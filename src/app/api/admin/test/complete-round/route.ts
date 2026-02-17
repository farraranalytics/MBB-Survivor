import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getTournamentStateServer } from '@/lib/status-server';
import {
  processCompletedGame,
  processMissedPicks,
  processNoAvailablePicks,
  checkForChampions,
  checkRoundCompletion,
  propagateWinner,
  createEmptyResults,
} from '@/lib/game-processing';
import { lookupRealResult } from '@/lib/test-results';

export async function POST(request: NextRequest) {
  // Auth: must be a pool creator
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: pools } = await supabase
    .from('pools')
    .select('id')
    .eq('creator_id', user.id)
    .limit(1);

  if (!pools || pools.length === 0) {
    return NextResponse.json({ error: 'Not a pool creator' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const mode = body.mode || 'real_results'; // 'real_results', 'favorites', 'random'
    const roundId = body.roundId; // Optional — defaults to current round

    // Get target round
    let activeRound;
    if (roundId) {
      const { data: round } = await supabaseAdmin
        .from('rounds')
        .select('id, name, date')
        .eq('id', roundId)
        .single();
      if (!round) return NextResponse.json({ error: 'Round not found' }, { status: 404 });
      activeRound = round;
    } else {
      const state = await getTournamentStateServer();
      if (!state.currentRound) {
        return NextResponse.json({ error: 'No current round' }, { status: 400 });
      }
      activeRound = { id: state.currentRound.id, name: state.currentRound.name, date: state.currentRound.date };
    }

    // Get all non-final games for this round (skip shells missing teams)
    const { data: pendingGames } = await supabaseAdmin
      .from('games')
      .select(`
        id, team1_id, team2_id, status, game_datetime,
        team1:team1_id(id, abbreviation, seed),
        team2:team2_id(id, abbreviation, seed)
      `)
      .eq('round_id', activeRound.id)
      .in('status', ['scheduled', 'in_progress'])
      .not('team1_id', 'is', null)
      .not('team2_id', 'is', null)
      .order('game_datetime', { ascending: true });

    if (!pendingGames || pendingGames.length === 0) {
      return NextResponse.json({ message: 'No pending games in this round' });
    }

    const results = createEmptyResults();
    const gameResults: any[] = [];

    for (const game of pendingGames) {
      const team1 = (game as any).team1;
      const team2 = (game as any).team2;

      let winnerId: string;
      let team1Score: number;
      let team2Score: number;

      if (mode === 'real_results' && team1 && team2) {
        // Look up real 2025 result
        const result = lookupRealResult(team1.abbreviation, team2.abbreviation);
        if (result) {
          winnerId = result.winner === team1.abbreviation ? game.team1_id : game.team2_id;
          if (winnerId === game.team1_id) {
            team1Score = result.winnerScore;
            team2Score = result.loserScore;
          } else {
            team1Score = result.loserScore;
            team2Score = result.winnerScore;
          }
        } else {
          // No real result — fall back to favorites
          const seed1 = team1?.seed ?? 8;
          const seed2 = team2?.seed ?? 8;
          winnerId = seed1 <= seed2 ? game.team1_id : game.team2_id;
          const ws = Math.floor(Math.random() * 26) + 70;
          const ls = Math.floor(Math.random() * 21) + 50;
          team1Score = winnerId === game.team1_id ? ws : ls;
          team2Score = winnerId === game.team2_id ? ws : ls;
        }
      } else if (mode === 'random') {
        winnerId = Math.random() > 0.5 ? game.team1_id : game.team2_id;
        const ws = Math.floor(Math.random() * 26) + 70;
        const ls = Math.floor(Math.random() * 21) + 50;
        team1Score = winnerId === game.team1_id ? ws : ls;
        team2Score = winnerId === game.team2_id ? ws : ls;
      } else {
        // Favorites: lower seed number wins (1 beats 16)
        const seed1 = team1?.seed ?? 8;
        const seed2 = team2?.seed ?? 8;
        winnerId = seed1 <= seed2 ? game.team1_id : game.team2_id;
        const ws = Math.floor(Math.random() * 26) + 70;
        const ls = Math.floor(Math.random() * 21) + 50;
        team1Score = winnerId === game.team1_id ? ws : ls;
        team2Score = winnerId === game.team2_id ? ws : ls;
      }

      const loserId = winnerId === game.team1_id ? game.team2_id : game.team1_id;

      // Update game — NEVER touch game_datetime
      await supabaseAdmin
        .from('games')
        .update({
          status: 'final',
          winner_id: winnerId,
          team1_score: team1Score,
          team2_score: team2Score,
        })
        .eq('id', game.id);

      // Process picks and eliminations
      await processCompletedGame(activeRound.id, winnerId, loserId, results);

      // Propagate winner to next-round game slot
      await propagateWinner(game.id, winnerId);

      gameResults.push({
        gameId: game.id,
        winner: winnerId,
        loser: loserId,
        winnerAbbr: winnerId === game.team1_id ? team1?.abbreviation : team2?.abbreviation,
        score: `${team1Score}-${team2Score}`,
      });
    }

    // All games done — process missed picks, no-available-picks, champions, round completion
    await processMissedPicks(activeRound.id, results);
    await processNoAvailablePicks(activeRound.id, results);
    await checkForChampions(activeRound.id, results);
    await checkRoundCompletion(activeRound.id, results);

    return NextResponse.json({
      success: true,
      round: activeRound.name,
      mode,
      gamesCompleted: gameResults.length,
      gameResults,
      results,
    });

  } catch (err: any) {
    console.error('complete-round error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

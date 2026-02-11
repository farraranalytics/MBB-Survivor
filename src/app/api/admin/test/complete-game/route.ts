import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  processCompletedGame,
  processMissedPicks,
  checkRoundCompletion,
  cascadeGameResult,
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
    const body = await request.json();
    const { gameId, winnerId, useRealResults } = body;

    if (!gameId) {
      return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
    }

    // Get the game with team info
    const { data: game } = await supabaseAdmin
      .from('games')
      .select(`
        id, round_id, team1_id, team2_id, status,
        team1:team1_id(id, abbreviation, seed),
        team2:team2_id(id, abbreviation, seed)
      `)
      .eq('id', gameId)
      .single();

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (game.status === 'final') {
      return NextResponse.json({ error: 'Game is already final' }, { status: 400 });
    }

    const team1 = (game as any).team1;
    const team2 = (game as any).team2;

    let resolvedWinnerId: string;
    let team1Score: number;
    let team2Score: number;

    if (useRealResults && team1 && team2) {
      // Look up real 2025 results
      const result = lookupRealResult(team1.abbreviation, team2.abbreviation);
      if (result) {
        // Determine which DB team is the winner
        resolvedWinnerId = result.winner === team1.abbreviation ? game.team1_id : game.team2_id;
        // Assign scores correctly
        if (resolvedWinnerId === game.team1_id) {
          team1Score = result.winnerScore;
          team2Score = result.loserScore;
        } else {
          team1Score = result.loserScore;
          team2Score = result.winnerScore;
        }
      } else {
        // No real result found — fall back to favorites or winnerId
        if (winnerId) {
          resolvedWinnerId = winnerId;
        } else {
          // Favorites: lower seed wins
          const seed1 = team1?.seed ?? 8;
          const seed2 = team2?.seed ?? 8;
          resolvedWinnerId = seed1 <= seed2 ? game.team1_id : game.team2_id;
        }
        const winnerScore = Math.floor(Math.random() * 26) + 70;
        const loserScore = Math.floor(Math.random() * 21) + 50;
        team1Score = resolvedWinnerId === game.team1_id ? winnerScore : loserScore;
        team2Score = resolvedWinnerId === game.team2_id ? winnerScore : loserScore;
      }
    } else if (winnerId) {
      // Manual winner selection
      if (winnerId !== game.team1_id && winnerId !== game.team2_id) {
        return NextResponse.json({ error: 'winnerId must be team1_id or team2_id' }, { status: 400 });
      }
      resolvedWinnerId = winnerId;
      const winnerScore = Math.floor(Math.random() * 26) + 70;
      const loserScore = Math.floor(Math.random() * 21) + 50;
      team1Score = resolvedWinnerId === game.team1_id ? winnerScore : loserScore;
      team2Score = resolvedWinnerId === game.team2_id ? winnerScore : loserScore;
    } else {
      return NextResponse.json({ error: 'winnerId or useRealResults is required' }, { status: 400 });
    }

    const loserId = resolvedWinnerId === game.team1_id ? game.team2_id : game.team1_id;

    // 1. Update game to final — NEVER touch game_datetime
    await supabaseAdmin
      .from('games')
      .update({
        status: 'final',
        winner_id: resolvedWinnerId,
        team1_score: team1Score,
        team2_score: team2Score,
      })
      .eq('id', gameId);

    // 2. Process picks and eliminations
    const results = createEmptyResults();
    await processCompletedGame(game.round_id, resolvedWinnerId, loserId, results);

    // 3. Cascade: create/populate next-round game
    await cascadeGameResult(gameId, resolvedWinnerId, results);

    // 4. Check round completion (missed picks, pool advancement)
    await processMissedPicks(game.round_id, results);
    await checkRoundCompletion(game.round_id, results);

    return NextResponse.json({
      success: true,
      game: {
        id: gameId,
        winner: resolvedWinnerId,
        loser: loserId,
        score: `${team1Score}-${team2Score}`,
      },
      results,
    });

  } catch (err: any) {
    console.error('complete-game error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

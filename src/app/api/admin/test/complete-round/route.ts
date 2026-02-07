import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  processCompletedGame,
  processMissedPicks,
  checkRoundCompletion,
  createEmptyResults,
} from '@/lib/game-processing';

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
    const mode = body.mode || 'favorites'; // 'favorites' = higher seed wins, 'random' = coin flip

    // Get active round
    const { data: activeRound } = await supabaseAdmin
      .from('rounds')
      .select('id, name, date')
      .eq('is_active', true)
      .single();

    if (!activeRound) {
      return NextResponse.json({ error: 'No active round' }, { status: 400 });
    }

    // Get all non-final games for this round
    const { data: pendingGames } = await supabaseAdmin
      .from('games')
      .select(`
        id, team1_id, team2_id, status,
        team1:team1_id(seed),
        team2:team2_id(seed)
      `)
      .eq('round_id', activeRound.id)
      .in('status', ['scheduled', 'in_progress']);

    if (!pendingGames || pendingGames.length === 0) {
      return NextResponse.json({ message: 'No pending games in active round' });
    }

    const results = createEmptyResults();
    const gameResults: any[] = [];

    for (const game of pendingGames) {
      // Determine winner based on mode
      let winnerId: string;
      let loserId: string;

      if (mode === 'random') {
        // Coin flip
        winnerId = Math.random() > 0.5 ? game.team1_id : game.team2_id;
      } else {
        // Favorites: lower seed number wins (1 beats 16)
        const seed1 = (game as any).team1?.seed ?? 8;
        const seed2 = (game as any).team2?.seed ?? 8;
        winnerId = seed1 <= seed2 ? game.team1_id : game.team2_id;
      }
      loserId = winnerId === game.team1_id ? game.team2_id : game.team1_id;

      // Generate fake scores
      const winnerScore = Math.floor(Math.random() * 26) + 70;
      const loserScore = Math.floor(Math.random() * 21) + 50;
      const team1Score = winnerId === game.team1_id ? winnerScore : loserScore;
      const team2Score = winnerId === game.team2_id ? winnerScore : loserScore;

      // Update game
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

      gameResults.push({
        gameId: game.id,
        winner: winnerId,
        loser: loserId,
        score: `${team1Score}-${team2Score}`,
      });
    }

    // All games done — process missed picks + round completion
    await processMissedPicks(activeRound.id, results);
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

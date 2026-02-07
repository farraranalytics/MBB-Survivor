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
    const { gameId, winnerId } = await request.json();

    if (!gameId || !winnerId) {
      return NextResponse.json({ error: 'gameId and winnerId are required' }, { status: 400 });
    }

    // Get the game
    const { data: game } = await supabaseAdmin
      .from('games')
      .select('id, round_id, team1_id, team2_id, status')
      .eq('id', gameId)
      .single();

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (game.status === 'final') {
      return NextResponse.json({ error: 'Game is already final' }, { status: 400 });
    }

    // Validate winnerId is one of the two teams
    if (winnerId !== game.team1_id && winnerId !== game.team2_id) {
      return NextResponse.json({ error: 'winnerId must be team1_id or team2_id' }, { status: 400 });
    }

    const loserId = winnerId === game.team1_id ? game.team2_id : game.team1_id;

    // Generate fake scores (winner gets 70-95, loser gets 50-70)
    const winnerScore = Math.floor(Math.random() * 26) + 70;
    const loserScore = Math.floor(Math.random() * 21) + 50;

    const team1Score = winnerId === game.team1_id ? winnerScore : loserScore;
    const team2Score = winnerId === game.team2_id ? winnerScore : loserScore;

    // Update game to final
    await supabaseAdmin
      .from('games')
      .update({
        status: 'final',
        winner_id: winnerId,
        team1_score: team1Score,
        team2_score: team2Score,
      })
      .eq('id', gameId);

    // Process picks and eliminations using the SAME logic as the real cron
    const results = createEmptyResults();
    await processCompletedGame(game.round_id, winnerId, loserId, results);

    // Check if all games in round are now final → process missed picks + round completion
    await processMissedPicks(game.round_id, results);
    await checkRoundCompletion(game.round_id, results);

    return NextResponse.json({
      success: true,
      game: {
        id: gameId,
        winner: winnerId,
        score: `${team1Score}-${team2Score}`,
      },
      results,
    });

  } catch (err: any) {
    console.error('complete-game error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

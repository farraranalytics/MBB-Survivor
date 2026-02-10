import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getTournamentStateServer } from '@/lib/status-server';
import {
  processCompletedGame,
  processMissedPicks,
  checkRoundCompletion,
  createEmptyResults,
} from '@/lib/game-processing';

type RoundState = 'pre_round' | 'round_started' | 'round_complete';

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
    const targetState = body.state as RoundState;

    if (!['pre_round', 'round_started', 'round_complete'].includes(targetState)) {
      return NextResponse.json({ error: 'Invalid state. Use: pre_round, round_started, round_complete' }, { status: 400 });
    }

    // Get current round
    const state = await getTournamentStateServer();
    if (!state.currentRound) {
      return NextResponse.json({ error: 'No current round' }, { status: 400 });
    }

    const roundId = state.currentRound.id;
    const roundName = state.currentRound.name;
    const now = new Date();

    if (targetState === 'pre_round') {
      return await setPreRound(roundId, roundName, now);
    } else if (targetState === 'round_started') {
      return await setRoundStarted(roundId, roundName, now);
    } else {
      return await setRoundComplete(roundId, roundName, now);
    }

  } catch (err: any) {
    console.error('set-round-state error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Pre Round: reset games, set datetimes to future ──────────────────
async function setPreRound(roundId: string, roundName: string, now: Date) {
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const deadlineTomorrow = new Date(tomorrow.getTime() - 5 * 60 * 1000);

  // Get games to find losers for un-elimination
  const { data: games } = await supabaseAdmin
    .from('games')
    .select('id, team1_id, team2_id, winner_id')
    .eq('round_id', roundId);

  const loserIds: string[] = [];
  for (const game of (games || [])) {
    if (game.winner_id) {
      const loserId = game.winner_id === game.team1_id ? game.team2_id : game.team1_id;
      loserIds.push(loserId);
    }
  }

  // 1. Reset all games to scheduled, set game_datetime to tomorrow
  await supabaseAdmin
    .from('games')
    .update({
      status: 'scheduled',
      winner_id: null,
      team1_score: null,
      team2_score: null,
      game_datetime: tomorrow.toISOString(),
    })
    .eq('round_id', roundId);

  // 2. Update rounds.deadline_datetime to future
  await supabaseAdmin
    .from('rounds')
    .update({ deadline_datetime: deadlineTomorrow.toISOString() })
    .eq('id', roundId);

  // 3. Un-eliminate teams that lost in this round
  if (loserIds.length > 0) {
    await supabaseAdmin
      .from('teams')
      .update({ is_eliminated: false })
      .in('id', loserIds);
  }

  // 4. Clear pick results
  await supabaseAdmin
    .from('picks')
    .update({ is_correct: null })
    .eq('round_id', roundId);

  // 5. Un-eliminate players eliminated in this round
  const { data: revivedPlayers } = await supabaseAdmin
    .from('pool_players')
    .update({ is_eliminated: false, elimination_round_id: null, elimination_reason: null })
    .eq('elimination_round_id', roundId)
    .select('id');

  // 6. Revert pools back to active
  await supabaseAdmin
    .from('pools')
    .update({ status: 'active', winner_id: null })
    .eq('status', 'complete');

  return NextResponse.json({
    success: true,
    state: 'pre_round',
    round: roundName,
    description: 'Picks OPEN, deadline in future, other picks HIDDEN',
    gamesReset: games?.length || 0,
    teamsRevived: loserIds.length,
    playersRevived: revivedPlayers?.length || 0,
  });
}

// ── Round Started: set datetimes to past, games to in_progress ───────
async function setRoundStarted(roundId: string, roundName: string, now: Date) {
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);

  // 1. Set game_datetime to past and status to in_progress (only scheduled games)
  await supabaseAdmin
    .from('games')
    .update({
      status: 'in_progress',
      game_datetime: tenMinAgo.toISOString(),
    })
    .eq('round_id', roundId)
    .eq('status', 'scheduled');

  // Also update game_datetime on already-in-progress games
  await supabaseAdmin
    .from('games')
    .update({ game_datetime: tenMinAgo.toISOString() })
    .eq('round_id', roundId)
    .eq('status', 'in_progress');

  // 2. Update rounds.deadline_datetime to past
  await supabaseAdmin
    .from('rounds')
    .update({ deadline_datetime: fifteenMinAgo.toISOString() })
    .eq('id', roundId);

  // Count updated games
  const { data: inProgressGames } = await supabaseAdmin
    .from('games')
    .select('id')
    .eq('round_id', roundId)
    .eq('status', 'in_progress');

  return NextResponse.json({
    success: true,
    state: 'round_started',
    round: roundName,
    description: 'Picks LOCKED, deadline passed, other picks VISIBLE',
    gamesInProgress: inProgressGames?.length || 0,
  });
}

// ── Round Complete: complete all games with winners, process results ──
async function setRoundComplete(roundId: string, roundName: string, now: Date) {
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const twoHoursAgoDeadline = new Date(twoHoursAgo.getTime() - 5 * 60 * 1000);

  // 1. Set game_datetime to past
  await supabaseAdmin
    .from('games')
    .update({ game_datetime: twoHoursAgo.toISOString() })
    .eq('round_id', roundId);

  // 2. Update rounds.deadline_datetime to past
  await supabaseAdmin
    .from('rounds')
    .update({ deadline_datetime: twoHoursAgoDeadline.toISOString() })
    .eq('id', roundId);

  // 3. Complete all non-final games (favorites mode: higher seed wins)
  const { data: pendingGames } = await supabaseAdmin
    .from('games')
    .select(`
      id, team1_id, team2_id, status,
      team1:team1_id(seed),
      team2:team2_id(seed)
    `)
    .eq('round_id', roundId)
    .in('status', ['scheduled', 'in_progress']);

  const results = createEmptyResults();
  const gameResults: any[] = [];

  for (const game of (pendingGames || [])) {
    const seed1 = (game as any).team1?.seed ?? 8;
    const seed2 = (game as any).team2?.seed ?? 8;
    const winnerId = seed1 <= seed2 ? game.team1_id : game.team2_id;
    const loserId = winnerId === game.team1_id ? game.team2_id : game.team1_id;

    const winnerScore = Math.floor(Math.random() * 26) + 70;
    const loserScore = Math.floor(Math.random() * 21) + 50;
    const team1Score = winnerId === game.team1_id ? winnerScore : loserScore;
    const team2Score = winnerId === game.team2_id ? winnerScore : loserScore;

    await supabaseAdmin
      .from('games')
      .update({
        status: 'final',
        winner_id: winnerId,
        team1_score: team1Score,
        team2_score: team2Score,
      })
      .eq('id', game.id);

    await processCompletedGame(roundId, winnerId, loserId, results);

    gameResults.push({
      gameId: game.id,
      winner: winnerId,
      score: `${team1Score}-${team2Score}`,
    });
  }

  // 4. Process missed picks + check round completion
  await processMissedPicks(roundId, results);
  await checkRoundCompletion(roundId, results);

  return NextResponse.json({
    success: true,
    state: 'round_complete',
    round: roundName,
    description: 'All games FINAL, picks graded, eliminations processed',
    gamesCompleted: gameResults.length,
    gameResults,
    results,
  });
}

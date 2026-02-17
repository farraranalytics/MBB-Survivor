import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getTournamentStateServer } from '@/lib/status-server';
import { clearServerClockCache } from '@/lib/clock-server';
import {
  processCompletedGame,
  processMissedPicks,
  processNoAvailablePicks,
  checkForChampions,
  checkRoundCompletion,
  propagateWinner,
  clearBracketAdvancement,
  createEmptyResults,
} from '@/lib/game-processing';
import { mapRoundNameToCode } from '@/lib/bracket';

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
    const roundId = body.roundId; // Optional — defaults to current round

    if (!['pre_round', 'round_started', 'round_complete'].includes(targetState)) {
      return NextResponse.json({ error: 'Invalid state. Use: pre_round, round_started, round_complete' }, { status: 400 });
    }

    // Get target round
    let targetRoundId: string;
    let roundName: string;
    let roundDate: string;
    let deadlineDatetime: string;

    if (roundId) {
      const { data: round } = await supabaseAdmin
        .from('rounds')
        .select('id, name, date, deadline_datetime')
        .eq('id', roundId)
        .single();
      if (!round) return NextResponse.json({ error: 'Round not found' }, { status: 404 });
      targetRoundId = round.id;
      roundName = round.name;
      roundDate = round.date;
      deadlineDatetime = round.deadline_datetime;
    } else {
      const state = await getTournamentStateServer();
      if (!state.currentRound) {
        return NextResponse.json({ error: 'No current round' }, { status: 400 });
      }
      targetRoundId = state.currentRound.id;
      roundName = state.currentRound.name;
      roundDate = state.currentRound.date;
      deadlineDatetime = state.currentRound.deadline;
    }

    // Map phase to simulated clock phase
    const phaseMap: Record<string, string> = {
      'pre_round': 'pre_round',
      'round_started': 'live',
      'round_complete': 'post_round',
    };
    const clockPhase = phaseMap[targetState];

    // Compute simulated datetime for the phase
    let simulatedDatetime: string;
    switch (clockPhase) {
      case 'pre_round':
        simulatedDatetime = `${roundDate}T12:00:00+00:00`; // 8 AM ET
        break;
      case 'live': {
        const deadline = new Date(deadlineDatetime);
        simulatedDatetime = new Date(deadline.getTime() + 60 * 60 * 1000).toISOString();
        break;
      }
      case 'post_round':
        simulatedDatetime = `${roundDate}T03:55:00+00:00`; // 11:55 PM ET
        break;
      default:
        simulatedDatetime = new Date().toISOString();
    }

    // 1. Update admin_test_state (simulated clock)
    await supabaseAdmin
      .from('admin_test_state')
      .update({
        is_test_mode: true,
        simulated_datetime: simulatedDatetime,
        target_round_id: targetRoundId,
        phase: clockPhase,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .not('id', 'is', null);

    clearServerClockCache();

    // 2. Set is_active on the target round, false on all others
    await supabaseAdmin
      .from('rounds')
      .update({ is_active: false })
      .neq('id', targetRoundId);

    await supabaseAdmin
      .from('rounds')
      .update({ is_active: true })
      .eq('id', targetRoundId);

    // 3. Handle game status changes based on target state
    if (targetState === 'pre_round') {
      return await handlePreRound(targetRoundId, roundName, simulatedDatetime);
    } else if (targetState === 'round_started') {
      return await handleRoundStarted(targetRoundId, roundName, simulatedDatetime);
    } else {
      return await handleRoundComplete(targetRoundId, roundName, simulatedDatetime);
    }

  } catch (err: any) {
    console.error('set-round-state error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Pre Round: reset games, simulated clock to before deadline ──────
async function handlePreRound(roundId: string, roundName: string, simulatedDatetime: string) {
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

  // Reset all games to scheduled — DO NOT touch game_datetime
  await supabaseAdmin
    .from('games')
    .update({
      status: 'scheduled',
      winner_id: null,
      team1_score: null,
      team2_score: null,
    })
    .eq('round_id', roundId);

  // Clear downstream bracket slots (e.g. R64 reset → clear R32+ team slots)
  const roundCode = mapRoundNameToCode(roundName);
  const shellsCleared = await clearBracketAdvancement(roundCode);

  // Un-eliminate teams
  if (loserIds.length > 0) {
    await supabaseAdmin
      .from('teams')
      .update({ is_eliminated: false })
      .in('id', loserIds);
  }

  // Delete picks for this round (picks are leaf records, safe to delete)
  const { data: deletedPicks } = await supabaseAdmin
    .from('picks')
    .delete()
    .eq('round_id', roundId)
    .select('id');

  // Un-eliminate players
  const { data: revivedPlayers } = await supabaseAdmin
    .from('pool_players')
    .update({ is_eliminated: false, elimination_round_id: null, elimination_reason: null })
    .eq('elimination_round_id', roundId)
    .eq('entry_deleted', false)
    .select('id');

  // Revert pools
  await supabaseAdmin
    .from('pools')
    .update({ status: 'active', winner_id: null })
    .eq('status', 'complete');

  // Re-propagate winners from prior round into this round's team slots
  // A previous reset may have cleared these slots; fill them from completed feeder games.
  const gameIdsInScope = new Set((games || []).map(g => g.id));
  const { data: feederGames } = await supabaseAdmin
    .from('games')
    .select('id, winner_id, advances_to_game_id, advances_to_slot')
    .not('winner_id', 'is', null)
    .not('advances_to_game_id', 'is', null);

  let repropagated = 0;
  for (const fg of (feederGames || [])) {
    if (gameIdsInScope.has(fg.advances_to_game_id)) {
      const field = fg.advances_to_slot === 1 ? 'team1_id' : 'team2_id';
      await supabaseAdmin
        .from('games')
        .update({ [field]: fg.winner_id })
        .eq('id', fg.advances_to_game_id);
      repropagated++;
    }
  }

  return NextResponse.json({
    success: true,
    state: 'pre_round',
    round: roundName,
    simulatedDatetime,
    description: 'Simulated clock set to pre-deadline. Picks OPEN, other picks HIDDEN.',
    gamesReset: games?.length || 0,
    teamsRevived: loserIds.length,
    playersRevived: revivedPlayers?.length || 0,
    shellGamesCleared: shellsCleared,
    picksDeleted: deletedPicks?.length || 0,
    teamsRepropagated: repropagated,
  });
}

// ── Round Started: set games to in_progress via simulated clock ──────
async function handleRoundStarted(roundId: string, roundName: string, simulatedDatetime: string) {
  // Set scheduled games to in_progress (simulates games starting)
  await supabaseAdmin
    .from('games')
    .update({ status: 'in_progress' })
    .eq('round_id', roundId)
    .eq('status', 'scheduled');

  const { data: inProgressGames } = await supabaseAdmin
    .from('games')
    .select('id')
    .eq('round_id', roundId)
    .eq('status', 'in_progress');

  return NextResponse.json({
    success: true,
    state: 'round_started',
    round: roundName,
    simulatedDatetime,
    description: 'Simulated clock set to post-deadline. Picks LOCKED, other picks VISIBLE.',
    gamesInProgress: inProgressGames?.length || 0,
  });
}

// ── Round Complete: complete all games, process results ──────────────
async function handleRoundComplete(roundId: string, roundName: string, simulatedDatetime: string) {
  // Complete all non-final games that have both teams (skip shells missing teams)
  const { data: pendingGames } = await supabaseAdmin
    .from('games')
    .select(`
      id, team1_id, team2_id, status,
      team1:team1_id(seed, abbreviation),
      team2:team2_id(seed, abbreviation)
    `)
    .eq('round_id', roundId)
    .in('status', ['scheduled', 'in_progress'])
    .not('team1_id', 'is', null)
    .not('team2_id', 'is', null);

  const results = createEmptyResults();
  const gameResults: any[] = [];

  for (const game of (pendingGames || [])) {
    const team1 = (game as any).team1;
    const team2 = (game as any).team2;

    // Try real results first, fall back to favorites
    let winnerId: string;
    let team1Score: number;
    let team2Score: number;

    const { lookupRealResult } = await import('@/lib/test-results');
    const result = team1 && team2 ? lookupRealResult(team1.abbreviation, team2.abbreviation) : null;

    if (result) {
      winnerId = result.winner === team1?.abbreviation ? game.team1_id : game.team2_id;
      if (winnerId === game.team1_id) {
        team1Score = result.winnerScore;
        team2Score = result.loserScore;
      } else {
        team1Score = result.loserScore;
        team2Score = result.winnerScore;
      }
    } else {
      const seed1 = team1?.seed ?? 8;
      const seed2 = team2?.seed ?? 8;
      winnerId = seed1 <= seed2 ? game.team1_id : game.team2_id;
      const ws = Math.floor(Math.random() * 26) + 70;
      const ls = Math.floor(Math.random() * 21) + 50;
      team1Score = winnerId === game.team1_id ? ws : ls;
      team2Score = winnerId === game.team2_id ? ws : ls;
    }

    const loserId = winnerId === game.team1_id ? game.team2_id : game.team1_id;

    // NEVER touch game_datetime
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
    await propagateWinner(game.id, winnerId);

    gameResults.push({
      gameId: game.id,
      winner: winnerId,
      score: `${team1Score}-${team2Score}`,
    });
  }

  await processMissedPicks(roundId, results);
  await processNoAvailablePicks(roundId, results);
  await checkForChampions(roundId, results);
  await checkRoundCompletion(roundId, results);

  return NextResponse.json({
    success: true,
    state: 'round_complete',
    round: roundName,
    simulatedDatetime,
    description: 'Simulated clock set to post-round. All games FINAL, picks graded.',
    gamesCompleted: gameResults.length,
    gameResults,
    results,
  });
}

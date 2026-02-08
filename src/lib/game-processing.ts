// Shared game result processing logic used by both:
// - /api/cron/process-results (real ESPN flow)
// - /api/admin/test/* (manual test flow)

import { supabaseAdmin } from '@/lib/supabase/admin';

export interface ProcessingResults {
  gamesCompleted: number;
  picksMarkedCorrect: number;
  picksMarkedIncorrect: number;
  playersEliminated: number;
  missedPickEliminations: number;
  roundsCompleted: number;
  poolsCompleted: number;
  errors: string[];
}

export function createEmptyResults(): ProcessingResults {
  return {
    gamesCompleted: 0,
    picksMarkedCorrect: 0,
    picksMarkedIncorrect: 0,
    playersEliminated: 0,
    missedPickEliminations: 0,
    roundsCompleted: 0,
    poolsCompleted: 0,
    errors: [],
  };
}

/**
 * Process a single completed game: mark picks correct/incorrect, eliminate losers.
 * Called after a game is set to 'final' with a winner_id.
 */
export async function processCompletedGame(
  roundId: string,
  winnerId: string,
  loserId: string,
  results: ProcessingResults
) {
  results.gamesCompleted++;

  // Mark winning picks correct
  const { data: correctPicks } = await supabaseAdmin
    .from('picks')
    .update({ is_correct: true })
    .eq('round_id', roundId)
    .eq('team_id', winnerId)
    .is('is_correct', null)
    .select('id');
  results.picksMarkedCorrect += correctPicks?.length || 0;

  // Mark losing picks incorrect
  const { data: incorrectPicks } = await supabaseAdmin
    .from('picks')
    .update({ is_correct: false })
    .eq('round_id', roundId)
    .eq('team_id', loserId)
    .is('is_correct', null)
    .select('pool_player_id');
  results.picksMarkedIncorrect += incorrectPicks?.length || 0;

  // Eliminate losing team from tournament
  await supabaseAdmin
    .from('teams')
    .update({ is_eliminated: true })
    .eq('id', loserId);

  // Eliminate players who picked the loser
  if (incorrectPicks && incorrectPicks.length > 0) {
    const poolPlayerIds = incorrectPicks.map(p => p.pool_player_id);

    const { data: eliminated } = await supabaseAdmin
      .from('pool_players')
      .update({
        is_eliminated: true,
        elimination_round_id: roundId,
        elimination_reason: 'wrong_pick',
      })
      .in('id', poolPlayerIds)
      .eq('is_eliminated', false)
      .select('id');
    results.playersEliminated += eliminated?.length || 0;
  }
}

/**
 * After ALL games in a round are final, eliminate players who didn't submit a pick.
 */
export async function processMissedPicks(
  roundId: string,
  results: ProcessingResults
) {
  // Check if all games in this round are final
  const { data: pendingGames } = await supabaseAdmin
    .from('games')
    .select('id')
    .eq('round_id', roundId)
    .in('status', ['scheduled', 'in_progress']);

  if (pendingGames && pendingGames.length > 0) {
    return; // Still games in progress
  }

  const { data: alivePlayers } = await supabaseAdmin
    .from('pool_players')
    .select('id, pool_id')
    .eq('is_eliminated', false);

  if (!alivePlayers || alivePlayers.length === 0) return;

  const alivePlayerIds = alivePlayers.map(p => p.id);
  const { data: picksForRound } = await supabaseAdmin
    .from('picks')
    .select('pool_player_id')
    .eq('round_id', roundId)
    .in('pool_player_id', alivePlayerIds);

  const playerIdsWithPicks = new Set(picksForRound?.map(p => p.pool_player_id) || []);
  const playersWithoutPicks = alivePlayers.filter(p => !playerIdsWithPicks.has(p.id));

  if (playersWithoutPicks.length === 0) return;

  const missedIds = playersWithoutPicks.map(p => p.id);
  const { data: missedEliminated } = await supabaseAdmin
    .from('pool_players')
    .update({
      is_eliminated: true,
      elimination_round_id: roundId,
      elimination_reason: 'missed_pick',
    })
    .in('id', missedIds)
    .eq('is_eliminated', false)
    .select('id');

  results.missedPickEliminations = missedEliminated?.length || 0;
}

/**
 * Check if a round is complete (all games final) and handle advancement.
 */
export async function checkRoundCompletion(
  roundId: string,
  results: ProcessingResults
) {
  const { data: nonFinalGames } = await supabaseAdmin
    .from('games')
    .select('id')
    .eq('round_id', roundId)
    .neq('status', 'final');

  if (nonFinalGames && nonFinalGames.length > 0) {
    return;
  }

  // Round is complete — deactivate it
  await supabaseAdmin
    .from('rounds')
    .update({ is_active: false })
    .eq('id', roundId);
  results.roundsCompleted++;

  // Check if this was the LAST round
  const { data: currentRound } = await supabaseAdmin
    .from('rounds')
    .select('date')
    .eq('id', roundId)
    .single();

  const { data: futureRounds } = await supabaseAdmin
    .from('rounds')
    .select('id, name, date')
    .gt('date', currentRound?.date || '')
    .order('date', { ascending: true });

  if (!futureRounds || futureRounds.length === 0) {
    // Tournament is over — complete all active pools
    const { data: pools } = await supabaseAdmin
      .from('pools')
      .select('id')
      .eq('status', 'active');

    for (const pool of (pools || [])) {
      const { data: alivePlayers } = await supabaseAdmin
        .from('pool_players')
        .select('user_id')
        .eq('pool_id', pool.id)
        .eq('is_eliminated', false)
        .limit(1);

      const winnerId = alivePlayers?.[0]?.user_id || null;

      await supabaseAdmin
        .from('pools')
        .update({ status: 'complete', winner_id: winnerId })
        .eq('id', pool.id);
      results.poolsCompleted++;
    }
  } else {
    // Auto-advance: activate the next round so users can start picking
    const nextRound = futureRounds[0];
    await supabaseAdmin
      .from('rounds')
      .update({ is_active: true })
      .eq('id', nextRound.id);
  }
}

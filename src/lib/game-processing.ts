// Shared game result processing logic used by both:
// - /api/cron/process-results (real ESPN flow)
// - /api/admin/test/* (manual test flow)

import { supabaseAdmin } from '@/lib/supabase/admin';
import { getEffectiveNowServer } from '@/lib/clock-server';
import { sendBulkNotifications } from '@/lib/notifications';

export interface ProcessingResults {
  gamesCompleted: number;
  picksMarkedCorrect: number;
  picksMarkedIncorrect: number;
  playersEliminated: number;
  missedPickEliminations: number;
  noAvailablePickEliminations: number;
  championsDeclared: number;
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
    noAvailablePickEliminations: 0,
    championsDeclared: 0,
    roundsCompleted: 0,
    poolsCompleted: 0,
    errors: [],
  };
}

/**
 * Delete picks for future unlocked rounds when entries are eliminated.
 * Safe to delete picks — they are leaf records with no FK dependencies.
 */
export async function deleteFuturePicksForEntries(
  poolPlayerIds: string[]
): Promise<number> {
  if (poolPlayerIds.length === 0) return 0;

  // Find rounds where earliest game deadline > now (still unlocked)
  const { data: allRounds } = await supabaseAdmin
    .from('rounds')
    .select('id');

  if (!allRounds || allRounds.length === 0) return 0;

  const effectiveNow = await getEffectiveNowServer();
  const now = effectiveNow.getTime();
  const futureRoundIds: string[] = [];

  for (const round of allRounds) {
    const { data: games } = await supabaseAdmin
      .from('games')
      .select('game_datetime')
      .eq('round_id', round.id)
      .not('game_datetime', 'is', null)
      .order('game_datetime', { ascending: true })
      .limit(1);

    if (games && games.length > 0) {
      const deadline = new Date(games[0].game_datetime).getTime() - 5 * 60 * 1000;
      if (now < deadline) {
        futureRoundIds.push(round.id);
      }
    }
  }

  if (futureRoundIds.length === 0) return 0;

  const { data: deleted } = await supabaseAdmin
    .from('picks')
    .delete()
    .in('pool_player_id', poolPlayerIds)
    .in('round_id', futureRoundIds)
    .select('id');

  return deleted?.length || 0;
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

    // Delete future round picks for eliminated entries
    if (eliminated && eliminated.length > 0) {
      await deleteFuturePicksForEntries(eliminated.map(e => e.id));
    }
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
    .eq('is_eliminated', false)
    .eq('entry_deleted', false);

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

  // Delete future round picks for eliminated entries
  if (missedEliminated && missedEliminated.length > 0) {
    await deleteFuturePicksForEntries(missedEliminated.map(e => e.id));
  }
}

/**
 * After a round completes, auto-eliminate entries that have no available teams for the next round.
 * Runs after processMissedPicks so only still-alive entries are checked.
 * Uses completedRoundId for elimination_round_id (they were eliminated as a result of this round).
 */
export async function processNoAvailablePicks(
  completedRoundId: string,
  results: ProcessingResults
) {
  // Find the next round by date
  const { data: completedRound } = await supabaseAdmin
    .from('rounds')
    .select('date')
    .eq('id', completedRoundId)
    .single();

  if (!completedRound) return;

  const { data: nextRound } = await supabaseAdmin
    .from('rounds')
    .select('id')
    .gt('date', completedRound.date)
    .order('date', { ascending: true })
    .limit(1)
    .single();

  if (!nextRound) return; // No next round — tournament ending, skip

  // Get games in next round with both teams populated (winners already propagated)
  const { data: nextRoundGames } = await supabaseAdmin
    .from('games')
    .select('team1_id, team2_id')
    .eq('round_id', nextRound.id)
    .not('team1_id', 'is', null)
    .not('team2_id', 'is', null);

  if (!nextRoundGames || nextRoundGames.length === 0) return;

  // Collect available team IDs
  const availableTeamIds = new Set<string>();
  for (const g of nextRoundGames) {
    availableTeamIds.add(g.team1_id);
    availableTeamIds.add(g.team2_id);
  }

  // Get alive entries
  const { data: alivePlayers } = await supabaseAdmin
    .from('pool_players')
    .select('id')
    .eq('is_eliminated', false)
    .eq('entry_deleted', false);

  if (!alivePlayers || alivePlayers.length === 0) return;

  // Get all picks for alive entries to find used teams
  const aliveIds = alivePlayers.map(p => p.id);
  const { data: allPicks } = await supabaseAdmin
    .from('picks')
    .select('pool_player_id, team_id')
    .in('pool_player_id', aliveIds);

  // Build map: entry → set of used team IDs
  const usedTeams = new Map<string, Set<string>>();
  for (const pick of (allPicks || [])) {
    if (!usedTeams.has(pick.pool_player_id)) {
      usedTeams.set(pick.pool_player_id, new Set());
    }
    usedTeams.get(pick.pool_player_id)!.add(pick.team_id);
  }

  // Find entries with no available picks
  const stuckIds: string[] = [];
  for (const player of alivePlayers) {
    const used = usedTeams.get(player.id) || new Set();
    const hasAvailable = [...availableTeamIds].some(tid => !used.has(tid));
    if (!hasAvailable) {
      stuckIds.push(player.id);
    }
  }

  if (stuckIds.length === 0) return;

  // Eliminate — tagged with completed round (they were eliminated as a result of this round)
  const { data: eliminated } = await supabaseAdmin
    .from('pool_players')
    .update({
      is_eliminated: true,
      elimination_round_id: completedRoundId,
      elimination_reason: 'no_available_picks',
    })
    .in('id', stuckIds)
    .eq('is_eliminated', false)
    .select('id, user_id, pool_id');

  results.noAvailablePickEliminations = eliminated?.length || 0;

  // Delete future round picks for eliminated entries
  if (eliminated && eliminated.length > 0) {
    await deleteFuturePicksForEntries(eliminated.map(e => e.id));
  }

  // Notify eliminated players
  if (eliminated && eliminated.length > 0) {
    const poolIds = [...new Set(eliminated.map(e => e.pool_id))];
    const { data: pools } = await supabaseAdmin
      .from('pools')
      .select('id, name')
      .in('id', poolIds);
    const poolMap = new Map(pools?.map(p => [p.id, p.name]) || []);

    const notifs = eliminated.map(e => ({
      userId: e.user_id,
      title: 'Ran Out of Teams',
      message: `You have no remaining teams to pick and have been eliminated from ${poolMap.get(e.pool_id) || 'your pool'}.`,
      url: `/pools/${e.pool_id}/standings`,
      type: 'game_result' as const,
      poolId: e.pool_id,
    }));
    sendBulkNotifications(notifs).catch(() => {});
  }
}

/**
 * After all eliminations, check if any pool has a sole champion or a tie.
 * - 1 alive → sole champion, complete pool
 * - 0 alive → tie: un-eliminate entries from this round, they're co-champions
 * - >1 alive → continue
 */
export async function checkForChampions(
  roundId: string,
  results: ProcessingResults
) {
  const { data: activePools } = await supabaseAdmin
    .from('pools')
    .select('id, name')
    .eq('status', 'active');

  if (!activePools || activePools.length === 0) return;

  for (const pool of activePools) {
    const { data: aliveEntries } = await supabaseAdmin
      .from('pool_players')
      .select('id, user_id')
      .eq('pool_id', pool.id)
      .eq('is_eliminated', false)
      .eq('entry_deleted', false);

    const aliveCount = aliveEntries?.length || 0;

    if (aliveCount === 1) {
      // Sole champion
      await supabaseAdmin
        .from('pools')
        .update({ status: 'complete', winner_id: aliveEntries![0].user_id })
        .eq('id', pool.id);
      results.championsDeclared++;
      results.poolsCompleted++;

      // Notify the champion
      sendBulkNotifications([{
        userId: aliveEntries![0].user_id,
        title: 'Champion!',
        message: `You are the champion of ${pool.name}!`,
        url: `/pools/${pool.id}/standings`,
        type: 'pool_event',
        poolId: pool.id,
      }]).catch(() => {});
    } else if (aliveCount === 0) {
      // TIE — un-eliminate entries from this round using priority tiers:
      // Tier 1: wrong_pick / no_available_picks (actively playing)
      // Tier 2: missed_pick (forfeited — only if tier 1 is empty)
      const { data: allElimThisRound } = await supabaseAdmin
        .from('pool_players')
        .select('id, user_id, elimination_reason')
        .eq('pool_id', pool.id)
        .eq('elimination_round_id', roundId)
        .eq('entry_deleted', false);

      if (allElimThisRound && allElimThisRound.length > 0) {
        // Prefer entries that actually picked (wrong_pick) over those who didn't participate
        const activePlayers = allElimThisRound.filter(
          e => e.elimination_reason === 'wrong_pick'
        );
        const tiedEntries = activePlayers.length > 0 ? activePlayers : allElimThisRound;

        const tiedIds = tiedEntries.map(e => e.id);
        await supabaseAdmin
          .from('pool_players')
          .update({
            is_eliminated: false,
            elimination_round_id: null,
            elimination_reason: null,
          })
          .in('id', tiedIds);

        // Complete pool — winner_id = first champion (backward compat), real truth = alive entries
        await supabaseAdmin
          .from('pools')
          .update({ status: 'complete', winner_id: tiedEntries[0].user_id })
          .eq('id', pool.id);
        results.championsDeclared += tiedEntries.length;
        results.poolsCompleted++;

        // Notify co-champions
        const coChampNotifs = tiedEntries.map(e => ({
          userId: e.user_id,
          title: 'Co-Champion!',
          message: `You are a co-champion of ${pool.name}!`,
          url: `/pools/${pool.id}/standings`,
          type: 'pool_event' as const,
          poolId: pool.id,
        }));
        sendBulkNotifications(coChampNotifs).catch(() => {});
      }
    }
    // aliveCount > 1: tournament continues, no action
  }
}

// ─── Pre-Generated Bracket: Winner Propagation ──────────────────

/** Round ordering for clearBracketAdvancement */
const ROUND_ORDER = ['R64', 'R32', 'S16', 'E8', 'F4', 'CHIP'];

/**
 * Propagate a game's winner into the next round's team slot.
 * Uses advances_to_game_id + advances_to_slot from the pre-generated bracket.
 */
export async function propagateWinner(
  gameId: string,
  winnerId: string,
): Promise<void> {
  const { data: game } = await supabaseAdmin
    .from('games')
    .select('advances_to_game_id, advances_to_slot')
    .eq('id', gameId)
    .single();

  if (!game?.advances_to_game_id || !game?.advances_to_slot) return;

  const field = game.advances_to_slot === 1 ? 'team1_id' : 'team2_id';
  await supabaseAdmin
    .from('games')
    .update({ [field]: winnerId })
    .eq('id', game.advances_to_game_id);
}

/**
 * Clear team slots in rounds AFTER the given round code.
 * Keeps shell games intact, just NULLs team/score/winner data.
 */
export async function clearBracketAdvancement(fromRoundCode: string): Promise<number> {
  const startIdx = ROUND_ORDER.indexOf(fromRoundCode);
  if (startIdx < 0) return 0;

  // Clear rounds strictly after fromRoundCode
  const roundsToClear = ROUND_ORDER.slice(startIdx + 1);
  if (roundsToClear.length === 0) return 0;

  const { data: cleared } = await supabaseAdmin
    .from('games')
    .update({
      team1_id: null,
      team2_id: null,
      winner_id: null,
      team1_score: null,
      team2_score: null,
      status: 'scheduled',
    })
    .in('tournament_round', roundsToClear)
    .select('id');

  return cleared?.length || 0;
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

  // Round is complete — status is now derived from game states, no need to toggle is_active
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
        .eq('entry_deleted', false)
        .limit(1);

      const winnerId = alivePlayers?.[0]?.user_id || null;

      await supabaseAdmin
        .from('pools')
        .update({ status: 'complete', winner_id: winnerId })
        .eq('id', pool.id);
      results.poolsCompleted++;
    }
  } else {
    // Next round becomes current automatically — status is derived from game states
  }
}

// Shared game result processing logic used by both:
// - /api/cron/process-results (real ESPN flow)
// - /api/admin/test/* (manual test flow)

import { supabaseAdmin } from '@/lib/supabase/admin';
import { R64_SEED_PAIRINGS, mapRoundNameToCode } from '@/lib/bracket';

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
 * Replaces deleteCascadedGames() — keeps shell games intact, just NULLs team data.
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

// ─── Legacy Cascade (DEPRECATED — kept for reference) ───────────
// These functions will be removed after the bracket revamp is verified.

const NEXT_ROUND: Record<string, string> = {
  'R64': 'R32', 'R32': 'S16', 'S16': 'E8', 'E8': 'F4', 'F4': 'CHIP',
};

// F4 pairings: which regions meet in each semifinal
const F4_PAIRINGS: [string, string][] = [
  ['East', 'West'],
  ['South', 'Midwest'],
];

/**
 * Get the bracket position (index) of a game within its round and region.
 * For R64: based on seed → R64_SEED_PAIRINGS index (0-7)
 * For R32+: floor(prevPosition / 2)
 */
function getBracketPosition(teamSeed: number, roundCode: string): number {
  const r64Index = R64_SEED_PAIRINGS.findIndex(pair => pair.includes(teamSeed));
  if (r64Index < 0) return 0;
  switch (roundCode) {
    case 'R64': return r64Index;
    case 'R32': return Math.floor(r64Index / 2);
    case 'S16': return Math.floor(r64Index / 4);
    case 'E8': return 0;
    default: return 0;
  }
}

/**
 * Find the DB round ID for the next round.
 * Handles Day 1/Day 2 splits for R64→R32 mapping.
 */
async function findNextRoundId(
  currentRoundId: string,
  nextRoundCode: string,
  winnerRegion: string,
): Promise<string | null> {
  // Get all rounds
  const { data: rounds } = await supabaseAdmin
    .from('rounds')
    .select('id, name, date')
    .order('date', { ascending: true });

  if (!rounds) return null;

  // Find rounds matching the next round code
  const nextRounds = rounds.filter(r => mapRoundNameToCode(r.name) === nextRoundCode);
  if (nextRounds.length === 0) return null;

  // If only one round matches, use it
  if (nextRounds.length === 1) return nextRounds[0].id;

  // Multiple rounds (Day 1 / Day 2 split) — match by which regions are in which day
  // For R32: Day 1 has the same regions as R64 Day 1, Day 2 has R64 Day 2's regions
  // Strategy: check which next-round already has games from this region, or
  // map based on the current round's day pattern

  // Get the current round
  const currentRound = rounds.find(r => r.id === currentRoundId);
  if (!currentRound) return nextRounds[0].id;

  const currentRoundCode = mapRoundNameToCode(currentRound.name);

  // For R64→R32: match by date offset (R64 Day 1 → R32 Day 1, etc.)
  if (currentRoundCode === 'R64' && nextRoundCode === 'R32') {
    // Find the current round's index among R64 rounds
    const r64Rounds = rounds.filter(r => mapRoundNameToCode(r.name) === 'R64');
    const r32Rounds = nextRounds;
    const currentIndex = r64Rounds.findIndex(r => r.id === currentRoundId);
    if (currentIndex >= 0 && currentIndex < r32Rounds.length) {
      return r32Rounds[currentIndex].id;
    }
  }

  // For R32→S16 with multiple S16 rounds: match by region
  // Check if any next-round already has games from this region
  for (const nextRound of nextRounds) {
    const { data: existingGames } = await supabaseAdmin
      .from('games')
      .select('id, team1_id, team2_id')
      .eq('round_id', nextRound.id)
      .limit(1);

    if (existingGames && existingGames.length > 0) {
      // Check the region of teams in this round
      const teamId = existingGames[0].team1_id || existingGames[0].team2_id;
      if (teamId) {
        const { data: team } = await supabaseAdmin
          .from('teams')
          .select('region')
          .eq('id', teamId)
          .single();
        if (team?.region === winnerRegion) return nextRound.id;
      }
    }
  }

  // Fallback: use the first matching round
  return nextRounds[0].id;
}

/**
 * @deprecated Use propagateWinner() instead. This function dynamically creates
 * next-round games — the new approach uses pre-generated shell games.
 */
export async function cascadeGameResult(
  gameId: string,
  winnerId: string,
  results: ProcessingResults,
): Promise<void> {
  // Get the completed game with team info
  const { data: game } = await supabaseAdmin
    .from('games')
    .select(`
      id, round_id, team1_id, team2_id, game_datetime,
      team1:team1_id(id, seed, region, abbreviation),
      team2:team2_id(id, seed, region, abbreviation)
    `)
    .eq('id', gameId)
    .single();

  if (!game) return;

  const winner = winnerId === game.team1_id ? (game as any).team1 : (game as any).team2;
  if (!winner) return;

  const winnerRegion: string = winner.region;
  const winnerSeed: number = winner.seed;

  // Get current round info
  const { data: currentRound } = await supabaseAdmin
    .from('rounds')
    .select('id, name, date')
    .eq('id', game.round_id)
    .single();

  if (!currentRound) return;

  const currentRoundCode = mapRoundNameToCode(currentRound.name);
  const nextRoundCode = NEXT_ROUND[currentRoundCode];
  if (!nextRoundCode) return; // Championship winner — tournament over

  // ── Within-region cascade (R64 → R32 → S16 → E8) ──────────────

  if (['R64', 'R32', 'S16'].includes(currentRoundCode)) {
    const currentBracketPos = getBracketPosition(winnerSeed, currentRoundCode);
    const nextBracketPos = Math.floor(currentBracketPos / 2);
    const isTeam1 = currentBracketPos % 2 === 0; // even = team1, odd = team2

    // Find the next round ID
    const nextRoundId = await findNextRoundId(game.round_id, nextRoundCode, winnerRegion);
    if (!nextRoundId) return;

    // Compute a placeholder game_datetime (same date as next round + offset based on position)
    const { data: nextRound } = await supabaseAdmin
      .from('rounds')
      .select('date')
      .eq('id', nextRoundId)
      .single();

    const nextRoundDate = nextRound?.date || currentRound.date;
    const baseTime = new Date(`${nextRoundDate}T19:00:00Z`); // default 12pm MT / 2pm ET
    const gameTime = new Date(baseTime.getTime() + nextBracketPos * 2.5 * 60 * 60 * 1000); // stagger by 2.5 hrs

    // Find existing next-round game for this region + bracket position
    // Match by: round_id + has a team from same region + bracket_position
    const { data: existingGames } = await supabaseAdmin
      .from('games')
      .select(`
        id, team1_id, team2_id, bracket_position,
        team1:team1_id(region),
        team2:team2_id(region)
      `)
      .eq('round_id', nextRoundId);

    let nextGame = null;

    if (existingGames) {
      // Look for a game with bracket_position set
      nextGame = existingGames.find(g =>
        g.bracket_position === nextBracketPos &&
        ((g as any).team1?.region === winnerRegion || (g as any).team2?.region === winnerRegion)
      );

      // Also try matching by parent game relationship — look for a game
      // that already has one team from the same region at this position
      if (!nextGame) {
        nextGame = existingGames.find(g => {
          const t1Region = (g as any).team1?.region;
          const t2Region = (g as any).team2?.region;
          return (t1Region === winnerRegion || t2Region === winnerRegion) &&
                 (!g.team1_id || !g.team2_id);
        });
      }
    }

    if (nextGame) {
      // Populate the empty slot
      const update: Record<string, any> = {};
      if (isTeam1 || !nextGame.team1_id) {
        if (!nextGame.team1_id) update.team1_id = winnerId;
        else if (!nextGame.team2_id) update.team2_id = winnerId;
      } else {
        if (!nextGame.team2_id) update.team2_id = winnerId;
        else if (!nextGame.team1_id) update.team1_id = winnerId;
      }

      if (Object.keys(update).length > 0) {
        await supabaseAdmin
          .from('games')
          .update(update)
          .eq('id', nextGame.id);
      }
    } else {
      // Create new game shell
      const newGame: Record<string, any> = {
        round_id: nextRoundId,
        game_datetime: gameTime.toISOString(),
        status: 'scheduled',
        bracket_position: nextBracketPos,
        tournament_round: nextRoundCode,
      };

      if (isTeam1) {
        newGame.team1_id = winnerId;
      } else {
        newGame.team2_id = winnerId;
      }

      // Set parent game reference
      newGame.parent_game_a_id = isTeam1 ? gameId : null;
      newGame.parent_game_b_id = !isTeam1 ? gameId : null;

      await supabaseAdmin.from('games').insert(newGame);
    }
    return;
  }

  // ── Cross-region cascade: E8 → F4 ──────────────────────────────

  if (currentRoundCode === 'E8') {
    // Find the F4 round
    const nextRoundId = await findNextRoundId(game.round_id, 'F4', winnerRegion);
    if (!nextRoundId) return;

    // Determine which F4 game this region feeds into
    const pairingIndex = F4_PAIRINGS.findIndex(pair => pair.includes(winnerRegion));
    if (pairingIndex < 0) return;

    const isFirstRegion = F4_PAIRINGS[pairingIndex][0] === winnerRegion;

    // Find existing F4 games
    const { data: f4Games } = await supabaseAdmin
      .from('games')
      .select('id, team1_id, team2_id, bracket_position')
      .eq('round_id', nextRoundId);

    let f4Game = f4Games?.find(g => g.bracket_position === pairingIndex);

    if (f4Game) {
      // Populate the empty slot
      const update: Record<string, any> = {};
      if (isFirstRegion && !f4Game.team1_id) update.team1_id = winnerId;
      else if (!isFirstRegion && !f4Game.team2_id) update.team2_id = winnerId;
      else if (!f4Game.team1_id) update.team1_id = winnerId;
      else if (!f4Game.team2_id) update.team2_id = winnerId;

      if (Object.keys(update).length > 0) {
        await supabaseAdmin.from('games').update(update).eq('id', f4Game.id);
      }
    } else {
      // Create F4 game shell
      const { data: nextRound } = await supabaseAdmin
        .from('rounds')
        .select('date')
        .eq('id', nextRoundId)
        .single();
      const nextDate = nextRound?.date || currentRound.date;
      const gameTime = new Date(`${nextDate}T${pairingIndex === 0 ? '22:00' : '00:30'}:00Z`);

      const newGame: Record<string, any> = {
        round_id: nextRoundId,
        game_datetime: gameTime.toISOString(),
        status: 'scheduled',
        bracket_position: pairingIndex,
        tournament_round: 'F4',
      };
      if (isFirstRegion) newGame.team1_id = winnerId;
      else newGame.team2_id = winnerId;

      await supabaseAdmin.from('games').insert(newGame);
    }
    return;
  }

  // ── F4 → Championship ──────────────────────────────────────────

  if (currentRoundCode === 'F4') {
    const nextRoundId = await findNextRoundId(game.round_id, 'CHIP', winnerRegion);
    if (!nextRoundId) return;

    // Find existing championship game
    const { data: chipGames } = await supabaseAdmin
      .from('games')
      .select('id, team1_id, team2_id')
      .eq('round_id', nextRoundId);

    const chipGame = chipGames?.[0];

    if (chipGame) {
      const update: Record<string, any> = {};
      if (!chipGame.team1_id) update.team1_id = winnerId;
      else if (!chipGame.team2_id) update.team2_id = winnerId;

      if (Object.keys(update).length > 0) {
        await supabaseAdmin.from('games').update(update).eq('id', chipGame.id);
      }
    } else {
      const { data: nextRound } = await supabaseAdmin
        .from('rounds')
        .select('date')
        .eq('id', nextRoundId)
        .single();
      const nextDate = nextRound?.date || currentRound.date;

      await supabaseAdmin.from('games').insert({
        round_id: nextRoundId,
        game_datetime: `${nextDate}T01:20:00Z`,
        status: 'scheduled',
        bracket_position: 0,
        tournament_round: 'CHIP',
        team1_id: winnerId,
      });
    }
    return;
  }
}

/**
 * @deprecated Use clearBracketAdvancement() instead. This function deletes
 * cascade-created games — the new approach clears team slots on pre-generated shells.
 */
export async function deleteCascadedGames(roundId: string): Promise<number> {
  // Get the round code
  const { data: round } = await supabaseAdmin
    .from('rounds')
    .select('name')
    .eq('id', roundId)
    .single();

  if (!round) return 0;

  const roundCode = mapRoundNameToCode(round.name);
  const nextRoundCode = NEXT_ROUND[roundCode];
  if (!nextRoundCode) return 0;

  // Get all rounds
  const { data: allRounds } = await supabaseAdmin
    .from('rounds')
    .select('id, name')
    .order('date', { ascending: true });

  if (!allRounds) return 0;

  // Find rounds for the next round code
  const nextRounds = allRounds.filter(r => mapRoundNameToCode(r.name) === nextRoundCode);
  if (nextRounds.length === 0) return 0;

  let totalDeleted = 0;

  for (const nextRound of nextRounds) {
    // Delete games in the next round that have bracket_position set
    // (these were created by the cascade) or that have only one team
    const { data: deleted } = await supabaseAdmin
      .from('games')
      .delete()
      .eq('round_id', nextRound.id)
      .not('bracket_position', 'is', null)
      .select('id');

    totalDeleted += deleted?.length || 0;

    // Also delete any games with only one team set (partial cascade games)
    const { data: partialGames } = await supabaseAdmin
      .from('games')
      .select('id, team1_id, team2_id')
      .eq('round_id', nextRound.id);

    if (partialGames) {
      const partialIds = partialGames
        .filter(g => (!g.team1_id || !g.team2_id) && (g.team1_id || g.team2_id))
        .map(g => g.id);

      if (partialIds.length > 0) {
        const { data: deletedPartial } = await supabaseAdmin
          .from('games')
          .delete()
          .in('id', partialIds)
          .select('id');
        totalDeleted += deletedPartial?.length || 0;
      }
    }
  }

  // Recursively delete cascaded games from further rounds
  for (const nextRound of nextRounds) {
    totalDeleted += await deleteCascadedGames(nextRound.id);
  }

  return totalDeleted;
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

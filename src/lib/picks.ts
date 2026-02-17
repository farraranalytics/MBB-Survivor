// Pick submission logic and validation
import { supabase } from '@/lib/supabase/client';
import { getTournamentState } from '@/lib/status';
import { getEffectiveNow } from '@/lib/clock';
import { getAllGamesWithTeams, getAllRounds, getGamesForDay } from '@/lib/bracket';
import { BracketGame } from '@/types/bracket';
import {
  PoolPlayer,
  Round,
  Pick,
  Game,
  TeamInfo,
  PickableTeam,
  PlayerStatus,
  PickDeadline,
  PickSubmission,
  PickValidation,
  PoolStandings
} from '@/types/picks';

export class PickError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PickError';
  }
}

// ─── Round Queries ────────────────────────────────────────────────

/**
 * Get the active round (current tournament day)
 */
export async function getActiveRound(): Promise<Round | null> {
  const state = await getTournamentState();
  if (!state.currentRound) return null;

  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('id', state.currentRound.id)
    .single();

  if (error) return null;
  return data;
}

// ─── Game Queries ─────────────────────────────────────────────────

/**
 * Get games for a round by querying the games table by round_id only.
 * @deprecated Use getPickableTeams() or getGamesForDay() (from bracket.ts) for the pick page
 * so matchups use the same bracket logic as the analyze page (actualGameIndices, r32DayMapping, etc.).
 */
export async function getTodaysGames(roundId: string): Promise<Game[]> {
  const { data, error } = await supabase
    .from('games')
    .select(`
      *,
      team1:team1_id(id, name, mascot, abbreviation, seed, region, logo_url, espn_team_id, is_eliminated),
      team2:team2_id(id, name, mascot, abbreviation, seed, region, logo_url, espn_team_id, is_eliminated)
    `)
    .eq('round_id', roundId)
    .order('game_datetime', { ascending: true });

  if (error) {
    throw new PickError(`Failed to fetch games: ${error.message}`, 'FETCH_ERROR');
  }

  return data || [];
}

// ─── Player Queries ───────────────────────────────────────────────

/**
 * Get player's pool_player record.
 * If poolPlayerId is provided, fetch that specific entry.
 * Otherwise, fetch all entries for the user and return the first non-eliminated one.
 */
export async function getPoolPlayer(poolId: string, userId: string, poolPlayerId?: string): Promise<PoolPlayer | null> {
  if (poolPlayerId) {
    const { data, error } = await supabase
      .from('pool_players')
      .select('*')
      .eq('id', poolPlayerId)
      .eq('pool_id', poolId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new PickError(`Failed to fetch pool player: ${error.message}`, 'FETCH_ERROR');
    }
    return data;
  }

  // Multi-entry: fetch all entries, prefer first non-eliminated
  const { data: entries, error } = await supabase
    .from('pool_players')
    .select('*')
    .eq('pool_id', poolId)
    .eq('user_id', userId)
    .order('entry_number', { ascending: true });

  if (error) {
    throw new PickError(`Failed to fetch pool player: ${error.message}`, 'FETCH_ERROR');
  }

  if (!entries || entries.length === 0) return null;

  // Return first non-eliminated entry, or first entry if all eliminated
  return entries.find(e => !e.is_eliminated) || entries[0];
}

/**
 * Get team IDs already used by a player in this pool.
 * Optionally exclude a round (so current round's pick isn't marked as used).
 */
export async function getUsedTeams(poolPlayerId: string, excludeRoundId?: string): Promise<string[]> {
  let query = supabase
    .from('picks')
    .select('team_id')
    .eq('pool_player_id', poolPlayerId);

  if (excludeRoundId) {
    query = query.neq('round_id', excludeRoundId);
  }

  const { data, error } = await query;

  if (error) {
    throw new PickError(`Failed to fetch used teams: ${error.message}`, 'FETCH_ERROR');
  }

  return data?.map(pick => pick.team_id) || [];
}

/**
 * Get player's pick for a specific round (with team/round joins)
 */
export async function getPlayerPick(poolPlayerId: string, roundId: string): Promise<Pick | null> {
  const { data, error } = await supabase
    .from('picks')
    .select(`
      *,
      team:team_id(id, name, mascot, abbreviation, seed, region, logo_url, espn_team_id, is_eliminated),
      round:round_id(id, name, date, deadline_datetime, is_active)
    `)
    .eq('pool_player_id', poolPlayerId)
    .eq('round_id', roundId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new PickError(`Failed to fetch player pick: ${error.message}`, 'FETCH_ERROR');
  }

  return data;
}

/**
 * Get all picks for a player (for history)
 */
export async function getPlayerPicks(poolPlayerId: string): Promise<Pick[]> {
  const { data, error } = await supabase
    .from('picks')
    .select(`
      *,
      team:team_id(id, name, mascot, abbreviation, seed, region, logo_url, espn_team_id, is_eliminated),
      round:round_id(id, name, date, deadline_datetime, is_active)
    `)
    .eq('pool_player_id', poolPlayerId)
    .order('submitted_at', { ascending: true });

  if (error) {
    throw new PickError(`Failed to fetch player picks: ${error.message}`, 'FETCH_ERROR');
  }

  return data || [];
}

// ─── Pickable Teams ───────────────────────────────────────────────

/**
 * Calculate risk level based on seed differential
 */
function calculateRiskLevel(teamSeed: number, opponentSeed: number): 'low' | 'medium' | 'high' {
  const seedDiff = teamSeed - opponentSeed;
  if (seedDiff <= -6) return 'low';    // Strong favorite (e.g., 1-seed vs 16-seed)
  if (seedDiff >= 6) return 'high';    // Big underdog
  return 'medium';
}

/**
 * Build PickableTeam[] from pre-filtered BracketGame[].
 * Exported so the pick page can reuse it for spectator views.
 */
export function buildPickableTeamsFromGames(
  games: BracketGame[],
  usedTeamIds: string[],
): PickableTeam[] {
  const pickableTeams: PickableTeam[] = [];

  for (const game of games) {
    if (!game.team1 || !game.team2) continue;
    const t1 = game.team1 as TeamInfo;
    const t2 = game.team2 as TeamInfo;

    // Team 1
    pickableTeams.push({
      id: t1.id,
      name: t1.name,
      mascot: t1.mascot,
      abbreviation: t1.abbreviation,
      seed: t1.seed,
      region: t1.region,
      logo_url: t1.logo_url,
      espn_team_id: t1.espn_team_id ?? null,
      is_eliminated: t1.is_eliminated,
      game_id: game.id,
      game_datetime: game.game_datetime,
      round_id: game.round_id,
      opponent: {
        id: t2.id,
        name: t2.name,
        seed: t2.seed,
        abbreviation: t2.abbreviation
      },
      already_used: usedTeamIds.includes(t1.id),
      risk_level: calculateRiskLevel(t1.seed, t2.seed)
    });

    // Team 2
    pickableTeams.push({
      id: t2.id,
      name: t2.name,
      mascot: t2.mascot,
      abbreviation: t2.abbreviation,
      seed: t2.seed,
      region: t2.region,
      logo_url: t2.logo_url,
      espn_team_id: t2.espn_team_id ?? null,
      is_eliminated: t2.is_eliminated,
      game_id: game.id,
      game_datetime: game.game_datetime,
      round_id: game.round_id,
      opponent: {
        id: t1.id,
        name: t1.name,
        seed: t1.seed,
        abbreviation: t1.abbreviation
      },
      already_used: usedTeamIds.includes(t2.id),
      risk_level: calculateRiskLevel(t2.seed, t1.seed)
    });
  }

  // Sort: game time ascending, then seed ascending (favorites first)
  return pickableTeams.sort((a, b) => {
    const timeDiff = new Date(a.game_datetime).getTime() - new Date(b.game_datetime).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.seed - b.seed;
  });
}

/**
 * Build the list of pickable teams for the current round/day.
 * Uses the same round/day/matchup structure as the analyze page (BracketPlanner):
 * getGamesForDay() applies actualGameIndices, r32DayMapping, and fixedRegions (S16/E8)
 * so the games shown here match exactly what the analyze page shows for this day.
 * Do not use getTodaysGames(roundId) here — that queries by round_id only and can
 * disagree with bracket logic for R32+ when cascade-created games have wrong round_id.
 */
export async function getPickableTeams(poolPlayerId: string, roundId: string): Promise<PickableTeam[]> {
  const [allGames, allRounds, usedTeamIds] = await Promise.all([
    getAllGamesWithTeams(),
    getAllRounds(),
    getUsedTeams(poolPlayerId, roundId)
  ]);

  const dayGames = getGamesForDay(allGames, allRounds, roundId);
  return buildPickableTeamsFromGames(dayGames, usedTeamIds);
}

// ─── Deadline ─────────────────────────────────────────────────────

/**
 * Check pick deadline status for a round.
 * Uses bracket-aware game filtering so the deadline is based on the
 * actual games that will be shown on this day (matching analyze page logic).
 */
export async function getPickDeadline(roundId: string): Promise<PickDeadline> {
  const [allGames, allRounds] = await Promise.all([
    getAllGamesWithTeams(),
    getAllRounds(),
  ]);

  const round = allRounds.find(r => r.id === roundId);
  if (!round) {
    throw new PickError('Round not found', 'FETCH_ERROR');
  }

  // Get bracket-aware games for this day
  const dayGames = getGamesForDay(allGames, allRounds, roundId);

  // Earliest game time across all games on this day
  const firstGameTime = dayGames.length > 0
    ? dayGames.reduce((earliest, g) =>
        g.game_datetime < earliest ? g.game_datetime : earliest,
        dayGames[0].game_datetime
      )
    : null;

  // Deadline = first game - 5 minutes
  let deadlineDatetime: string;
  if (firstGameTime) {
    deadlineDatetime = new Date(new Date(firstGameTime).getTime() - 5 * 60 * 1000).toISOString();
  } else {
    // Fallback: no games, use a far-future date
    deadlineDatetime = new Date('2099-01-01').toISOString();
  }

  const now = await getEffectiveNow();
  const diff = new Date(deadlineDatetime).getTime() - now.getTime();
  const minutesRemaining = Math.max(0, Math.floor(diff / 60000));

  return {
    round_id: roundId,
    round_name: round.name,
    deadline_datetime: deadlineDatetime,
    minutes_remaining: minutesRemaining,
    is_expired: diff <= 0,
    first_game_time: firstGameTime || deadlineDatetime,
  };
}

// ─── Validation ───────────────────────────────────────────────────

/**
 * Full validation of a pick submission.
 * Uses bracket-aware game filtering so validation matches what
 * the pick page actually shows.
 */
export async function validatePick(submission: PickSubmission): Promise<PickValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // 1. Player must exist and not be eliminated
    const { data: poolPlayer, error: ppErr } = await supabase
      .from('pool_players')
      .select('*')
      .eq('id', submission.pool_player_id)
      .single();

    if (ppErr || !poolPlayer) {
      errors.push('Invalid player');
      return { valid: false, errors, warnings };
    }

    if (poolPlayer.is_eliminated) {
      errors.push('You are eliminated and cannot make picks');
      return { valid: false, errors, warnings };
    }

    // Load bracket data once for deadline + team validation
    const [allGames, allRounds] = await Promise.all([
      getAllGamesWithTeams(),
      getAllRounds(),
    ]);
    const dayGames = getGamesForDay(allGames, allRounds, submission.round_id);

    // 2. Deadline must not have passed (from bracket-aware games)
    const firstGameTime = dayGames.length > 0
      ? dayGames.reduce((e, g) => g.game_datetime < e ? g.game_datetime : e, dayGames[0].game_datetime)
      : null;
    let deadlineDatetime: string;
    if (firstGameTime) {
      deadlineDatetime = new Date(new Date(firstGameTime).getTime() - 5 * 60 * 1000).toISOString();
    } else {
      deadlineDatetime = new Date('2099-01-01').toISOString();
    }
    const now = await getEffectiveNow();
    const diff = new Date(deadlineDatetime).getTime() - now.getTime();
    const minutesRemaining = Math.max(0, Math.floor(diff / 60000));

    if (diff <= 0) {
      errors.push('Pick deadline has passed');
      return { valid: false, errors, warnings };
    }
    if (minutesRemaining < 5) {
      warnings.push('Less than 5 minutes remaining!');
    }

    // 3. Team not already used in a PREVIOUS round (exclude current round's pick)
    const { data: previousPicks } = await supabase
      .from('picks')
      .select('team_id, round_id')
      .eq('pool_player_id', submission.pool_player_id)
      .neq('round_id', submission.round_id);
    const previouslyUsedTeams = (previousPicks || []).map(p => p.team_id);
    if (previouslyUsedTeams.includes(submission.team_id)) {
      errors.push('You have already picked this team in a previous round');
      return { valid: false, errors, warnings };
    }

    // 4. (Picks can be changed before deadline — no block on existing pick)

    // 5. Team must be playing in today's games (bracket-aware)
    const teamPlaying = dayGames.some(
      g => g.team1?.id === submission.team_id || g.team2?.id === submission.team_id
    );
    if (!teamPlaying) {
      errors.push('Selected team is not playing today');
      return { valid: false, errors, warnings };
    }
  } catch (err) {
    errors.push('Validation failed — please try again');
    return { valid: false, errors, warnings };
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Submit Pick ──────────────────────────────────────────────────

/**
 * Submit or change a pick (validates first, replaces existing if needed)
 */
export async function submitPick(submission: PickSubmission): Promise<Pick> {
  const validation = await validatePick(submission);
  if (!validation.valid) {
    throw new PickError(validation.errors.join('. '), 'VALIDATION_ERROR');
  }

  // Delete existing pick for this round if changing
  const existingPick = await getPlayerPick(submission.pool_player_id, submission.round_id);
  if (existingPick) {
    const { error: deleteError } = await supabase
      .from('picks')
      .delete()
      .eq('id', existingPick.id);

    if (deleteError) {
      throw new PickError(`Failed to change pick: ${deleteError.message}`, 'SUBMIT_ERROR');
    }
  }

  const { data, error } = await supabase
    .from('picks')
    .insert({
      pool_player_id: submission.pool_player_id,
      round_id: submission.round_id,
      team_id: submission.team_id,
      confidence: submission.confidence ?? null
    })
    .select(`
      *,
      team:team_id(id, name, mascot, abbreviation, seed, region, logo_url, espn_team_id, is_eliminated),
      round:round_id(id, name, date, deadline_datetime, is_active)
    `)
    .single();

  if (error) {
    if (error.message.includes('deadline')) {
      throw new PickError('Pick deadline has passed', 'DEADLINE_ERROR');
    }
    throw new PickError(`Failed to submit pick: ${error.message}`, 'SUBMIT_ERROR');
  }

  return data;
}

// ─── Pool Standings ───────────────────────────────────────────────

/**
 * Build full standings for a pool, including player statuses
 */
export async function getPoolStandings(poolId: string, currentUserId?: string): Promise<PoolStandings> {
  // Pool info
  const { data: pool, error: poolError } = await supabase
    .from('pools')
    .select('id, name, creator_id, join_code, max_entries_per_user')
    .eq('id', poolId)
    .single();

  if (poolError) {
    throw new PickError(`Failed to fetch pool: ${poolError.message}`, 'FETCH_ERROR');
  }

  // All players in this pool
  const { data: players, error: playersError } = await supabase
    .from('pool_players')
    .select('*')
    .eq('pool_id', poolId)
    .order('is_eliminated', { ascending: true })
    .order('display_name', { ascending: true });

  if (playersError) {
    throw new PickError(`Failed to fetch players: ${playersError.message}`, 'FETCH_ERROR');
  }

  const activeRound = await getActiveRound();

  // Build per-player status
  const playerStatuses: PlayerStatus[] = [];
  const yourEntries: PlayerStatus[] = [];

  for (const player of players || []) {
    const { data: picks } = await supabase
      .from('picks')
      .select(`
        *,
        team:team_id(id, name, mascot, abbreviation, seed, region, logo_url, is_eliminated),
        round:round_id(id, name, date, deadline_datetime, is_active)
      `)
      .eq('pool_player_id', player.id)
      .order('submitted_at', { ascending: true });

    const currentPick = activeRound
      ? (picks?.find(p => p.round_id === activeRound.id) ?? null)
      : null;
    const teamsUsed = picks?.map(p => p.team_id) || [];

    // Survival streak = consecutive correct picks from most recent backward
    let survivalStreak = 0;
    if (picks && picks.length > 0) {
      const reversed = [...picks].reverse();
      for (const p of reversed) {
        if (p.is_correct === true) survivalStreak++;
        else break;
      }
    }

    const status: PlayerStatus = {
      pool_player_id: player.id,
      display_name: player.display_name,
      entry_number: player.entry_number ?? 1,
      entry_label: player.entry_label ?? null,
      is_eliminated: player.is_eliminated,
      elimination_reason: player.elimination_reason,
      current_pick: currentPick,
      picks_count: picks?.length || 0,
      teams_used: teamsUsed,
      survival_streak: survivalStreak
    };

    playerStatuses.push(status);

    if (currentUserId && player.user_id === currentUserId) {
      yourEntries.push(status);
    }
  }

  return {
    pool_id: poolId,
    pool_name: pool.name,
    creator_id: pool.creator_id,
    join_code: pool.join_code,
    max_entries_per_user: pool.max_entries_per_user ?? 1,
    total_players: players?.length || 0,
    alive_players: players?.filter(p => !p.is_eliminated).length || 0,
    eliminated_players: players?.filter(p => p.is_eliminated).length || 0,
    current_round: activeRound,
    players: playerStatuses,
    your_entries: yourEntries
  };
}

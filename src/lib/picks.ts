// Pick submission logic and validation
import { supabase } from '@/lib/supabase/client';
import { getTournamentState } from '@/lib/status';
import { getEffectiveNow } from '@/lib/clock';
import {
  PoolPlayer,
  Round,
  Pick,
  Game,
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
 * Get today's games for a specific round, with joined team data
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
 * Build the list of pickable teams for the current round.
 * Marks teams already used by this player.
 */
export async function getPickableTeams(poolPlayerId: string, roundId: string): Promise<PickableTeam[]> {
  const [games, usedTeamIds] = await Promise.all([
    getTodaysGames(roundId),
    getUsedTeams(poolPlayerId, roundId)
  ]);

  const pickableTeams: PickableTeam[] = [];

  for (const game of games) {
    if (!game.team1 || !game.team2) continue;

    // Team 1
    pickableTeams.push({
      id: game.team1.id,
      name: game.team1.name,
      mascot: game.team1.mascot,
      abbreviation: game.team1.abbreviation,
      seed: game.team1.seed,
      region: game.team1.region,
      logo_url: game.team1.logo_url,
      espn_team_id: (game.team1 as any).espn_team_id ?? null,
      is_eliminated: game.team1.is_eliminated,
      game_id: game.id,
      game_datetime: game.game_datetime,
      opponent: {
        id: game.team2.id,
        name: game.team2.name,
        seed: game.team2.seed,
        abbreviation: game.team2.abbreviation
      },
      already_used: usedTeamIds.includes(game.team1.id),
      risk_level: calculateRiskLevel(game.team1.seed, game.team2.seed)
    });

    // Team 2
    pickableTeams.push({
      id: game.team2.id,
      name: game.team2.name,
      mascot: game.team2.mascot,
      abbreviation: game.team2.abbreviation,
      seed: game.team2.seed,
      region: game.team2.region,
      logo_url: game.team2.logo_url,
      espn_team_id: (game.team2 as any).espn_team_id ?? null,
      is_eliminated: game.team2.is_eliminated,
      game_id: game.id,
      game_datetime: game.game_datetime,
      opponent: {
        id: game.team1.id,
        name: game.team1.name,
        seed: game.team1.seed,
        abbreviation: game.team1.abbreviation
      },
      already_used: usedTeamIds.includes(game.team2.id),
      risk_level: calculateRiskLevel(game.team2.seed, game.team1.seed)
    });
  }

  // Sort: game time ascending, then seed ascending (favorites first)
  return pickableTeams.sort((a, b) => {
    const timeDiff = new Date(a.game_datetime).getTime() - new Date(b.game_datetime).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.seed - b.seed;
  });
}

// ─── Deadline ─────────────────────────────────────────────────────

/**
 * Check pick deadline status for a round
 */
export async function getPickDeadline(roundId: string): Promise<PickDeadline> {
  // Get round name
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('id, name')
    .eq('id', roundId)
    .single();

  if (roundError || !round) {
    throw new PickError(`Failed to fetch round: ${roundError?.message || 'Not found'}`, 'FETCH_ERROR');
  }

  // Get earliest game time for this round
  const { data: firstGame } = await supabase
    .from('games')
    .select('game_datetime')
    .eq('round_id', roundId)
    .order('game_datetime', { ascending: true })
    .limit(1)
    .single();

  const firstGameTime = firstGame?.game_datetime || null;

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
 * Full validation of a pick submission
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

    // 2. Deadline must not have passed
    const deadline = await getPickDeadline(submission.round_id);
    if (deadline.is_expired) {
      errors.push('Pick deadline has passed');
      return { valid: false, errors, warnings };
    }
    if (deadline.minutes_remaining < 5) {
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

    // 5. Team must be playing in today's games
    const games = await getTodaysGames(submission.round_id);
    const teamPlaying = games.some(
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

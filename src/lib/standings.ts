// Standings & Leaderboard data fetching
import { supabase } from '@/lib/supabase/client';
import {
  StandingsPlayer,
  RoundResult,
  PoolLeaderboard,
  MyPool,
} from '@/types/standings';

// ─── Pool Leaderboard ─────────────────────────────────────────────

/**
 * Build full leaderboard for a pool with round-by-round results
 */
export async function getPoolLeaderboard(poolId: string): Promise<PoolLeaderboard> {
  // 1. Pool info
  const { data: pool, error: poolError } = await supabase
    .from('pools')
    .select('id, name, status')
    .eq('id', poolId)
    .single();

  if (poolError || !pool) {
    throw new Error(`Failed to fetch pool: ${poolError?.message || 'Not found'}`);
  }

  // 2. All rounds (completed + active), ordered by date
  const { data: rounds } = await supabase
    .from('rounds')
    .select('id, round_name, start_date, pick_deadline')
    .order('start_date', { ascending: true });

  const allRounds = rounds || [];

  // 3. Active round
  const activeRound = allRounds.find(r => {
    const deadline = new Date(r.pick_deadline);
    const now = new Date();
    // A round is "active" if its deadline hasn't passed or it's the most recent
    return deadline > now;
  }) || null;

  // 4. All players in pool
  const { data: players, error: playersError } = await supabase
    .from('pool_players')
    .select(`
      id,
      user_id,
      status,
      elimination_date,
      elimination_round,
      joined_at,
      profiles:user_id(display_name)
    `)
    .eq('pool_id', poolId);

  if (playersError) {
    throw new Error(`Failed to fetch players: ${playersError.message}`);
  }

  // 5. All picks in this pool with game data
  const { data: allPicks } = await supabase
    .from('picks')
    .select(`
      id,
      user_id,
      round_id,
      team_name,
      is_correct,
      game_id,
      games:game_id(
        status,
        home_team,
        away_team,
        home_seed,
        away_seed,
        home_score,
        away_score,
        winner
      )
    `)
    .eq('pool_id', poolId);

  const picks = allPicks || [];

  // 6. Build round lookup
  const roundMap = new Map(allRounds.map(r => [r.id, r]));

  // 7. Build per-player standings
  const standingsPlayers: StandingsPlayer[] = (players || []).map(player => {
    // Type-safe profile access
    const profile = player.profiles as unknown as { display_name: string } | null;
    const displayName = profile?.display_name || 'Unknown';
    const isEliminated = player.status === 'eliminated';

    // Player's picks
    const playerPicks = picks.filter(p => p.user_id === player.user_id);

    // Build round results
    const roundResults: RoundResult[] = playerPicks
      .map(pick => {
        const round = roundMap.get(pick.round_id);
        if (!round) return null;

        // Game data
        const game = pick.games as unknown as {
          status: string;
          home_team: string;
          away_team: string;
          home_seed: number;
          away_seed: number;
          home_score: number;
          away_score: number;
          winner: string;
        } | null;

        // Determine opponent
        let opponentName: string | null = null;
        let opponentSeed: number | null = null;
        let teamSeed = 0;
        let gameScore: string | null = null;

        if (game) {
          if (game.home_team === pick.team_name) {
            opponentName = game.away_team;
            opponentSeed = game.away_seed;
            teamSeed = game.home_seed;
          } else {
            opponentName = game.home_team;
            opponentSeed = game.home_seed;
            teamSeed = game.away_seed;
          }

          if (game.status === 'completed' || game.status === 'in_progress') {
            gameScore = `${game.home_score}-${game.away_score}`;
          }
        }

        return {
          round_id: pick.round_id,
          round_name: round.round_name,
          round_date: round.start_date,
          team_name: pick.team_name,
          team_seed: teamSeed,
          team_abbreviation: pick.team_name.substring(0, 4).toUpperCase(),
          opponent_name: opponentName,
          opponent_seed: opponentSeed,
          is_correct: pick.is_correct,
          game_status: (game?.status || 'scheduled') as 'scheduled' | 'in_progress' | 'final',
          game_score: gameScore,
        } as RoundResult;
      })
      .filter((r): r is RoundResult => r !== null)
      .sort((a, b) => new Date(a.round_date).getTime() - new Date(b.round_date).getTime());

    // Correct picks count
    const correctPicks = roundResults.filter(r => r.is_correct === true).length;

    // Survival streak (consecutive correct from most recent backward)
    let survivalStreak = 0;
    const reversed = [...roundResults].reverse();
    for (const r of reversed) {
      if (r.is_correct === true) survivalStreak++;
      else if (r.is_correct === false) break;
      // null (pending) doesn't break streak
    }

    // Longest streak
    let longestStreak = 0;
    let currentStreak = 0;
    for (const r of roundResults) {
      if (r.is_correct === true) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else if (r.is_correct === false) {
        currentStreak = 0;
      }
    }

    // Teams used
    const teamsUsed = roundResults.map(r => r.team_name);

    // Current round pick
    const currentRoundPick = activeRound
      ? roundResults.find(r => r.round_id === activeRound.id) || null
      : null;

    // Elimination round name
    let eliminationRoundName: string | null = null;
    if (isEliminated && player.elimination_round) {
      const elimRound = allRounds.find(r => {
        // Match by round_number if stored as integer
        return true; // We'll use the last incorrect pick's round instead
      });
      // More reliable: find the round where the player got eliminated
      const wrongPick = roundResults.find(r => r.is_correct === false);
      eliminationRoundName = wrongPick?.round_name || null;
    }

    return {
      pool_player_id: player.id,
      user_id: player.user_id,
      display_name: displayName,
      is_eliminated: isEliminated,
      elimination_reason: isEliminated ? 'wrong_pick' : null,
      elimination_round_name: eliminationRoundName,
      picks_count: playerPicks.length,
      correct_picks: correctPicks,
      survival_streak: survivalStreak,
      longest_streak: longestStreak,
      teams_used: teamsUsed,
      round_results: roundResults,
      current_round_pick: currentRoundPick,
    };
  });

  // Sort: alive first, then by correct picks desc, then streak desc, then name
  standingsPlayers.sort((a, b) => {
    if (a.is_eliminated !== b.is_eliminated) return a.is_eliminated ? 1 : -1;
    if (b.correct_picks !== a.correct_picks) return b.correct_picks - a.correct_picks;
    if (b.survival_streak !== a.survival_streak) return b.survival_streak - a.survival_streak;
    return a.display_name.localeCompare(b.display_name);
  });

  // Rounds that have been played (have picks)
  const roundsWithPicks = new Set(picks.map(p => p.round_id));
  const roundsPlayed = allRounds
    .filter(r => roundsWithPicks.has(r.id))
    .map(r => ({ id: r.id, name: r.round_name, date: r.start_date }));

  return {
    pool_id: poolId,
    pool_name: pool.name,
    pool_status: pool.status as 'open' | 'active' | 'complete',
    total_players: standingsPlayers.length,
    alive_players: standingsPlayers.filter(p => !p.is_eliminated).length,
    eliminated_players: standingsPlayers.filter(p => p.is_eliminated).length,
    current_round: activeRound
      ? {
          id: activeRound.id,
          name: activeRound.round_name,
          date: activeRound.start_date,
          deadline_datetime: activeRound.pick_deadline,
        }
      : null,
    rounds_played: roundsPlayed,
    players: standingsPlayers,
  };
}

// ─── My Pools ─────────────────────────────────────────────────────

/**
 * Fetch all pools the current user is a member of, with summary stats
 */
export async function getMyPools(userId: string): Promise<MyPool[]> {
  // 1. Get all pool memberships for this user
  const { data: memberships, error: memError } = await supabase
    .from('pool_players')
    .select(`
      id,
      pool_id,
      user_id,
      status,
      pools:pool_id(
        id,
        name,
        status,
        join_code
      )
    `)
    .eq('user_id', userId);

  if (memError) {
    throw new Error(`Failed to fetch pools: ${memError.message}`);
  }

  if (!memberships || memberships.length === 0) return [];

  // 2. Get active round
  const { data: rounds } = await supabase
    .from('rounds')
    .select('id, round_name, pick_deadline')
    .order('start_date', { ascending: false })
    .limit(1);

  const currentRound = rounds?.[0] || null;
  const deadlinePassed = currentRound
    ? new Date(currentRound.pick_deadline) < new Date()
    : true;

  // 3. Build pool data
  const myPools: MyPool[] = [];

  for (const membership of memberships) {
    const pool = membership.pools as unknown as {
      id: string;
      name: string;
      status: string;
      join_code: string;
    } | null;

    if (!pool) continue;

    // Count players in this pool
    const { count: totalPlayers } = await supabase
      .from('pool_players')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', pool.id);

    const { count: alivePlayers } = await supabase
      .from('pool_players')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', pool.id)
      .eq('status', 'active');

    // User's picks count
    const { data: userPicks } = await supabase
      .from('picks')
      .select('id, is_correct, round_id')
      .eq('pool_id', pool.id)
      .eq('user_id', userId);

    const picksCount = userPicks?.length || 0;

    // Check if picked today
    const hasPicked = currentRound
      ? userPicks?.some(p => p.round_id === currentRound.id) || false
      : false;

    // Survival streak
    let streak = 0;
    if (userPicks && userPicks.length > 0) {
      const sorted = [...userPicks].reverse();
      for (const p of sorted) {
        if (p.is_correct === true) streak++;
        else break;
      }
    }

    myPools.push({
      pool_id: pool.id,
      pool_name: pool.name,
      pool_status: pool.status as 'open' | 'active' | 'complete',
      join_code: pool.join_code,
      total_players: totalPlayers || 0,
      alive_players: alivePlayers || 0,
      your_status: membership.status as 'active' | 'eliminated',
      your_picks_count: picksCount,
      your_streak: streak,
      current_round_name: currentRound?.round_name || null,
      has_picked_today: hasPicked,
      deadline_datetime: currentRound?.pick_deadline || null,
    });
  }

  return myPools;
}

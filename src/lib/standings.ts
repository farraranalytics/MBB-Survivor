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

  // 2. All rounds ordered by date
  const { data: rounds } = await supabase
    .from('rounds')
    .select('id, name, date, deadline_datetime, is_active')
    .order('date', { ascending: true });

  const allRounds = rounds || [];

  // 3. Active round
  const activeRound = allRounds.find(r => r.is_active) || null;

  // 4. All players in pool
  const { data: players, error: playersError } = await supabase
    .from('pool_players')
    .select('id, user_id, display_name, entry_label, is_eliminated, elimination_round_id, elimination_reason, joined_at')
    .eq('pool_id', poolId);

  if (playersError) {
    throw new Error(`Failed to fetch players: ${playersError.message}`);
  }

  // 5. All picks for players in this pool, with team data
  const playerIds = (players || []).map(p => p.id);
  const { data: allPicks } = playerIds.length > 0
    ? await supabase
        .from('picks')
        .select(`
          id,
          pool_player_id,
          round_id,
          team_id,
          is_correct,
          submitted_at,
          team:team_id(id, name, abbreviation, seed, logo_url)
        `)
        .in('pool_player_id', playerIds)
    : { data: [] };

  // 6. All games with team data (for opponent lookup)
  const { data: allGames } = await supabase
    .from('games')
    .select(`
      id,
      round_id,
      team1_id,
      team2_id,
      status,
      team1_score,
      team2_score,
      winner_id,
      team1:team1_id(id, name, abbreviation, seed),
      team2:team2_id(id, name, abbreviation, seed)
    `);

  const picks = allPicks || [];
  const games = allGames || [];
  const roundMap = new Map(allRounds.map(r => [r.id, r]));

  // Find the game for a given pick
  function findGame(roundId: string, teamId: string) {
    return games.find(g => g.round_id === roundId && (g.team1_id === teamId || g.team2_id === teamId));
  }

  // 7. Build per-player standings
  const standingsPlayers: StandingsPlayer[] = (players || []).map(player => {
    const playerPicks = picks.filter(p => p.pool_player_id === player.id);

    const roundResults: RoundResult[] = playerPicks
      .map(pick => {
        const round = roundMap.get(pick.round_id);
        if (!round) return null;

        const team = pick.team as unknown as { id: string; name: string; abbreviation: string; seed: number; logo_url: string | null } | null;
        const game = findGame(pick.round_id, pick.team_id);

        let opponentName: string | null = null;
        let opponentSeed: number | null = null;
        let gameScore: string | null = null;
        let gameStatus: 'scheduled' | 'in_progress' | 'final' = 'scheduled';

        if (game) {
          gameStatus = game.status as 'scheduled' | 'in_progress' | 'final';
          const t1 = game.team1 as unknown as { id: string; name: string; abbreviation: string; seed: number } | null;
          const t2 = game.team2 as unknown as { id: string; name: string; abbreviation: string; seed: number } | null;

          if (game.team1_id === pick.team_id) {
            opponentName = t2?.name || null;
            opponentSeed = t2?.seed || null;
          } else {
            opponentName = t1?.name || null;
            opponentSeed = t1?.seed || null;
          }

          if (game.team1_score != null && game.team2_score != null) {
            gameScore = `${game.team1_score}-${game.team2_score}`;
          }
        }

        return {
          round_id: pick.round_id,
          round_name: round.name,
          round_date: round.date,
          team_name: team?.name || 'Unknown',
          team_seed: team?.seed || 0,
          team_abbreviation: team?.abbreviation || '???',
          team_logo_url: team?.logo_url || null,
          opponent_name: opponentName,
          opponent_seed: opponentSeed,
          is_correct: pick.is_correct,
          game_status: gameStatus,
          game_score: gameScore,
        } as RoundResult;
      })
      .filter((r): r is RoundResult => r !== null)
      .sort((a, b) => new Date(a.round_date).getTime() - new Date(b.round_date).getTime());

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

    const teamsUsed = roundResults.map(r => r.team_name);

    const currentRoundPick = activeRound
      ? roundResults.find(r => r.round_id === activeRound.id) || null
      : null;

    // Elimination round name
    let eliminationRoundName: string | null = null;
    if (player.is_eliminated && player.elimination_round_id) {
      const elimRound = roundMap.get(player.elimination_round_id);
      eliminationRoundName = elimRound?.name || null;
    }

    return {
      pool_player_id: player.id,
      user_id: player.user_id,
      display_name: player.display_name,
      entry_label: player.entry_label || player.display_name,
      is_eliminated: player.is_eliminated,
      elimination_reason: player.elimination_reason as 'wrong_pick' | 'missed_pick' | 'manual' | null,
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
    .map(r => ({ id: r.id, name: r.name, date: r.date, deadline_datetime: r.deadline_datetime }));

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
          name: activeRound.name,
          date: activeRound.date,
          deadline_datetime: activeRound.deadline_datetime,
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
      is_eliminated,
      entry_number,
      entry_label,
      pools:pool_id(
        id,
        name,
        status,
        join_code,
        creator_id,
        max_entries_per_user
      )
    `)
    .eq('user_id', userId)
    .order('entry_number', { ascending: true });

  if (memError) {
    throw new Error(`Failed to fetch pools: ${memError.message}`);
  }

  if (!memberships || memberships.length === 0) return [];

  // Deduplicate: group memberships by pool_id
  const poolGroups = new Map<string, typeof memberships>();
  for (const m of memberships) {
    const pool = m.pools as unknown as { id: string } | null;
    if (!pool) continue;
    const key = pool.id;
    if (!poolGroups.has(key)) poolGroups.set(key, []);
    poolGroups.get(key)!.push(m);
  }

  // 2. Get active round
  const { data: activeRounds } = await supabase
    .from('rounds')
    .select('id, name, deadline_datetime')
    .eq('is_active', true)
    .limit(1);

  const currentRound = activeRounds?.[0] || null;

  // 3. Build pool data (deduplicated by pool)
  const myPools: MyPool[] = [];

  for (const [, entries] of poolGroups) {
    const firstEntry = entries[0];
    const pool = firstEntry.pools as unknown as {
      id: string;
      name: string;
      status: string;
      join_code: string;
      creator_id: string;
      max_entries_per_user: number | null;
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
      .eq('is_eliminated', false);

    // Aggregate across all user entries in this pool
    let totalPicks = 0;
    let bestStreak = 0;
    let anyAlive = false;
    let anyPicked = false;
    const yourEntries: import('@/types/standings').MyPoolEntry[] = [];

    for (const entry of entries) {
      if (!entry.is_eliminated) anyAlive = true;

      const { data: userPicks } = await supabase
        .from('picks')
        .select('id, is_correct, round_id')
        .eq('pool_player_id', entry.id);

      const entryPickCount = userPicks?.length || 0;
      totalPicks += entryPickCount;

      const entryPickedToday = !!(currentRound && userPicks?.some(p => p.round_id === currentRound.id));
      if (entryPickedToday) anyPicked = true;

      let streak = 0;
      if (userPicks && userPicks.length > 0) {
        const sorted = [...userPicks].reverse();
        for (const p of sorted) {
          if (p.is_correct === true) streak++;
          else break;
        }
      }
      if (streak > bestStreak) bestStreak = streak;

      yourEntries.push({
        pool_player_id: entry.id,
        entry_number: (entry as any).entry_number ?? 1,
        entry_label: (entry as any).entry_label || `Entry ${(entry as any).entry_number ?? 1}`,
        is_eliminated: entry.is_eliminated,
        picks_count: entryPickCount,
        has_picked_today: entryPickedToday,
      });
    }

    myPools.push({
      pool_id: pool.id,
      pool_name: pool.name,
      pool_status: pool.status as 'open' | 'active' | 'complete',
      join_code: pool.join_code,
      creator_id: pool.creator_id,
      max_entries_per_user: pool.max_entries_per_user ?? 1,
      total_players: totalPlayers || 0,
      alive_players: alivePlayers || 0,
      your_status: anyAlive ? 'active' : 'eliminated',
      your_picks_count: totalPicks,
      your_streak: bestStreak,
      your_entry_count: entries.length,
      your_entries: yourEntries,
      current_round_name: currentRound?.name || null,
      has_picked_today: anyPicked,
      deadline_datetime: currentRound?.deadline_datetime || null,
    });
  }

  return myPools;
}

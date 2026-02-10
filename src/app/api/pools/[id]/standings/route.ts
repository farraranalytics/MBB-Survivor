import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getTournamentStateServer } from '@/lib/status-server';
import {
  StandingsPlayer,
  RoundResult,
  PoolLeaderboard,
} from '@/types/standings';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Authenticate
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: poolId } = await params;

  // Verify user is a member of this pool
  const { data: membership } = await supabaseAdmin
    .from('pool_players')
    .select('id')
    .eq('pool_id', poolId)
    .eq('user_id', user.id)
    .limit(1);

  if (!membership || membership.length === 0) {
    return NextResponse.json({ error: 'Not a member of this pool' }, { status: 403 });
  }

  try {
    const leaderboard = await buildLeaderboard(poolId);
    return NextResponse.json(leaderboard);
  } catch (err: any) {
    console.error('standings API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Server-side leaderboard builder using supabaseAdmin (bypasses RLS)
async function buildLeaderboard(poolId: string): Promise<PoolLeaderboard> {
  // 1. Pool info
  const { data: pool, error: poolError } = await supabaseAdmin
    .from('pools')
    .select('id, name, status, entry_fee, prize_pool')
    .eq('id', poolId)
    .single();

  if (poolError || !pool) {
    throw new Error(`Failed to fetch pool: ${poolError?.message || 'Not found'}`);
  }

  // 2. All rounds ordered by date
  const { data: rounds } = await supabaseAdmin
    .from('rounds')
    .select('id, name, date, deadline_datetime, is_active')
    .order('date', { ascending: true });

  const allRounds = rounds || [];

  // 3. Active round from tournament state
  const state = await getTournamentStateServer();
  const activeRoundId = state.currentRound?.id || null;
  const activeRound = allRounds.find(r => r.id === activeRoundId) || null;

  // 4. All players in pool
  const { data: players, error: playersError } = await supabaseAdmin
    .from('pool_players')
    .select('id, user_id, display_name, entry_label, is_eliminated, elimination_round_id, elimination_reason, joined_at')
    .eq('pool_id', poolId);

  if (playersError) {
    throw new Error(`Failed to fetch players: ${playersError.message}`);
  }

  // 5. All picks for players in this pool (admin client — bypasses RLS)
  const playerIds = (players || []).map(p => p.id);
  const { data: allPicks } = playerIds.length > 0
    ? await supabaseAdmin
        .from('picks')
        .select(`
          id,
          pool_player_id,
          round_id,
          team_id,
          is_correct,
          submitted_at,
          team:team_id(id, name, abbreviation, seed, logo_url, espn_team_id)
        `)
        .in('pool_player_id', playerIds)
    : { data: [] };

  // 6. All games with team data
  const { data: allGames } = await supabaseAdmin
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
      game_datetime,
      team1:team1_id(id, name, abbreviation, seed),
      team2:team2_id(id, name, abbreviation, seed)
    `);

  const picks = allPicks || [];
  const games = allGames || [];
  const roundMap = new Map(allRounds.map(r => [r.id, r]));

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

        const team = pick.team as unknown as { id: string; name: string; abbreviation: string; seed: number; logo_url: string | null; espn_team_id: number | null } | null;
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
          team_espn_id: team?.espn_team_id ?? null,
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

    let survivalStreak = 0;
    const reversed = [...roundResults].reverse();
    for (const r of reversed) {
      if (r.is_correct === true) survivalStreak++;
      else if (r.is_correct === false) break;
    }

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

  // Rounds that have been played (have picks), with completion status
  const roundsWithPicks = new Set(picks.map(p => p.round_id));
  const roundsPlayed = allRounds
    .filter(r => roundsWithPicks.has(r.id))
    .map(r => {
      const roundGames = games.filter(g => g.round_id === r.id);
      const is_complete = roundGames.length > 0 && roundGames.every(g => g.status === 'final');
      const gameTimes = roundGames
        .map(g => (g as any).game_datetime || '')
        .filter(Boolean)
        .sort();
      const deadline_datetime = gameTimes.length > 0
        ? new Date(new Date(gameTimes[0]).getTime() - 5 * 60 * 1000).toISOString()
        : r.deadline_datetime;
      return { id: r.id, name: r.name, date: r.date, deadline_datetime, is_complete };
    });

  const entryFee = parseFloat(pool.entry_fee) || 0;
  const prizePot = parseFloat(pool.prize_pool) || (entryFee * standingsPlayers.length);

  return {
    pool_id: poolId,
    pool_name: pool.name,
    pool_status: state.status === 'pre_tournament' ? 'open'
      : state.status === 'tournament_complete' ? 'complete'
      : 'active',
    entry_fee: entryFee,
    prize_pool: prizePot,
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
  } as PoolLeaderboard;
}

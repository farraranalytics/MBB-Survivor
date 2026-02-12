import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getTournamentStateServer } from '@/lib/status-server';

export interface MostPickedTeam {
  team_id: string;
  team_name: string;
  team_abbreviation: string;
  team_seed: number;
  team_region: string;
  team_logo_url: string | null;
  team_espn_id: number | null;
  count: number;
  pct: number;
  at_risk: number;
  opponent_name: string | null;
  opponent_abbreviation: string | null;
  opponent_seed: number | null;
  game_status: 'scheduled' | 'in_progress' | 'final';
  game_datetime: string | null;
  team_score: number | null;
  opponent_score: number | null;
}

export interface MostPickedResponse {
  round_id: string;
  round_name: string;
  is_locked: boolean;
  deadline: string | null;
  total_picks: number;
  teams: MostPickedTeam[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: poolId } = await params;

  // Verify membership
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
    const state = await getTournamentStateServer();
    const currentRound = state.currentRound;

    const emptyResponse = (roundId = '', roundName = '', locked = false, deadline: string | null = null) =>
      NextResponse.json({ round_id: roundId, round_name: roundName, is_locked: locked, deadline, total_picks: 0, teams: [] });

    if (!currentRound) return emptyResponse();

    const isLocked = currentRound.isDeadlinePassed;
    if (!isLocked) {
      return emptyResponse(currentRound.id, currentRound.name, false, currentRound.deadline || null);
    }

    // Get all alive entries in this pool
    const { data: poolPlayers } = await supabaseAdmin
      .from('pool_players')
      .select('id, is_eliminated')
      .eq('pool_id', poolId);

    const alivePlayerIds = (poolPlayers || []).filter(p => !p.is_eliminated).map(p => p.id);

    if (alivePlayerIds.length === 0) {
      return emptyResponse(currentRound.id, currentRound.name, true, currentRound.deadline || null);
    }

    // Get picks for current round from alive players
    const { data: picks } = await supabaseAdmin
      .from('picks')
      .select('id, pool_player_id, team_id, team:team_id(id, name, abbreviation, seed, region, logo_url, espn_team_id)')
      .eq('round_id', currentRound.id)
      .in('pool_player_id', alivePlayerIds);

    const allPicks = picks || [];
    const totalPicks = allPicks.length;

    if (totalPicks === 0) {
      return emptyResponse(currentRound.id, currentRound.name, true, currentRound.deadline || null);
    }

    // Group picks by team
    const teamGroups = new Map<string, { team: any; count: number }>();
    for (const pick of allPicks) {
      const teamId = pick.team_id;
      if (!teamGroups.has(teamId)) {
        teamGroups.set(teamId, { team: pick.team, count: 0 });
      }
      teamGroups.get(teamId)!.count++;
    }

    // Get games for this round
    const { data: games } = await supabaseAdmin
      .from('games')
      .select('id, team1_id, team2_id, status, team1_score, team2_score, game_datetime, team1:team1_id(id, name, abbreviation, seed), team2:team2_id(id, name, abbreviation, seed)')
      .eq('round_id', currentRound.id);

    const allGames = games || [];

    // Build response
    const teams: MostPickedTeam[] = [];
    for (const [teamId, group] of teamGroups) {
      const team = group.team as any;
      if (!team) continue;

      const game = allGames.find(g => g.team1_id === teamId || g.team2_id === teamId);

      let opponentName: string | null = null;
      let opponentAbbr: string | null = null;
      let opponentSeed: number | null = null;
      let gameStatus: 'scheduled' | 'in_progress' | 'final' = 'scheduled';
      let gameDatetime: string | null = null;
      let teamScore: number | null = null;
      let opponentScore: number | null = null;

      if (game) {
        gameStatus = game.status as 'scheduled' | 'in_progress' | 'final';
        gameDatetime = game.game_datetime;
        const t1 = game.team1 as any;
        const t2 = game.team2 as any;

        if (game.team1_id === teamId) {
          opponentName = t2?.name || null;
          opponentAbbr = t2?.abbreviation || null;
          opponentSeed = t2?.seed || null;
          teamScore = game.team1_score;
          opponentScore = game.team2_score;
        } else {
          opponentName = t1?.name || null;
          opponentAbbr = t1?.abbreviation || null;
          opponentSeed = t1?.seed || null;
          teamScore = game.team2_score;
          opponentScore = game.team1_score;
        }
      }

      teams.push({
        team_id: teamId,
        team_name: team.name,
        team_abbreviation: team.abbreviation || '???',
        team_seed: team.seed || 0,
        team_region: team.region || '',
        team_logo_url: team.logo_url || null,
        team_espn_id: team.espn_team_id ?? null,
        count: group.count,
        pct: Math.round((group.count / totalPicks) * 100),
        at_risk: group.count,
        opponent_name: opponentName,
        opponent_abbreviation: opponentAbbr,
        opponent_seed: opponentSeed,
        game_status: gameStatus,
        game_datetime: gameDatetime,
        team_score: teamScore,
        opponent_score: opponentScore,
      });
    }

    teams.sort((a, b) => b.count - a.count);

    return NextResponse.json({
      round_id: currentRound.id,
      round_name: currentRound.name,
      is_locked: true,
      deadline: currentRound.deadline || null,
      total_picks: totalPicks,
      teams,
    });
  } catch (err: any) {
    console.error('most-picked API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

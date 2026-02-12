import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getTournamentStateServer } from '@/lib/status-server';
import { deleteCascadedGames } from '@/lib/game-processing';
import { clearServerClockCache } from '@/lib/clock-server';

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
    const roundId = body.roundId;
    const resetAll = body.all === true;

    // ── Full tournament reset ─────────────────────────────────
    if (resetAll) {
      // Delete all cascade-created games (games with bracket_position set)
      const { data: cascadeGames } = await supabaseAdmin
        .from('games')
        .delete()
        .not('bracket_position', 'is', null)
        .select('id');

      // Also delete any games with only one team (partial cascade)
      const { data: allGames } = await supabaseAdmin
        .from('games')
        .select('id, team1_id, team2_id');

      const partialIds = (allGames || [])
        .filter(g => (!g.team1_id || !g.team2_id) && (g.team1_id || g.team2_id))
        .map(g => g.id);

      if (partialIds.length > 0) {
        await supabaseAdmin.from('games').delete().in('id', partialIds);
      }

      // Reset remaining games (seed data R64 games)
      await supabaseAdmin
        .from('games')
        .update({ status: 'scheduled', winner_id: null, team1_score: null, team2_score: null })
        .neq('status', 'scheduled');

      // Un-eliminate all teams
      await supabaseAdmin
        .from('teams')
        .update({ is_eliminated: false })
        .eq('is_eliminated', true);

      // Clear all pick results
      await supabaseAdmin
        .from('picks')
        .update({ is_correct: null })
        .not('is_correct', 'is', null);

      // Un-eliminate all players
      const { data: revivedPlayers } = await supabaseAdmin
        .from('pool_players')
        .update({ is_eliminated: false, elimination_round_id: null, elimination_reason: null })
        .eq('is_eliminated', true)
        .eq('entry_deleted', false)
        .select('id');

      // Revert pools
      await supabaseAdmin
        .from('pools')
        .update({ status: 'active', winner_id: null })
        .eq('status', 'complete');

      // Reset test mode clock
      await supabaseAdmin
        .from('admin_test_state')
        .update({
          is_test_mode: false,
          simulated_datetime: null,
          target_round_id: null,
          phase: 'pre_round',
          updated_at: new Date().toISOString(),
        })
        .not('id', 'is', null);

      clearServerClockCache();

      return NextResponse.json({
        success: true,
        mode: 'full_reset',
        cascadeGamesDeleted: (cascadeGames?.length || 0) + partialIds.length,
        playersRevived: revivedPlayers?.length || 0,
      });
    }

    // ── Single round reset ────────────────────────────────────
    let round;
    if (roundId) {
      const { data } = await supabaseAdmin
        .from('rounds')
        .select('id, name')
        .eq('id', roundId)
        .single();
      round = data;
    } else {
      const state = await getTournamentStateServer();
      const currentRoundId = state.currentRound?.id;
      if (currentRoundId) {
        const { data } = await supabaseAdmin
          .from('rounds')
          .select('id, name')
          .eq('id', currentRoundId)
          .single();
        round = data;
      }
    }

    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // 1. Delete cascade-created games in NEXT rounds
    const cascadeDeleted = await deleteCascadedGames(round.id);

    // 2. Get games in this round to find losers
    const { data: games } = await supabaseAdmin
      .from('games')
      .select('id, team1_id, team2_id, winner_id')
      .eq('round_id', round.id);

    const loserIds: string[] = [];
    for (const game of (games || [])) {
      if (game.winner_id) {
        const loserId = game.winner_id === game.team1_id ? game.team2_id : game.team1_id;
        loserIds.push(loserId);
      }
    }

    // 3. Reset all games in this round — NEVER touch game_datetime
    await supabaseAdmin
      .from('games')
      .update({
        status: 'scheduled',
        winner_id: null,
        team1_score: null,
        team2_score: null,
      })
      .eq('round_id', round.id);

    // 4. Un-eliminate teams that lost in this round
    if (loserIds.length > 0) {
      await supabaseAdmin
        .from('teams')
        .update({ is_eliminated: false })
        .in('id', loserIds);
    }

    // 5. Reset picks for this round (clear is_correct)
    await supabaseAdmin
      .from('picks')
      .update({ is_correct: null })
      .eq('round_id', round.id);

    // 6. Un-eliminate players eliminated in this round
    const { data: revivedPlayers } = await supabaseAdmin
      .from('pool_players')
      .update({
        is_eliminated: false,
        elimination_round_id: null,
        elimination_reason: null,
      })
      .eq('elimination_round_id', round.id)
      .eq('entry_deleted', false)
      .select('id');

    // 7. Revert pools back to active
    await supabaseAdmin
      .from('pools')
      .update({ status: 'active', winner_id: null })
      .eq('status', 'complete');

    return NextResponse.json({
      success: true,
      round: round.name,
      gamesReset: games?.length || 0,
      teamsRevived: loserIds.length,
      playersRevived: revivedPlayers?.length || 0,
      cascadeGamesDeleted: cascadeDeleted,
    });

  } catch (err: any) {
    console.error('reset-round error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

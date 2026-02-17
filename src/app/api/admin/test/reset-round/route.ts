import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getTournamentStateServer } from '@/lib/status-server';
import { clearBracketAdvancement } from '@/lib/game-processing';
import { mapRoundNameToCode } from '@/lib/bracket';
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
      // Clear team slots on all R32+ shell games (keep shells intact)
      const { data: clearedShells } = await supabaseAdmin
        .from('games')
        .update({
          team1_id: null,
          team2_id: null,
          winner_id: null,
          team1_score: null,
          team2_score: null,
          status: 'scheduled',
        })
        .in('tournament_round', ['R32', 'S16', 'E8', 'F4', 'CHIP'])
        .select('id');

      // Reset R64 games (keep teams, clear results)
      await supabaseAdmin
        .from('games')
        .update({ status: 'scheduled', winner_id: null, team1_score: null, team2_score: null })
        .eq('tournament_round', 'R64')
        .neq('status', 'scheduled');

      // Un-eliminate all teams
      await supabaseAdmin
        .from('teams')
        .update({ is_eliminated: false })
        .eq('is_eliminated', true);

      // Clear all pick results (safe UPDATE — never DELETE picks to avoid FK cascade)
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
        shellGamesCleared: clearedShells?.length || 0,
        playersRevived: revivedPlayers?.length || 0,
      });
    }

    // ── Rewind to before selected round (resets it + all later rounds) ──
    let targetRound;
    if (roundId) {
      const { data } = await supabaseAdmin
        .from('rounds')
        .select('id, name, date')
        .eq('id', roundId)
        .single();
      targetRound = data;
    } else {
      const state = await getTournamentStateServer();
      const currentRoundId = state.currentRound?.id;
      if (currentRoundId) {
        const { data } = await supabaseAdmin
          .from('rounds')
          .select('id, name, date')
          .eq('id', currentRoundId)
          .single();
        targetRound = data;
      }
    }

    if (!targetRound) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // Get the selected round + all rounds after it (to cascade-reset)
    const { data: roundsToReset } = await supabaseAdmin
      .from('rounds')
      .select('id, name')
      .gte('date', targetRound.date)
      .order('date', { ascending: false }); // latest first

    if (!roundsToReset || roundsToReset.length === 0) {
      return NextResponse.json({ error: 'No rounds to reset' }, { status: 400 });
    }

    const roundIdsToReset = roundsToReset.map(r => r.id);
    const roundNames = roundsToReset.map(r => r.name);

    // 1. Clear bracket advancement from selected round onward
    const roundCode = mapRoundNameToCode(targetRound.name);
    const shellsCleared = await clearBracketAdvancement(roundCode);

    // 2. Get all games in affected rounds to find losers
    const { data: games } = await supabaseAdmin
      .from('games')
      .select('id, round_id, team1_id, team2_id, winner_id')
      .in('round_id', roundIdsToReset);

    const loserIds: string[] = [];
    for (const game of (games || [])) {
      if (game.winner_id) {
        const loserId = game.winner_id === game.team1_id ? game.team2_id : game.team1_id;
        if (loserId) loserIds.push(loserId);
      }
    }

    // 3. Reset all games in affected rounds — NEVER touch game_datetime
    await supabaseAdmin
      .from('games')
      .update({
        status: 'scheduled',
        winner_id: null,
        team1_score: null,
        team2_score: null,
      })
      .in('round_id', roundIdsToReset);

    // 4. Un-eliminate teams that lost in affected rounds
    if (loserIds.length > 0) {
      await supabaseAdmin
        .from('teams')
        .update({ is_eliminated: false })
        .in('id', loserIds);
    }

    // 5. Reset picks for affected rounds (clear is_correct)
    await supabaseAdmin
      .from('picks')
      .update({ is_correct: null })
      .in('round_id', roundIdsToReset);

    // 6. Un-eliminate players eliminated in any affected round
    const { data: revivedPlayers } = await supabaseAdmin
      .from('pool_players')
      .update({
        is_eliminated: false,
        elimination_round_id: null,
        elimination_reason: null,
      })
      .in('elimination_round_id', roundIdsToReset)
      .eq('entry_deleted', false)
      .select('id');

    // 7. Revert pools back to active
    await supabaseAdmin
      .from('pools')
      .update({ status: 'active', winner_id: null })
      .eq('status', 'complete');

    return NextResponse.json({
      success: true,
      roundsReset: roundNames,
      gamesReset: games?.length || 0,
      teamsRevived: loserIds.length,
      playersRevived: revivedPlayers?.length || 0,
      shellGamesCleared: shellsCleared,
    });

  } catch (err: any) {
    console.error('reset-round error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

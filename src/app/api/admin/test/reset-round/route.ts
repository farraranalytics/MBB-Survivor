import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

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
    const roundId = body.roundId; // Optional — defaults to active round

    // Get the round to reset
    let round;
    if (roundId) {
      const { data } = await supabaseAdmin
        .from('rounds')
        .select('id, name')
        .eq('id', roundId)
        .single();
      round = data;
    } else {
      // Default to active round
      const { data } = await supabaseAdmin
        .from('rounds')
        .select('id, name')
        .eq('is_active', true)
        .single();
      round = data;
    }

    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // 1. Reset all games in this round
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

    await supabaseAdmin
      .from('games')
      .update({
        status: 'scheduled',
        winner_id: null,
        team1_score: null,
        team2_score: null,
      })
      .eq('round_id', round.id);

    // 2. Un-eliminate teams that lost in this round
    if (loserIds.length > 0) {
      await supabaseAdmin
        .from('teams')
        .update({ is_eliminated: false })
        .in('id', loserIds);
    }

    // 3. Reset picks for this round (clear is_correct)
    await supabaseAdmin
      .from('picks')
      .update({ is_correct: null })
      .eq('round_id', round.id);

    // 4. Un-eliminate players eliminated in this round
    const { data: revivedPlayers } = await supabaseAdmin
      .from('pool_players')
      .update({
        is_eliminated: false,
        elimination_round_id: null,
        elimination_reason: null,
      })
      .eq('elimination_round_id', round.id)
      .select('id');

    // 5. Re-activate this round
    await supabaseAdmin
      .from('rounds')
      .update({ is_active: true })
      .eq('id', round.id);

    // 6. Revert pools back to active (in case they were completed)
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
    });

  } catch (err: any) {
    console.error('reset-round error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
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
    const body = await request.json();
    const { round_id, phase, datetime, enabled } = body;

    // If toggling test mode off
    if (enabled === false) {
      await supabaseAdmin
        .from('admin_test_state')
        .update({
          is_test_mode: false,
          simulated_datetime: null,
          target_round_id: null,
          phase: 'pre_round',
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .not('id', 'is', null); // update the singleton

      clearServerClockCache();

      return NextResponse.json({
        success: true,
        is_test_mode: false,
        simulated_datetime: null,
      });
    }

    let simulatedDatetime: string;

    if (datetime) {
      // Direct datetime override
      simulatedDatetime = new Date(datetime).toISOString();
    } else if (round_id && phase) {
      // Compute from round + phase
      const { data: round } = await supabaseAdmin
        .from('rounds')
        .select('id, name, date, deadline_datetime')
        .eq('id', round_id)
        .single();

      if (!round) {
        return NextResponse.json({ error: 'Round not found' }, { status: 404 });
      }

      simulatedDatetime = computeSimulatedTime(round, phase);
    } else {
      return NextResponse.json(
        { error: 'Provide either { round_id, phase } or { datetime }' },
        { status: 400 }
      );
    }

    await supabaseAdmin
      .from('admin_test_state')
      .update({
        is_test_mode: true,
        simulated_datetime: simulatedDatetime,
        target_round_id: round_id || null,
        phase: phase || 'pre_round',
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .not('id', 'is', null); // update the singleton

    clearServerClockCache();

    return NextResponse.json({
      success: true,
      is_test_mode: true,
      simulated_datetime: simulatedDatetime,
      phase: phase || null,
      round_id: round_id || null,
    });

  } catch (err: any) {
    console.error('set-clock error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Compute the simulated time for a round + phase combination.
 */
function computeSimulatedTime(
  round: { date: string; deadline_datetime: string },
  phase: string
): string {
  const date = round.date; // e.g., "2026-03-19"

  switch (phase) {
    case 'pre_round':
      // 8 AM ET = noon UTC (before deadline — picks allowed)
      return `${date}T12:00:00+00:00`;

    case 'live': {
      // 1 hour after deadline (picks locked, games in progress)
      const deadline = new Date(round.deadline_datetime);
      return new Date(deadline.getTime() + 60 * 60 * 1000).toISOString();
    }

    case 'post_round':
      // 11:55 PM ET = next day 03:55 UTC (all games should be final)
      return `${date}T03:55:00+00:00`;

    default:
      return new Date().toISOString();
  }
}

// Also support GET to read current test state
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('admin_test_state')
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

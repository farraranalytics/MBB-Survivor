import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyCronAuth } from '@/lib/cron-auth';

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = {
      activated: null as string | null,
      deactivated: [] as string[],
      poolsTransitioned: 0,
    };

    // Current time in UTC
    const now = new Date();

    // 1. Get all rounds ordered by date
    const { data: rounds } = await supabaseAdmin
      .from('rounds')
      .select('id, name, date, deadline_datetime, is_active')
      .order('date', { ascending: true });

    if (!rounds) return NextResponse.json({ message: 'No rounds found' });

    // 2. Find today's round (where date = today in ET)
    const todayET = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayStr = todayET.toISOString().split('T')[0]; // YYYY-MM-DD

    const todayRound = rounds.find(r => r.date === todayStr);
    const currentlyActive = rounds.find(r => r.is_active);

    // 3. If today has a round and it's not already active, activate it
    if (todayRound && !todayRound.is_active) {
      // Check if deadline is within the next 6 hours (games are today)
      const deadlineTime = new Date(todayRound.deadline_datetime);
      const hoursUntilDeadline = (deadlineTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilDeadline <= 6 && hoursUntilDeadline >= -24) {
        // Deactivate any currently active round
        if (currentlyActive && currentlyActive.id !== todayRound.id) {
          await supabaseAdmin
            .from('rounds')
            .update({ is_active: false })
            .eq('id', currentlyActive.id);
          results.deactivated.push(currentlyActive.name);
        }

        // Activate today's round
        await supabaseAdmin
          .from('rounds')
          .update({ is_active: true })
          .eq('id', todayRound.id);
        results.activated = todayRound.name;

        // 4. Pool status: open → active (if this is the first round being activated)
        const isFirstRound = rounds[0]?.id === todayRound.id;
        if (isFirstRound || !rounds.some(r => r.date < todayStr)) {
          const { data: transitioned } = await supabaseAdmin
            .from('pools')
            .update({ status: 'active' })
            .eq('status', 'open')
            .select('id');
          results.poolsTransitioned = transitioned?.length || 0;
        }
      }
    }

    return NextResponse.json({ success: true, results });

  } catch (err: any) {
    console.error('activate-rounds error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

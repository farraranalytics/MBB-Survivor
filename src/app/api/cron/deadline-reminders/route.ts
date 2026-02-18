import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyCronAuth } from '@/lib/cron-auth';
import { sendBulkNotifications } from '@/lib/notifications';

/**
 * Cron job: Send deadline reminder notifications.
 * Checks for rounds with deadlines approaching (~24h and ~1h windows).
 * Sends to alive entries that haven't picked yet.
 *
 * Designed to run every 30 minutes. Uses time windows to avoid duplicate sends:
 * - 24h reminder: 23-25h before deadline
 * - 1h reminder: 30min-1.5h before deadline
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const results = { reminders24h: 0, reminders1h: 0, errors: [] as string[] };

    // Get active round with deadline
    const { data: activeRound } = await supabaseAdmin
      .from('rounds')
      .select('id, name, deadline_datetime')
      .eq('is_active', true)
      .single();

    if (!activeRound) {
      return NextResponse.json({ message: 'No active round', results });
    }

    const deadline = new Date(activeRound.deadline_datetime);
    const hoursUntil = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Determine which reminder window we're in
    const is24hWindow = hoursUntil >= 23 && hoursUntil <= 25;
    const is1hWindow = hoursUntil >= 0.5 && hoursUntil <= 1.5;

    if (!is24hWindow && !is1hWindow) {
      return NextResponse.json({ message: `Not in reminder window (${hoursUntil.toFixed(1)}h until deadline)`, results });
    }

    // Get alive entries that haven't picked for this round
    const { data: alivePlayers } = await supabaseAdmin
      .from('pool_players')
      .select('id, user_id, pool_id')
      .eq('is_eliminated', false)
      .eq('entry_deleted', false);

    if (!alivePlayers || alivePlayers.length === 0) {
      return NextResponse.json({ message: 'No alive players', results });
    }

    const aliveIds = alivePlayers.map(p => p.id);

    // Find who already has picks for this round
    const { data: existingPicks } = await supabaseAdmin
      .from('picks')
      .select('pool_player_id')
      .eq('round_id', activeRound.id)
      .in('pool_player_id', aliveIds);

    const pickedIds = new Set(existingPicks?.map(p => p.pool_player_id) || []);
    const unpickedPlayers = alivePlayers.filter(p => !pickedIds.has(p.id));

    if (unpickedPlayers.length === 0) {
      return NextResponse.json({ message: 'All alive players have picked', results });
    }

    // Get pool names
    const poolIds = [...new Set(unpickedPlayers.map(p => p.pool_id))];
    const { data: pools } = await supabaseAdmin
      .from('pools')
      .select('id, name')
      .in('id', poolIds);
    const poolMap = new Map(pools?.map(p => [p.id, p.name]) || []);

    // Deduplicate by user_id + pool_id (multi-entry users get one notification per pool)
    const seen = new Set<string>();
    const uniqueEntries = unpickedPlayers.filter(p => {
      const key = `${p.user_id}:${p.pool_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const deadlineStr = deadline.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });

    const urgency = is1hWindow ? '1 hour' : '24 hours';
    const notifs = uniqueEntries.map(e => ({
      userId: e.user_id,
      title: is1hWindow ? 'Pick Deadline Soon!' : 'Pick Reminder',
      message: `You have ~${urgency} to make your ${activeRound.name} pick in ${poolMap.get(e.pool_id) || 'your pool'}. Deadline: ${deadlineStr} ET.`,
      url: `/pools/${e.pool_id}/pick`,
      type: 'deadline_reminder' as const,
      poolId: e.pool_id,
    }));

    const sendResult = await sendBulkNotifications(notifs);

    if (is24hWindow) results.reminders24h = sendResult.sent;
    else results.reminders1h = sendResult.sent;

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error('deadline-reminders error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

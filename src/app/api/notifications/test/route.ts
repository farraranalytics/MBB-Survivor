import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const poolId = body.pool_id;

  // Get pool name for the test message
  let poolName = 'your pool';
  if (poolId) {
    const { data: pool } = await supabaseAdmin
      .from('pools')
      .select('name')
      .eq('id', poolId)
      .single();
    if (pool) poolName = pool.name;
  }

  // Get active push subscriptions for this user
  const { data: subscriptions, error: fetchError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (fetchError) {
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No active subscriptions' });
  }

  const payload = JSON.stringify({
    title: 'Test Notification',
    message: `Push notifications are working for ${poolName}!`,
    url: poolId ? `/pools/${poolId}/pick` : '/dashboard',
    icon: '/icons/icon-192.png',
  });

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      );
      sent++;
    } catch (err: any) {
      failed++;
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabaseAdmin
          .from('push_subscriptions')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', sub.id);
      }
    }
  }

  return NextResponse.json({ sent, failed });
}

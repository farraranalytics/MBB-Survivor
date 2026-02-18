import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function POST(request: NextRequest) {
  // Internal-only: check for authorization header or service role key
  const authHeader = request.headers.get('authorization');
  const expectedKey = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
  if (authHeader !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { user_id, title, message, url, type } = body;

  if (!user_id || !title || !message) {
    return NextResponse.json({ error: 'Missing required fields: user_id, title, message' }, { status: 400 });
  }

  // Get active push subscriptions for the user
  const { data: subscriptions, error: fetchError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', user_id)
    .eq('is_active', true);

  if (fetchError) {
    console.error('Failed to fetch subscriptions:', fetchError);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No active subscriptions' });
  }

  const payload = JSON.stringify({
    title,
    message,
    url: url || '/dashboard',
    icon: '/icons/icon-192.png',
  });

  let sent = 0;
  let failed = 0;

  // Send to all active subscriptions
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payload,
      );
      sent++;
    } catch (err: any) {
      failed++;
      // 410 Gone or 404 means the subscription is no longer valid
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabaseAdmin
          .from('push_subscriptions')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', sub.id);
      } else {
        console.error(`Push failed for subscription ${sub.id}:`, err.statusCode, err.body);
      }
    }
  }

  // Also store in the notifications table for in-app history
  await supabaseAdmin.from('notifications').insert({
    user_id,
    type: type || 'general',
    title,
    message,
  });

  return NextResponse.json({ sent, failed });
}

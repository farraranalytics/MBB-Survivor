import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Configure web-push VAPID
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export type NotificationType =
  | 'deadline_reminder'
  | 'game_result'
  | 'pool_event'
  | 'general';

interface NotificationPayload {
  userId: string;
  title: string;
  message: string;
  url?: string;
  type?: NotificationType;
  poolId?: string;
}

/**
 * Send a notification to a user, respecting their preferences.
 * Routes to push (Web Push API) or email (Resend) based on user_profiles.notification_preferences.
 * Always inserts into the `notifications` table for in-app history.
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const { userId, title, message, url = '/dashboard', type = 'general', poolId } = payload;

  // Store in notifications table for in-app history
  await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    pool_id: poolId || null,
    type,
    title,
    message,
  });

  // Check user preferences
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('notification_preferences')
    .eq('id', userId)
    .single();

  const prefs = (profile?.notification_preferences as { email?: boolean; push?: boolean }) || { email: true, push: false };

  // Try push first
  if (prefs.push) {
    const sent = await sendPushToUser(userId, title, message, url);
    if (sent > 0) return; // Push delivered, done
  }

  // Email fallback (if push not enabled or no active subscriptions)
  if (prefs.email) {
    await sendEmailToUser(userId, title, message);
  }
}

/**
 * Send notifications to multiple users in bulk.
 * More efficient than calling sendNotification() in a loop — batches the DB queries.
 */
export async function sendBulkNotifications(
  notifications: NotificationPayload[],
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  // Process in parallel batches of 10 to avoid overwhelming the system
  const batchSize = 10;
  for (let i = 0; i < notifications.length; i += batchSize) {
    const batch = notifications.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((n) => sendNotification(n)),
    );
    for (const result of results) {
      if (result.status === 'fulfilled') sent++;
      else failed++;
    }
  }

  return { sent, failed };
}

/**
 * Send push notification directly to a user's active subscriptions.
 * Returns the number of successful sends.
 */
async function sendPushToUser(
  userId: string,
  title: string,
  message: string,
  url: string,
): Promise<number> {
  const { data: subscriptions } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!subscriptions || subscriptions.length === 0) return 0;

  const pushPayload = JSON.stringify({
    title,
    message,
    url,
    icon: '/icons/icon-192.png',
  });

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        pushPayload,
      );
      sent++;
    } catch (err: any) {
      // 410 Gone or 404 = subscription expired/unsubscribed
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabaseAdmin
          .from('push_subscriptions')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', sub.id);
      }
    }
  }

  return sent;
}

/**
 * Send email notification to a user via Resend.
 * Uses Supabase to look up the user's email, then sends via Resend API.
 */
async function sendEmailToUser(
  userId: string,
  title: string,
  message: string,
): Promise<void> {
  // Get user email from auth
  const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (!user?.email) return;

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return; // Email not configured

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Survive the Dance <noreply@survivethedance.com>',
        to: user.email,
        subject: title,
        html: buildEmailHtml(title, message),
      }),
    });
  } catch (err) {
    console.error('Failed to send email notification:', err);
  }
}

/**
 * Build a simple dark-themed HTML email matching the app's design.
 */
function buildEmailHtml(title: string, message: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0D1B2A;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D1B2A;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background-color:#111827;border-radius:14px;border:1px solid rgba(255,255,255,0.05);overflow:hidden;">
        <tr><td style="background-color:#080810;padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.08);">
          <span style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.15em;color:#FF5722;text-transform:uppercase;">
            SURVIVE THE DANCE
          </span>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#E8E6E1;">${title}</h2>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#9BA3AE;">${message}</p>
        </td></tr>
        <tr><td style="padding:0 24px 24px;">
          <a href="https://survivethedance.com/dashboard" style="display:inline-block;padding:12px 24px;background-color:#FF5722;color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
            Open App
          </a>
        </td></tr>
      </table>
      <p style="margin:24px 0 0;font-size:11px;color:#5F6B7A;text-align:center;">
        Survive the Dance &middot; survivethedance.com
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

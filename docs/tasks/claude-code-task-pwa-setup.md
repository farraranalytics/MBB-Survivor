# Task: PWA Setup — Installable App + Push Notifications

## Goal
Turn Survive the Dance into a Progressive Web App (PWA) so users can:
- Install it on their homescreen (looks/feels like a native app)
- Receive push notifications for deadlines, results, and pool events
- Use email fallback for iOS (no Web Push support on Safari)

---

## Current State (updated 2026-02-17)
- **Phase 1 COMPLETE** — app is installable as PWA
- **Phase 2 COMPLETE** — push notification infrastructure built
- **Phase 3 COMPLETE** — notification events hooked in (all game/pool events + deadline reminders)
- **PWA icons:** `public/icons/icon-192.png`, `icon-384.png`, `icon-512.png`, `apple-touch-icon-180.png` (generated from `app-store-icon-1024.png`)
- **Manifest:** `src/app/manifest.ts` (Next.js built-in convention, serves at `/manifest.webmanifest`)
- **Service worker:** `src/app/sw.ts` → builds to `public/sw.js` (46KB) via Serwist
- **next.config.ts:** Wrapped with `withSerwistInit({ swSrc: 'src/app/sw.ts', swDest: 'public/sw.js' })`
- **layout.tsx:** Has PWA meta tags (theme-color, apple-mobile-web-app-capable, apple-touch-icon)
- **package.json:** `@serwist/next` (dep), `serwist` (devDep), build script uses `--webpack`
- **Existing DB:** `notifications` table (id, user_id, pool_id, type, title, message, is_read, sent_at), `user_profiles.notification_preferences` JSONB (`{"email": true, "push": false}`)
- **Email:** Resend SMTP already configured via Supabase custom SMTP
- **GOTCHA:** Must only have ONE `next.config.*` file — `.js`/`.mjs` take precedence over `.ts` and silently ignore it

---

## Phase 1: Installable PWA (Homescreen)

### 1.1 Generate PWA Icons
- [x] Scale `app-store-icon-1024.png` → `public/icons/icon-192.png`, `icon-384.png`, `icon-512.png`
- [x] Create `public/icons/apple-touch-icon-180.png` for iOS
- [ ] Optionally create maskable variants (192×192 with safe zone padding)

### 1.2 Create Web App Manifest
- [x] Create `src/app/manifest.ts` (Next.js built-in convention, serves at `/manifest.webmanifest`):
```json
{
  "name": "Survive the Dance",
  "short_name": "Survive",
  "description": "Free March Madness survivor pool. Pick one team per round — survive or go home.",
  "start_url": "/dashboard",
  "display": "standalone",
  "theme_color": "#0D1B2A",
  "background_color": "#0D1B2A",
  "orientation": "portrait-primary",
  "categories": ["sports", "games"],
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-384.png", "sizes": "384x384", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
  ]
}
```

### 1.3 Add PWA Meta Tags to layout.tsx
- [x] Add to `<head>`:
```html
<meta name="theme-color" content="#0D1B2A" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Survive the Dance" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png" />
<link rel="manifest" href="/manifest.json" />
```

### 1.4 Service Worker Setup (Serwist)
- [x] `npm install @serwist/next` (Next.js integration for Serwist)
- [x] Update `next.config.ts` to wrap with Serwist plugin
- [x] Create `src/app/sw.ts` (service worker entry point)
- [x] Configure caching strategies (using Serwist `defaultCache`)
- [x] Verify: `npm run build` produces `/sw.js` in output (46KB generated)
- [ ] Verify: Chrome DevTools → Application → Service Workers shows registered SW
- [ ] Verify: Lighthouse PWA audit passes (installable + service worker)

### 1.5 Verify Install Prompt
- [ ] Test on Android Chrome: "Add to Home Screen" prompt appears
- [ ] Test on iOS Safari: Share → Add to Home Screen works
- [ ] App opens in standalone mode (no browser chrome)
- [ ] Splash screen shows correct background color + icon

---

## Phase 2: Push Notification Infrastructure

### 2.1 VAPID Keys + Dependencies
- [x] `npm install web-push` (server-side push sending)
- [x] Generate VAPID keys: `npx web-push generate-vapid-keys`
- [x] Store in `.env.local`:
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY=...`
  - `VAPID_PRIVATE_KEY=...`
  - `VAPID_SUBJECT=mailto:noreply@survivethedance.com`
- [ ] Add to Vercel environment variables
- [x] `npm install --save-dev @types/web-push`

### 2.2 Push Subscriptions Table
- [x] Create Supabase migration:
```sql
CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id) WHERE is_active = true;
```

### 2.3 API Routes
- [x] `POST /api/notifications/subscribe` — store push subscription from client
  - Receives: `{ endpoint, keys: { p256dh, auth } }`
  - Upserts into `push_subscriptions` table
  - Updates `user_profiles.notification_preferences.push = true`
- [x] `POST /api/notifications/unsubscribe` — deactivate subscription
  - Sets `is_active = false` on matching endpoint
  - Updates `user_profiles.notification_preferences.push = false`
- [x] `POST /api/notifications/send` — internal route to send push (called by cron/processing)
  - Accepts: `{ user_id, title, message, url, type }`
  - Looks up active subscriptions for user
  - Sends via `web-push` library
  - Marks failed subscriptions as inactive (410 Gone = unsubscribed)

### 2.4 Client-Side Push Registration
- [x] Create `src/lib/push.ts` helper:
  - `requestNotificationPermission()` — prompts user, returns granted/denied
  - `subscribeToPush()` — gets SW registration, calls `pushManager.subscribe()`, POSTs to API
  - `unsubscribeFromPush()` — unsubscribes and POSTs to API
- [x] Add push event listener to service worker (`sw.ts`):
  - `self.addEventListener('push', ...)` — shows notification with icon, badge, data
  - `self.addEventListener('notificationclick', ...)` — navigates to relevant page

### 2.5 Permission Prompt UI
- [x] Create notification opt-in component (`NotificationToggle.tsx`)
- [x] Detect platform: show "Enable notifications" on Android/Desktop, "Email alerts" note on iOS
- [x] Settings page: toggle push on/off (both `/settings` and `/pools/[id]/settings`)

---

## Phase 3: Notification Events

### 3.1 Pick Deadline Reminders
- [x] Cron route created: `/api/cron/deadline-reminders`
- [x] Send push 24h before deadline to users with unpicked alive entries
- [x] Send push 1h before deadline to users with unpicked alive entries
- [x] Notification type: `deadline_reminder`
- [x] Click action: navigate to `/pools/[id]/pick`
- [x] cron-job.org job configured: every 30 min on game days, `Authorization: Bearer <CRON_SECRET>` header

### 3.2 Game Results / Elimination Alerts
- [x] Hooked into `process-results/route.ts` (wrong pick eliminations inline)
- [x] After wrong picks: send "Your pick lost. Eliminated from [Pool Name]."
- [x] After `processMissedPicks()`: send "Missed the deadline. Eliminated from [Pool Name]."
- [x] After `processNoAvailablePicks()`: send "Ran out of teams. Eliminated from [Pool Name]."
- [x] After successful pick result: send "Your pick won! You advance in [Pool Name]."
- [x] Notification type: `game_result`
- [x] Click action: navigate to `/pools/[id]/standings`

### 3.3 Pool Lifecycle Events
- [x] Pool goes active: "Your pool [Name] is now live. Make your first pick!" (in `activateTodaysRound`)
- [x] New round starts: "New round available in [Pool Name]. Pick before [deadline]." (in `activateTodaysRound`)
- [x] Pool complete / champion: "You are the champion of [Pool Name]!" / "Co-champion" (in `checkForChampions`)
- [x] Notification type: `pool_event`
- [x] Click action: navigate to `/pools/[id]/standings` or `/pools/[id]/pick`

### 3.4 Email Fallback
- [x] `notifications.ts` checks `user_profiles.notification_preferences`
- [x] Push attempted first; if no active subscriptions, falls back to Resend email
- [x] Dark-themed HTML email template matching app design
- [x] Respects `email = false` preference — skips email if disabled
- **NOTE:** Email fallback requires `RESEND_API_KEY` env var (separate from Supabase SMTP)

---

## Files Changed/Created

### Phase 1 (DONE)
| File | Action | Status |
|------|--------|--------|
| `src/app/manifest.ts` | CREATE (Next.js built-in convention) | Done |
| `public/icons/icon-192.png` | CREATE (scaled from 1024) | Done |
| `public/icons/icon-384.png` | CREATE (scaled from 1024) | Done |
| `public/icons/icon-512.png` | CREATE (scaled from 1024) | Done |
| `public/icons/apple-touch-icon-180.png` | CREATE (scaled from 1024) | Done |
| `src/app/layout.tsx` | MODIFY (add PWA meta tags) | Done |
| `next.config.ts` | REWRITE (wrap with Serwist plugin) | Done |
| `next.config.js` | DELETE (was overriding .ts) | Done |
| `next.config.mjs` | DELETE (was overriding .ts) | Done |
| `src/app/sw.ts` | CREATE (Serwist service worker entry) | Done |
| `tsconfig.json` | MODIFY (add webworker lib, @serwist/next/typings) | Done |
| `.gitignore` | MODIFY (add public/sw.js, sw.js.map) | Done |
| `package.json` | MODIFY (add @serwist/next, serwist, --webpack flag) | Done |

### Phase 2 (DONE)
| File | Action | Status |
|------|--------|--------|
| `supabase/migrations/006_push_subscriptions.sql` | CREATE | Done |
| `src/app/api/notifications/subscribe/route.ts` | CREATE | Done |
| `src/app/api/notifications/unsubscribe/route.ts` | CREATE | Done |
| `src/app/api/notifications/send/route.ts` | CREATE | Done |
| `src/lib/push.ts` | CREATE | Done |
| `src/components/NotificationToggle.tsx` | CREATE | Done |
| `src/app/sw.ts` | MODIFY (add push + click handlers) | Done |
| `src/app/pools/[id]/settings/page.tsx` | MODIFY (add NotificationToggle) | Done |
| `src/app/settings/page.tsx` | MODIFY (add NotificationToggle) | Done |
| `.env.local` | MODIFY (add VAPID keys) | Done |

### Phase 3 (DONE)
| File | Action | Status |
|------|--------|--------|
| `src/lib/notifications.ts` | CREATE (send logic: push vs email routing) | Done |
| `src/app/api/cron/deadline-reminders/route.ts` | CREATE | Done |
| `src/lib/game-processing.ts` | MODIFY (notifications for no_available_picks + champions) | Done |
| `src/app/api/cron/process-results/route.ts` | MODIFY (notifications for wrong/missed picks, round activate, pool active) | Done |

---

## iOS Limitations (Important)
- Safari does NOT support Web Push API
- PWAs installed on iOS homescreen cannot receive push notifications
- **Strategy:** Detect iOS → show email-only notification option, hide push toggle
- Email notifications via Resend are the iOS fallback

## Testing Checklist
- [ ] Chrome DevTools → Application → Manifest shows correct data
- [ ] Lighthouse → PWA audit: installable, has service worker, has manifest
- [ ] Android Chrome: install prompt works, standalone mode works
- [ ] iOS Safari: Add to Home Screen works, standalone mode works
- [ ] Push permission prompt appears at right time (after pool join)
- [ ] Push notification received on Android/Desktop Chrome
- [ ] Notification click navigates to correct page
- [ ] Unsubscribe flow works (settings toggle)
- [ ] Email fallback sends when push is disabled/unavailable

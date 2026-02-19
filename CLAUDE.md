# CLAUDE.md — Survive the Dance (MBB Survivor)

## Project Overview
- **App:** "Survive the Dance" — March Madness Basketball Survivor Pool
- **Stack:** Next.js 16 App Router, Supabase (auth + DB), Tailwind CSS 4, Vercel
- **Domain:** survivethedance.com (Vercel)
- **GitHub:** https://github.com/farraranalytics/MBB-Survivor.git
- **Supabase:** project `yavrvdzbfloyhbecvwpm`
- **Credentials:** `.env.local` (Supabase URL, keys, DB connection, Odds API key)
- **Build:** `next build --webpack` (Serwist needs webpack, not Turbopack)
- **Status:** Feature-complete (auth, pools, picks, standings, bracket, analyze, admin, odds API, diagnostics, PWA with push notifications)

## Design System
- **Surfaces:** `#080810` (surface-0/nav), `#0D1B2A` (surface-1/bg), `#111827` (surface-2/cards), `#1B2A3D` (surface-3/elevated), `#243447` (surface-4), `#2D3E52` (surface-5)
- **Text:** `#E8E6E1` (primary), `#9BA3AE` (secondary), `#5F6B7A` (tertiary)
- **Fonts:** Oswald (display/headings), DM Sans (body), Space Mono (data/labels), Barlow Condensed (wordmark "SURVIVE")
- **Radii:** 4px (xs), 6px (sm/buttons), 10px (md), 14px (lg/cards), 20px (xl), 9999px (full)
- **Champion gold:** `#FFB300` with `rgba(255,179,0,0.08)` bg, `rgba(255,179,0,0.2)` border
- **Style:** Dark premium UI, DraftKings/ESPN-inspired

## Key Patterns & Conventions
- `.label` class = gray (tertiary) by default; use `.text-label-accent` for orange labels
- `.btn-orange` uses Oswald font (display), not DM Sans
- Pool status lifecycle: `open` → `active` → `complete` (intentional 3-state, do NOT normalize)
- `max_entries_per_user` allows multi-entry pools
- `display_name` is denormalized: exists in Auth metadata AND `pool_players` table — must update both
- All pools are effectively private (join code required); `is_private` kept in DB but hidden from UI
- Round names: "Elite 8 Day 1" (not "Elite Eight"), "Sweet 16 Day 1", "Round 1 Day 1", etc.
- The `teams` table does NOT have an `espn_id` column — don't include it in queries

## Game Processing & Elimination
- **Champion = alive entries when pool.status = 'complete'** — works for sole + co-champions
- **Elimination processing order:** wrong_pick → missed_pick → no_available_picks → checkForChampions
- **Tie handling:** When 0 alive, un-eliminate entries from that round → co-champions
- **Key functions:** `processNoAvailablePicks()`, `checkForChampions()` in `game-processing.ts`
- **elimination_round_id for no_available_picks:** Uses completedRoundId (NOT next round) so tie logic works

## Bracket System
- 63 games: 32 R64 with teams + 31 shells, 62 advancement FKs wired
- `propagateWinner()` replaces `cascadeGameResult()`, `clearBracketAdvancement()` replaces `deleteCascadedGames()`
- Picks ARE safe to DELETE — they're leaf records (nothing FKs to them)
- Cascade reset must re-propagate feeder game winners into target round team slots
- Cascade reset must update `admin_test_state` (simulated clock) to point at target round

## Auth & Email
- **Auth flow:** Supabase email/password via `@supabase/ssr` (PKCE flow)
- **Email provider:** Resend (`smtp.resend.com:465`, username `resend`, password = API key)
- **Supabase SMTP:** Custom SMTP enabled, sender `noreply@survivethedance.com` / "Survive The Dance"
- **CRITICAL: Email templates must use `{{ .TokenHash }}` NOT `{{ .ConfirmationURL }}`**
  - `{{ .ConfirmationURL }}` doesn't work with PKCE — tokens end up in hash fragment, invisible to server routes
  - Correct pattern: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=TYPE&next=/destination`
  - Signup: `type=signup&next=/auth/login` | Password reset: `type=recovery&next=/auth/reset-password`
- **Auth routes:**
  - `/auth/login` — LoginForm.tsx
  - `/auth/signup` — SignUpForm.tsx
  - `/auth/forgot-password` — ForgotPasswordForm.tsx
  - `/auth/reset-password` — ResetPasswordForm.tsx
  - `/auth/confirm/route.ts` — server-side token exchange via `verifyOtp({ token_hash, type })`
  - `/auth/callback/route.ts` — PKCE code exchange
- **Supabase Redirect URLs:** `https://survivethedance.com/**` and `http://localhost:3000/**`

## Settings Page Architecture
- `/settings/page.tsx` — standalone account page (display name, email, sign out). Redirects to pool settings if activePoolId exists.
- `/pools/[id]/settings/page.tsx` — full pool settings (entries, account, pool info, admin panel, test mode, sign out)
- **Important:** `/settings` must be a real page, not just a redirect. Users without pools need access to sign out.

## Supabase RLS Gotchas
- Supabase returns **success with 0 rows** when RLS blocks UPDATE/DELETE — no error thrown!
- Always add `.select('id')` after `.update()`/`.delete()` and check `data.length === 0` to detect silent failures
- RLS policies on `pool_players`: SELECT, INSERT, UPDATE (`user_id = auth.uid()`), DELETE (owner OR pool creator)
- Pool creator DELETE policy uses subquery: `pool_id IN (SELECT id FROM pools WHERE creator_id = auth.uid())`
- Regular user DELETE restricted to `status = 'open'` pools only

## Denormalized Data: display_name
- `display_name` exists in THREE places: auth metadata, `pool_players`, and `user_profiles`
- When updating, must sync ALL THREE — auth metadata is the source of truth
- Both `/settings` and `/pools/[id]/settings` handle this via `handleSaveDisplayName()`
- `pool_players` update uses `.select('id')` to detect silent RLS failures
- If data gets out of sync, fix via SQL: `UPDATE pool_players/user_profiles SET display_name = auth.users.raw_user_meta_data->>'display_name'`

## Soft Delete (entry_deleted)
- `pool_players` uses `entry_deleted` flag for soft deletes — ALWAYS filter `.eq('entry_deleted', false)` when querying active entries
- `entry_number` is never renumbered after deletion — gaps are fine, it's just a unique sort key
- Unique constraint is partial: `(pool_id, user_id, entry_number) WHERE entry_deleted = false`
- DB trigger `enforce_max_entries_per_user()` handles max check at database level

## PWA & Push Notifications
- **Installable PWA:** Icons (regular + maskable), manifest, meta tags, Serwist service worker
- **Push:** VAPID keys, `push_subscriptions` table, client `push.ts`, SW push/click handlers
- **Components:** `NotificationToggle`, `InstallAppButton`, `PushPrompt` in settings/layout
- **iOS:** iOS 16.4+ supports Web Push in installed PWAs. No iOS exclusion. Shows "Install to enable" for iOS browser (not standalone).
- **Notification routing:** `src/lib/notifications.ts` — checks `user_profiles.notification_preferences`, push first then email fallback via Resend
- **Events notified:** wrong_pick eliminated, missed_pick eliminated, no_available_picks, pick won, champion/co-champion, pool goes active, new round available
- **Deadline reminders:** `/api/cron/deadline-reminders` — 24h and 1h windows, every 30 min via cron-job.org
- **CRITICAL:** Must only have ONE `next.config.*` file. `.js`/`.mjs` take precedence over `.ts` silently.
- **Env vars:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `RESEND_API_KEY`, `CRON_SECRET`

## Odds API
- **Client:** `src/lib/odds.ts` — server-side only, 5-min cache, quota tracking from headers
- **DB columns:** `team1_moneyline`, `team2_moneyline`, `team1_spread` (no team2_spread), `team1_win_probability`, `team2_win_probability`, `odds_updated_at`
- **Team matching:** Fuzzy name match (case-insensitive substring) between Odds API names and DB team names
- **Sport key:** `basketball_ncaab` — may be inactive outside of season (Nov-Apr)
- **Env var:** `ODDS_API_KEY` (not NEXT_PUBLIC_ prefixed)
- **Diagnostics:** `/admin/diagnostics` — pool-creator gated, ESPN + Odds tests + quick actions

## Cron Jobs (cron-job.org)
- **Sync Games:** `GET https://www.survivethedance.com/api/cron/sync-games`
- **Process Results:** `GET https://www.survivethedance.com/api/cron/process-results`
- **Sync Odds:** `GET https://www.survivethedance.com/api/cron/sync-odds`
- **Deadline Reminders:** `GET https://www.survivethedance.com/api/cron/deadline-reminders`
- All use `Authorization: Bearer <CRON_SECRET>` header
- **IMPORTANT:** Must use `www.survivethedance.com` — non-www redirects and cron-job.org fails on redirects

## Security Rules
- NEVER hardcode secrets in scripts — always use `dotenv` + `.env.local`
- `scripts/*.mjs` is in `.gitignore` — ad-hoc scripts stay local-only
- Git history retains secrets even after removal — always rotate compromised keys

## Documentation Protocol (MANDATORY)
- After EVERY request or code change, update:
  1. **Task checklist** (`docs/tasks/claude-code-task-*.md`) — check off completed items
  2. **MEMORY.md** — update active task status, add new patterns/gotchas
- If context gets cleared, a fresh agent must be able to read these docs and pick up exactly where we left off
- Document the "why" not just the "what"
- When starting a new session, FIRST read the active task file to restore context
- Task files live in `docs/tasks/claude-code-task-{N}-*.md`

## Standings Grid
- Outcome round: When `pool.status = 'complete'`, API appends next unplayed round to `rounds_played` with `is_outcome_round: true`
- Champion crown: `OutcomeCell('champion')` renders gold bg + crown emoji
- "No teams" indicator: `OutcomeCell('no_teams')` renders red circle-slash + "NO TEAMS" label
- `elimination_round_id` exposed on `StandingsPlayer` type

## Windows Dev Environment
- `-Raw` param may not work in all PS versions; use `[System.IO.File]::ReadAllText()` instead
- Paths with `[id]` brackets need `-LiteralPath` to avoid wildcard interpretation
- `$_` variables get mangled when passing PS commands via bash heredoc; write to .ps1 file instead

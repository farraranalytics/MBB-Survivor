# MBB Survivor Pool — Project Brief

## Overview
March Madness Survivor Pool web application. Players join pools, pick one team per tournament day to win. Correct pick = survive, wrong/missed pick = eliminated. Last player standing wins.

## GitHub Repo
https://github.com/farraranalytics/MBB-Survivor.git

## Tech Stack
- **Framework:** Next.js (App Router)
- **Database & Auth:** Supabase (PostgreSQL + Auth + Realtime)
- **Styling:** Tailwind CSS
- **Deployment:** Vercel
- **Sports Data:** ESPN API / SportsDataIO for live scores, brackets, schedules

## Supabase Project
- **Project:** MBB Survivor
- **URL:** https://yavrvdzbfloyhbecvwpm.supabase.co
- **Credentials:** stored in `projects/MBB_Survivor/.env.local` (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
- **Use service role key** for schema migrations and admin operations (server-side only, never expose to client)
- **Use anon key** for client-side auth and queries (NEXT_PUBLIC_ prefix makes it available to browser)
- You can run SQL migrations via the Supabase Management API or use `npx supabase` CLI

## Project Directory
`projects/MBB_Survivor` — all code lives here. Use `run_command` with `working_dir: "MBB_Survivor"` to execute commands.

## Your Workflow
1. **Build incrementally** — get a working skeleton first, then add features layer by layer
2. **Commit often** — small, meaningful commits after each milestone
3. **Push freely** — push to the GitHub repo whenever you commit, no approval needed
4. **Test as you go** — run `npm run build` and `npm run dev` to verify your work
5. **Update this brief** — as you make architectural decisions, update this file so future sessions have context

## Build Order
1. ~~Initialize Next.js + Supabase + Tailwind project~~ — DONE
2. ~~Set up Supabase schema~~ — DONE (8 tables, RLS, triggers, functions applied via SQL Editor)
3. ~~Auth flow (sign up, login, join pool via code/link)~~ — DONE
4. ~~Pool creation + join with group code~~ — DONE
5. ~~Tournament data integration (bracket, schedule, scores)~~ — DONE
6. ~~Daily pick submission screen (mobile-first)~~ — DONE
7. ~~**Standings & leaderboard**~~ — **DONE**
8. ~~**Bracket visualization**~~ — **DONE**
9. **Analyze tab** (team inventory, comparative analysis, pick recommendations) — NEXT
10. Notifications (deadline reminders, survival/elimination alerts)
11. Admin panel (pool management, manual overrides)

## Key Requirements
- **Mobile-first** — users pick from phones, pick screen must be dead simple
- **Server-side deadline enforcement** — 30 min before first tip-off, not just client-side
- **Pick privacy** — picks stored immediately but only visible to pool after deadline
- **Real-time updates** — use Supabase Realtime for live standings
- **Survivor rules:** one pick/day, each team used once, miss = eliminated, wrong = eliminated

## Current Status (Updated 2026-02-05)
**Step 8 COMPLETED** — Bracket visualization fully implemented.

### Completed Files (all under `src/`):
- `lib/supabase/client.ts` — browser client with `supabase` singleton export
- `lib/supabase/server.ts` — server client
- `components/auth/AuthProvider.tsx` — React context for auth state
- `components/auth/LoginForm.tsx` — email/password login
- `components/auth/SignUpForm.tsx` — registration with display name
- `components/auth/ProtectedRoute.tsx` — auth gate wrapper
- `app/layout.tsx` — root layout with AuthProvider
- `app/page.tsx` — landing page (redirects to dashboard if logged in)
- `app/auth/login/page.tsx` — login route
- `app/auth/signup/page.tsx` — signup route
- `app/dashboard/page.tsx` — main dashboard with My Pools (real Supabase data), action alerts, quick actions
- `app/pools/create/page.tsx` — pool creation form
- `app/pools/join/page.tsx` — join pool by code (authenticated)
- `app/join/page.tsx` — join pool by code (unauthenticated, redirects to auth)
- `types/tournament.ts` — TypeScript types for teams, games, brackets, ESPN API responses
- `lib/espn.ts` — ESPN API client with caching, error handling, live scores

### Step 6 Files (Pick Submission):
- `types/picks.ts` — Pool, PoolPlayer, Round, Pick, Game, PickableTeam, PlayerStatus, PickDeadline, PickSubmission, PickValidation, PoolStandings types
- `lib/picks.ts` — Full pick logic: getActiveRound, getTodaysGames, getPoolPlayer, getUsedTeams, getPlayerPick, getPlayerPicks, getPickableTeams (with risk levels), getPickDeadline, validatePick (5-rule validation), submitPick, getPoolStandings
- `app/pools/[id]/page.tsx` — Pool detail: compact top-5 standings, your status, make-pick CTA, deadline countdown, quick actions (full standings, tournament)
- `app/pools/[id]/pick/page.tsx` — The pick screen (mobile-first)

### Step 7 Files (Standings & Leaderboard):
- `types/standings.ts` — RoundResult, StandingsPlayer, PoolLeaderboard, MyPool, StandingsFilter, StandingsSort types
- `lib/standings.ts` — getPoolLeaderboard (full round-by-round results, streaks, history), getMyPools (dashboard pool cards with live status)
- `app/pools/[id]/standings/page.tsx` — **Full standings page:**
  - Pool summary bar (alive/eliminated/total counts, current round)
  - Filter pills: All / Alive / Eliminated
  - **List view (default):** Expandable player rows → full pick history per player, round-by-round results, team usage, streaks
  - **Grid view toggle:** Round-by-round result grid table with horizontal scroll, result badges (✅❌🏀⏳—), sticky player column
  - Color-coded result badges: correct (green), wrong (red), pending (blue w/ seed), live (yellow pulse), no pick (gray)
  - Legend section explaining all badges
  - Auto-refresh every 30 seconds
- `app/dashboard/page.tsx` — **Enhanced dashboard:**
  - Blue action alert banner when picks needed
  - Pool cards with status (alive/eliminated), streak, pick status
  - "Pick needed today!" prompt on active pool cards
  - Grouped by active vs eliminated pools
  - Quick action buttons: Create, Join, Tournament

### Step 8 Files (Bracket Visualization):
- `types/bracket.ts` — BracketGame, BracketRound, RegionBracket types
- `lib/bracket.ts` — Data layer: getAllRounds, getAllGamesWithTeams, buildRegionBracket (with NCAA seed ordering), buildFinalFour
- `components/bracket/BracketMatchupCard.tsx` — Compact matchup card: seed badge, team name, score, winner/loser styling, status badge (Final/Live)
- `components/bracket/RegionBracket.tsx` — 4-column region bracket (R1→Elite 8), TBD placeholders for later rounds, horizontal scroll on mobile
- `app/tournament/page.tsx` — **Complete rewrite:** removed ESPN API, Supabase-powered bracket + schedule views, region tabs (East/West/South/Midwest/Final Four), round selector for schedule view

### Routes (12 total):
- `/` — Landing page
- `/auth/login` — Login
- `/auth/signup` — Sign up
- `/dashboard` — Main dashboard with My Pools
- `/join` — Join pool (unauthenticated entry point)
- `/pools/create` — Create pool
- `/pools/join` — Join pool by code
- `/pools/[id]` — Pool detail with compact standings (**dynamic**)
- `/pools/[id]/pick` — Pick screen (**dynamic**)
- `/pools/[id]/standings` — Full standings & leaderboard (**dynamic**)
- `/tournament` — Tournament view
- `/_not-found` — 404 page

### IMPORTANT Conventions:
- Project uses **`src/` directory** — all files go under `src/app/`, NOT `app/` at project root
- Supabase client: `import { supabase } from '@/lib/supabase/client'`
- Auth context: `import { useAuth } from '@/components/auth/AuthProvider'`
- Pick types: `import { ... } from '@/types/picks'`
- Pick logic: `import { ... } from '@/lib/picks'`
- Standings types: `import { ... } from '@/types/standings'`
- Standings logic: `import { ... } from '@/lib/standings'`
- Bracket types: `import { ... } from '@/types/bracket'`
- Bracket logic: `import { ... } from '@/lib/bracket'`

### Architecture Decisions:
- **Pick validation:** 5-rule client-side validation + server-side DB trigger
- **Risk levels:** Based on seed differential — ≤-6 = Safe, ≥6 = Risky, else Toss-up
- **Deadline countdown:** Real-time (updates every second), color-coded urgency bands
- **Confirmation modal:** Bottom-sheet style on mobile, centered modal on desktop
- **Pick privacy:** RLS policy only shows other players' picks after round deadline
- **Standings sorting:** Alive first → correct picks desc → survival streak desc → alphabetical
- **Leaderboard queries:** Joins picks with games table for opponent info, scores, game status
- **Dashboard pools:** getMyPools queries pool_players → pools → picks per user for live card data

### DB Schema Notes:
- Schema file is `src/lib/supabase/schema.sql` but the LIVE schema was applied directly via Supabase SQL Editor
- Schema uses `team_name` (string) in picks table, NOT team_id (UUID) — lib/picks.ts uses the Step 2 schema convention with team_id FK, while the actual DB uses team_name strings
- The `pool_players` table uses `status` field ('active'/'eliminated'), not `is_eliminated` boolean
- The `rounds` table uses `round_name` and `pick_deadline` fields, not `name` and `deadline_datetime`
- **NOTE:** There may be schema mismatches between the code (lib/picks.ts) and actual DB. The picks.ts lib was built against a normalized FK schema while the actual DB uses denormalized string fields. Step 7 (lib/standings.ts) queries against the actual DB schema.

### Next Steps:
- Step 9: Analyze tab (team inventory, comparative analysis, pick recommendations)
- Step 10: Notifications (deadline reminders, survival/elimination alerts)
- Schema alignment: reconcile lib/picks.ts queries with actual DB field names
- Supabase seed.sql not yet run (sample data for dev)

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
6. ~~**Daily pick submission screen (mobile-first)**~~ — **DONE**
7. **Standings & leaderboard** — NEXT
8. Bracket visualization
9. Analyze tab (team inventory, comparative analysis, pick recommendations)
10. Notifications (deadline reminders, survival/elimination alerts)
11. Admin panel (pool management, manual overrides)

## Key Requirements
- **Mobile-first** — users pick from phones, pick screen must be dead simple
- **Server-side deadline enforcement** — 30 min before first tip-off, not just client-side
- **Pick privacy** — picks stored immediately but only visible to pool after deadline
- **Real-time updates** — use Supabase Realtime for live standings
- **Survivor rules:** one pick/day, each team used once, miss = eliminated, wrong = eliminated

## Current Status (Updated 2026-02-05)
**Step 6 COMPLETED** — Pick submission screen fully implemented and deployed.

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
- `app/dashboard/page.tsx` — main dashboard with create/join pool cards
- `app/pools/create/page.tsx` — pool creation form
- `app/pools/join/page.tsx` — join pool by code (authenticated)
- `app/join/page.tsx` — join pool by code (unauthenticated, redirects to auth)
- `types/tournament.ts` — TypeScript types for teams, games, brackets, ESPN API responses
- `lib/espn.ts` — ESPN API client with caching, error handling, live scores

### Step 6 Files (Pick Submission):
- `types/picks.ts` — Pool, PoolPlayer, Round, Pick, Game, PickableTeam, PlayerStatus, PickDeadline, PickSubmission, PickValidation, PoolStandings types
- `lib/picks.ts` — Full pick logic: getActiveRound, getTodaysGames, getPoolPlayer, getUsedTeams, getPlayerPick, getPlayerPicks, getPickableTeams (with risk levels), getPickDeadline, validatePick (5-rule validation), submitPick, getPoolStandings
- `app/pools/[id]/page.tsx` — Pool detail page: standings table, your status badge (alive/eliminated), make-pick CTA button, deadline countdown, survival streaks
- `app/pools/[id]/pick/page.tsx` — **The pick screen (most important screen in the app)**:
  - Sticky countdown timer (color-coded urgency: blue → orange → red → pulse)
  - Team cards grouped by game time with big tap targets
  - Seed badges, opponent info, risk level indicators (Safe/Toss-up/Risky)
  - Used-team filtering toggle (show/hide already-picked teams)
  - Fixed bottom submit bar that appears when a team is selected
  - Full-screen confirmation modal (slides up from bottom on mobile)
  - Warning about one-time team usage
  - Loading spinner during submission
  - Success screen after pick locks in
  - Error states for: eliminated, no active round, deadline passed, not a member
- `app/tournament/page.tsx` — Tournament bracket/schedule view with live updates

### Routes (10 total):
- `/` — Landing page
- `/auth/login` — Login
- `/auth/signup` — Sign up
- `/dashboard` — Main dashboard
- `/join` — Join pool (unauthenticated entry point)
- `/pools/create` — Create pool
- `/pools/join` — Join pool by code
- `/pools/[id]` — Pool detail with standings (**dynamic**)
- `/pools/[id]/pick` — Pick screen (**dynamic**)
- `/tournament` — Tournament view

### IMPORTANT Conventions:
- Project uses **`src/` directory** — all files go under `src/app/`, NOT `app/` at project root
- Supabase client: `import { supabase } from '@/lib/supabase/client'`
- Auth context: `import { useAuth } from '@/components/auth/AuthProvider'`
- Pick types: `import { ... } from '@/types/picks'`
- Pick logic: `import { ... } from '@/lib/picks'`

### Architecture Decisions:
- **Pick validation:** 5-rule client-side validation (player exists, not eliminated, deadline not passed, team not used, no existing pick) PLUS server-side DB trigger on `picks` table
- **Risk levels:** Based on seed differential — ≤-6 = Safe, ≥6 = Risky, else Toss-up
- **Deadline countdown:** Real-time (updates every second), color-coded urgency bands
- **Confirmation modal:** Bottom-sheet style on mobile, centered modal on desktop
- **Pick privacy:** RLS policy only shows other players' picks after round deadline

### Next Steps:
- Step 7: Standings & leaderboard (more detailed than current standings: pick history, streak tracking, head-to-head)
- Step 8: Bracket visualization
- Step 9: Analyze tab
- Dashboard enhancement: Show "My Pools" list with status from actual Supabase data
- Supabase seed.sql not yet run (sample data for dev)

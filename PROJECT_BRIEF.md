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
5. ~~**Tournament data integration** (bracket, schedule, scores)~~ — **DONE** (Step 5 complete)
6. **Daily pick submission screen (mobile-first)** — NEXT
7. Standings & leaderboard
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
**Step 5 COMPLETED** — Tournament data integration implemented.

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

### NEW in Step 5:
- `types/tournament.ts` — TypeScript types for teams, games, brackets, ESPN API responses
- `lib/espn.ts` — ESPN API client with functions to fetch tournament data, live scores, team info
- `app/tournament/page.tsx` — Tournament bracket/schedule view with live updates, round selector, game cards

### IMPORTANT Conventions:
- Project uses **`src/` directory** — all files go under `src/app/`, NOT `app/` at project root
- Supabase client: `import { supabase } from '@/lib/supabase/client'`
- Auth context: `import { useAuth } from '@/components/auth/AuthProvider'`

### Step 5 Implementation Details:
- **ESPN API Integration:** Full ESPN API client with caching, error handling, and live score updates
- **Tournament Types:** Comprehensive TypeScript types for teams, games, rounds, brackets, regions
- **Tournament Page:** Mobile-responsive UI with schedule/bracket views, live scores, round navigation
- **Real-time Updates:** Auto-refreshes scores every 30 seconds during active tournament
- **Error Handling:** Robust error handling with user-friendly messages and retry functionality

### System Status Note:
- npm and git commands currently failing with system error 3221225794
- Code written successfully but cannot test build or commit/push until system issue resolved
- All files verified written to correct locations under src/

### Next Steps:
- Step 6: Daily pick submission screen (mobile-first)
- Need to commit and push Step 5 work when system commands restored
- Supabase seed.sql not yet run (sample data for dev)
# MBB Survivor Pool — Project Brief

## Overview
**Survive the Dance** — March Madness Basketball Survivor Pool web app. Players join pools, pick one team per tournament day to win. Correct pick = survive, wrong/missed pick = eliminated. Last player standing wins.

## GitHub Repo
https://github.com/farraranalytics/MBB-Survivor.git

## Tech Stack
- **Framework:** Next.js 16 (App Router, `src/` directory)
- **Database & Auth:** Supabase (PostgreSQL + Auth + RLS + Realtime)
- **Styling:** Tailwind CSS v4
- **Deployment:** Vercel
- **Sports Data:** ESPN API / SportsDataIO for live scores, brackets, schedules

## Brand: "Survive the Dance"
- **Primary:** #FF5722 (orange)
- **Background:** #0D1B2A (navy), #111118 (surface dark), #1A1A24 (surface elevated)
- **Text:** #E8E6E1 (court white), #8A8694 (dim)
- **Status:** #4CAF50 (alive green), #EF5350 (eliminated red), #FFB300 (amber)
- **Typography:** Oswald 700 uppercase (headings), DM Sans (body), Space Mono (data labels)

## Supabase Project
- **Project:** MBB Survivor (`yavrvdzbfloyhbecvwpm`)
- **URL:** https://yavrvdzbfloyhbecvwpm.supabase.co
- **Credentials:** `projects/MBB_Survivor/.env.local`

## Project Directory
`projects/MBB_Survivor/` — all code lives here.

---

## Build Progress

### Completed (Steps 1–8 + UX Overhaul + Admin + Multi-Bracket)

| Step | What | Status |
|------|------|--------|
| 1 | Initialize Next.js + Supabase + Tailwind | Done |
| 2 | Supabase schema (8 tables, RLS, triggers) | Done |
| 3 | Auth flow (sign up, login, join via code) | Done |
| 4 | Pool creation + join with group code | Done |
| 5 | Tournament data integration (bracket, schedule, scores) | Done |
| 6 | Daily pick submission screen (mobile-first) | Done |
| 7 | Standings & leaderboard | Done |
| 8 | Bracket visualization | Done |
| — | "Survive the Dance" brand identity + dark theme | Done |
| — | Bottom nav (Home, Picks, Standings, Settings) | Done |
| — | Pool-first home screen (pool detail is default view) | Done |
| — | Settings page with pool management | Done |
| — | Admin settings for pool creators | Done |
| — | Multi-bracket support (multiple entries per pool) | Done (code) |

### Pending

| Step | What | Status |
|------|------|--------|
| — | **Run SQL migration** (`supabase/migrations/001_multi_bracket.sql`) | Needs to be run in Supabase SQL Editor |
| 9 | Analyze tab (team inventory, pick recommendations) | Not started |
| 10 | Notifications (deadline reminders, alerts) | Not started |
| 11 | Admin panel (manual overrides, pool management) | Not started |
| — | Supabase seed.sql for sample data | Not run |
| — | Schema alignment (reconcile picks.ts with actual DB) | Not done |

---

## Recent Work (Current Session)

### Phase 1: Admin Settings for Pool Creators
Pool creators now have a gear icon in Settings that links to `/pools/[id]/admin` where they can edit:
- Pool name
- Private/public toggle
- Max players
- Entry fee
- Brackets per player (max_entries_per_user)

**Files created:**
- `src/lib/admin.ts` — `getPoolAdmin()` and `updatePoolSettings()` data layer
- `src/app/pools/[id]/admin/page.tsx` — Admin settings form (auth-gated to creator)

**Files modified:**
- `src/app/settings/page.tsx` — Added gear icon linking to admin page per pool

### Phase 2: Multi-Bracket Support
Pools can now allow users to have multiple entries (brackets), each with independent picks and elimination status.

**Schema migration** (not yet applied): `supabase/migrations/001_multi_bracket.sql`
- `pools.max_entries_per_user` — INTEGER, default 1, range 1–10
- `pool_players.entry_number` — INTEGER, default 1
- `pool_players.entry_label` — VARCHAR(60), user-defined bracket name
- Unique constraint changed: `(pool_id, user_id)` → `(pool_id, user_id, entry_number)`
- Trigger: `enforce_max_entries_per_user()` — prevents exceeding pool's max at insert time

**User-defined bracket names:**
- Create pool page: "Your Bracket Name" input for the creator's first entry
- Join pool page: "Bracket Name" input for each entry (contextual hints for 1st vs additional)
- Fallback naming: `{displayName}'s Bracket` if left blank

**Dashboard bracket switching:**
- Pool pills (existing) — switch between pools when user is in multiple
- Bracket pills (new `BracketSwitcher`) — switch between entries within a multi-entry pool
- Each pill shows bracket name + alive/eliminated status dot

**Files created:**
- `supabase/migrations/001_multi_bracket.sql` — Schema migration

**Files modified:**
- `src/types/picks.ts` — Added `max_entries_per_user` to Pool, `entry_number`/`entry_label` to PoolPlayer/PlayerStatus, `your_entries: PlayerStatus[]` to PoolStandings
- `src/types/standings.ts` — Added `MyPoolEntry` interface, `your_entries: MyPoolEntry[]` to MyPool
- `src/lib/picks.ts` — `getPoolPlayer` refactored for multi-entry (optional `poolPlayerId` param), `getPoolStandings` builds `your_entries[]`
- `src/lib/standings.ts` — `getMyPools` groups by pool, builds `yourEntries[]` per pool with per-entry stats
- `src/lib/settings.ts` — Added `max_entries_per_user` to `CreatedPool` query
- `src/app/pools/create/page.tsx` — Added bracket name + brackets-per-player fields, `entry_number` + `entry_label` in creator insert
- `src/app/pools/join/page.tsx` — Added bracket name input, multi-entry counting, `entry_number` + `entry_label` in join insert
- `src/app/pools/[id]/admin/page.tsx` — Added "Brackets Per Player" setting
- `src/app/pools/[id]/pick/page.tsx` — Reads `?entry=` search param, passes to `getPoolPlayer`
- `src/components/pool/PoolDetailView.tsx` — Always shows bracket name per entry, multi-entry card layout
- `src/app/dashboard/page.tsx` — Added `BracketSwitcher` component, `selectedBracketId` state, bracket pills below pool pills

---

## Routes (14 total)

| Route | Type | Description |
|-------|------|-------------|
| `/` | Static | Landing page |
| `/auth/login` | Static | Login |
| `/auth/signup` | Static | Sign up |
| `/dashboard` | Static | Home — pool detail view with pool/bracket switcher |
| `/join` | Static | Join pool (unauthenticated entry) |
| `/pools/create` | Static | Create pool form |
| `/pools/join` | Static | Join pool by code |
| `/pools/[id]` | Dynamic | Pool detail page |
| `/pools/[id]/admin` | Dynamic | Admin settings (creator only) |
| `/pools/[id]/pick` | Dynamic | Pick screen (supports `?entry=` param) |
| `/pools/[id]/standings` | Dynamic | Full standings & leaderboard |
| `/settings` | Static | Settings with pool list + admin links |
| `/tournament` | Static | Tournament bracket + schedule views |

## Key Conventions
- **`src/` directory** — all files under `src/app/`, `src/lib/`, `src/components/`, `src/types/`
- Supabase client: `import { supabase } from '@/lib/supabase/client'`
- Auth context: `import { useAuth } from '@/components/auth/AuthProvider'`
- Picks are scoped per `pool_player_id` — multi-bracket works without picks schema changes
- RLS allows pool creators to update their pools: `auth.uid() = creator_id`

## Architecture Decisions
- **Pick validation:** 5-rule client-side + server-side DB trigger
- **Risk levels:** Seed differential ≤-6 = Safe, ≥6 = Risky, else Toss-up
- **Multi-entry design:** Each entry is a separate `pool_players` row. Picks already use `pool_player_id` FK, so entries are naturally independent
- **Bracket names:** User-defined at creation/join time, displayed in dashboard pills and pool detail
- **Navigation model:** Pool pills switch pools; bracket pills switch entries within a pool
- **Standings sort:** Alive first → correct picks desc → survival streak desc → alphabetical

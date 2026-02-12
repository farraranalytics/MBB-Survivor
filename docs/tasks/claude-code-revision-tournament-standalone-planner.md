# Revision: Tournament In Progress Page + Standalone Bracket Planner

These are TWO updates that work together to make the app useful for visitors during the tournament even if they can't join a pool.

---

## Update 1: Tournament In Progress Page

**File:** `src/components/TournamentInProgress.tsx`

**Current behavior:** Shows a lock icon, "pools are locked" message, and either "Go to Dashboard" (logged in) or "Sign Up for Next Year" (logged out).

**New behavior:** Same lockout message, but reframe it as an invitation rather than a dead end. Add a prominent CTA to the Bracket Planner.

**Updated layout:**

```
┌─────────────────────────────────────────────┐
│                                              │
│           SURVIVE THE DANCE                  │
│              (wordmark)                      │
│                                              │
│         🏀 (basketball icon, not lock)       │
│                                              │
│     THE DANCE IS UNDERWAY                    │
│                                              │
│     Pools are locked for the 2026            │
│     tournament, but the action is live.      │
│                                              │
│  ┌─────────────────────────────────┐        │
│  │   EXPLORE THE BRACKET PLANNER →  │        │  ← BIG orange CTA
│  └─────────────────────────────────┘        │
│                                              │
│  Plan your strategy, predict upsets, and     │
│  track every game — no pool required.        │
│                                              │
│  ┌─────────────────────────────────┐        │
│  │     Sign Up for 2027           │        │  ← Secondary CTA (logged out)
│  └─────────────────────────────────┘        │
│  OR                                          │
│  ┌─────────────────────────────────┐        │
│  │     Go to Dashboard             │        │  ← Secondary CTA (logged in)
│  └─────────────────────────────────┘        │
│                                              │
│  🏀 Tournament is live · 124 players ·      │
│  18 pools · 32 games completed              │
│                                              │
│  About Survive the Dance                     │
│                                              │
└─────────────────────────────────────────────┘
```

**Key changes from current:**
1. Replace lock icon with basketball icon — feels inviting not restrictive
2. Change heading from "TOURNAMENT IN PROGRESS" to "THE DANCE IS UNDERWAY"
3. Change subtext from "pools are locked" to "Pools are locked for the 2026 tournament, but the action is live."
4. Add BIG primary CTA: "Explore the Bracket Planner →" linking to `/analyze`
5. Move dashboard/signup buttons to secondary position below
6. Add descriptive text under the planner CTA: "Plan your strategy, predict upsets, and track every game — no pool required."

**The Bracket Planner link goes to `/analyze`** (the new standalone route — see Update 2 below).

---

## Update 2: Standalone Bracket Planner Route

**Problem:** The Bracket Planner currently lives at `/pools/[id]/analyze` which requires pool context. We need it accessible without a pool — for visitors during the tournament and as a marketing tool.

### Create a new standalone route: `/analyze`

**Create `src/app/analyze/page.tsx`:**

This is a standalone version of the Bracket Planner that:
- Does NOT require login
- Does NOT require pool context
- Pulls teams from `teams` table and game results from `games` table (public data)
- Does NOT show entry-specific data (no submitted picks, no used teams)
- Does NOT show the entry switcher tabs
- All picks are planning-only (never submitted)
- Saves planning state to `localStorage` for persistence between sessions

**Data it needs (all public, no auth required):**
```typescript
// Teams grouped by region
const { data: teams } = await supabase.from('teams').select('*').order('seed');

// All rounds
const { data: rounds } = await supabase.from('rounds').select('*').order('date');

// Completed game results (auto-populate advancers)
const { data: games } = await supabase
  .from('games')
  .select('*, team1:team1_id(*), team2:team2_id(*)')
  .order('game_datetime');
```

**Supabase RLS note:** The `teams`, `rounds`, and `games` tables likely need a public read policy if they don't already have one. Check RLS:
```sql
-- These should already exist but verify:
CREATE POLICY "Public read teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Public read rounds" ON rounds FOR SELECT USING (true);
CREATE POLICY "Public read games" ON games FOR SELECT USING (true);
```

**Page behavior:**
- If user is logged in AND has an active pool → show a subtle banner: "You're in a pool! Go to your pool's analyze tab for personalized analysis" with link to `/pools/[id]/analyze`
- If user is not logged in → show the planner normally, with a subtle signup nudge at the bottom: "Like what you see? Create an account and join a pool for the next tournament."
- First visit → show the coaching/tutorial onboarding
- Completed games are auto-locked with results (same as pool version)
- Everything else is free-form planning

### Update the pool-specific route: `/pools/[id]/analyze`

The existing pool-specific version at `/pools/[id]/analyze/page.tsx` stays but gains these extras over the standalone version:
- Entry switcher (pick which entry to plan for)
- Pre-populated submitted picks (locked, shown as "LOCKED")
- Used teams highlighted (from that entry's pick history)
- Win probability from Odds API (if available)

Both routes use the same underlying `BracketPlanner` component — just with different props:

```typescript
// Standalone (no pool context)
<BracketPlanner
  teams={teams}
  rounds={rounds}
  games={games}
  mode="standalone"
/>

// Pool-specific (with entry context)
<BracketPlanner
  teams={teams}
  rounds={rounds}
  games={games}
  mode="pool"
  poolPlayerId={poolPlayerId}
  submittedPicks={existingPicks}
  usedTeamIds={usedTeamIds}
/>
```

### Update Bottom Nav

**File:** `src/components/BottomNav.tsx`

The Analyze tab currently links to `${poolBase}/analyze` or falls back to `/dashboard` if no pool is active. Update the fallback:

**Before:**
```typescript
href: poolBase ? `${poolBase}/analyze` : '/dashboard',
```

**After:**
```typescript
href: poolBase ? `${poolBase}/analyze` : '/analyze',
```

This way, users without a pool can still access the standalone Bracket Planner from the bottom nav.

### Show Bottom Nav for Non-Pool Users During Tournament

**Currently:** Bottom nav only shows for logged-in users. Consider showing it (or a simplified version) for non-logged-in users too, with just Home + Analyze tabs visible. This lets visitors who land on the tournament-in-progress page navigate to the Bracket Planner easily.

**Alternatively:** Just make sure the Bracket Planner page at `/analyze` has its own back button / navigation, so visitors aren't trapped on the page.

---

## Update 3: Landing Page Link to Bracket Planner

**File:** `src/app/page.tsx` (the root landing page, if it exists)

If you have a public landing page at `/`, add a section or CTA that links to the Bracket Planner during the tournament. Something like:

```
🏀 THE TOURNAMENT IS LIVE
Explore our free Bracket Planner — predict upsets, track
every game, and plan your survivor strategy.
[Open Bracket Planner →]
```

This makes the planner discoverable from organic search traffic too.

---

## Summary of Files

### Create
1. `src/app/analyze/page.tsx` — Standalone Bracket Planner route (no auth/pool required)
2. `src/app/analyze/layout.tsx` — Optional: layout with minimal chrome for non-logged-in users

### Modify
1. `src/components/TournamentInProgress.tsx` — Add Bracket Planner CTA, reframe messaging
2. `src/components/BottomNav.tsx` — Update Analyze tab fallback href to `/analyze`
3. `src/components/analyze/BracketPlanner.tsx` — Accept `mode` prop ("standalone" vs "pool") to conditionally show entry-specific features

### Verify
1. Supabase RLS policies — `teams`, `rounds`, `games` tables need public read access

---

## What NOT to Do

- Don't require login to view the standalone Bracket Planner — it's a marketing tool
- Don't show the entry switcher or submitted picks in standalone mode — no pool context
- Don't allow pick submission from the standalone planner — it's planning only
- Don't remove the pool-specific `/pools/[id]/analyze` route — it still exists with richer features
- Don't show the bottom nav's Pick, Field, Bracket, Settings tabs to non-logged-in users — only Home + Analyze make sense
- Don't gate the Bracket Planner behind signup — let people use it freely, nudge signup at the bottom

# Task: Dashboard Redesign — Homepage Upgrade

## Overview

Redesign the dashboard (`src/app/dashboard/page.tsx`) to match the mockup layout. The mockup has 5 sections stacked vertically. Our current dashboard already has most of the data and components — this is primarily a layout/UI restructuring with one new feature ("Most Picked Today").

## Reference

- Mockup code: `docs/mockups/app-shell.jsx` (HomeDashboard component, lines 452-689)
- Mockup screenshots: See uploaded images
- Current dashboard: `src/app/dashboard/page.tsx`

## Current Dashboard Structure (what exists now)

1. **HeroBanner** — Tournament status card (pre-tournament / pre-round / live / complete)
2. **Create/Join Buttons** — Always visible
3. **SurvivalSummary** — List of all user entries across pools with survival bars
4. **PickCTA** — "X Entries Need a Pick" alert
5. **SimplePoolCard** — Pool cards with join code, alive/total, deadline
6. **ActivityFeed** — Recent events (game finals, eliminations, joins)

## New Dashboard Structure (from mockup)

### Section 1: Welcome + Pick Alert Banner
Replace the current HeroBanner + PickCTA with a simpler layout:

**Top:** Welcome greeting with user's display name and avatar initial
```
Welcome back,
MARCUS                                    [M]
```

**Pick Alert Banner** (only when entries need picks):
Orange gradient border card with basketball icon, "3 ENTRIES NEED A PICK", countdown text, and arrow that navigates to pick page. This replaces the current separate PickCTA component.

Use the current `formatDeadline()` function for the countdown text.

### Section 2: Most Picked Today (NEW FEATURE)

This is the one genuinely new component. It shows which teams are most popular picks for the current round across all entries in a pool.

**Two states:**
- **Pre-tipoff (round is `pre_round`):** Shows "Locked Until Tipoff" header with blurred fake bars and a countdown overlay. Data is hidden until games start.
- **Post-tipoff (round is `round_live` or `round_complete`):** Shows each picked team with percentage bar, entry count, game status (live score or tipoff time), and stakes line ("If X loses, Y entries die" / "X leading — Y entries ride safe").

**Pool switching:** Use our existing `PoolSelectorBar` component (from `src/components/pool/PoolSelectorBar.tsx`) instead of the tab buttons in the mockup. The mockup uses inline pill buttons — we should use our dropdown selector for consistency across the app.

**Data source:** This needs a new API endpoint or query. For each pool, for the current active round:
1. Query all picks for the current round in this pool
2. Group by team_id, count entries per team
3. Calculate percentage (count / total entries that have picked)
4. Join with games table to get opponent, game status, score, game_datetime
5. Sort by count descending

**New API route:** `src/app/api/pools/[id]/most-picked/route.ts`
- Returns: `{ teams: [{ team, seed, region, pct, count, atRisk, opponent, oppSeed, status, score?, timeLeft?, time?, spread? }] }`
- Only returns data when the round's deadline has passed (picks are locked)
- Uses `effective_now()` or `getEffectiveNowServer()` to determine if we're past deadline

**IMPORTANT:** The "Most Picked Today" section should only show live game data (scores, time remaining) if we actually have that data from ESPN sync. For now, show the team distribution with game times but don't show live scores (we don't have a live score feed running yet). The structure should support it for later.

**Component:** Create `src/components/dashboard/MostPickedToday.tsx`

### Section 3: Today's Round Progress

A compact card showing:
- Round name and date
- 10-segment progress bar (one per tournament day, colored: green=complete, orange=current, dark=future)
- "DAY X OF 10" label

Use `TournamentState.rounds` to build the progress segments. The current round index determines which segment is orange.

**Component:** Create `src/components/dashboard/RoundProgress.tsx`

### Section 4: Quick Stats

Three stat cards in a row:
- **ALIVE:** Count of alive entries across all pools (green) — `of X` subtitle
- **BEST STREAK:** Longest current streak across all entries (yellow) — "DAYS" subtitle
- **POOLS:** Number of pools (blue) — "ACTIVE" subtitle

Data already available from `pools` (MyPool[]) in the dashboard.

**Component:** Inline in dashboard or `src/components/dashboard/QuickStats.tsx`

### Section 5: Pool Cards (redesigned)

Replace the current `SimplePoolCard` with the mockup's richer pool card layout:

Each pool card has:
- **Header:** Pool name (left), prize pot (right, green)
- **Subtitle:** "HOSTED BY [creator] · $[entry_fee] BUY-IN"
- **Survival bar:** Green fill with "X ALIVE" (left) and "X OUT" (right), "X% SURVIVAL RATE" below
- **My Entries list:** Each entry row with:
  - Status dot (green=alive, red=eliminated)
  - Entry name (strikethrough if eliminated)
  - "PICK NEEDED" badge (orange) or "✓ LOCKED" (green) or "☠ DAY X" (red)
  - Streak count with 🔥 emoji

**Data gap:** `MyPool` type doesn't currently include `entry_fee` or `prize_pool`. These exist in the `pools` table. Options:
  - (A) Add `entry_fee` and `prize_pool` to the `getMyPools()` query (it already selects from pools but doesn't include these fields)
  - (B) Fetch separately

Go with option (A) — add to the existing pools select in `getMyPools()` and add to the `MyPool` interface.

Also need `creator_name` for the "HOSTED BY" line. Currently `MyPool` has `creator_id` but not the display name. Add a join to `user_profiles` in `getMyPools()` to get the creator's display name, or just use the pool name context.

**Note:** The mockup doesn't show join codes on pool cards. Our current cards show them. Keep the join code row but move it inside a "Share" action or make it less prominent.

### Section 6: Remove / Restructure

- **Remove** the current `HeroBanner` component — replaced by Welcome + Round Progress
- **Remove** the current standalone `PickCTA` — merged into the Pick Alert Banner
- **Keep** the `SurvivalSummary` concept but it's now absorbed into the Pool Cards (each card shows its own entries)
- **Remove** or **move** `ActivityFeed` to a secondary position (below pool cards, collapsed by default). The mockup doesn't show an activity feed.
- **Remove** the Create/Join buttons row — these are accessible from the bottom nav and don't need to be on every dashboard load. If you keep them, make them very subtle (text links, not buttons).

## Files to Create

1. `src/components/dashboard/MostPickedToday.tsx` — Main new component
2. `src/components/dashboard/RoundProgress.tsx` — Tournament day progress bar
3. `src/components/dashboard/QuickStats.tsx` — 3-stat row
4. `src/components/dashboard/PoolCard.tsx` — Redesigned pool card
5. `src/components/dashboard/PickAlertBanner.tsx` — Orange CTA banner
6. `src/app/api/pools/[id]/most-picked/route.ts` — API for pick distribution data

## Files to Modify

1. `src/app/dashboard/page.tsx` — Complete restructure using new components
2. `src/types/standings.ts` — Add `entry_fee: number` and `prize_pool: number` to `MyPool` interface
3. `src/lib/standings.ts` — Add `entry_fee, prize_pool` to the pools select in `getMyPools()`

## Styling Notes

- Follow our existing design system (CSS variables from globals.css, Tailwind utilities)
- Use the same fonts already imported: Oswald, Barlow Condensed, DM Sans, Space Mono
- The mockup uses inline styles — convert everything to Tailwind classes + our CSS custom properties
- Mobile-first: the layout should work on 375px width and scale up
- Use `style={{ fontFamily: ... }}` pattern that the rest of the app uses

## What NOT to Change

- Bottom navigation bar (already implemented)
- Top header bar (already implemented)  
- Other pages (standings, pick, bracket, analyze)
- Pool selector component (reuse as-is)
- Authentication flow
- Any API routes other than the new most-picked endpoint

## Acceptance Criteria

- [ ] Dashboard shows Welcome + avatar at top
- [ ] Pick Alert Banner shows when entries need picks, navigates to pick page
- [ ] "Most Picked Today" shows blurred/locked state pre-tipoff
- [ ] "Most Picked Today" shows team distribution with bars post-tipoff
- [ ] "Most Picked Today" uses PoolSelectorBar for pool switching
- [ ] Round Progress shows 10-segment bar with current day highlighted
- [ ] Quick Stats show alive count, best streak, pool count
- [ ] Pool Cards show name, pot, survival bar, and entry list with statuses
- [ ] MyPool type includes entry_fee and prize_pool
- [ ] Layout matches mockup visual hierarchy
- [ ] Works on mobile (375px+)

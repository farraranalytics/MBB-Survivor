# Pick Page Redesign — Full Plan

## Overview

Redesign the pick page (`/pools/[id]/pick`) to match the cleaner prototype layout. The current page groups games by time slot with a flat list. The new design groups games by **region** with a 2-column grid layout, adds a "Biggest Favorites" quick-pick row, a status bar, and a "Your Run" pick timeline at the bottom.

**Reference files:** `pick-tab__1_.jsx` (prototype), screenshots NewPickPage1-3.png

---

## What Changes (and What Doesn't)

### ✅ KEEP — don't touch these
- All data fetching logic (`loadData`, `getPickableTeams`, `getActiveRound`, etc.)
- Confirmation modal (`ConfirmModal`) — works great as-is
- Entry switching logic (multi-entry tabs, `+ Entry` button)
- Eliminated/spectator flow (`SpectatorHeader`, `SpectatorGameCard`)
- Success snackbar animation
- `submitPick` flow and error handling
- `lib/picks.ts` and `types/picks.ts` — no schema changes

### 🔄 CHANGE — restructure these
1. **Page header/top bar** — new layout with round info box
2. **Status bar** — new alive/day status + countdown
3. **Game listing** — from time-grouped flat list → region-grouped 2-col grid
4. **Team card** — from radio-style selection → inline tap-to-select with highlight
5. **Lock button** — from fixed bottom bar → inline at bottom of games
6. **Add "Your Run" timeline** — new component at bottom
7. **Add "Biggest Favorites" row** — optional, depends on odds API readiness

---

## Detailed Component Changes

### 1. Page Header (Top Bar)

**Current:** Sticky sub-header with round name, countdown timer, current pick pill, entry tabs all crammed together.

**New:** Clean two-section header:

```
┌──────────────────────────────────────────────────────┐
│ PICK TAB (label)                    ┌──────────────┐ │
│ MAKE YOUR PICK (title)              │    ROUND     │ │
│                                     │  R64 Day 1   │ │
│ ┌──────────────────────────────┐    │ 16 GAMES     │ │
│ │ POOL  MARCH MADNESS MANIA   │    │  Mar 19      │ │
│ └──────────────────────────────┘    └──────────────┘ │
│ [● PADRES TO THE SHIP] [● RAIDERS SUCK] [+ Entry]   │
└──────────────────────────────────────────────────────┘
```

**Implementation:**
- Left side: "PICK TAB" label (orange, mono), "MAKE YOUR PICK" heading (Oswald)
- Right side: Round info card — round name, game count badge, date badge
- Pool selector: full-width bar showing pool name with alive/total count, dropdown to switch pools (only if user has multiple pools — check `useActivePool`)
- Entry tabs: horizontal scroll row below pool selector

**Key detail:** The round info box replaces the current sticky sub-header. The pool selector is a new element matching the prototype style — a full-width bar on the pick page showing `POOL` label + pool name + alive/total count. It's a dropdown that lists the user's pools. When user switches pool, navigate to `/pools/[newPoolId]/pick`. This supplements the existing header pool switcher (don't remove that one). Entry tabs sit below the pool bar.

### 2. Status Bar

**Current:** Countdown timer embedded in sticky header.

**New:** Dedicated status bar:

```
┌──────────────────────────────────────────────────────┐
│ 🟢 ALIVE  DAY 1 OF 10 · FIRST PICK      LOCKS 4:23 │
└──────────────────────────────────────────────────────┘
```

**Implementation:**
- Green dot + "ALIVE" (or red + "ELIMINATED" for spectators)
- "DAY X OF 10" — compute from round index
- "FIRST PICK" if no existing pick, or show current pick
- Right side: countdown timer using existing `CountdownTimer` component
- Background: `surface0` with subtle alive-green border

### 3. Biggest Favorites Row (Phase 2 — after Odds API)

**Current:** Doesn't exist.

**New:** Horizontal scroll row of top 6 favorites by spread:

```
┌────────────┐ ┌────────────┐ ┌────────────┐
│ 1 HOUSTON  │ │ 1 AUBURN   │ │ 1 DUKE     │
│ vs (16)    │ │ vs (16)    │ │ vs (16)    │
│   -23.5    │ │   -20.5    │ │   -20.0    │
└────────────┘ └────────────┘ └────────────┘
```

**Implementation:**
- Only show when odds data is available (Task 14 — Odds API integration)
- Tapping a favorite card selects that team (same as tapping in the region grid)
- Label: "BIGGEST FAVORITES · TAP TO SELECT" with "VIA ODDS API" right-aligned
- **For now:** Skip this section entirely. Add it when odds API is integrated. Leave a commented placeholder in the code.

### 4. Games by Region (Core Change)

**Current:** Games grouped by time slot → flat list of matchup cards.

**New:** Games grouped by region → 2-column grid within each region section.

```
┌──────────────────────────────────────────────────────┐
│ | SOUTH   4 GAMES                                    │
│ ┌────────────────────┐ ┌────────────────────┐        │
│ │ 12:15P ET      TBS │ │ 2:45P ET       TBS │        │
│ │  1  AUBURN     28-5│ │  8  LOUISVILLE     │        │
│ │ 16  ALA STATE      │ │  9  CREIGHTON      │        │
│ └────────────────────┘ └────────────────────┘        │
│ ┌────────────────────┐ ┌────────────────────┐        │
│ │ 7:10P ET      TNT │ │ 9:40P ET       TNT │        │
│ │  5  MICHIGAN       │ │  4  TEXAS A&M      │        │
│ │ 12  UC SAN DIEGO   │ │ 13  YALE           │        │
│ └────────────────────┘ └────────────────────┘        │
└──────────────────────────────────────────────────────┘
```

**Implementation:**

**a) Group teams by region:**
```typescript
// Current: teams grouped by game time
// New: teams grouped by region, then by game within region
const regionGroups = new Map<string, { games: Map<string, PickableTeam[]> }>();

for (const team of displayTeams) {
  const region = team.region; // Need to add region to PickableTeam type
  if (!regionGroups.has(region)) {
    regionGroups.set(region, { games: new Map() });
  }
  const rg = regionGroups.get(region)!;
  if (!rg.games.has(team.game_id)) {
    rg.games.set(team.game_id, []);
  }
  rg.games.get(team.game_id)!.push(team);
}
```

**b) Required data change — PickableTeam needs `region`:**

The `getPickableTeams()` function in `lib/picks.ts` returns teams with opponent info but may not include `region`. Need to verify the Supabase query includes `region` from the teams table. If not, add it.

**c) Region section component:**
- Region header: orange bar + region name (Oswald, uppercase) + game count badge
- Games grid: `grid grid-cols-1 sm:grid-cols-2 gap-2` within each region
- On mobile: regions are collapsible (tap header to expand/collapse). Default: all expanded on desktop, first region expanded on mobile.
- If user's pick is in this region, show `PICK: <TEAM>` badge in header and accent border on the region container.

**d) Compact game card within region:**
Each game card shows:
```
┌──────────────────────────┐
│ 12:15P ET           TBS  │  ← time strip (surface3 background)
│  1  AUBURN          28-5 │  ← team row (tappable)
│ 16  ALA STATE            │  ← team row (tappable)
└──────────────────────────┘
```

- Time strip at top with game time + network (if available, otherwise just time)
- Each team row is independently tappable
- Selected team gets orange left border + orange subtle background
- Used teams show "USED" badge + strikethrough + dimmed opacity
- Team record (win-loss) shown right-aligned in mono font — join from `team_records` table. Format as "W-L" (e.g., "30-5"). If no record exists, omit gracefully.

**e) Region order:** South, East, West, Midwest (matching prototype). Or alphabetical. Consistent either way.

### 5. Lock/Submit Button

**Current:** Fixed bottom bar that sits above bottom nav. Shows "Pick (seed) Team" or "Change to (seed) Team".

**New:** Keep the fixed bottom bar — same positioning above bottom nav. Update styling to match new design language:

```
When no team selected:
┌──────────────────────────────────────────────────────┐
│                SELECT A TEAM ABOVE                   │  (disabled, surface4 bg)
└──────────────────────────────────────────────────────┘

When team selected:
┌──────────────────────────────────────────────────────┐
│          LOCK PICK → (1) HOUSTON                     │  (orange, active, glow)
└──────────────────────────────────────────────────────┘
```

**Implementation:**
- Keep existing fixed positioning (bottom-16, above bottom nav)
- Update button text: "Select a Team Above" (disabled) or "Lock Pick → (seed) Team" (active)
- If changing existing pick: "Change Pick → (seed) Team"
- When tapped, shows the existing `ConfirmModal` (keep as-is)
- Add orange box-shadow glow when active (matching prototype)

### 6. Pick Timeline ("Your Run")

**Current:** Doesn't exist on the pick page. Eliminated users see a chip-style "Your Run" in the SpectatorHeader.

**New:** Always visible at the bottom of the page for all users (alive or eliminated). Shows all 10 rounds as a vertical timeline.

```
PICK HISTORY
YOUR RUN

● R64 Day 1  Mar 19  [NOW]
  ↑ PICKING NOW

○ R64 Day 2  Mar 20
  —

○ R32 Day 1  Mar 21
  —

... (8 more rounds)
```

**Implementation:**

**a) New component: `PickTimeline`**

```typescript
interface PickTimelineProps {
  rounds: Round[];           // All 10 rounds
  picks: Pick[];             // User's picks so far
  currentRoundId: string;    // Active round ID
}
```

- Vertical timeline with connecting lines between dots
- Current round: large orange dot with glow, "NOW" badge
- Past rounds with survived pick: green dot, green connecting line, pick shown in green chip
- Past rounds with failed pick: red dot, pick shown in red chip
- Future rounds: gray dot, dimmed "—"
- Each round shows: label (R64 Day 1), date (Mar 19), pick if made

**b) Data needed:**
- We already fetch `pickHistory` for eliminated users via `getPlayerPicks()`
- For alive users, we need to also fetch pick history. Add this to `loadData()`:
  ```typescript
  // Always load pick history for timeline (not just eliminated users)
  const history = await getPlayerPicks(poolPlayer.id);
  setPickHistory(history);
  ```
- We also need all rounds (not just the active one). The rounds are already available from `getActiveRound()` indirectly, but we need the full list. Add a fetch:
  ```typescript
  const { data: allRounds } = await supabase
    .from('rounds')
    .select('*')
    .order('date', { ascending: true });
  ```

**c) Placement:** Below the lock button, above the page bottom padding.

### 7. Remove the "vs" Divider Between Teams

**Current:** Each matchup card has a `vs` divider between the two teams.

**New:** No "vs" divider. Teams are stacked directly with just a subtle border between them, matching the compact card style in the prototype.

---

## Files to Modify

### Primary (pick page rebuild):
1. **`src/app/pools/[id]/pick/page.tsx`** — Major restructure of the main component layout. New components: `RegionSection`, `CompactGameCard`, `PickTimeline`, `StatusBar`. Remove the time-slot grouping logic. Add region grouping.

### Supporting (minor tweaks):
2. **`src/lib/picks.ts`** — Verify `getPickableTeams()` returns team `region`. If not, update the Supabase query.
3. **`src/types/picks.ts`** — Verify `PickableTeam` includes `region: string`. Likely already there via `TeamInfo`.

### No changes needed:
- `lib/supabase/client.ts`
- `components/CountdownTimer.tsx`
- `components/auth/AuthProvider.tsx`
- Database schema

---

## Implementation Order

### Phase 1: Core Layout (do first)
1. Add region to PickableTeam if not present
2. Replace time-slot grouping with region grouping
3. Build `RegionSection` component (region header + 2-col game grid)
4. Build `CompactGameCard` component (time strip + team rows)
5. Update the header to new layout (round info box, pool info bar, entry tabs)

### Phase 2: Status Bar + Timeline
6. Build `StatusBar` component (alive status, day count, countdown)
7. Build `PickTimeline` component (vertical timeline of all rounds)
8. Fetch all rounds + full pick history for alive users
9. Wire timeline into the page

### Phase 3: Polish
10. Mobile collapsible regions (expand/collapse on tap)
11. Region highlight when pick is in that region
12. Smooth transitions and animations
13. Test with all tournament states (no picks, pick made, eliminated, spectating)

### Phase 4: Odds Integration (later, with Task 14)
14. Add "Biggest Favorites" row when odds data is available

---

## Visual Reference

The page flows top-to-bottom:

```
┌─────────────────────────────────────┐
│ PICK TAB          ┌──────────────┐  │
│ MAKE YOUR PICK    │  R64 Day 1   │  │
│                   │  16 GAMES    │  │
│ Pool: March...    │  Mar 19      │  │
│ [Entry 1][Entry 2]└──────────────┘  │
├─────────────────────────────────────┤
│ 🟢 ALIVE  DAY 1 OF 10    LOCKS 4:23│
├─────────────────────────────────────┤
│ (future: Biggest Favorites row)     │
├─────────────────────────────────────┤
│ | SOUTH   4 GAMES                   │
│ [Game][Game]                        │
│ [Game][Game]                        │
├─────────────────────────────────────┤
│ | EAST    4 GAMES                   │
│ [Game][Game]                        │
│ [Game][Game]                        │
├─────────────────────────────────────┤
│ | WEST    4 GAMES                   │
│ [Game][Game]                        │
│ [Game][Game]                        │
├─────────────────────────────────────┤
│ | MIDWEST 4 GAMES                   │
│ [Game][Game]                        │
│ [Game][Game]                        │
├─────────────────────────────────────┤
│ [══ LOCK PICK → (1) HOUSTON ══════] │  ← or fixed bottom bar
├─────────────────────────────────────┤
│ PICK HISTORY                        │
│ YOUR RUN                            │
│ ● R64 Day 1  Mar 19  [NOW]         │
│   ↑ PICKING NOW                     │
│ ○ R64 Day 2  Mar 20                │
│   —                                 │
│ ... (8 more rounds)                 │
└─────────────────────────────────────┘
```

---

## Decisions (Confirmed)

1. **Keep fixed bottom bar.** Don't go inline. The fixed bar is better mobile UX. Style it to match the new design language.

2. **Team win-loss records — YES, via `team_records` table.** A new `team_records` table has been created (see `create_team_records_table.sql`). Join this table when fetching pickable teams. Show record as `W-L` (e.g., "30-5") right-aligned on team rows in mono font. If no record exists for a team, just omit it gracefully.

3. **TV network — SKIP.** Will not implement.

4. **Mobile collapsible regions — YES.** Implement collapsible regions on mobile. Default: all regions expanded on desktop, only the first region expanded on mobile. Tap region header to toggle expand/collapse. Show chevron indicator.

5. **Pool selector on pick page — YES, match prototype style.** There's already a pool switcher in the app header, but add a second pool info bar on the pick page itself matching the prototype's style: full-width bar showing `POOL` label + pool name + alive/total count. Make it a dropdown that lists the user's pools (fetched from existing data). When user switches pool, navigate to that pool's pick page. This is IN ADDITION to the existing header pool switcher (don't remove that). The entry tabs sit below this pool bar.

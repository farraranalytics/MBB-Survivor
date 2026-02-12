# Task: Bracket Planner — Analyze Tab Redesign

**Purpose:** Replace the current analyze tab (5 disconnected modules) with a full tournament bracket planner that lets users map their entire 10-pick survivor strategy before and during the tournament. The user uploaded a working prototype at `survivor-grid.jsx` — adapt it to work with real database data instead of hardcoded constants.

## Reference File

**Read this first:** `survivor-grid.jsx` (uploaded to the project — check `/mnt/user-data/uploads/` or the project root). This is a ~980-line standalone React component that IS the feature. The job is to integrate it with the app's database, not rebuild from scratch.

## What the Bracket Planner Does

The prototype has 3 views:

### View 1: Splash / Landing Page
- Hero section explaining the tool: "Map your entire survivor strategy before tip-off"
- "How It Works" — 3-step explanation (Predict Winners → Pin Picks → Spot Traps)
- Elite 8 danger zone callout
- Schedule breakdown (10 days, games per round)
- "Start Planning" (full access) + "Try Demo" buttons
- **Integration note:** This splash might not be needed inside the app since users are already logged in and in a pool. Consider showing it only the first time, or skip it and go straight to the planner. Use your judgment.

### View 2: Demo Mode
- Guided walkthrough with coaching bar (bottom tooltip)
- 5 tutorial steps: Predict Winners → Lock Your Pick → Watch It Flow → Region Trackers → Elite 8 Trap
- Highlight rings around active tutorial sections
- Limited interaction — shows CTA to "unlock full planner" at the end
- **Integration note:** The demo/paywall ("Survive+ · $9.99/tournament") should be removed. This app is free. But the tutorial coaching system is great — keep it as a first-time-user onboarding.

### View 3: Planner (the main tool)
The core feature. Sections from top to bottom:

1. **Top Bar** — "Bracket Planner" title + X/10 picks counter + Reset button + Tutorial restart
2. **Region Trackers** — 4 cards (East, South, West, Midwest) showing picks used per region, available teams, danger warnings (3+ = warning, 4+ = danger), flip button to swap bracket halves
3. **10 Day Cards** — Accordion-style expandable cards, one per tournament day. Each card shows:
   - Day number, date, round label, bracket half (A/B)
   - Region pills showing which regions play that day
   - Current pick for this day (or "No pick set")
   - When expanded: shows all matchups grouped by region. Each matchup has:
     - Two team buttons — click to "predict" winner (advance them)
     - ✎ pin button — click to lock a team as your survivor pick for this day
     - Used teams show strikethrough + dimmed
     - Upset detection (when predicted winner has worse seed)
4. **Bracket Flow** — 4-column grid (one per region) showing projected R32 winners → S16 winners → Region champion. Used teams show red strikethrough.
5. **Usage Map** — Region × Day table showing where picks are placed, with dot/bullet markers
6. **Pick Sheet** — 5-column grid of all 10 days with pinned picks, regional exposure warnings

---

## Integration Plan

### A. Data Sources — Replace Hardcoded Constants

The prototype has hardcoded `BRACKET`, `DAYS`, `R64_SEEDS`, etc. Replace with database queries.

#### 1. Teams (`BRACKET` constant → `teams` table)

**Current prototype:**
```javascript
const BRACKET = {
  East: [{ seed: 1, team: "Duke" }, { seed: 2, team: "Alabama" }, ...],
  South: [...],
  ...
};
```

**Replace with:**
```typescript
const { data: teams } = await supabase
  .from('teams')
  .select('id, name, abbreviation, seed, region, is_eliminated, logo_url')
  .order('seed', { ascending: true });

// Group by region
const bracket: Record<string, TeamInfo[]> = {};
for (const team of teams) {
  if (!bracket[team.region]) bracket[team.region] = [];
  bracket[team.region].push(team);
}
```

**Important:** The prototype uses `team.team` (string name) as the identifier. The database version should use `team.id` (UUID) for all lookups and comparisons, but display `team.name` or `team.abbreviation` in the UI.

#### 2. Tournament Days (`DAYS` constant → `rounds` table)

**Current prototype:**
```javascript
const DAYS = [
  { id: "R64_D1", label: "R64 Day 1", date: "Mar 19", round: "R64", half: "A", allRegions: true },
  ...
];
```

**Replace with:**
```typescript
const { data: rounds } = await supabase
  .from('rounds')
  .select('id, name, date, deadline_datetime, is_active')
  .order('date', { ascending: true });

// Map to the day format the planner expects
const DAYS = rounds.map((round, idx) => ({
  id: round.id,
  label: round.name,  // "Round 1 Day 1", "Sweet 16 Day 2", etc.
  date: formatDate(round.date),
  round: mapRoundNameToCode(round.name), // "R64", "R32", "S16", "E8", "F4", "CHIP"
  half: inferHalf(round.name), // "A" for Day 1, "B" for Day 2, null for F4/CHIP
  allRegions: !["E8"].includes(mapRoundNameToCode(round.name)),
  deadline: round.deadline_datetime,
  isActive: round.is_active,
}));
```

**Helper to map round names to short codes:**
```typescript
function mapRoundNameToCode(name: string): string {
  if (name.startsWith('Round 1')) return 'R64';
  if (name.startsWith('Round 2')) return 'R32';
  if (name.startsWith('Sweet 16')) return 'S16';
  if (name.startsWith('Elite 8')) return 'E8';
  if (name === 'Final Four') return 'F4';
  if (name === 'Championship') return 'CHIP';
  return 'R64';
}

function inferHalf(name: string): string | null {
  if (name.includes('Day 1')) return 'A';
  if (name.includes('Day 2')) return 'B';
  return null; // F4, Championship
}
```

#### 3. First Round Matchups (`R64_SEEDS` → `games` table)

**Current prototype:**
```javascript
const R64_SEEDS = [[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]];
```

This is the standard NCAA bracket structure and doesn't change. **Keep it hardcoded** — it's not data, it's bracket structure. But also check the `games` table for actual Round 1 matchups (in case First Four teams change seeds):

```typescript
// For R64, use the standard seed pairings (always the same)
// For later rounds, derive from game results or user predictions
const { data: games } = await supabase
  .from('games')
  .select(`
    id, round_id, status, winner_id,
    team1:team1_id(id, name, abbreviation, seed, region),
    team2:team2_id(id, name, abbreviation, seed, region)
  `)
  .order('game_datetime', { ascending: true });
```

#### 4. Completed Games — Auto-lock results

**This is the biggest integration change.** The prototype treats everything as a prediction. In the real app, completed games should auto-populate:

```typescript
// For each game with status === 'final':
// - The winner is locked (can't be changed by user)
// - The advancer is set automatically
// - The UI shows the result (score, "FINAL" label)

// For each game with status === 'in_progress':
// - Show live indicator
// - Still allow prediction (result not final)

// For each game with status === 'scheduled':
// - Full prediction mode (user clicks to advance)
```

**How to implement:** When building the planner state, pre-populate `advancers` for all completed games:

```typescript
const initialAdvancers: Record<string, TeamInfo> = {};

for (const game of completedGames) {
  const winner = game.winner_id === game.team1.id ? game.team1 : game.team2;
  const gameKey = `${winner.region}_${mapRoundToCode(game.round_id)}_${gameIndex}`;
  initialAdvancers[gameKey] = winner;
}

// Pass to component — these entries are READ-ONLY (user can't change them)
```

#### 5. Existing Picks — Pre-populate pinned picks

The user's actual submitted picks (from the `picks` table) should appear as pinned picks in the planner:

```typescript
const { data: existingPicks } = await supabase
  .from('picks')
  .select(`
    id, round_id, team_id,
    team:team_id(id, name, abbreviation, seed, region),
    round:round_id(id, name, date)
  `)
  .eq('pool_player_id', poolPlayerId);

// Map to planner format
const initialPicks: Record<string, PlannerPick> = {};
for (const pick of existingPicks) {
  initialPicks[pick.round_id] = {
    team: pick.team.name,
    seed: pick.team.seed,
    region: pick.team.region,
    teamId: pick.team.id,
    dayId: pick.round_id,
    isSubmitted: true, // Can't unpin — it's a real pick
  };
}
```

**Key distinction:**
- `isSubmitted: true` = real pick from the `picks` table. Show with a "LOCKED" indicator. Can't be unpinned.
- `isSubmitted: false` = planning-only pick. User can pin/unpin freely. NOT submitted to the database.

The planner is a PLANNING tool — pinning a pick here does NOT submit it. The user still submits picks through the normal pick page. The planner just helps them plan ahead.

---

### B. State Management

The prototype uses local `useState` for everything. For the integrated version:

**Keep as local state (planner is a planning tool, not persistent):**
- `advancers` — user's predicted winners (except completed games which are locked)
- `picks` — user's planned picks (except submitted picks which are locked)
- `expanded` — which day card is open
- `regionFlipped` — bracket half swap per region
- `e8Swapped` — Elite 8 region swap

**Pre-populate from database:**
- `advancers` — auto-set for completed games
- `picks` — auto-set for submitted picks

**Optional future enhancement:** Save planner state to `localStorage` so it persists between sessions. NOT a database save — this is a local planning tool.

---

### C. Component Architecture

**Don't create one 980-line file.** Break the prototype into components:

```
src/app/pools/[id]/analyze/page.tsx          — Main page (data loading, entry switcher)
src/components/analyze/BracketPlanner.tsx     — Main planner container
src/components/analyze/RegionTracker.tsx      — 4 region usage cards
src/components/analyze/DayCard.tsx            — Single day accordion card
src/components/analyze/MatchupCard.tsx        — Single game matchup within a day
src/components/analyze/BracketFlow.tsx        — 4-region projected path
src/components/analyze/UsageMap.tsx           — Region × Day table
src/components/analyze/PickSheet.tsx          — 10-pick summary grid
src/components/analyze/PlannerCoaching.tsx    — Tutorial coaching bar
src/lib/bracket.ts                           — Bracket logic (seed pairings, feeder maps, round codes)
```

---

### D. Entry-Specific Planning

The planner needs to be **entry-specific** — each entry has different used teams. Use the existing entry switcher from the pick page:

- Show entry tabs at the top (same as pick page)
- When user switches entries, reload used teams and submitted picks for that entry
- Each entry gets its own planning state

---

### E. UI Adaptations

#### Mobile Responsiveness
The prototype uses `gridTemplateColumns: "repeat(4, 1fr)"` for region trackers and bracket flow — this breaks on mobile. Adapt:

- Region trackers: `grid-cols-2` on mobile, `grid-cols-4` on desktop
- Day card expanded matchups: stack vertically on mobile (1 column), side-by-side on desktop
- Bracket flow: 2-column grid on mobile, 4-column on desktop
- Usage map: horizontal scroll on mobile
- Pick sheet: `grid-cols-2` on mobile, `grid-cols-5` on desktop

#### Remove Splash/Demo/Paywall
- Remove the splash landing page view — user is already in the app
- Remove the demo mode and Survive+ paywall references
- Keep the tutorial/coaching system as a first-time onboarding (show coaching bar on first visit, track dismissal in `localStorage`)
- Remove the "← Back" button (the bottom nav handles navigation)

#### Integrate with App Chrome
- Remove the inline `<link>` tags for Google Fonts (already loaded in root layout)
- Remove the standalone header bar (app has Header + BottomNav)
- Use the existing page layout pattern: `<div className="min-h-screen bg-[#0D1B2A] pb-24">`
- Match existing page padding: `max-w-lg mx-auto px-5` for mobile-first, but allow wider for the planner since it has dense content — use `max-w-4xl` instead

#### Game Status Indicators
For completed games in the day cards:

```
┌─────────────────────────────────────┐
│  GAME 1                     FINAL  │
│  1  Duke               78   ✓ W   │
│  16 Norfolk State      55     L   │
└─────────────────────────────────────┘
```

For live games:
```
┌─────────────────────────────────────┐
│  GAME 3                  🔴 LIVE   │
│  5  Oregon              34         │
│  12 Liberty             29   H1   │
└─────────────────────────────────────┘
```

For scheduled games (full prediction mode — same as prototype):
```
┌─────────────────────────────────────┐
│  GAME 2                  7:10 PM   │
│  8  Miss St                    ✎  │
│  9  Baylor              ✓     ✎  │
└─────────────────────────────────────┘
```

#### Win Probability Integration
Use the Odds API probabilities (Task 14) in the matchup cards. Show the win% next to each team name in scheduled games:

```
│  1  Duke          92%         ✎  │
│  16 Norfolk St     8%         ✎  │
```

Import `getWinProbability()` from `@/lib/analyze` (same function used by pick page).

---

### F. Bracket Logic Module (`src/lib/bracket.ts`)

Extract the pure bracket logic from the prototype into a shared utility:

```typescript
// Standard NCAA bracket structure
export const R64_SEED_PAIRINGS = [[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]];
export const R32_FEEDERS = [[0,1],[2,3],[4,5],[6,7]];
export const S16_FEEDERS = [[0,1],[2,3]];
export const E8_FEEDERS = [[0,1]];

export const HALF_A = { R64: [0,1,2,3], R32: [0,1], S16: [0] };
export const HALF_B = { R64: [4,5,6,7], R32: [2,3], S16: [1] };

export const PREV_ROUND: Record<string, string> = { R32: "R64", S16: "R32", E8: "S16", F4: "E8" };
export const FEEDERS_MAP: Record<string, number[][]> = { R32: R32_FEEDERS, S16: S16_FEEDERS, E8: E8_FEEDERS };

export const REGIONS = ["East", "South", "West", "Midwest"];

export const ROUND_COLORS: Record<string, string> = {
  R64: "#5F6B7A", R32: "#9BA3AE", S16: "#42A5F5",
  E8: "#FFB300", F4: "#EF5350", CHIP: "#FF5722",
};

export function mapRoundNameToCode(name: string): string { ... }
export function inferHalf(name: string): string | null { ... }
export function getRegionsForDay(day: DayInfo, e8Swapped: boolean): string[] { ... }
```

---

### G. What to Keep From Current Analyze Page

- `getPoolPlayer()` call for auth/pool membership check
- Entry switcher (if user has multiple entries)
- Loading skeleton pattern
- Error state component
- `useActivePool` context usage

### What to Remove

- **All 5 current modules:** Team Inventory, Opponent Intel, Today's Games, Pick Optimizer, Survival Odds (placeholder)
- The existing module accordion system
- All of `src/lib/analyze.ts` EXCEPT `getSeedWinProbability()` and `getWinProbability()` (still needed by pick page)
- `getTeamInventory()` and `getOpponentInventories()` functions (the planner replaces this functionality more elegantly)

**Wait — don't delete `getTeamInventory()` yet.** The 64-team inventory grid on the pick page (separate task) may still use it. Check if the pick page imports it before removing.

---

## Data Flow Summary

```
Database                          Planner State                    UI
────────                          ─────────────                    ──
teams table      ───────────────► bracket (grouped by region)  ──► Region Trackers
rounds table     ───────────────► days (10 day cards)          ──► Day Cards
games table      ───────────────► completedAdvancers (locked)  ──► Matchup Cards (FINAL state)
picks table      ───────────────► submittedPicks (locked)      ──► Pick Sheet (LOCKED state)
                                  userAdvancers (editable)     ──► Matchup Cards (predicted state)
                                  userPlannedPicks (editable)  ──► Pick Sheet (planned state)
                                  regionCounts (derived)       ──► Region Trackers
                                  bracketFlow (derived)        ──► Bracket Flow
```

---

## Files to Create

1. `src/app/pools/[id]/analyze/page.tsx` — **Full rewrite** (data loading + layout, pool mode)
2. `src/app/analyze/page.tsx` — **New** standalone route (no auth required)
3. `src/components/analyze/BracketPlanner.tsx` — Main planner container (accepts mode prop)
4. `src/components/analyze/RegionTracker.tsx` — Region usage cards
5. `src/components/analyze/DayCard.tsx` — Expandable day card
6. `src/components/analyze/MatchupCard.tsx` — Game matchup within a day
7. `src/components/analyze/BracketFlow.tsx` — Projected path visualization
8. `src/components/analyze/UsageMap.tsx` — Region × Day table
9. `src/components/analyze/PickSheet.tsx` — 10-pick summary grid
10. `src/components/analyze/PlannerCoaching.tsx` — Tutorial/coaching bar
11. `src/lib/bracket.ts` — Bracket structure constants and utilities

## Files to Modify

1. `src/lib/analyze.ts` — Remove unused functions but KEEP `getSeedWinProbability()` and `getWinProbability()`
2. `src/components/BottomNav.tsx` — Update Analyze tab fallback from `/dashboard` to `/analyze`
3. `src/components/TournamentInProgress.tsx` — Add Bracket Planner CTA, reframe messaging (see companion revision file)

## Files to Reference (Don't Modify)

1. `survivor-grid.jsx` — The prototype. Copy logic and styling from here.
2. `src/app/pools/[id]/pick/page.tsx` — Entry switcher pattern, pick submission flow
3. `src/lib/picks.ts` — `getPickableTeams()`, `getPlayerPicks()`, `getTodaysGames()`
4. `src/types/picks.ts` — `Game`, `PickableTeam`, `TeamInfo` types

---

## Implementation Priority

Since this is a large feature, implement in this order:

### Phase 1: Core Planner (must have)
1. `bracket.ts` — bracket logic utilities
2. `BracketPlanner.tsx` — main container with data loading
3. `RegionTracker.tsx` — region usage cards
4. `DayCard.tsx` + `MatchupCard.tsx` — the 10 day cards with matchups
5. `page.tsx` — rewired analyze page

### Phase 2: Visualization (important)
6. `BracketFlow.tsx` — projected path
7. `UsageMap.tsx` — region × day table
8. `PickSheet.tsx` — pick summary grid

### Phase 3: Polish
9. `PlannerCoaching.tsx` — tutorial system
10. Auto-populate completed games
11. Win probability display in matchups
12. Mobile responsive breakpoints

---

## Standalone Mode (No Pool Required)

**Read the companion file:** `claude-code-revision-tournament-standalone-planner.md` for full details.

The BracketPlanner component must support two modes:

**Pool mode** (`/pools/[id]/analyze`) — full features with entry switcher, submitted picks, used teams
**Standalone mode** (`/analyze`) — no auth required, no pool context, just bracket data + planning

The component accepts a `mode` prop:

```typescript
interface BracketPlannerProps {
  teams: TeamInfo[];
  rounds: RoundInfo[];
  games: GameInfo[];
  mode: 'standalone' | 'pool';
  // Pool-mode only props (optional)
  poolPlayerId?: string;
  submittedPicks?: Pick[];
  usedTeamIds?: string[];
}
```

In standalone mode:
- No entry switcher
- No submitted picks pre-populated
- No "LOCKED" badges
- No used team tracking (everything is available)
- Completed games still auto-lock from the `games` table
- Planning state saved to `localStorage` for persistence
- Signup nudge at the bottom: "Create an account and join a pool for the next tournament"

Create a new page at `src/app/analyze/page.tsx` that renders `<BracketPlanner mode="standalone" />` with data fetched from public tables (teams, rounds, games). Check that Supabase RLS allows public reads on these tables.

---

## What NOT to Do

- Don't submit picks from the planner — it's a planning tool only. Picks are submitted through the pick page.
- Don't save planner state to the database — use local state (optionally localStorage for persistence)
- Don't include the Survive+ paywall, pricing, or demo mode restrictions — the app is free
- Don't keep the prototype's standalone header/back button — the app has its own navigation
- Don't hardcode the 2026 bracket data — pull everything from the database
- Don't delete `getSeedWinProbability()` from analyze.ts — the pick page still uses it
- Don't break the pick page's imports from analyze.ts
- Don't make the planner too wide — keep it within `max-w-4xl` (but wider than the usual `max-w-lg`)
- Don't create a single 980-line component — break it into the component files listed above

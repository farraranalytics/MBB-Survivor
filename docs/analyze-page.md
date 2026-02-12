# Analyze Page — "Plan Your Path"

The Analyze page is a **bracket planner** that lets users map out their entire survivor pick strategy across all tournament rounds. It answers the key question: *"If I pick team X today, what are my options in later rounds?"*

## Page URL

`/pools/[id]/analyze`

## How It Works

In a survivor pool you can only pick each team **once** for the entire tournament. The Analyze page lets users:

1. **Predict game winners** — tap a team to say "I think they'll advance"
2. **Pin a survivor pick** — tap the pencil icon to lock a team as your pick for that day
3. **See the cascade** — pinned picks get crossed out everywhere else; predicted winners flow into the next round's matchups
4. **Watch for traps** — region trackers warn when you're burning too many teams from one region (the "Elite 8 trap")

Submitted picks (from the Pick page) show as locked and can't be changed here. Unsubmitted days are fully editable for planning purposes — nothing is saved to the DB from this page.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  PoolAnalyzePage  (src/app/pools/[id]/analyze/)     │
│  - Fetches all data from Supabase                   │
│  - Manages entry switching                          │
│  - Passes everything to BracketPlanner              │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  BracketPlanner  (src/components/analyze/)           │
│  - Core orchestrator component                       │
│  - All bracket logic (advancers, picks, matchups)    │
│  - Tutorial state management                         │
│                                                      │
│  Renders:                                            │
│  ┌─────────────┐ ┌──────────┐ ┌──────────────┐      │
│  │RegionTracker│ │ DayCard  │ │ BracketFlow  │      │
│  │             │ │  ┌──────┐│ │              │      │
│  │ 4 region    │ │  │Match-││ │ Projected    │      │
│  │ usage bars  │ │  │upCard││ │ path per     │      │
│  │             │ │  └──────┘│ │ region       │      │
│  └─────────────┘ └──────────┘ └──────────────┘      │
│  ┌─────────────┐ ┌──────────┐ ┌──────────────┐      │
│  │  UsageMap   │ │PickSheet │ │  Planner     │      │
│  │             │ │          │ │  Coaching    │      │
│  │ Region×Day  │ │ Summary  │ │  (tutorial)  │      │
│  │ grid        │ │ of all   │ │              │      │
│  │             │ │ picks    │ │              │      │
│  └─────────────┘ └──────────┘ └──────────────┘      │
└─────────────────────────────────────────────────────┘
```

## Data Flow

### Page-Level Fetch (`PoolAnalyzePage`)

The page fetches 5 things from Supabase on mount:

| Query | Table | Purpose |
|-------|-------|---------|
| Player entries | `pool_players` | Entry switcher tabs (multi-entry support) |
| All teams | `teams` | Grouped by region → `bracket` object |
| All rounds | `rounds` | Tournament day list for planner columns |
| All games + team joins | `games` | Bracket structure, game statuses, matchup data |
| Entry's picks + team joins | `picks` | Which teams are already submitted/locked |

These are passed into `BracketPlanner` as props.

### BracketPlanner State

| State | Type | Purpose |
|-------|------|---------|
| `advancers` | `Record<string, TeamInfo>` | Predicted winners keyed by `{region}_{roundCode}_{gameIdx}` |
| `picks` | `Record<string, PlannerPick>` | Pinned survivor picks keyed by round UUID |
| `expanded` | `string \| null` | Which DayCard is currently expanded |
| `regionFlipped` | `Record<string, boolean>` | Per-region Day1/Day2 half swap |
| `e8Swapped` | `boolean` | Whether Elite 8 region order is swapped |

### Key Derived Values (via `useMemo`)

| Value | How it's built |
|-------|---------------|
| `days` | `buildPlannerDays(rounds)` — maps each round to a `PlannerDay` with label, date, roundCode, half |
| `lockedAdvancers` | `buildLockedAdvancers(games, rounds, bracket)` — completed games have locked winners |
| `lockedPicks` | `buildLockedPicks(submittedPicks, bracket)` — submitted picks can't be changed |
| `gameStatuses` | Maps each `{region}_{round}_{gameIdx}` to its status, scores, winner |
| `actualGameIndices` | Per-round, per-region game indices from DB — overrides hardcoded HALF_A/HALF_B |
| `usedTeamIds` | All teams in current picks + historically used teams from entry |
| `regionCounts` | Count of picks per region for balance tracking |

## Component Breakdown

### RegionTracker
**File:** `src/components/analyze/RegionTracker.tsx`

4-card grid showing pick usage per region. Each card has:
- Region name + "X USED" badge
- 4-segment progress bar (fills as picks are used)
- "X/16 LEFT" counter (available teams remaining)

Color coding:
- Normal (< 3 picks): orange
- Warning (3 picks): yellow
- Danger (4+ picks): red

### DayCard
**File:** `src/components/analyze/DayCard.tsx`

Collapsible card for each tournament day. Shows:
- **Collapsed:** Day number, date, round label, current pick (or "No pick set"), chevron
- **Expanded:** Grid of regions, each containing MatchupCards

The header has an orange-bordered pill when a pick is set, with team seed/name/region and a lock icon for submitted picks.

### MatchupCard
**File:** `src/components/analyze/MatchupCard.tsx`

Individual game matchup within a DayCard. Two interaction modes:

1. **Team name button** (left side) — toggles the advancer prediction
   - Highlighted with border when selected as advancer
   - Struck-through + dimmed when team is already used
   - Shows score for completed games

2. **Pencil button** (right side) — pins this team as the survivor pick for the day
   - Orange glow when selected as pick
   - Lock icon when submitted
   - Disabled for already-used teams

Header shows game time in ET, UPSET badge (when predicted winner has higher seed than opponent), FINAL badge for completed games.

### BracketFlow
**File:** `src/components/analyze/BracketFlow.tsx`

"Projected Path" visualization — 4-column grid (one per region) showing:
- R32 winners (4 team pills)
- S16 winners (2 team pills)
- Region champion (1 large pill)

Used teams are shown in red with strikethrough. This is where the "Elite 8 trap" becomes visible — if your projected region champion is already burned, you're in trouble.

### UsageMap
**File:** `src/components/analyze/UsageMap.tsx`

Region × Day grid table:
- Rows: East, South, West, Midwest
- Columns: Each tournament day
- Cells: `●` (pick set), `·` (available, no pick), `—` (region not playing this day)
- Total column shows count with danger coloring at 4+

### PickSheet
**File:** `src/components/analyze/PickSheet.tsx`

Summary grid of all picks across all days:
- Each day is a card showing round label + picked team (or dash)
- Submitted picks show lock icon
- Bottom warning if any region has 4+ picks ("Heavy regional exposure")

### PlannerCoaching
**File:** `src/components/analyze/PlannerCoaching.tsx`

5-step tutorial that walks new users through the planner. Fixed bottom bar with:
- Step counter, title, description
- "Got it" (dismiss) + "Next" buttons
- Progress dots

Steps:
1. **Predict Winners** — click team names to advance them
2. **Lock Your Pick** — use pencil button to pin survivor pick
3. **Watch It Flow Forward** — winners populate next round matchups
4. **Watch Your Regions** — region tracker warns about overexposure
5. **The Elite 8 Trap** — Bracket Flow shows if your path is blocked

State persisted in `localStorage` (`planner-tutorial-dismissed`). Can restart via `?` button.

## Bracket Logic (in `src/lib/bracket.ts`)

### Round Code Mapping

| DB Name | Code | Games/Region |
|---------|------|-------------|
| Round 1 Day 1/2 | R64 | 8 |
| Round 2 Day 1/2 | R32 | 4 |
| Sweet 16 Day 1/2 | S16 | 2 |
| Elite Eight Day 1/2 | E8 | 1 |
| Final Four | F4 | 1 (cross-region) |
| Championship | CHIP | 1 |

### Advancer Resolution

For any game, `getGameWinner()` returns:
1. The explicitly set advancer if one exists
2. Otherwise, the **chalk** pick (lowest seed = strongest team)

This "chalk default" means the planner auto-fills with favorites, and users only need to override when they predict upsets.

### Game Index System

Each game within a round+region has a positional index based on the bracket structure:

```
R64:  [0]=1v16  [1]=8v9  [2]=5v12  [3]=4v13  [4]=6v11  [5]=3v14  [6]=7v10  [7]=2v15
R32:  [0]=winner(R64-0 vs R64-1)  [1]=winner(R64-2 vs R64-3)  ...
S16:  [0]=winner(R32-0 vs R32-1)  [1]=winner(R32-2 vs R32-3)
E8:   [0]=winner(S16-0 vs S16-1)
```

The key format `{region}_{roundCode}_{gameIdx}` (e.g., `East_R64_3`) uniquely identifies any game in the bracket and is used throughout for advancers, game statuses, and locked states.

## Pool Mode vs Standalone Mode

| Feature | Pool Mode | Standalone Mode |
|---------|-----------|----------------|
| Entry tabs | Yes | No |
| Submitted picks locked | Yes | No |
| Used teams from history | Yes (from DB) | No |
| Signup nudge | No | Yes (bottom CTA) |

The standalone mode (`/analyze`) is a public-facing version with no auth required — useful as a marketing tool.

# Task: Fix Analyze Tab Day Mapping in BracketPlanner

## The Problem

The Bracket Planner (analyze tab) assigns future-round games to the wrong days. For R32, it uses `HALF_A = [0,1]` and `HALF_B = [2,3]` to decide which R32 game indices show on Day 1 vs Day 2. This is wrong — R32 day assignment is determined by which R64 day the parent games were on, NOT by bracket position.

Example: Duke plays R64 on Day 2 → Duke's R32 game MUST show on R32 Day 2. But the current code puts Duke's R32 game on Day 1 because Duke's R32 game index (0) is in HALF_A.

For S16 and E8, the code also doesn't use the region-based scheduling rules from the database.

## The Correct Rules

```
R64 Day 1/2:  Set by actual game schedule (already correct in DB)
R32 Day 1:    Teams whose R64 game was on R64 Day 1  (Thu→Sat)
R32 Day 2:    Teams whose R64 game was on R64 Day 2  (Fri→Sun)
S16 Day 1:    South + West regions                    (venue-driven, 2026 schedule)
S16 Day 2:    East + Midwest regions                  (venue-driven, 2026 schedule)
E8 Day 1:     South + West regions                    (deterministic from S16)
E8 Day 2:     East + Midwest regions                  (deterministic from S16)
F4:           Fixed single day
Championship: Fixed single day
```

## Actual R64-to-R32 Mapping (from current DB data)

The R64 games are NOT evenly split top-half/bottom-half per region. Here's the actual split:

```
Region      R64 Day 1 game indices    R64 Day 2 game indices
East        [4, 5]                    [0, 1, 2, 3, 6, 7]
South       [0, 1, 2, 3]             [4, 5, 6, 7]
West        [4, 5, 6, 7]             [0, 1, 2, 3]
Midwest     [0, 1, 2, 3, 6, 7]       [4, 5]
```

R32 games are fed by pairs of R64 games. Both parents are always on the same day:
```
R32 game 0 ← R64 games 0+1
R32 game 1 ← R64 games 2+3
R32 game 2 ← R64 games 4+5
R32 game 3 ← R64 games 6+7
```

So the CORRECT R32 day assignments are:
```
Region      R32 Day 1 games    R32 Day 2 games
East        [2]                [0, 1, 3]
South       [0, 1]             [2, 3]
West        [2, 3]             [0, 1]
Midwest     [0, 1, 3]          [2]
```

This is completely different from the current HALF_A=[0,1] / HALF_B=[2,3] split.

## The Fix

### Approach: Build R32 day mapping from actual R64 game data

Instead of using HALF_A/HALF_B for R32, compute which R32 game indices belong on which day by checking which R64 day each parent game is on. This only requires the existing R64 games data (already loaded).

### Step 1: Add R32 day-mapping computation to BracketPlanner

Add a new `useMemo` in `BracketPlanner.tsx` that builds a map of `roundId → region → gameIndices[]` for R32 days, derived from R64 game data:

```typescript
// Build R32 day mapping from R64 game data
// R32 day is determined by which R64 day the parent games were on
const r32DayMapping = useMemo(() => {
  const R64_DAY1_ID = rounds.find(r => r.name === 'Round 1 Day 1')?.id;
  const R64_DAY2_ID = rounds.find(r => r.name === 'Round 1 Day 2')?.id;
  const R32_DAY1_ID = rounds.find(r => r.name === 'Round 2 Day 1')?.id;
  const R32_DAY2_ID = rounds.find(r => r.name === 'Round 2 Day 2')?.id;

  if (!R64_DAY1_ID || !R64_DAY2_ID || !R32_DAY1_ID || !R32_DAY2_ID) return {};

  // For each region, figure out which R64 game indices are on Day 1 vs Day 2
  const r64DayByRegionAndIndex: Record<string, Record<number, string>> = {};

  for (const game of games) {
    if (!game.team1) continue;
    const region = (game.team1 as TeamInfo).region;
    const seed = (game.team1 as TeamInfo).seed;
    const gameIdx = seedToR64Index(seed);
    if (gameIdx < 0) continue;

    if (!r64DayByRegionAndIndex[region]) r64DayByRegionAndIndex[region] = {};

    if (game.round_id === R64_DAY1_ID) {
      r64DayByRegionAndIndex[region][gameIdx] = 'Day1';
    } else if (game.round_id === R64_DAY2_ID) {
      r64DayByRegionAndIndex[region][gameIdx] = 'Day2';
    }
  }

  // R32 feeders: R32 game N is fed by R64 games [2N, 2N+1]
  const R32_FEEDERS = [[0,1],[2,3],[4,5],[6,7]];

  // For each region, determine which R32 games go on Day 1 vs Day 2
  const mapping: Record<string, Record<string, number[]>> = {};
  // mapping[roundId][region] = [gameIndices]

  mapping[R32_DAY1_ID] = {};
  mapping[R32_DAY2_ID] = {};

  for (const region of PLANNER_REGIONS) {
    mapping[R32_DAY1_ID][region] = [];
    mapping[R32_DAY2_ID][region] = [];

    for (let r32Idx = 0; r32Idx < R32_FEEDERS.length; r32Idx++) {
      const [f0, f1] = R32_FEEDERS[r32Idx];
      const f0Day = r64DayByRegionAndIndex[region]?.[f0];
      const f1Day = r64DayByRegionAndIndex[region]?.[f1];

      // Both parents should be on the same day (NCAA scheduling guarantees this)
      // If either parent is Day1, the R32 game is on Day1
      if (f0Day === 'Day1' || f1Day === 'Day1') {
        mapping[R32_DAY1_ID][region].push(r32Idx);
      } else {
        mapping[R32_DAY2_ID][region].push(r32Idx);
      }
    }
  }

  return mapping;
}, [games, rounds]);
```

### Step 2: Add S16/E8 region mapping constants

Add to `bracket.ts` (or keep in BracketPlanner):

```typescript
// 2026 region-to-day mapping for S16 and E8
// Update yearly after Selection Sunday
const S16_DAY1_REGIONS = ['South', 'West'];      // Thu Mar 26
const S16_DAY2_REGIONS = ['East', 'Midwest'];     // Fri Mar 27
const E8_DAY1_REGIONS  = ['South', 'West'];       // Sat Mar 28 (deterministic from S16)
const E8_DAY2_REGIONS  = ['East', 'Midwest'];     // Sun Mar 29
```

### Step 3: Update `buildPlannerDays()` in bracket.ts

Fix the S16 and E8 `fixedRegions` assignment. Replace the current hardcoded E8-only logic:

```typescript
// CURRENT (broken):
if (roundCode === 'E8' && half === 'A') fixedRegions = ['East', 'South'];
if (roundCode === 'E8' && half === 'B') fixedRegions = ['West', 'Midwest'];

// FIXED:
const S16_DAY1_REGIONS = ['South', 'West'];
const S16_DAY2_REGIONS = ['East', 'Midwest'];
const E8_DAY1_REGIONS  = ['South', 'West'];
const E8_DAY2_REGIONS  = ['East', 'Midwest'];

if (roundCode === 'S16') {
  fixedRegions = half === 'A' ? S16_DAY1_REGIONS : S16_DAY2_REGIONS;
}
if (roundCode === 'E8') {
  fixedRegions = half === 'A' ? E8_DAY1_REGIONS : E8_DAY2_REGIONS;
}
```

Also set `allRegions: false` for S16 days (currently they have `allRegions: true`).

### Step 4: Update `getMatchupsForDay()` in BracketPlanner.tsx

Merge the R32 day mapping into the game index resolution. Change the fallback logic:

```typescript
// In getMatchupsForDay, when determining gameIndices:

// 1. First check actualGameIndices from DB (for rounds with real games)
const dbIndices = actualGameIndices[day.id]?.[region];

// 2. Then check r32DayMapping (for R32 days without real games yet)
const r32Indices = r32DayMapping[day.id]?.[region];

let gameIndices: number[];

if (dbIndices && dbIndices.length > 0) {
  gameIndices = dbIndices;
} else if (r32Indices && r32Indices.length > 0) {
  gameIndices = r32Indices;
} else if (roundCode === 'E8') {
  gameIndices = [0];
} else if (roundCode === 'S16') {
  // S16 has 2 games per region: indices 0 and 1
  gameIndices = [0, 1];
} else if (roundCode === 'F4' || roundCode === 'CHIP') {
  gameIndices = [0];
} else {
  // Ultimate fallback (shouldn't reach here for normal tournament data)
  let half = day.half;
  if (half && regionFlipped[region]) half = half === 'A' ? 'B' : 'A';
  gameIndices = half === 'A'
    ? (HALF_A[roundCode] || [])
    : half === 'B'
      ? (HALF_B[roundCode] || [])
      : [...(HALF_A[roundCode] || []), ...(HALF_B[roundCode] || [])];
}
```

### Step 5: Update `getRegionsForDayWrapped()` in BracketPlanner.tsx

For R32 days, use the r32DayMapping to determine which regions have games:

```typescript
const getRegionsForDayWrapped = (day: PlannerDay): string[] => {
  // Use actual DB data if available
  const dbRegions = actualGameIndices[day.id];
  if (dbRegions && Object.keys(dbRegions).length > 0) {
    return PLANNER_REGIONS.filter(r => dbRegions[r] && dbRegions[r].length > 0);
  }
  // Use R32 day mapping for R32 days
  const r32Regions = r32DayMapping[day.id];
  if (r32Regions && Object.keys(r32Regions).length > 0) {
    return PLANNER_REGIONS.filter(r => r32Regions[r] && r32Regions[r].length > 0);
  }
  // Use fixedRegions for S16/E8
  if (day.fixedRegions) {
    const base = [...day.fixedRegions];
    return e8Swapped ? base.reverse() : base;
  }
  return PLANNER_REGIONS;
};
```

## Import needed

Add `seedToR64Index` to the imports from `@/lib/bracket` in BracketPlanner.tsx (it's already exported).

## Expected Results After Fix

### R32 Day 1 (Mar 21):
```
East:     1 game  (game 2: seeds 5v12 winner vs 4v13 winner)
South:    2 games (game 0: 1v16w vs 8v9w, game 1: 5v12w vs 4v13w)
West:     2 games (game 2: 6v11w vs 3v14w, game 3: 7v10w vs 2v15w)
Midwest:  3 games (game 0: 1v16w vs 8v9w, game 1: 5v12w vs 4v13w, game 3: 7v10w vs 2v15w)
```

### R32 Day 2 (Mar 22):
```
East:     3 games (game 0, 1, 3)
South:    2 games (game 2, 3)
West:     2 games (game 0, 1)
Midwest:  1 game  (game 2)
```

### S16 Day 1 (Mar 26): South + West only (2 games each)
### S16 Day 2 (Mar 27): East + Midwest only (2 games each)
### E8 Day 1 (Mar 28): South + West only (1 game each)
### E8 Day 2 (Mar 29): East + Midwest only (1 game each)
### F4 (Apr 4): All regions (2 semifinal games)
### Championship (Apr 6): 1 game

## Files to Modify

1. **`src/lib/bracket.ts`** — Fix `buildPlannerDays()` S16/E8 fixedRegions
2. **`src/components/analyze/BracketPlanner.tsx`** — Add `r32DayMapping` useMemo, update `getMatchupsForDay()` and `getRegionsForDayWrapped()`

## What NOT to Change

- R64 day assignments (already correct from DB)
- The advancer/pick logic (works correctly once games are on the right day)
- DayCard, MatchupCard, or other analyze sub-components (they render whatever they're given)
- Any non-analyze pages

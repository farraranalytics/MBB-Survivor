# Fix Bracket Page — Round Grouping + Date/Time Display

## The Problem

The bracket page is broken because of a mismatch between round names in the database and the bracket logic.

**Database round names:** `Round 1 Day 1`, `Round 1 Day 2`, `Round 2 Day 1`, `Round 2 Day 2`, `Sweet 16 Day 1`, `Sweet 16 Day 2`, `Elite 8 Day 1`, `Elite 8 Day 2`, `Final Four`, `Championship`

**What the bracket code expects:** `Round of 64`, `Round of 32`, `Sweet 16`, `Elite Eight`

These never match, so games don't group into the right bracket columns. Also, each tournament round is split across two days (Day 1 and Day 2), but the bracket should show ONE column per round, not per day.

## The Fix

### 1. Update `src/lib/bracket.ts` — Add round grouping logic

Create a mapping that groups day-split rounds into single bracket rounds:

```typescript
// Map DB round names to bracket column names
const ROUND_GROUP_MAP: Record<string, string> = {
  'Round 1 Day 1': 'Round of 64',
  'Round 1 Day 2': 'Round of 64',
  'Round 2 Day 1': 'Round of 32',
  'Round 2 Day 2': 'Round of 32',
  'Sweet 16 Day 1': 'Sweet 16',
  'Sweet 16 Day 2': 'Sweet 16',
  'Elite 8 Day 1': 'Elite 8',
  'Elite 8 Day 2': 'Elite 8',
  'Final Four': 'Final Four',
  'Championship': 'Championship',
};
```

Update `buildRegionBracket()` to:
1. Group games by this mapped bracket round name (not by individual round ID)
2. Combine games from both days into a single bracket column
3. For each region, the Round of 64 column should have 8 games (not 16 — 8 per region), Round of 32 should have 4, Sweet 16 should have 2, Elite 8 should have 1
4. Sort Round of 64 games by the standard bracket seed order (1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15)

The expected games per column per region:
- Round of 64: 8 games
- Round of 32: 4 games
- Sweet 16: 2 games
- Elite 8: 1 game

### 2. Update `src/components/bracket/BracketMatchupCard.tsx` — Add date and time

Each matchup card should show when the game is/was played. This is critical because games in the same bracket column happen on different days.

**For scheduled games:** Show the date AND time
```
  1  DUKE
 16  MT ST MARY'S
     Mar 20 · 12:15 PM
```

**For completed games:** Show "FINAL" and the date
```
  1  DUKE          93
 16  MT ST MARY'S  49
     FINAL · Mar 20
```

**For live games:** Show "LIVE" indicator
```
  1  DUKE          45
 16  MT ST MARY'S  38
     🔴 LIVE
```

The game datetime is already on `game.game_datetime`. Use the existing `formatET()`, `formatETShort()`, and `formatDateET()` helpers from `@/lib/timezone`.

Update the bottom status bar of the card:
- Currently only shows status for final/live games
- Change to ALWAYS show the bottom bar:
  - Scheduled: show date + time (e.g., `Mar 20 · 12:15 PM`) 
  - Final: show `FINAL · Mar 20`
  - Live: show `🔴 LIVE`

### 3. Update `src/components/bracket/RegionBracket.tsx` — Fix column headers

Change the column headers from using `round.name` (which would be "Round 1 Day 1") to using the grouped bracket round name.

Update `EXPECTED_GAMES` to `[8, 4, 2, 1]` per region (it already is, just confirming).

Update `roundLabels` to: `['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8']` (it already has this as a fallback, but make it the primary label since we're now grouping).

### 4. Update the BracketRound type

Since we're grouping multiple DB rounds into one bracket column, the `BracketRound` type needs a small update in `src/types/bracket.ts`:

```typescript
export interface BracketRound {
  round: Round;         // Keep for backwards compat — use the first round in the group
  roundLabel: string;   // The display name: "Round of 64", "Round of 32", etc.
  games: BracketGame[];
}
```

### 5. No changes needed to the Schedule view

The Schedule view (the other tab) already works correctly by showing games per round — leave it alone. Only the Bracket view needs fixing.

## Files to Modify

1. `src/lib/bracket.ts` — Add `ROUND_GROUP_MAP`, update `buildRegionBracket()` to group by bracket round
2. `src/components/bracket/BracketMatchupCard.tsx` — Add date/time to bottom bar for ALL game states
3. `src/components/bracket/RegionBracket.tsx` — Use `roundLabel` for column headers
4. `src/types/bracket.ts` — Add `roundLabel` to `BracketRound`

## How to Test

After running the seed script, you should see:

**East region bracket:**
```
Round of 64          Round of 32       Sweet 16       Elite 8
─────────────        ───────────       ──────────     ───────
1 Duke               TBD               TBD            TBD
16 Mt St Mary's      TBD
  Mar 20 · 12:15 PM

8 Miss State          
9 Baylor             TBD
  Mar 20 · 2:00 PM   TBD

5 Oregon
12 Liberty           TBD
  Mar 20 · 7:10 PM   TBD

4 Arizona
13 Akron
  Mar 20 · 5:30 PM

6 BYU
11 VCU               TBD
  Mar 19 · 7:25 PM   TBD

3 Wisconsin
14 Montana
  Mar 19 · 4:30 PM

7 Saint Mary's
10 Vanderbilt        TBD
  Mar 20 · ...        TBD

2 Alabama
15 Robert Morris
  Mar 20 · 2:00 PM
```

Note that within the same "Round of 64" column, some games are Mar 19 (Day 1) and some are Mar 20 (Day 2). The date on each card makes it clear which day each game is on — this is why date display is important.

## Important

- Don't change the database round names or structure
- Don't change the Schedule view
- Keep the region filter tabs (East, West, South, Midwest, Final Four)
- Keep the existing matchup card styling — just add the date/time bar
- The `buildFinalFour()` function already works correctly since Final Four and Championship are single-day rounds

# Task: Redesign Admin Test Mode — Simulated Clock + Game Cascade

## Why This Exists

The current admin test mode is broken by design. It overwrites `game_datetime` on real games to `NOW()` so deadline checks pass — this destroys the actual schedule data and makes every game show the same timestamp. It also doesn't handle the forward cascade (creating next-round games when a round completes).

The new approach: **never touch game dates/times.** Instead, use a simulated clock that makes the app *think* it's tournament time, and let game results trigger automatic creation of next-round matchups.

## Overview

Two independent pieces:

1. **Simulated Clock** — Admin sets a fake "current time" that the app uses for deadline/status checks instead of `NOW()`. This lets you test pre-deadline, mid-round, and post-round states without changing any game data.

2. **Game Result Cascade** — When a game is marked complete, the system automatically creates/populates the next-round game with the winner. This mirrors what happens in production when ESPN scores come in.

---

## Part 1: Simulated Clock

### New Table: `admin_test_state`

```sql
CREATE TABLE IF NOT EXISTS admin_test_state (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    is_test_mode BOOLEAN NOT NULL DEFAULT false,
    simulated_datetime TIMESTAMPTZ,        -- the fake "now" 
    target_round_id uuid REFERENCES rounds(id),  -- which round we're testing
    phase VARCHAR(20) DEFAULT 'pre_round', -- 'pre_round', 'live', 'post_round'
    updated_by uuid REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one row ever exists (singleton pattern)
INSERT INTO admin_test_state (is_test_mode) VALUES (false);

-- RLS: only pool creators can update, anyone authenticated can read
ALTER TABLE admin_test_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read test state" ON admin_test_state 
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can update test state" ON admin_test_state 
    FOR UPDATE TO authenticated USING (true);  -- tighten this later if needed
```

### Simulated DateTime Logic

When the admin selects a round and phase, compute the simulated time automatically:

| Phase | Simulated Time | What It Tests |
|-------|---------------|---------------|
| `pre_round` | Round date, 8:00 AM ET | Before deadline — picks allowed, countdown active |
| `live` | Round's `deadline_datetime` + 1 hour | After deadline — picks locked, games in progress |
| `post_round` | Round date, 11:55 PM ET | All games should be final, ready for next round |

```typescript
function computeSimulatedTime(round: Round, phase: string): string {
  const date = round.date; // e.g., "2026-03-19"
  switch (phase) {
    case 'pre_round':
      return `${date}T12:00:00+00`; // 8 AM ET = noon UTC
    case 'live':
      // 1 hour after deadline
      const deadline = new Date(round.deadline_datetime);
      return new Date(deadline.getTime() + 60 * 60 * 1000).toISOString();
    case 'post_round':
      return `${date}T03:55:00+00`; // next day ~11:55 PM ET
      // Actually: round date + 1 day, 03:55 UTC = 11:55 PM ET
    default:
      return new Date().toISOString();
  }
}
```

### New Utility: `getEffectiveNow()`

Replace ALL uses of `new Date()` / `Date.now()` / `NOW()` for deadline/status checks with this:

**Client-side (`src/lib/clock.ts`):**

```typescript
import { supabase } from '@/lib/supabase/client';

let _testState: { is_test_mode: boolean; simulated_datetime: string | null } | null = null;
let _lastFetch = 0;

export async function getEffectiveNow(): Promise<Date> {
  // Cache for 30 seconds to avoid hammering DB
  if (!_testState || Date.now() - _lastFetch > 30000) {
    const { data } = await supabase
      .from('admin_test_state')
      .select('is_test_mode, simulated_datetime')
      .single();
    _testState = data || { is_test_mode: false, simulated_datetime: null };
    _lastFetch = Date.now();
  }

  if (_testState.is_test_mode && _testState.simulated_datetime) {
    return new Date(_testState.simulated_datetime);
  }
  return new Date();
}

export function clearClockCache() {
  _testState = null;
  _lastFetch = 0;
}
```

**Server-side** — same pattern but using the server supabase client. The cron endpoints and API routes should also use `getEffectiveNow()`.

### Files That Need `getEffectiveNow()` Replacement

Search the codebase for deadline/time checks. Key locations:

1. **`src/lib/picks.ts`** — deadline check before allowing pick submission
2. **`src/lib/status.ts`** — tournament/round status derivation
3. **`src/lib/status-server.ts`** — server-side status checks
4. **`src/components/CountdownTimer.tsx`** — countdown display
5. **`src/components/SplashOverlay.tsx`** — "what's happening now" logic
6. **`src/app/pools/[id]/pick/page.tsx`** — pick page deadline display
7. **`src/app/api/cron/*.ts`** — all cron endpoints
8. **Any component that compares dates** to decide what to show

The rule: **if it checks "is the deadline passed?" or "what's the current round?", it must use `getEffectiveNow()` instead of `new Date()`.**

---

## Part 2: Game Result Cascade

When an admin marks a game as complete (or when ESPN sync processes a result), the system should automatically set up the next-round matchup.

### How It Works

1. Admin clicks "Complete Game" → sets `winner_id`, `team1_score`, `team2_score`, `status = 'final'`
2. System checks: does the winner's next-round game already exist?
   - If **no** → create the game shell (with correct `round_id` based on `round_day_mapping` / `region_sweet16_schedule`)
   - If **yes** → populate the empty team slot with the winner
3. When BOTH team slots in a next-round game are filled, that game is ready to play
4. Mark losing team as `is_eliminated = true` in the `teams` table

### Determining the Next Round

For a completed game, figure out which round and day the winner advances to:

```typescript
function getNextRoundId(
  completedGame: Game,
  team: TeamInfo,
  rounds: Round[]
): string | null {
  const currentRoundCode = completedGame.tournament_round; // 'R64', 'R32', etc.
  
  // What's the next round?
  const NEXT_ROUND: Record<string, string> = {
    'R64': 'R32', 'R32': 'S16', 'S16': 'E8', 'E8': 'F4', 'F4': 'CHIP'
  };
  const nextRoundCode = NEXT_ROUND[currentRoundCode];
  if (!nextRoundCode) return null; // Championship winner — tournament over
  
  if (nextRoundCode === 'R32') {
    // Deterministic: R64 Thu → R32 Sat, R64 Fri → R32 Sun
    // Find the R32 round whose date is currentGame.date + 2 days
    const gameDate = new Date(completedGame.game_datetime);
    const r32Date = new Date(gameDate.getTime() + 2 * 24 * 60 * 60 * 1000);
    const r32DateStr = r32Date.toISOString().split('T')[0];
    return rounds.find(r => 
      mapRoundNameToCode(r.name) === 'R32' && r.date === r32DateStr
    )?.id || null;
  }
  
  if (nextRoundCode === 'S16' || nextRoundCode === 'E8') {
    // Region-based: look up from REGION_ROUND_DATES_2026
    const targetDate = REGION_ROUND_DATES_2026[team.region]?.[nextRoundCode];
    return rounds.find(r =>
      mapRoundNameToCode(r.name) === nextRoundCode && r.date === targetDate
    )?.id || null;
  }
  
  if (nextRoundCode === 'F4' || nextRoundCode === 'CHIP') {
    // Fixed dates
    const targetDate = FIXED_DATES_2026[nextRoundCode];
    return rounds.find(r =>
      mapRoundNameToCode(r.name) === nextRoundCode && r.date === targetDate
    )?.id || null;
  }
  
  return null;
}
```

### Determining the Opponent Slot

The bracket has a fixed structure. When a game completes, we need to know which other game's winner our winner will face:

**R64 → R32 pairing:** Games are paired by bracket position. In each region, seed pairings map to R64 game indices 0-7. R32 game 0 = winner of R64 games 0+1, R32 game 1 = winner of R64 games 2+3, etc.

```
R64 game 0 (1v16) ─┐
                    ├─ R32 game 0
R64 game 1 (8v9)  ─┘
R64 game 2 (5v12) ─┐
                    ├─ R32 game 1
R64 game 3 (4v13) ─┘
...
```

The simplest approach: when creating a next-round game shell, set `parent_game_a_id` and `parent_game_b_id` on the new game. When one parent completes, put the winner in `team1_id`. When the other parent completes, put the winner in `team2_id`.

### API Endpoint Changes

**`src/app/api/admin/test/complete-game/route.ts`** — Redesign:

```typescript
// OLD (broken):
// 1. Set game_datetime = NOW()  ← NEVER DO THIS
// 2. Set winner/scores/status

// NEW:
// 1. Set winner_id, team1_score, team2_score, status = 'final'
// 2. Mark losing team is_eliminated = true
// 3. Call cascadeGameResult(game) to create/populate next-round game
// 4. NEVER touch game_datetime
```

**`src/app/api/admin/test/complete-round/route.ts`** — Redesign:

```typescript
// Complete all games in the specified round with predetermined results
// Uses the 2025 real results from the Excel data as defaults
// After completing all games, triggers cascade for each → next round games created
```

**`src/app/api/admin/test/set-round-state/route.ts`** — Redesign:

```typescript
// Instead of manipulating game dates, this now:
// 1. Sets the simulated clock phase (pre_round / live / post_round)
// 2. Sets is_active on the target round
// 3. Updates admin_test_state table
```

**`src/app/api/admin/test/reset-round/route.ts`** — Redesign:

```typescript
// 1. Clear winner_id, scores, status on all games in the round
// 2. Un-eliminate teams that were eliminated in this round
// 3. DELETE any auto-created next-round games (cascade cleanup)
// 4. Reset simulated clock if needed
```

**NEW: `src/app/api/admin/test/set-clock/route.ts`:**

```typescript
// POST { round_id, phase } or POST { datetime } 
// Updates admin_test_state with the simulated time
// Returns the computed simulated datetime
```

---

## Part 3: Admin Test UI

The settings page (pool creator section) should have a test mode panel:

```
┌─────────────────────────────────────────┐
│  🧪 TEST MODE                    [OFF]  │
├─────────────────────────────────────────┤
│                                         │
│  Round:  [Round 1 Day 1 ▼]             │
│  Phase:  ○ Pre-Round  ● Live  ○ Done   │
│                                         │
│  Simulated Time: Mar 19, 2026 1:15 PM  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Complete Next Game               │  │  ← marks next scheduled game as final
│  │  Complete All Games               │  │  ← marks all games in round as final
│  │  Reset Round                      │  │  ← undoes results + deletes cascade
│  └───────────────────────────────────┘  │
│                                         │
│  Games:                                 │
│  ✓ (1) HOU 78 - 40 SIUE               │
│  ✓ (1) AUB 83 - 63 ALST               │
│  ○ (2) TENN vs WOF          [Complete] │
│  ○ (4) PUR vs HPU           [Complete] │
│  ...                                    │
└─────────────────────────────────────────┘
```

**Key interactions:**
- Toggle test mode ON → sets `admin_test_state.is_test_mode = true`
- Select round → updates `target_round_id`, recomputes simulated time
- Select phase → updates `phase` and `simulated_datetime`
- "Complete Next Game" → calls complete-game endpoint with 2025 real results
- "Complete All Games" → batch completes the round
- "Reset Round" → undoes everything

---

## Files to Create / Modify

### New Files:
- `src/lib/clock.ts` — `getEffectiveNow()`, `clearClockCache()`
- `src/app/api/admin/test/set-clock/route.ts` — set simulated time
- `supabase/migrations/003_admin_test_state.sql` — new table

### Modify:
- `src/app/api/admin/test/complete-game/route.ts` — remove datetime mutation, add cascade
- `src/app/api/admin/test/complete-round/route.ts` — same
- `src/app/api/admin/test/reset-round/route.ts` — add cascade cleanup
- `src/app/api/admin/test/set-round-state/route.ts` — use simulated clock instead
- `src/lib/picks.ts` — replace `new Date()` with `getEffectiveNow()`
- `src/lib/status.ts` — replace `new Date()` with `getEffectiveNow()`
- `src/lib/status-server.ts` — replace `new Date()` with `getEffectiveNow()`
- `src/components/CountdownTimer.tsx` — use `getEffectiveNow()`
- `src/lib/game-processing.ts` — add `cascadeGameResult()` function
- `src/app/pools/[id]/settings/page.tsx` — new test mode UI panel

### Reference Data (for auto-completing with real results):
The 2025 tournament results are in `2025_March_Madness_Results.xlsx` and can be hardcoded as a constant for the "complete with real results" feature. Example:

```typescript
const REAL_2025_RESULTS: Record<string, { winner: string; score1: number; score2: number }> = {
  'HOU_vs_SIUE': { winner: 'HOU', score1: 78, score2: 40 },
  'AUB_vs_ALST': { winner: 'AUB', score1: 83, score2: 63 },
  // ... all 63 games
};
```

---

## Acceptance Criteria

- [ ] `admin_test_state` table created with singleton row
- [ ] `getEffectiveNow()` utility created and used everywhere dates are checked
- [ ] Test mode toggle works — turning it on makes the app think it's tournament time
- [ ] Phase switching (pre/live/post) changes the simulated datetime correctly
- [ ] "Complete Game" sets winner/scores/status WITHOUT touching game_datetime
- [ ] Completing a game auto-creates the next-round game with the winner slotted in
- [ ] "Reset Round" clears results AND deletes auto-created next-round games
- [ ] Countdown timer shows time relative to simulated clock in test mode
- [ ] Pick submission respects simulated deadline (can pick in pre_round, blocked in live/post)
- [ ] `game_datetime` is NEVER modified by any admin test action
- [ ] All existing pages render correctly with simulated time

---

## What NOT to Change

- Don't touch the `round_day_mapping` or `region_sweet16_schedule` tables (those are correct)
- Don't modify how games are displayed (dates/times show the real scheduled times always)
- Don't change the ESPN sync cron logic (that handles live tournament data separately)
- Don't add the cascade logic to the ESPN cron endpoints yet — just the admin test endpoints. The cron endpoints can be updated later to use the same `cascadeGameResult()` function.

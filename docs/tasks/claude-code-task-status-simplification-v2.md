# Task: Simplify Status System — Derive All Statuses From Game States

## Overview

The app currently uses 3 stored flags to track status:
- `rounds.is_active` (boolean) — manually toggled by cron/admin
- `rounds.deadline_datetime` (timestamp) — manually updated by sync-games cron
- `pools.status` ('open' | 'active' | 'complete') — manually transitioned by cron/admin

This creates bugs because these flags get out of sync with reality. The fix: **derive all statuses from game data**. A round's status is determined by its games' statuses. The tournament status is determined by all rounds. The deadline is computed from game times. No manual transitions needed.

## Files to Read First

Read ALL of these before writing any code:
1. `src/lib/picks.ts` — getActiveRound (line 30), getPickDeadline (line 258), validatePick, submitPick
2. `src/lib/standings.ts` — getPoolLeaderboard, getMyPools
3. `src/lib/analyze.ts` — getTeamInventory, getOpponentInventories (uses excludeRoundId)
4. `src/lib/game-processing.ts` — checkRoundCompletion (line 147, sets is_active=false, pools.status)
5. `src/types/picks.ts` — Round type (has is_active, deadline_datetime), PickDeadline type
6. `src/types/standings.ts` — MyPool type (has pool_status), PoolLeaderboard type
7. `src/app/dashboard/page.tsx` — pool cards, formatDeadline, status checks
8. `src/app/pools/[id]/pick/page.tsx` — getActiveRound, getPickDeadline, deadline.is_expired checks
9. `src/app/pools/[id]/standings/page.tsx` — isPickVisible function (line 17-22)
10. `src/app/pools/[id]/analyze/page.tsx` — hideCurrentRound logic (line 660)
11. `src/app/pools/create/page.tsx` — tournament started check (line 125-153)
12. `src/app/pools/join/page.tsx` — pool.status check (line 50)
13. `src/app/pools/[id]/settings/page.tsx` — is_active query (line 446-447), pool.status check (line 1021)
14. `src/app/api/cron/process-results/route.ts` — is_active query (line 34)
15. `src/app/api/cron/activate-rounds/route.ts` — entire file manages is_active
16. `src/app/api/cron/sync-games/route.ts` — already computes deadline from game times (line 91-107)
17. `src/app/api/admin/test/activate-next-round/route.ts` — toggles is_active
18. `src/app/api/admin/test/reset-round/route.ts` — sets is_active
19. `src/app/api/admin/test/complete-round/route.ts` — queries is_active (line 38)

---

## The New Model

### Tournament Status (computed, never stored)

| Status | How to determine |
|--------|-----------------|
| `pre_tournament` | Every game across ALL rounds has `status = 'scheduled'` |
| `tournament_live` | At least one game in any round has `status = 'in_progress'` or `status = 'final'` |
| `tournament_complete` | Every game in the LAST round (by date) has `status = 'final'` |

### Round Status (computed per round from its games)

| Status | How to determine |
|--------|-----------------|
| `pre_round` | All games in this round have `status = 'scheduled'` |
| `round_live` | At least one game is `in_progress` or `final`, but NOT all are `final` |
| `round_complete` | All games in this round have `status = 'final'` |

### Current Round (computed)

The "current round" = the first round (ordered by date ascending) where status is `pre_round` or `round_live`. If all rounds are `round_complete`, the current round is the last round.

### Deadline (computed)

For any round: `deadline = earliest game_datetime in that round - 5 minutes`

This is already how `sync-games/route.ts` calculates it (line 91-107). Now the client will compute it the same way instead of reading a stored column.

### Pick Visibility (computed)

Other users' picks for round X are visible when: `roundX.status === 'round_live' || roundX.status === 'round_complete'` (i.e., at least one game has started or finished).

Your own picks are ALWAYS visible to you.

---

## Step 1: Create `src/lib/status.ts`

This is the new single source of truth. Every page/component will import from here.

```typescript
// src/lib/status.ts
// Derive all tournament/round statuses from game data.
// This replaces rounds.is_active, rounds.deadline_datetime reads, and pools.status reads.

import { supabase } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────

export type TournamentStatus = 'pre_tournament' | 'tournament_live' | 'tournament_complete';
export type RoundStatus = 'pre_round' | 'round_live' | 'round_complete';

export interface RoundInfo {
  id: string;
  name: string;
  date: string;
  status: RoundStatus;
  deadline: string;            // ISO datetime string (earliest game_datetime - 5 min)
  isDeadlinePassed: boolean;   // true if now >= deadline
  gamesScheduled: number;
  gamesInProgress: number;
  gamesFinal: number;
  gamesTotal: number;
}

export interface TournamentState {
  status: TournamentStatus;
  currentRound: RoundInfo | null;   // the round that is pre_round or round_live
  rounds: RoundInfo[];              // all rounds with derived status
}

// ─── Core: Get Tournament State ───────────────────────────────

export async function getTournamentState(): Promise<TournamentState> {
  // Single query: all rounds with their games
  const { data: rounds, error } = await supabase
    .from('rounds')
    .select(`
      id, name, date,
      games(id, status, game_datetime)
    `)
    .order('date', { ascending: true });

  if (error || !rounds || rounds.length === 0) {
    return { status: 'pre_tournament', currentRound: null, rounds: [] };
  }

  const now = new Date();

  const roundInfos: RoundInfo[] = rounds.map(round => {
    const games = (round as any).games || [];
    const scheduled = games.filter((g: any) => g.status === 'scheduled').length;
    const inProgress = games.filter((g: any) => g.status === 'in_progress').length;
    const final_ = games.filter((g: any) => g.status === 'final').length;
    const total = games.length;

    // Derive round status
    let status: RoundStatus;
    if (total === 0 || scheduled === total) {
      status = 'pre_round';
    } else if (final_ === total) {
      status = 'round_complete';
    } else {
      status = 'round_live';
    }

    // Derive deadline = earliest game_datetime - 5 minutes
    let deadline = '';
    let isDeadlinePassed = false;
    if (games.length > 0) {
      const gameTimes = games.map((g: any) => g.game_datetime).filter(Boolean).sort();
      if (gameTimes.length > 0) {
        const earliestGameTime = new Date(gameTimes[0]);
        const deadlineTime = new Date(earliestGameTime.getTime() - 5 * 60 * 1000);
        deadline = deadlineTime.toISOString();
        isDeadlinePassed = now >= deadlineTime;
      }
    }

    return {
      id: round.id,
      name: round.name,
      date: round.date,
      status,
      deadline,
      isDeadlinePassed,
      gamesScheduled: scheduled,
      gamesInProgress: inProgress,
      gamesFinal: final_,
      gamesTotal: total,
    };
  });

  // Derive tournament status
  const allPreRound = roundInfos.every(r => r.status === 'pre_round');
  const lastRound = roundInfos[roundInfos.length - 1];
  const lastRoundComplete = lastRound?.status === 'round_complete';

  let tournamentStatus: TournamentStatus;
  if (allPreRound) {
    tournamentStatus = 'pre_tournament';
  } else if (lastRoundComplete) {
    tournamentStatus = 'tournament_complete';
  } else {
    tournamentStatus = 'tournament_live';
  }

  // Current round = first that is pre_round or round_live
  // If all complete, use the last round
  const currentRound =
    roundInfos.find(r => r.status === 'pre_round' || r.status === 'round_live')
    || (lastRoundComplete ? lastRound : null);

  return {
    status: tournamentStatus,
    currentRound,
    rounds: roundInfos,
  };
}

// ─── Convenience Helpers ──────────────────────────────────────

/** Can users create pools, join pools, add entries? Pre-tournament only. */
export function canJoinOrCreate(state: TournamentState): boolean {
  return state.status === 'pre_tournament';
}

/** Can the current user make/change picks for the current round? */
export function canMakePicks(state: TournamentState): boolean {
  if (!state.currentRound) return false;
  return state.currentRound.status === 'pre_round' && !state.currentRound.isDeadlinePassed;
}

/** Are other users' picks visible for a specific round? */
export function arePicksVisible(roundInfo: RoundInfo): boolean {
  return roundInfo.status === 'round_live' || roundInfo.status === 'round_complete';
}

/** Get deadline display info */
export function getDeadlineDisplay(state: TournamentState): {
  deadline: string;
  isExpired: boolean;
  minutesRemaining: number;
} | null {
  if (!state.currentRound?.deadline) return null;

  const deadlineTime = new Date(state.currentRound.deadline);
  const now = new Date();
  const diff = deadlineTime.getTime() - now.getTime();

  return {
    deadline: state.currentRound.deadline,
    isExpired: diff <= 0,
    minutesRemaining: Math.max(0, Math.ceil(diff / 60000)),
  };
}

/**
 * Find a RoundInfo by ID from the tournament state.
 * Useful when you have a round_id from picks data and need to check visibility.
 */
export function getRoundById(state: TournamentState, roundId: string): RoundInfo | undefined {
  return state.rounds.find(r => r.id === roundId);
}
```

---

## Step 2: Create `src/lib/status-server.ts`

Server-side version for API routes (uses supabaseAdmin instead of client supabase).

```typescript
// src/lib/status-server.ts
// Server-side version of tournament state derivation.
// Uses supabaseAdmin (service role) for API routes and cron jobs.

import { supabaseAdmin } from '@/lib/supabase/admin';

// Re-export types from status.ts
export type { TournamentStatus, RoundStatus, RoundInfo, TournamentState } from '@/lib/status';
export { canJoinOrCreate, canMakePicks, arePicksVisible, getDeadlineDisplay, getRoundById } from '@/lib/status';

export async function getTournamentStateServer(): Promise<import('@/lib/status').TournamentState> {
  const { data: rounds, error } = await supabaseAdmin
    .from('rounds')
    .select(`
      id, name, date,
      games(id, status, game_datetime)
    `)
    .order('date', { ascending: true });

  if (error || !rounds || rounds.length === 0) {
    return { status: 'pre_tournament', currentRound: null, rounds: [] };
  }

  const now = new Date();

  const roundInfos: import('@/lib/status').RoundInfo[] = rounds.map(round => {
    const games = (round as any).games || [];
    const scheduled = games.filter((g: any) => g.status === 'scheduled').length;
    const inProgress = games.filter((g: any) => g.status === 'in_progress').length;
    const final_ = games.filter((g: any) => g.status === 'final').length;
    const total = games.length;

    let status: import('@/lib/status').RoundStatus;
    if (total === 0 || scheduled === total) status = 'pre_round';
    else if (final_ === total) status = 'round_complete';
    else status = 'round_live';

    let deadline = '';
    let isDeadlinePassed = false;
    if (games.length > 0) {
      const gameTimes = games.map((g: any) => g.game_datetime).filter(Boolean).sort();
      if (gameTimes.length > 0) {
        const earliestGameTime = new Date(gameTimes[0]);
        const deadlineTime = new Date(earliestGameTime.getTime() - 5 * 60 * 1000);
        deadline = deadlineTime.toISOString();
        isDeadlinePassed = now >= deadlineTime;
      }
    }

    return { id: round.id, name: round.name, date: round.date, status, deadline, isDeadlinePassed, gamesScheduled: scheduled, gamesInProgress: inProgress, gamesFinal: final_, gamesTotal: total };
  });

  const allPreRound = roundInfos.every(r => r.status === 'pre_round');
  const lastRound = roundInfos[roundInfos.length - 1];
  const lastRoundComplete = lastRound?.status === 'round_complete';

  const tournamentStatus = allPreRound ? 'pre_tournament' : lastRoundComplete ? 'tournament_complete' : 'tournament_live';
  const currentRound = roundInfos.find(r => r.status === 'pre_round' || r.status === 'round_live') || (lastRoundComplete ? lastRound : null);

  return { status: tournamentStatus, currentRound, rounds: roundInfos };
}
```

---

## Step 3: Update `src/lib/picks.ts`

### 3a. Replace `getActiveRound()` (line 30-43)

OLD: Queries `rounds` table filtering `is_active = true`.

NEW: Use `getTournamentState()` to find the current round, then fetch the full round record.

```typescript
import { getTournamentState } from '@/lib/status';

export async function getActiveRound(): Promise<Round | null> {
  const state = await getTournamentState();
  if (!state.currentRound) return null;

  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('id', state.currentRound.id)
    .single();

  if (error) return null;
  return data;
}
```

### 3b. Replace `getPickDeadline()` (line 258-282)

OLD: Reads `rounds.deadline_datetime` from DB.

NEW: Compute deadline from earliest game time - 5 minutes.

```typescript
export async function getPickDeadline(roundId: string): Promise<PickDeadline> {
  // Get round name
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('id, name')
    .eq('id', roundId)
    .single();

  if (roundError || !round) {
    throw new PickError(`Failed to fetch round: ${roundError?.message || 'Not found'}`, 'FETCH_ERROR');
  }

  // Get earliest game time for this round
  const { data: firstGame } = await supabase
    .from('games')
    .select('game_datetime')
    .eq('round_id', roundId)
    .order('game_datetime', { ascending: true })
    .limit(1)
    .single();

  const firstGameTime = firstGame?.game_datetime || null;

  // Deadline = first game - 5 minutes
  let deadlineDatetime: string;
  if (firstGameTime) {
    deadlineDatetime = new Date(new Date(firstGameTime).getTime() - 5 * 60 * 1000).toISOString();
  } else {
    // Fallback: no games, use a far-future date
    deadlineDatetime = new Date('2099-01-01').toISOString();
  }

  const now = new Date();
  const diff = new Date(deadlineDatetime).getTime() - now.getTime();
  const minutesRemaining = Math.max(0, Math.floor(diff / 60000));

  return {
    round_id: roundId,
    round_name: round.name,
    deadline_datetime: deadlineDatetime,
    minutes_remaining: minutesRemaining,
    is_expired: diff <= 0,
    first_game_time: firstGameTime || deadlineDatetime,
  };
}
```

### 3c. Update `validatePick()` (around line 299)

The deadline check inside validatePick calls `getPickDeadline` which now computes from game times. No further changes needed — it will work automatically with the updated getPickDeadline.

---

## Step 4: Update `src/lib/standings.ts`

### 4a. In `getPoolLeaderboard()`:

**Line 30-36** — Replace `rounds.is_active` query:
```typescript
// OLD:
const activeRound = allRounds.find(r => r.is_active) || null;

// NEW:
import { getTournamentState } from '@/lib/status';
const state = await getTournamentState();
const activeRoundId = state.currentRound?.id || null;
const activeRound = allRounds.find(r => r.id === activeRoundId) || null;
```

**Line 209** — The `rounds_played` array already includes `is_complete` derived from games. Keep as-is. But update the deadline field to compute from games instead of reading `deadline_datetime`:

In the `roundsPlayed` mapping, compute deadline from the round's games:
```typescript
const roundsPlayed = allRounds
  .filter(r => roundsWithPicks.has(r.id))
  .map(r => {
    const roundGames = games.filter(g => g.round_id === r.id);
    const is_complete = roundGames.length > 0 && roundGames.every(g => g.status === 'final');
    // Compute deadline from earliest game time
    const gameTimes = roundGames
      .map(g => g.game_datetime || '')
      .filter(Boolean)
      .sort();
    const deadline_datetime = gameTimes.length > 0
      ? new Date(new Date(gameTimes[0]).getTime() - 5 * 60 * 1000).toISOString()
      : r.deadline_datetime; // fallback to stored value if no game times
    return { id: r.id, name: r.name, date: r.date, deadline_datetime, is_complete };
  });
```

NOTE: This requires `game_datetime` in the games query. Check that the games query (around line 60) includes `game_datetime`. Currently it does NOT. Add it:

```typescript
// Line ~60, add game_datetime to the games select:
const { data: allGames } = await supabase
  .from('games')
  .select(`
    id, round_id, team1_id, team2_id, status,
    team1_score, team2_score, winner_id, game_datetime,
    team1:team1_id(id, name, abbreviation, seed),
    team2:team2_id(id, name, abbreviation, seed)
  `);
```

**Line 214** — Remove `pool_status` from the return or derive it:
```typescript
// OLD:
pool_status: pool.status as 'open' | 'active' | 'complete',

// NEW — derive from tournament state:
pool_status: state.status === 'pre_tournament' ? 'open'
  : state.status === 'tournament_complete' ? 'complete'
  : 'active',
```

### 4b. In `getMyPools()`:

**Line 278-281** — Replace active round query:
```typescript
// OLD:
const { data: activeRounds } = await supabase
  .from('rounds')
  .select('id, name, deadline_datetime')
  .eq('is_active', true)
  .limit(1);
const currentRound = activeRounds?.[0] || null;

// NEW:
const state = await getTournamentState();
const currentRoundInfo = state.currentRound;
// We still need the round ID and name for pick lookups:
const currentRound = currentRoundInfo
  ? { id: currentRoundInfo.id, name: currentRoundInfo.name, deadline_datetime: currentRoundInfo.deadline }
  : null;
```

**Line ~356** — Replace pool_status:
```typescript
// OLD:
pool_status: pool.status as 'open' | 'active' | 'complete',

// NEW:
pool_status: state.status === 'pre_tournament' ? 'open'
  : state.status === 'tournament_complete' ? 'complete'
  : 'active',
```

**Line ~369** — deadline_datetime:
```typescript
// OLD:
deadline_datetime: currentRound?.deadline_datetime || null,

// NEW (already handled since currentRound now has computed deadline):
deadline_datetime: currentRound?.deadline_datetime || null,
```

---

## Step 5: Update `src/app/pools/[id]/standings/page.tsx`

### Line 17-22 — Replace `isPickVisible` function:

```typescript
// OLD:
function isPickVisible(
  round: { deadline_datetime: string; is_complete: boolean },
  isOwnEntry: boolean,
): boolean {
  return isOwnEntry || new Date(round.deadline_datetime) < new Date() || round.is_complete;
}

// NEW — use the round's is_complete flag (already derived from game statuses in standings.ts):
function isPickVisible(
  round: { deadline_datetime: string; is_complete: boolean },
  isOwnEntry: boolean,
): boolean {
  // Show picks if: it's your own entry, OR the round is complete, OR the deadline has passed
  return isOwnEntry || round.is_complete || new Date(round.deadline_datetime) < new Date();
}
```

This is actually almost the same, but the key fix is in standings.ts where `is_complete` and `deadline_datetime` are now properly computed from game states. The function signature stays the same so nothing else in the page needs changing.

---

## Step 6: Update `src/app/pools/[id]/analyze/page.tsx`

### Line 660 — `hideCurrentRound` logic:

This already works correctly — it excludes current round picks before the deadline. With the updated `getPickDeadline` now computing from game times, this will automatically use the correct derived deadline. No changes needed here.

---

## Step 7: Update `src/app/dashboard/page.tsx`

### Line 191-214 — Pool card status and CTA logic:

The pool card uses `pool.pool_status` to determine what to show. After step 4b, `pool_status` in `MyPool` is already derived from tournament state. So the dashboard code doesn't need to change — it will get the correct derived status from `getMyPools()`.

### Line 447 — Tournament started check for hiding Create/Join:

```typescript
// OLD:
const tournamentStarted = pools.some(p => p.pool_status === 'active' || p.pool_status === 'complete');

// This still works because pool_status is now derived from game states in getMyPools().
// No change needed.
```

### Line 211-214 — Add Entry logic:

```typescript
// OLD:
&& pool.pool_status === 'open';

// This still works. pool_status = 'open' only when tournament state is pre_tournament.
// No change needed.
```

---

## Step 8: Update `src/app/pools/create/page.tsx`

### Line 125-153 — Tournament started check:

Replace the `is_active` / `deadline_datetime` queries with getTournamentState:

```typescript
// OLD (line 130-152):
useEffect(() => {
  async function checkTournament() {
    const { data: activeRounds } = await supabase
      .from('rounds')
      .select('id')
      .eq('is_active', true)
      .limit(1);
    if (activeRounds && activeRounds.length > 0) {
      setTournamentStarted(true);
      setCheckingTournament(false);
      return;
    }
    const { data: pastRounds } = await supabase
      .from('rounds')
      .select('id')
      .lt('deadline_datetime', new Date().toISOString())
      .limit(1);
    if (pastRounds && pastRounds.length > 0) {
      setTournamentStarted(true);
    }
    setCheckingTournament(false);
  }
  checkTournament();
}, []);

// NEW:
import { getTournamentState, canJoinOrCreate } from '@/lib/status';

useEffect(() => {
  async function checkTournament() {
    const state = await getTournamentState();
    setTournamentStarted(!canJoinOrCreate(state));
    setCheckingTournament(false);
  }
  checkTournament();
}, []);
```

---

## Step 9: Update `src/app/pools/join/page.tsx`

### Line 50 — Pool status check:

```typescript
// OLD:
if (pool.status !== 'open') throw new Error('This pool has already started. You can no longer join.');

// NEW:
import { getTournamentState, canJoinOrCreate } from '@/lib/status';

// Inside the join handler, after pool lookup:
const state = await getTournamentState();
if (!canJoinOrCreate(state)) {
  throw new Error('The tournament has already started. You can no longer join pools.');
}
```

---

## Step 10: Update `src/app/pools/[id]/settings/page.tsx`

### Line 446-447 — Active round query for simulator:

```typescript
// OLD:
.select('id, name, date, is_active')
.eq('is_active', true)

// NEW — use getTournamentState to find the current round, then query:
import { getTournamentState } from '@/lib/status';

const state = await getTournamentState();
const activeRoundId = state.currentRound?.id;
// Then query with .eq('id', activeRoundId) instead of .eq('is_active', true)
```

### Line 1021 — Leave pool check:

```typescript
// OLD:
{!isCreator && pool.status === 'open' && (

// NEW — this needs the tournament state. Add it to the data the settings page loads:
// Check canJoinOrCreate(state) instead of pool.status === 'open'
```

---

## Step 11: Update API Routes (Server-Side)

### `src/app/api/cron/process-results/route.ts` — Line 34:

```typescript
// OLD:
const { data: activeRound } = await supabaseAdmin
  .from('rounds')
  .select('id, name, date')
  .eq('is_active', true)
  .single();

// NEW:
import { getTournamentStateServer } from '@/lib/status-server';

const state = await getTournamentStateServer();
if (!state.currentRound) {
  return NextResponse.json({ message: 'No current round', results });
}
const activeRound = { id: state.currentRound.id, name: state.currentRound.name, date: state.currentRound.date };
```

### `src/app/api/cron/activate-rounds/route.ts`:

This file is now mostly unnecessary. The round activation is derived from game states. However, it still serves one purpose: transitioning `pools.status` from `open` to `active` when the tournament starts. For now, simplify it to just check tournament state and transition pools:

```typescript
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const state = await getTournamentStateServer();

    // If tournament has started but pools are still 'open', transition them
    if (state.status !== 'pre_tournament') {
      const { data: transitioned } = await supabaseAdmin
        .from('pools')
        .update({ status: 'active' })
        .eq('status', 'open')
        .select('id');

      return NextResponse.json({
        success: true,
        tournamentStatus: state.status,
        poolsTransitioned: transitioned?.length || 0,
      });
    }

    return NextResponse.json({ success: true, message: 'Tournament not started yet' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

### `src/app/api/admin/test/complete-round/route.ts` — Line 38:

```typescript
// OLD:
.eq('is_active', true)

// NEW:
import { getTournamentStateServer } from '@/lib/status-server';
const state = await getTournamentStateServer();
if (!state.currentRound) return NextResponse.json({ error: 'No current round' }, { status: 400 });
// Then use state.currentRound.id instead of querying for is_active
```

### `src/app/api/admin/test/activate-next-round/route.ts`:

This endpoint needs rethinking. In the new model, you don't "activate" a round — you just need all games in the current round to be `final`, and the next round automatically becomes current. But the endpoint is still useful for forcing the state. Simplify:

```typescript
// The purpose is now: "I want to move on to the next round."
// This means: ensure all current round games are final, then the next round becomes current automatically.
// If games aren't all final, return an error saying "Complete the current round first."

import { getTournamentStateServer } from '@/lib/status-server';

export async function POST(request: NextRequest) {
  // ... auth check stays the same ...

  const state = await getTournamentStateServer();
  if (!state.currentRound) {
    return NextResponse.json({ error: 'No current round' }, { status: 400 });
  }

  if (state.currentRound.status !== 'round_complete') {
    return NextResponse.json({
      error: `Current round "${state.currentRound.name}" is not complete yet. Complete all games first.`,
      gamesRemaining: state.currentRound.gamesScheduled + state.currentRound.gamesInProgress,
    }, { status: 400 });
  }

  // Current round is complete — the next pre_round round is automatically the new current.
  // Re-fetch state to confirm
  const newState = await getTournamentStateServer();
  return NextResponse.json({
    success: true,
    previousRound: state.currentRound.name,
    newCurrentRound: newState.currentRound?.name || 'Tournament complete',
    tournamentStatus: newState.status,
  });
}
```

### `src/app/api/admin/test/reset-round/route.ts`:

**Line 42** — Replace `is_active` query:
```typescript
// OLD:
.eq('is_active', true)

// NEW:
import { getTournamentStateServer } from '@/lib/status-server';
const state = await getTournamentStateServer();
const currentRoundId = state.currentRound?.id;
// Use currentRoundId
```

**Line 103** — Remove `is_active = true` update (not needed anymore):
```typescript
// OLD:
await supabaseAdmin.from('rounds').update({ is_active: true }).eq('id', round.id);

// NEW: Remove this line entirely. The round becomes current automatically when its games are reset to 'scheduled'.
```

**Line 109-110** — Keep the pool status reset for now (resetting pools from 'complete' back to 'active'):
```typescript
// This is still useful for testing — keep it.
await supabaseAdmin
  .from('pools')
  .update({ status: 'active', winner_id: null })
  .eq('status', 'complete');
```

### `src/lib/game-processing.ts`:

**Line 159** — Remove `is_active = false` update:
```typescript
// OLD:
await supabaseAdmin.from('rounds').update({ is_active: false }).eq('id', roundId);
results.roundsCompleted++;

// NEW — just increment the counter, don't touch is_active:
results.roundsCompleted++;
```

**Line 204** — Remove `is_active = true` for next round:
```typescript
// OLD:
await supabaseAdmin.from('rounds').update({ is_active: true }).eq('id', nextRound.id);

// NEW: Remove this line. The next round becomes current automatically.
```

**Lines 195-205** — Keep the pool status 'complete' update when tournament ends. This is still needed because pools.status = 'complete' with a winner_id is meaningful data, not just a derived status flag.

---

## Step 12: Update `src/app/api/cron/sync-games/route.ts`

**Line 91-107** — This already computes deadline from game times and writes it to `rounds.deadline_datetime`. Since we're no longer reading `deadline_datetime` on the client, this write is harmless but unnecessary. Leave it for now — it doesn't hurt anything and can serve as a cached fallback.

---

## Summary of Changes

| File | What Changes |
|------|-------------|
| `src/lib/status.ts` | **NEW** — Core status derivation utility |
| `src/lib/status-server.ts` | **NEW** — Server-side version using supabaseAdmin |
| `src/lib/picks.ts` | Replace `getActiveRound()` and `getPickDeadline()` to derive from game data |
| `src/lib/standings.ts` | Replace `is_active` queries, derive `pool_status`, add `game_datetime` to games query |
| `src/lib/game-processing.ts` | Remove `is_active` toggling (lines 159, 204) |
| `src/app/pools/create/page.tsx` | Replace tournament check with `getTournamentState()` + `canJoinOrCreate()` |
| `src/app/pools/join/page.tsx` | Replace `pool.status` check with `canJoinOrCreate()` |
| `src/app/pools/[id]/settings/page.tsx` | Replace `is_active` query with `getTournamentState()` |
| `src/app/api/cron/process-results/route.ts` | Replace `is_active` query with `getTournamentStateServer()` |
| `src/app/api/cron/activate-rounds/route.ts` | Simplify to just pool status transitions |
| `src/app/api/admin/test/complete-round/route.ts` | Replace `is_active` query |
| `src/app/api/admin/test/activate-next-round/route.ts` | Simplify — just verify round is complete |
| `src/app/api/admin/test/reset-round/route.ts` | Replace `is_active` queries, remove `is_active` updates |
| `src/app/dashboard/page.tsx` | No changes needed — works via derived pool_status from getMyPools |
| `src/app/pools/[id]/pick/page.tsx` | No changes needed — works via updated getActiveRound/getPickDeadline |
| `src/app/pools/[id]/standings/page.tsx` | No changes needed — isPickVisible already uses is_complete + deadline |
| `src/app/pools/[id]/analyze/page.tsx` | No changes needed — works via updated getPickDeadline |

## What NOT To Do

- Do NOT delete `rounds.is_active`, `rounds.deadline_datetime`, or `pools.status` columns from the database. Just stop reading them in new code. They can stay as cached/legacy values.
- Do NOT remove `pools.status = 'complete'` write in game-processing.ts — that write + winner_id is still meaningful for completed tournaments.
- Do NOT change how the Tournament Simulator sets `game.status` — that's exactly right. Setting game status to 'final' IS how you advance rounds in this model.
- Do NOT add any new database columns or migrations.

## Testing After Implementation

Use the Tournament Simulator in pool settings:

1. **Pre-tournament:** All games scheduled. Verify: can create pool ✓, can join ✓, can add entry ✓, can make picks ✓
2. **Complete one game in Round 1:** Verify: tournament is now 'tournament_live', joining is blocked ✓, picks for current round still work if deadline hasn't passed ✓
3. **Complete all Round 1 Day 1 games:** Verify: round is 'round_complete', eliminations processed ✓, other users' R1D1 picks now visible ✓
4. **Current round becomes Round 1 Day 2 automatically:** Verify: pick page shows R1D2 games ✓, deadline shows R1D2's first game - 5 min ✓
5. **Reset round:** Verify: games back to 'scheduled', round status back to 'pre_round', picks editable again ✓

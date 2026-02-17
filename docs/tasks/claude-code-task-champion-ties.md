# Task: Champion Declaration, Ties, and "No Available Picks" Elimination

**Created:** 2026-02-16
**Status:** Complete
**Branch:** main
**Depends on:** Bracket Revamp (complete)

---

## Context

Three interconnected features:
1. **No Available Picks** — Auto-eliminate entries that have used every remaining team
2. **Champion Declaration** — Declare winner when only 1 entry remains (don't wait for tournament end)
3. **Co-Champion Ties** — When ALL remaining entries are eliminated the same round, they're all co-champions

**Key rule:** Champion(s) should NEVER be empty. Every completed pool has at least one champion.

**Tie logic:** When eliminations bring alive count to 0, un-eliminate entries eliminated that round → they become co-champions. Champion = alive entry when `pool.status = 'complete'`.

---

## Implementation Checklist

### Phase 1: Types
- [x] Add `'no_available_picks'` to `elimination_reason` union in `src/types/picks.ts`
- [x] Add `'no_available_picks'` to `elimination_reason` in `src/types/standings.ts` (`StandingsPlayer`, `MyPoolEntry`)
- [x] Add `winner_id: string | null`, `champion_count: number`, `champion_entries` to `MyPool` in `src/types/standings.ts`
- [x] Add `winner_id: string | null`, `champion_count: number`, `champion_entries` to `PoolLeaderboard` in `src/types/standings.ts`
- [x] Add `noAvailablePickEliminations`, `championsDeclared` to `ProcessingResults` in `src/lib/game-processing.ts`
- [x] Update `createEmptyResults()` to initialize new fields to 0

### Phase 2: Backend — Core Functions
- [x] Add `processNoAvailablePicks(completedRoundId, results)` to `src/lib/game-processing.ts`
  - [x] Find next round by date after completed round
  - [x] Get all games in next round with both teams populated
  - [x] Collect available team IDs into Set
  - [x] For each alive entry, get used team IDs from picks
  - [x] Eliminate entries where every available team is already used
  - [x] Elimination reason: `'no_available_picks'`, elimination_round_id: completedRoundId
- [x] Add `checkForChampions(roundId, results)` to `src/lib/game-processing.ts`
  - [x] Query all active pools
  - [x] Count alive (non-eliminated, non-deleted) entries per pool
  - [x] **1 alive:** Set `pools.winner_id = user_id`, `status = 'complete'`
  - [x] **0 alive (TIE):** Un-eliminate entries with `elimination_round_id = roundId` in this pool, set `pools.winner_id = first.user_id`, `status = 'complete'`
  - [x] **>1 alive:** Continue (no action)

### Phase 3: Wire Into Routes
- [x] `src/app/api/cron/process-results/route.ts` — Call `processNoAvailablePicks()` after `processMissedPicks()` (both call sites)
- [x] `src/app/api/cron/process-results/route.ts` — Call `checkForChampions()` after all eliminations (both call sites)
- [x] `src/app/api/admin/test/complete-round/route.ts` — Same: add both calls after existing processing
- [x] Import new functions in both routes
- [x] Add `noAvailablePickEliminations` and `championsDeclared` to cron results object

### Phase 4: API Data Layer
- [x] `src/app/api/pools/[id]/standings/route.ts` — Include `winner_id` in pool select, resolve champion entry labels
- [x] `src/lib/standings.ts` `getPoolLeaderboard()` — Include `winner_id`, champion count/entries
- [x] `src/lib/standings.ts` `getMyPools()` — Include `winner_id` from pool query, resolve champion entry labels + count
- [x] Fix `elimination_reason` casts to include `'no_available_picks'` in all data layer functions

### Phase 5: Pick Page UI
- [x] `src/app/pools/[id]/pick/page.tsx` — Detect "all teams used" state: check if all pickable teams have `already_used = true`
- [x] Show amber "No Teams Available" card when all teams used (hide "Lock Pick" button)
- [x] Update `SpectatorHeader` to handle `'no_available_picks'` reason — show "No teams available to pick"
- [x] Add `ChampionHeader` component (gold theme, trophy emoji)
  - [x] Sole champion: "SURVIVOR CHAMPION — Last one standing in {pool}"
  - [x] Co-champion: "SURVIVOR CHAMPION — {N}-Way Tie"
  - [x] "Your Winning Run" pick chips in gold
- [x] Detect champion state: `pool.status === 'complete'` AND entry `is_eliminated = false`
- [x] Render `ChampionHeader` instead of pick interface when champion
- [x] Gold champion status bar replaces red eliminated bar for champions
- [x] Add `eliminationInfo` type update for `'no_available_picks'`

### Phase 6: Dashboard UI
- [x] `src/components/dashboard/PoolCard.tsx` — Gold champion banner on completed pools
  - [x] Sole: "CHAMPION: {entry_label}"
  - [x] Tied: "CO-CHAMPIONS" with all names
- [x] Champion entries get trophy badge + gold dot instead of green/skull
- [x] `no_available_picks` entries get "NO PICKS LEFT" badge (amber)

### Phase 7: Standings UI
- [x] `src/app/pools/[id]/standings/page.tsx` — Gold banner at top
  - [x] Sole: "SURVIVOR CHAMPION: {name}"
  - [x] Tied: "{N}-WAY TIE: {name1}, {name2}, {name3}"
- [x] Champion rows: gold background tint, trophy icon
- [x] Section header changes: "ALIVE" → "CHAMPION(S)" when pool complete
- [x] Non-champion eliminated entries: unchanged (red styling)
- [x] Standings API route updated with champion data

### Phase 8: Cleanup + Commit
- [x] QuickStats "Best Streak" already removed (from earlier change)
- [x] All champion/tie/no-picks logic implemented
- [x] Update MEMORY.md with new patterns learned
- [x] Update this checklist

---

## Key Files Reference

| File | Action | Phase |
|------|--------|-------|
| `src/types/picks.ts` | MODIFIED | 1 |
| `src/types/standings.ts` | MODIFIED | 1, 4 |
| `src/lib/game-processing.ts` | MODIFIED | 1, 2 |
| `src/app/api/cron/process-results/route.ts` | MODIFIED | 3 |
| `src/app/api/admin/test/complete-round/route.ts` | MODIFIED | 3 |
| `src/app/pools/[id]/pick/page.tsx` | MODIFIED | 5 |
| `src/components/dashboard/PoolCard.tsx` | MODIFIED | 6 |
| `src/components/dashboard/QuickStats.tsx` | MODIFIED (done earlier) | 8 |
| `src/lib/standings.ts` | MODIFIED | 4 |
| `src/app/api/pools/[id]/standings/route.ts` | MODIFIED | 4, 7 |
| `src/app/pools/[id]/standings/page.tsx` | MODIFIED | 7 |

---

## Design Decisions

- **No DB migration needed** — `elimination_reason` is VARCHAR(50), `winner_id` already exists on pools
- **Champion = alive entry in completed pool** — works for both sole and tied champions, no extra column needed
- **Tie resolution:** Un-eliminate tied entries so they remain alive. Co-champions = alive entries when pool is complete.
- **`pools.winner_id`** set to first champion's user_id for backward compat. Real truth = alive entries.
- **`elimination_round_id` for no_available_picks:** Uses completedRoundId (not next round) so tie logic works — all eliminations from same processing batch share the same round ID
- **Tiebreaker rules** deferred to future release (pool creator setting, championship pick UI, etc.)
- **`processNoAvailablePicks` runs after `processMissedPicks`** — order matters because missed-pick eliminations happen first, then no-available-picks check considers the reduced alive set
- **`checkForChampions` runs LAST** — after all elimination types have fired

---

## Verification Plan

1. Admin test: simulate to Final Four where entry has used all remaining teams → auto-eliminated `no_available_picks`
2. Eliminate all but 1 → sole champion declared, gold ChampionHeader on pick page
3. ALL entries pick losers same round → 0 alive → un-eliminated → co-champions with "{N}-Way Tie"
4. ALL entries have no picks left simultaneously → same tie logic → co-champions
5. Dashboard PoolCard shows "CHAMPION" or "CO-CHAMPIONS" banner
6. Standings shows gold banner + trophy rows for all champions
7. `pools.winner_id` is NEVER null on completed pool
8. Pick page shows "No Teams Available" warning before auto-elimination

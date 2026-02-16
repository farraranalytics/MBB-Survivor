# Task: Bracket Revamp — Pre-Generated 63-Game Structure

**Created:** 2026-02-15
**Status:** DB Migration + Generation Complete — Verified on Live DB
**Branch:** main

---

## Context

The current bracket system dynamically creates R32+ games during result processing via a 250-line `cascadeGameResult()` function that computes bracket positions from seeds and uses heuristic round matching. This is fragile and produces incorrect matchups. The fix: pre-generate all 63 tournament games with explicit feeder/advancement FKs, reducing winner propagation to a simple 15-line lookup.

**Reference Docs:**
- `docs/tasks/march_madness_gap_analysis.md` — Current vs proposed architecture analysis
- `docs/tasks/march_madness_matchup_schema.md` — Target matchup ID structure and propagation logic

---

## Implementation Checklist

### Phase 1: Database Migration
- [x] Create `supabase/migrations/005_bracket_structure.sql`
  - [x] Add `matchup_code VARCHAR(20)` to `games` (UNIQUE index, partial WHERE NOT NULL)
  - [x] Add `advances_to_game_id UUID FK→games` to `games`
  - [x] Add `advances_to_slot INTEGER CHECK (1,2)` to `games`
  - [x] Add index on `advances_to_game_id`
  - [x] Add index on `tournament_round`
  - [ ] Run migration in Supabase SQL Editor

### Phase 2: Bracket Generator
- [x] Create `src/lib/bracket-generator.ts`
  - [x] `generateFullBracket(f4Pairings)` function
  - [x] Validate preconditions (64 teams, 8+ rounds, 32 R64 games)
  - [x] Build `roundIdMap` — maps `(roundCode, region) → round_id` using round names + region-day assignments
  - [x] Backfill 32 R64 games with `matchup_code`, `bracket_position`, `tournament_round`
  - [x] Insert 31 shell games (R32→CHIP) with NULL teams, correct `round_id`, feeders
  - [x] Wire `advances_to_game_id` + `advances_to_slot` on all 62 non-championship games
  - [x] Matchup code convention: `{REGION}_R64_{1-8}` (uppercase, 1-indexed)
  - [x] F4 pairings as parameter — default 2026: East/West (F4_1), South/Midwest (F4_2)
  - [x] Idempotent: deletes existing R32+ shells before regenerating

### Phase 3: Simplified Winner Propagation
- [x] Add `propagateWinner(gameId, winnerId)` to `src/lib/game-processing.ts`
  - [x] Query game's `advances_to_game_id` and `advances_to_slot`
  - [x] If null (championship), return
  - [x] Update target game's `team1_id` or `team2_id` with winner
- [x] Add `clearBracketAdvancement(fromRoundCode)` to `src/lib/game-processing.ts`
  - [x] NULL out team1/team2/winner/scores on games in rounds AFTER the given round
  - [x] Reset status to `scheduled`
  - [x] Uses `tournament_round` column to target correct rounds
- [x] Deprecate `cascadeGameResult()` (keep with @deprecated JSDoc)
- [x] Deprecate `deleteCascadedGames()` (keep with @deprecated JSDoc)

### Phase 4: Admin Generate-Bracket Route
- [x] Create `src/app/api/admin/generate-bracket/route.ts`
  - [x] POST endpoint, pool-creator auth
  - [x] Takes optional `f4_pairings` param
  - [x] Calls `generateFullBracket()`
  - [x] Returns summary (games created, backfilled, errors)

### Phase 5: Update All Cascade Callers
- [x] `src/app/api/admin/test/complete-game/route.ts` — `cascadeGameResult()` → `propagateWinner()`
- [x] `src/app/api/admin/test/complete-round/route.ts` — `cascadeGameResult()` loop → `propagateWinner()` loop
- [x] `src/app/api/admin/test/set-round-state/route.ts` — `cascadeGameResult()` in handleRoundComplete → `propagateWinner()`
- [x] `src/app/api/admin/test/reset-round/route.ts` — `deleteCascadedGames()` → `clearBracketAdvancement()`
  - [x] Full reset: NULL out R32+ team slots instead of deleting games
  - [x] Single reset: NULL out next-round team slots instead of deleting
- [x] `src/app/api/cron/process-results/route.ts` — Add `propagateWinner()` call (closes existing gap)

### Phase 6: Update Types
- [x] Add to `Game` interface in `src/types/picks.ts`:
  - [x] `matchup_code: string | null`
  - [x] `bracket_position: number | null`
  - [x] `tournament_round: string | null`
  - [x] `advances_to_game_id: string | null`
  - [x] `advances_to_slot: number | null`
  - [x] `parent_game_a_id: string | null`
  - [x] `parent_game_b_id: string | null`
- [x] Make `team1_id` and `team2_id` nullable (`string | null`)

### Phase 7: Simplify Bracket Display Logic
- [x] `src/lib/bracket.ts` — `getGamesForDay()`
  - [x] Simplified from 140 lines to 8 lines: filter by `round_id === targetRoundId`
  - [x] Added `pickableOnly` param to filter `team1_id IS NOT NULL`
  - [x] Removed `actualGameIndices`, `r32DayMapping`, `fixedRegions` computation
- [x] `src/lib/bracket.ts` — `buildRegionBracket()`
  - [x] Filter by `matchup_code` prefix instead of `team1?.region` (handles NULL teams)
  - [x] Sort by `bracket_position` column (falls back to seed-based)
  - [x] Use `tournament_round` for grouping when available
- [x] `src/lib/bracket.ts` — `buildLockedAdvancers()`
  - [x] Use `matchup_code` → planner key conversion when available
  - [x] Added `matchupCodeToPlannerKey()` helper (UPPERCASE 1-indexed → TitleCase 0-indexed)
  - [x] Kept backward compat key format for BracketPlanner
- [x] `src/components/bracket/RegionBracket.tsx` — already renders TBD for null games (no changes needed)
- [x] `src/components/analyze/BracketPlanner.tsx` — no changes needed (planner key format preserved via conversion)

### Phase 8: Update Seed Data
- [x] `supabase/seed.sql` — Add `tournament_round = 'R64'`, `matchup_code`, `bracket_position` to R64 inserts
- [x] Reordered games to match bracket slot order (1v16, 8v9, 5v12, ...)
- [x] Document workflow: run seed.sql → call `/api/admin/generate-bracket`

### Phase 9: Verification
- [x] Run migration (columns already existed from migration 003; ran via standalone script)
- [x] Call bracket generator (ran `scripts/run-bracket-generator.mjs` against live DB)
- [x] SQL integrity checks:
  - [x] `SELECT count(*) FROM games` → 63 ✓
  - [x] `SELECT count(*) FROM games WHERE matchup_code IS NOT NULL` → 63 ✓
  - [x] `SELECT count(*) FROM games WHERE advances_to_game_id IS NOT NULL` → 62 ✓
  - [x] `SELECT count(*) FROM games WHERE tournament_round = 'R64' AND team1_id IS NOT NULL` → 32 ✓
  - [x] `SELECT count(*) FROM games WHERE tournament_round != 'R64' AND team1_id IS NULL` → 31 ✓
- [x] Deep verification (ran `scripts/verify-bracket.mjs`):
  - [x] All 62 non-CHIP games have valid advancement targets (no orphans)
  - [x] No duplicate advancement slots (each slot filled by exactly one feeder)
  - [x] All non-R64 games have parent_game_a_id and parent_game_b_id set
  - [x] All 10 round_ids correctly assigned across 63 games
  - [x] Region chains verified: EAST/WEST → F4_1, SOUTH/MIDWEST → F4_2 → CHIP_1
- [ ] Functional tests (require deployed app):
  - [ ] Complete one R64 game → winner appears in correct R32 slot
  - [ ] Complete all R64 Day 1 → all Day 1 R32 games have both teams
  - [ ] Reset a round → R32+ games still exist but have NULL teams
  - [ ] Full tournament simulation R64→CHIP → champion crowned
  - [ ] Bracket page shows TBD for unpopulated games with correct connectors
  - [ ] Pick page only shows games with populated teams

### Cleanup (after verification)
- [x] Remove deprecated `cascadeGameResult()`
- [x] Remove deprecated `deleteCascadedGames()`
- [x] Remove `findNextRoundId()`
- [x] Remove seed-based `getBracketPosition()` from game-processing.ts
- [x] Remove unused constants (`NEXT_ROUND`, `F4_PAIRINGS`, `R64_SEED_PAIRINGS` import)

### Admin Test Mode Hardening
- [x] Filter NULL-team games in `complete-round` and `set-round-state → handleRoundComplete` (prevent completing shell games without both teams)
- [x] Add `clearBracketAdvancement()` to `set-round-state → handlePreRound` (clear downstream slots when resetting to pre_round)

---

## Key Files Reference

| File | Action | Phase |
|------|--------|-------|
| `supabase/migrations/005_bracket_structure.sql` | CREATE | 1 |
| `src/lib/bracket-generator.ts` | CREATE | 2 |
| `src/app/api/admin/generate-bracket/route.ts` | CREATE | 4 |
| `src/lib/game-processing.ts` | MODIFY | 3, 5 |
| `src/lib/bracket.ts` | MODIFY | 7 |
| `src/types/picks.ts` | MODIFY | 6 |
| `src/app/api/admin/test/complete-game/route.ts` | MODIFY | 5 |
| `src/app/api/admin/test/complete-round/route.ts` | MODIFY | 5 |
| `src/app/api/admin/test/set-round-state/route.ts` | MODIFY | 5 |
| `src/app/api/admin/test/reset-round/route.ts` | MODIFY | 5 |
| `src/app/api/cron/process-results/route.ts` | MODIFY | 5 |
| `supabase/seed.sql` | MODIFY | 8 |

---

## Implementation Order

| # | Phase | Depends On | Risk |
|---|-------|-----------|------|
| 1 | DB Migration (Phase 1) | — | Low |
| 2 | Types update (Phase 6) | — | Low |
| 3 | Bracket Generator (Phase 2) | Phase 1 | Medium |
| 4 | Admin Route (Phase 4) | Phase 3 | Low |
| 5 | propagateWinner (Phase 3) | Phase 1 | Low |
| 6 | Update callers (Phase 5) | Phase 5 | Medium |
| 7 | Bracket display (Phase 7) | Phases 3, 6 | Medium |
| 8 | Seed data (Phase 8) | Phase 3 | Low |
| 9 | Verification (Phase 9) | All | — |

---

## Key Findings Log

_Record discoveries, gotchas, and decisions made during implementation here._

### Architecture Decisions
- **Keep UUIDs as PKs** — too many FK references across the codebase to migrate to VARCHAR. `matchup_code` serves as the human-readable overlay.
- **Keep `games` table name** — the matchup schema doc proposes `matchups` but renaming would touch every file. No functional benefit.
- **Keep `rounds` table as-is** — day-based round rows work for survivor picks. R32+ shell games get correct `round_id` at generation time.
- **Application-level propagation, not DB trigger** — pick processing, elimination, and round completion logic must remain in app code. A trigger would only handle team advancement and complicates admin reset/testing flows.
- **Cron process-results will now propagate** — closing existing gap where cron only marked picks but never cascaded winners to next round.

### Current System Gotchas Found
- `getGamesForDay()` (bracket.ts:208-346) is 140 lines of seed-based index math that can be replaced by a simple `round_id` filter once R32+ games have correct `round_id` at generation.
- `buildRegionBracket()` filters by `team1?.region` — breaks for shell games with NULL teams. Must switch to `matchup_code` prefix filtering.
- `buildLockedAdvancers()` builds keys as `${region}_${roundCode}_${gameIdx}` using 0-indexed slots. `matchup_code` uses 1-indexed. Need to align BracketPlanner to use matchup_code keys.
- `process-results` cron does NOT call `cascadeGameResult()` — this is an existing bug where winners don't propagate in production. Fixed by this revamp.

### Implementation Notes
_(Fill in as work progresses)_


# Bracket Revamp — Detailed Findings & Context

**Purpose:** This document captures the full exploration of the current codebase so a fresh agent can understand WHY we're making changes and HOW the current system works. Read this alongside `claude-code-task-bracket-revamp.md` (the implementation checklist).

---

## Why This Revamp Is Needed

The current system only creates R64 (Round of 64) games at tournament start. R32 through Championship games are created **dynamically** as results come in, via a 250+ line function called `cascadeGameResult()`. This approach has fundamental problems:

1. **No predictable bracket structure** — game UUIDs are random, bracket positions computed at runtime from seeds
2. **Fragile round matching** — `findNextRoundId()` uses heuristics to guess which "day" a game belongs to, and can fail
3. **No queryable relationships** — "who does this winner play next?" requires recomputing bracket math
4. **Different code paths** — within-region cascade (R64→E8) and cross-region (E8→F4→CHIP) use different logic
5. **Cron doesn't cascade** — the production `process-results` cron marks picks but NEVER propagates winners to the next round (existing bug)
6. **Reset deletes games** — admin reset deletes cascade-created games entirely, losing any ESPN sync data

The fix: pre-generate all 63 games with explicit FKs. Winner propagation becomes a 15-line lookup instead of 250 lines of heuristic math.

---

## Current Database Schema

### `games` table (the main table being revamped)
```
id                  UUID PK
round_id            UUID FK→rounds       -- which round/day this game belongs to
team1_id            UUID FK→teams        -- nullable for shell games
team2_id            UUID FK→teams        -- nullable for shell games
game_datetime       TIMESTAMPTZ          -- when the game starts
winner_id           UUID FK→teams        -- null until game is final
team1_score         INTEGER              -- null until in_progress
team2_score         INTEGER              -- null until in_progress
status              VARCHAR(20)          -- 'scheduled' | 'in_progress' | 'final'
espn_game_id        VARCHAR(50)          -- for ESPN API sync
bracket_position    INTEGER              -- added in migration 003, set during cascade
tournament_round    VARCHAR(10)          -- 'R64'|'R32'|'S16'|'E8'|'F4'|'CHIP', added in 003
parent_game_a_id    UUID FK→games        -- feeder game 1, added in 003
parent_game_b_id    UUID FK→games        -- feeder game 2, added in 003
```

**What's MISSING (to be added):**
- `matchup_code VARCHAR(20)` — human-readable positional ID like `EAST_R64_1`
- `advances_to_game_id UUID FK→games` — where the winner goes
- `advances_to_slot INTEGER` — which slot (1=team1, 2=team2) the winner fills

### `rounds` table
Each tournament day is a separate row:
- "Round 1 Day 1", "Round 1 Day 2" (R64, split by region)
- "Round 2 Day 1", "Round 2 Day 2" (R32, same region split)
- "Sweet 16 Day 1", "Sweet 16 Day 2" (S16, split: South/West vs East/Midwest)
- "Elite Eight Day 1", "Elite Eight Day 2" (E8, same split as S16)
- "Final Four" (single row)
- "Championship" (single row)

Total: ~12 round rows. This structure is kept as-is.

### `teams` table
64 teams with `region` (East/South/West/Midwest), `seed` (1-16), `is_eliminated` flag.

### `picks` table
References `pool_player_id`, `round_id`, `team_id`. One pick per player per round. `is_correct` starts null, set to true/false when game completes.

### `pool_players` table
`is_eliminated`, `elimination_round_id`, `elimination_reason` ('wrong_pick' | 'missed_pick' | 'manual').

---

## Current Code Architecture

### `src/lib/game-processing.ts` — The Heart of Game Processing

**`processCompletedGame(roundId, winnerId, loserId, results)`**
- Marks picks correct/incorrect via Supabase updates
- Sets losing team `is_eliminated = true`
- Eliminates pool players who picked the loser
- This function is FINE and doesn't need changes

**`cascadeGameResult(gameId, winnerId, results)`** — TO BE REPLACED
- 250+ lines, the main problem function
- Computes `bracket_position` from winner's seed using `getBracketPosition()`
- Uses `findNextRoundId()` heuristic to determine which round_id the next game belongs to
- Searches for existing game by region + bracket_position, creates if not found
- Different paths for within-region (R64→E8) vs cross-region (E8→F4, F4→CHIP)
- Uses `F4_PAIRINGS: [['East', 'West'], ['South', 'Midwest']]` for cross-region

**`deleteCascadedGames(roundId)`** — TO BE REPLACED
- Recursively deletes games created by cascade (identified by `bracket_position IS NOT NULL`)
- Also deletes partial games (only one team populated)
- Problem: deleting games loses ESPN sync data, matchup codes, etc.

**`processMissedPicks(roundId, results)`**
- Eliminates alive players who didn't submit a pick for the round
- Called after ALL games in a round are final
- This function is FINE and doesn't need changes

**`checkRoundCompletion(roundId, results)`**
- Checks if all games in a round are final
- If last round: marks pools complete, finds winner
- This function is FINE and doesn't need changes

### `src/lib/bracket.ts` — Bracket Constants & Display Logic

**Constants:**
```typescript
R64_SEED_PAIRINGS = [[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]]
R32_FEEDERS = [[0,1],[2,3],[4,5],[6,7]]     // R64 games 0-1 feed R32 game 0
S16_FEEDERS = [[0,1],[2,3]]                  // R32 games 0-1 feed S16 game 0
E8_FEEDERS = [[0,1]]                          // S16 games 0-1 feed E8 game 0
HALF_A = { R64: [0,1,2,3], R32: [0,1], S16: [0] }  // Day 1 game indices
HALF_B = { R64: [4,5,6,7], R32: [2,3], S16: [1] }  // Day 2 game indices
S16_DAY1_REGIONS = ['South', 'West']
S16_DAY2_REGIONS = ['East', 'Midwest']
E8_DAY1_REGIONS = ['South', 'West']
E8_DAY2_REGIONS = ['East', 'Midwest']
```

**`getGamesForDay(allGames, allRounds, targetRoundId)`** — 140 LINES, NEEDS SIMPLIFICATION
This is the most complex function. It determines which games belong on a given day by:
1. Building `actualGameIndices` — maps `round_id → region → gameIndex[]` from DB games (requires `game.team1` to be non-null to compute index from seed)
2. Building `r32DayMapping` — determines which R32 games go on Day 1 vs Day 2 based on which R64 day their feeder games were on
3. Applying `fixedRegions` for S16/E8 (hardcoded region-day assignments)
4. Filtering games against computed valid keys

**Problem:** This breaks for R32+ shell games with NULL teams because it relies on `game.team1.seed` to compute game index. After the revamp, games have correct `round_id` at generation, so this collapses to: `allGames.filter(g => g.round_id === targetRoundId)`.

**`buildRegionBracket(region, allGames, allRounds)`**
- Filters games by `game.team1?.region === region || game.team2?.region === region`
- **Problem:** Shell games with NULL teams have no region. Must switch to `matchup_code` prefix filtering.
- Groups games by round code (merges Day 1 + Day 2)
- Sorts R64 by bracket position (currently computed from seed, should use DB column)

**`buildLockedAdvancers(games, rounds, bracket)`**
- Builds map of winners keyed by `${region}_${roundCode}_${gameIdx}` (0-indexed)
- Used by BracketPlanner to show which teams have advanced
- **Problem:** Key format uses 0-indexed slots (`East_R64_0`) while matchup_code uses 1-indexed (`EAST_R64_1`). Need to align.

**`getAllGamesWithTeams()`**
- Supabase query: `games` with team1/team2 joins
- Currently selects `*` — will automatically include new columns after migration

### `src/types/picks.ts` — Type Definitions

Current `Game` interface:
```typescript
interface Game {
  id: string;
  round_id: string;
  team1_id: string;      // NOTE: typed as non-nullable but R32+ shells will have null
  team2_id: string;      // Same issue
  game_datetime: string;
  winner_id: string | null;
  team1_score: number | null;
  team2_score: number | null;
  status: 'scheduled' | 'in_progress' | 'final';
  espn_game_id: string | null;
  team1?: TeamInfo;
  team2?: TeamInfo;
}
```

**Must add:** `matchup_code`, `bracket_position`, `tournament_round`, `advances_to_game_id`, `advances_to_slot`, `parent_game_a_id`, `parent_game_b_id`. Also make `team1_id` and `team2_id` nullable.

---

## Who Calls What — Dependency Map

### Files that call `cascadeGameResult()` (all must be updated):
1. `src/app/api/admin/test/complete-game/route.ts` — single game completion
2. `src/app/api/admin/test/complete-round/route.ts` — bulk round completion
3. `src/app/api/admin/test/set-round-state/route.ts` — handleRoundComplete helper

### Files that call `deleteCascadedGames()` (all must be updated):
1. `src/app/api/admin/test/reset-round/route.ts` — round/tournament reset

### Files that should call propagation but DON'T (bug):
1. `src/app/api/cron/process-results/route.ts` — production result processing

### Files that query `games` table (must handle new columns/shell games):
- `src/lib/bracket.ts` — `getAllGamesWithTeams()`, `getGamesForDay()`, `buildRegionBracket()`
- `src/lib/picks.ts` — `getPickableTeams()`, `validatePick()`
- `src/app/api/pools/[id]/standings/route.ts` — leaderboard
- `src/app/api/pools/[id]/most-picked/route.ts` — most-picked display
- `src/lib/standings.ts` — client-side leaderboard
- `src/components/TournamentInProgress.tsx` — game count stats
- `src/components/SplashOverlay.tsx` — next game time

### Files that display bracket data (must handle TBD games):
- `src/components/bracket/RegionBracket.tsx` — region bracket grid
- `src/components/bracket/BracketMatchupCard.tsx` — individual matchup card (already handles TBD)
- `src/components/analyze/BracketPlanner.tsx` — bracket planning UI
- `src/app/pools/[id]/bracket/page.tsx` — bracket display page

---

## ESPN Integration (Minimal Impact)

### `src/app/api/cron/sync-games/route.ts`
- Fetches ESPN scoreboard by date
- Matches ESPN events to local games by `espn_game_id` or team name substring
- Updates `game_datetime` and `espn_game_id`
- **Impact:** Pre-generated R32+ shell games with NULL teams won't match ESPN events (no team names to match). This is FINE — ESPN sync runs on game day, and by then teams will be populated from previous round's propagation. The `espn_game_id` match path works once a game has been synced at least once.

### `src/lib/espn.ts`
- ESPN API client with caching
- `fetchTournamentBracket()`, `fetchLiveScores()`, `fetchGamesForDate()`
- **No changes needed.**

---

## Matchup Code Convention

Format: `{REGION}_{ROUND}_{SLOT}`
- Regions: `EAST`, `SOUTH`, `WEST`, `MIDWEST` (uppercase)
- Rounds: `R64`, `R32`, `S16`, `E8`
- Slots: 1-indexed (1-8 for R64, 1-4 for R32, 1-2 for S16, 1 for E8)
- Special: `F4_1`, `F4_2`, `CHIP_1`

**Per region: 15 games** (8 R64 + 4 R32 + 2 S16 + 1 E8)
**Cross-region: 3 games** (2 F4 + 1 CHIP)
**Total: 63 games** (15 × 4 + 3)

### Feeder Map (Single Region)

| Matchup Code | Feeder 1 | Feeder 2 | Advances To | Slot |
|------------|----------|----------|-------------|------|
| `{R}_R64_1` | — | — | `{R}_R32_1` | 1 |
| `{R}_R64_2` | — | — | `{R}_R32_1` | 2 |
| `{R}_R64_3` | — | — | `{R}_R32_2` | 1 |
| `{R}_R64_4` | — | — | `{R}_R32_2` | 2 |
| `{R}_R64_5` | — | — | `{R}_R32_3` | 1 |
| `{R}_R64_6` | — | — | `{R}_R32_3` | 2 |
| `{R}_R64_7` | — | — | `{R}_R32_4` | 1 |
| `{R}_R64_8` | — | — | `{R}_R32_4` | 2 |
| `{R}_R32_1` | `{R}_R64_1` | `{R}_R64_2` | `{R}_S16_1` | 1 |
| `{R}_R32_2` | `{R}_R64_3` | `{R}_R64_4` | `{R}_S16_1` | 2 |
| `{R}_R32_3` | `{R}_R64_5` | `{R}_R64_6` | `{R}_S16_2` | 1 |
| `{R}_R32_4` | `{R}_R64_7` | `{R}_R64_8` | `{R}_S16_2` | 2 |
| `{R}_S16_1` | `{R}_R32_1` | `{R}_R32_2` | `{R}_E8_1` | 1 |
| `{R}_S16_2` | `{R}_R32_3` | `{R}_R32_4` | `{R}_E8_1` | 2 |
| `{R}_E8_1` | `{R}_S16_1` | `{R}_S16_2` | `F4_1` or `F4_2` | depends on year |

### Slot Math
- `advances_to_matchup`: `{R}_R32_{ceil(slot/2)}` for R64→R32, same pattern for deeper rounds
- `advances_to_slot`: `((slot - 1) % 2) + 1` — odd slots → 1, even slots → 2

### Seed Pairings (Standard NCAA, Never Changes)
| Slot | R64 Matchup |
|------|-------------|
| 1 | 1 vs 16 |
| 2 | 8 vs 9 |
| 3 | 5 vs 12 |
| 4 | 4 vs 13 |
| 5 | 6 vs 11 |
| 6 | 3 vs 14 |
| 7 | 7 vs 10 |
| 8 | 2 vs 15 |

---

## Region-to-Day Assignments (2026, Hardcoded)

| Round | Day 1 Regions | Day 2 Regions |
|-------|---------------|---------------|
| R64 | East, South | West, Midwest |
| R32 | Same as R64 feeders | Same as R64 feeders |
| S16 | South, West | East, Midwest |
| E8 | South, West | East, Midwest |
| F4 | Single day | — |
| CHIP | Single day | — |

**Note:** R64/R32 day assignments follow region. S16/E8 day assignments are explicitly set and may differ from R64/R32.

---

## Risk Areas

1. **`getGamesForDay()` simplification** — This function is used by the pick page to determine available teams. If simplified incorrectly, users could see wrong matchups or miss pickable teams. Test thoroughly with each round.

2. **`buildRegionBracket()` with NULL teams** — Currently filters by team region. Must use matchup_code. If this breaks, bracket page shows nothing.

3. **BracketPlanner key alignment** — The planner uses `${region}_${roundCode}_${gameIdx}` keys (0-indexed, Title Case). Matchup codes are `${REGION}_${roundCode}_${slot}` (1-indexed, uppercase). Either convert keys in the planner or create a mapping function.

4. **`team1_id`/`team2_id` nullability** — The `Game` TypeScript interface has these as non-nullable strings. Shell games will have null. Must update the type and audit all code that accesses `game.team1_id` without null checks.

5. **ESPN sync timing** — If ESPN sync runs before propagation fills teams into R32+ games, it can't match by team name. This is fine as long as propagation runs first (process-results runs before sync-games in practice).

---

## Implementation Notes (2026-02-15)

All code changes for Phases 1-8 are complete. Build passes clean.

### Key Decisions Made During Implementation

1. **`getGamesForDay()` simplified to 8 lines** — the entire 140-line function with `actualGameIndices`, `r32DayMapping`, `fixedRegions` computation was replaced by a simple `round_id` filter. Works because pre-generated shell games have correct `round_id` at generation time.

2. **BracketPlanner key format preserved** — rather than updating the planner (which uses `${Region}_${roundCode}_${gameIdx}` Title Case 0-indexed), `buildLockedAdvancers()` converts matchup_code via `matchupCodeToPlannerKey()`. Keeps the planner untouched.

3. **Seed SQL reordered to bracket slot order** — games now match `R64_SEED_PAIRINGS` order (1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15).

4. **Pre-existing build errors fixed** — `.select('id', { count: 'exact', head: true })` in activate-rounds and process-results was invalid TypeScript for Supabase v2.

5. **Bracket generator is idempotent** — deletes existing R32+ shells before creating new ones, clears FKs first to avoid constraint violations.

6. **`clearBracketAdvancement()` NULLs instead of deleting** — shell games remain intact, preserving ESPN sync data and game IDs.

7. **Process-results cron now propagates winners** — fixed the existing bug where production cron never cascaded.

### Admin Test Mode Hardening (2026-02-15)

Three issues found and fixed for pre-generated bracket compatibility:

1. **NULL-team game completion bug** — `complete-round` and `set-round-state → handleRoundComplete` could complete shell games that had NULL team1_id or team2_id (no teams propagated yet). The seed-fallback logic would treat NULL seeds as 8, pick a "winner", and propagate it downstream. Fix: added `.not('team1_id', 'is', null).not('team2_id', 'is', null)` to filter out shell games without both teams.

2. **pre_round missing downstream clear** — `set-round-state → handlePreRound` resets game results for a round but didn't clear teams that had been propagated to downstream shells. `reset-round` already called `clearBracketAdvancement()`, so `handlePreRound` was inconsistent. Fix: added `clearBracketAdvancement(roundCode)` call to `handlePreRound`.

3. **Deprecated code removed** — Removed ~414 lines of dead code: `cascadeGameResult()`, `deleteCascadedGames()`, `findNextRoundId()`, `getBracketPosition()`, `NEXT_ROUND`, `F4_PAIRINGS` constants, and the `R64_SEED_PAIRINGS`/`mapRoundNameToCode` import. These functions dynamically created next-round games which is incompatible with the pre-generated bracket approach and could create orphaned games if accidentally invoked.

### Security Remediation (2026-02-15)

Found 4 standalone `.mjs` scripts with **hardcoded Supabase service role key** committed to the public GitHub repo. The service role key bypasses all RLS policies — full unrestricted DB access.

**Affected files:**
- `scripts/run-bracket-generator.mjs` (was git-tracked)
- `scripts/verify-bracket.mjs` (was git-tracked)
- `scripts/check-games.mjs` (untracked, but had hardcoded key)
- `scripts/fix-bracket-propagation.mjs` (untracked, but had hardcoded key)

**Root cause:** Scripts were written as standalone utilities to run against the live DB outside the Next.js build system (no path alias resolution). The quick path was to inline the credentials. The `.ts` scripts in the same directory already used `process.env` correctly.

**Fix applied:**
1. All 4 scripts now use `dotenv` to load from `.env.local` (same pattern as the `.ts` scripts)
2. Added `scripts/*.mjs` to `.gitignore`
3. Removed tracked `.mjs` files from git index via `git rm --cached`
4. Pushed to origin — current HEAD no longer contains secrets

**Still required:**
- **Rotate the Supabase service role key** — the old key is still in git history (commits `a25eabd` and earlier). Anyone with repo access can recover it.
- Update `.env.local` and Vercel environment variables with the new key after rotation.
- Optionally scrub git history with `git filter-repo` to remove old commits containing the key.

**Lesson learned:** Never hardcode credentials in scripts — always use `dotenv` + `.env.local`, even for standalone utilities. Add `scripts/*.mjs` to `.gitignore` by default for any ad-hoc scripts.

### Cron Setup (2026-02-16)
- Vercel Hobby plan limits crons to once per day — `*/5` expressions fail deployment
- Solution: daily crons in `vercel.json` as fallback, external cron service (cron-job.org) for frequent polling during tournament
- `activate-rounds` logic folded into `process-results` to reduce from 3 crons to 2
- External cron jobs configured: `sync-games` (daily) + `process-results` (every 5 min, enable on game days)

### Remaining Steps
- Functional verification (Phase 9): full simulation R64→CHIP via admin panel

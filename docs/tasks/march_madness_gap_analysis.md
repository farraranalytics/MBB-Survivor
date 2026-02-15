# March Madness Survivor - Gap Analysis & Implementation Plan

## Executive Summary

After reviewing the codebase, I've identified that the current architecture has **fundamental structural issues** that make reliable bracket progression impossible. The system attempts to dynamically create and populate games as results come in, rather than pre-generating the complete bracket structure. This approach is error-prone and is the root cause of the "matchups WAY off" issues.

**Recommendation: Full bracket structure revamp is required.** The changes are significant but isolated to a few key files.

---

## Current Architecture Analysis

### Database Schema (What Exists)

| Table | Current State | Issues |
|-------|---------------|--------|
| `rounds` | Each day is a separate round (e.g., "Round 1 Day 1", "Round 1 Day 2") | Conflates "round" and "day" concepts |
| `games` | Random UUIDs, created on-demand during cascade | No predictable IDs, no pre-generated structure |
| `games.bracket_position` | Set during cascade, computed from seed | Should be set at creation, explicit per region |
| `games.tournament_round` | R64/R32/S16/E8/F4/CHIP - set during cascade | Should be set at creation |
| `games.parent_game_a_id` / `parent_game_b_id` | Feeder references, set during cascade | Should be set at creation |
| `games.future_game_id` | Legacy, unused | Can be repurposed as `advances_to_game_id` |
| `round_day_mapping` | Mapping table for day transitions | Complex, could be simplified |
| `region_sweet16_schedule` | S16/E8 day assignments by region | Correct concept, good to keep |

### Game Processing Logic (What Exists)

**File: `src/lib/game-processing.ts`**

The `cascadeGameResult()` function (250+ lines) currently:

1. Gets the completed game and winner info
2. Computes `currentBracketPos` from winner's seed
3. Computes `nextBracketPos = Math.floor(currentBracketPos / 2)`
4. Determines `isTeam1 = currentBracketPos % 2 === 0`
5. Calls `findNextRoundId()` to guess which round to put the game in
6. Searches for existing game by region + bracket_position
7. If found: updates team1_id or team2_id
8. If not found: creates new game shell

**Problems:**
- No explicit relationship between feeder and target games
- `findNextRoundId()` has complex heuristics that can fail
- Game creation during cascade means no single source of truth
- Day-to-day transitions rely on index matching between round arrays
- Different code paths for within-region vs. cross-region (F4/CHIP)

### Bracket Logic (What Exists)

**File: `src/lib/bracket.ts`**

Contains hardcoded constants:
```typescript
export const R64_SEED_PAIRINGS = [[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]];
export const R32_FEEDERS = [[0,1],[2,3],[4,5],[6,7]];
export const S16_FEEDERS = [[0,1],[2,3]];
export const E8_FEEDERS = [[0,1]];
```

Also hardcoded region-day assignments:
```typescript
const S16_DAY1_REGIONS = ['South', 'West'];      // Thu Mar 26
const S16_DAY2_REGIONS = ['East', 'Midwest'];     // Fri Mar 27
```

**Problems:**
- Bracket structure is in code, not database
- No way to query "who does this winner play next" without computation
- Different files have different day-mapping logic

---

## Gap Analysis: Current vs. Proposed

### 1. Game Identification

| Aspect | Current | Proposed | Gap |
|--------|---------|----------|-----|
| Game IDs | Random UUIDs | Positional IDs (`SOUTH_R64_1`) | **Major change** |
| ID Predictability | None | Fully predictable from region+round+slot | Must generate on bracket load |

**Note:** We can keep UUIDs as PKs but add a `matchup_code` column for readability.

### 2. Bracket Structure

| Aspect | Current | Proposed | Gap |
|--------|---------|----------|-----|
| R64 games | Created in seed.sql | Pre-populated with teams | ✅ Already exists |
| R32+ games | Created dynamically during cascade | Pre-created with NULL teams | **Must pre-generate** |
| Total games at tournament start | 32 (R64 only) | 63 (all rounds) | **Must create 31 more shells** |

### 3. Feeder Relationships

| Aspect | Current | Proposed | Gap |
|--------|---------|----------|-----|
| `parent_game_a_id` | Set during cascade | Set at creation | **Must set up front** |
| `parent_game_b_id` | Set during cascade | Set at creation | **Must set up front** |
| Query "who feeds this game?" | Complex join | Simple FK lookup | Will be automatic |

### 4. Advancement Relationships

| Aspect | Current | Proposed | Gap |
|--------|---------|----------|-----|
| `advances_to_game_id` | Doesn't exist (uses `future_game_id` legacy) | Must be added or repurpose `future_game_id` | **Schema change** |
| `advances_to_slot` | Doesn't exist | Must be added (1 or 2) | **Schema change** |
| Query "where does winner go?" | Computed from seed at runtime | Simple FK lookup | Will be automatic |

### 5. Bracket Position

| Aspect | Current | Proposed | Gap |
|--------|---------|----------|-----|
| How it's set | Computed during cascade from seed | Set at game creation | **Change creation logic** |
| Value range | 0-7 for R64, 0-3 for R32, etc. | Same | ✅ Compatible |

### 6. Round/Day Handling

| Aspect | Current | Proposed | Gap |
|--------|---------|----------|-----|
| Round definition | Each day is a "round" | Keep as-is (works for survivor picks) | ✅ OK |
| Game → Round mapping | Via `round_id` FK | Same | ✅ OK |
| Day determination | Complex logic in multiple files | Explicit at game creation | Simplify |

### 7. Winner Propagation

| Aspect | Current | Proposed | Gap |
|--------|---------|----------|-----|
| Logic location | `cascadeGameResult()` - 250+ lines | `propagateWinner()` - ~20 lines | **Major simplification** |
| Complexity | High (search, match, create/update) | Low (lookup FK, set field) | **Major simplification** |
| Reliability | Fragile (heuristic matching) | Robust (explicit relationships) | **Major improvement** |

---

## Implementation Plan

### Phase 1: Schema Additions (Low Risk)

**Add columns to `games` table:**

```sql
-- Add explicit advancement relationships
ALTER TABLE games ADD COLUMN IF NOT EXISTS advances_to_game_id UUID REFERENCES games(id);
ALTER TABLE games ADD COLUMN IF NOT EXISTS advances_to_slot INTEGER CHECK (advances_to_slot IN (1, 2));
ALTER TABLE games ADD COLUMN IF NOT EXISTS matchup_code VARCHAR(20); -- e.g., "SOUTH_R64_1"

-- Add index for lookups
CREATE INDEX IF NOT EXISTS idx_games_matchup_code ON games(matchup_code);
CREATE INDEX IF NOT EXISTS idx_games_advances_to ON games(advances_to_game_id);
```

**Timeline:** 1 hour
**Risk:** None - additive only

### Phase 2: Bracket Generation Function

**Create new file: `src/lib/bracket-generator.ts`**

```typescript
// Key function signatures

interface BracketConfig {
  tournamentYear: number;
  regions: string[];  // ['East', 'South', 'West', 'Midwest']
  teams: TeamInput[];  // 64 teams with region + seed
  roundDates: RoundDateConfig;  // Dates for each round
}

async function generateFullBracket(config: BracketConfig): Promise<void>;
async function clearAndRegenerateBracket(tournamentYear: number): Promise<void>;
```

**What it does:**
1. Creates all 63 game records in one transaction
2. Populates R64 games with teams (based on seed pairings)
3. Creates R32-CHIP games with NULL teams
4. Sets all feeder relationships (`parent_game_a_id`, `parent_game_b_id`)
5. Sets all advancement relationships (`advances_to_game_id`, `advances_to_slot`)
6. Sets `bracket_position`, `tournament_round`, `matchup_code`

**Timeline:** 4-6 hours
**Risk:** Medium - core new functionality

### Phase 3: Simplified Winner Propagation

**Replace `cascadeGameResult()` with:**

```typescript
async function propagateWinner(gameId: string, winnerId: string): Promise<void> {
  // Get the completed game
  const game = await getGame(gameId);
  if (!game.advances_to_game_id) return; // Championship - no advancement
  
  // Determine winner's seed for display
  const winnerSeed = winnerId === game.team1_id ? game.team1_seed : game.team2_seed;
  
  // Update the target game
  const updateField = game.advances_to_slot === 1 ? 'team1_id' : 'team2_id';
  const seedField = game.advances_to_slot === 1 ? 'team1_seed' : 'team2_seed';
  
  await supabaseAdmin
    .from('games')
    .update({ 
      [updateField]: winnerId,
      [seedField]: winnerSeed 
    })
    .eq('id', game.advances_to_game_id);
}
```

**Timeline:** 2-3 hours
**Risk:** Low - much simpler than current logic

### Phase 4: Update Admin Test Mode

**Modify: `src/app/api/admin/test/complete-round/route.ts`**

- Replace `cascadeGameResult()` calls with `propagateWinner()`
- Update reset logic to clear teams from R32+ games instead of deleting games

**Modify: `src/app/api/admin/test/reset-round/route.ts`**

```typescript
// Instead of deleting cascade-created games:
await supabaseAdmin
  .from('games')
  .update({ 
    team1_id: null, 
    team2_id: null, 
    winner_id: null,
    status: 'scheduled',
    team1_score: null,
    team2_score: null
  })
  .eq('tournament_round', nextRoundCode);
```

**Timeline:** 2 hours
**Risk:** Low

### Phase 5: Update Seed Data

**Modify: `supabase/seed.sql`**

Replace current approach (only R64 games) with call to bracket generator or include all 63 games.

**Better approach:** Create an admin UI or script that:
1. Takes 64 teams as input (from Selection Sunday bracket)
2. Takes round dates as input
3. Calls `generateFullBracket()` to create everything

**Timeline:** 3-4 hours
**Risk:** Low

### Phase 6: Update Display Logic

**Files to update:**
- `src/lib/bracket.ts` - Simplify, remove runtime bracket-position computation
- `src/components/bracket/RegionBracket.tsx` - Use `matchup_code` for ordering
- `src/components/analyze/BracketPlanner.tsx` - Use DB structure directly

**Timeline:** 4-6 hours
**Risk:** Medium - affects multiple UI components

---

## Migration Strategy

### For Development/Testing

1. Run schema additions (Phase 1)
2. Truncate existing games table
3. Run bracket generator with test data
4. Test admin mode end-to-end

### For Production (if data exists)

1. Run schema additions
2. Run a one-time migration script to:
   - Compute and populate `matchup_code` for existing games
   - Compute and populate `advances_to_game_id` + `advances_to_slot`
   - Create missing game shells for future rounds
3. Switch to new propagation logic
4. Monitor for issues

---

## File Change Summary

| File | Action | Effort |
|------|--------|--------|
| `supabase/migrations/005_bracket_structure.sql` | **CREATE** - Schema additions | Small |
| `src/lib/bracket-generator.ts` | **CREATE** - New bracket generation | Large |
| `src/lib/game-processing.ts` | **MODIFY** - Replace cascade with simple propagation | Medium |
| `src/app/api/admin/test/complete-round/route.ts` | **MODIFY** - Use new propagation | Small |
| `src/app/api/admin/test/reset-round/route.ts` | **MODIFY** - Clear instead of delete | Small |
| `src/lib/bracket.ts` | **MODIFY** - Simplify, use DB structure | Medium |
| `supabase/seed.sql` | **MODIFY** - Generate full bracket | Medium |
| `src/app/api/admin/generate-bracket/route.ts` | **CREATE** - Admin bracket generation endpoint | Medium |

---

## Verification Tests

After implementation, verify:

1. **All 63 games exist** before tournament starts
2. **R64 games have teams**, R32+ have NULL teams
3. **Every game has `advances_to_game_id`** (except championship)
4. **Every game has `advances_to_slot`** (1 or 2, except championship)
5. **Completing R64 game populates correct R32 slot**
6. **Day assignments are correct** (R64 Day 1 winners → R32 Day 1)
7. **Region boundaries are respected** (no cross-region until F4)
8. **Admin reset clears R32+ teams** without deleting games
9. **Re-running complete-round produces same results**

---

## Appendix A: Complete Feeder Map (Single Region)

For reference during implementation:

| Game | Matchup Code | Feeder 1 | Feeder 2 | Advances To | Slot |
|------|-------------|----------|----------|-------------|------|
| 1 | `{REGION}_R64_1` | — | — | `{REGION}_R32_1` | 1 |
| 2 | `{REGION}_R64_2` | — | — | `{REGION}_R32_1` | 2 |
| 3 | `{REGION}_R64_3` | — | — | `{REGION}_R32_2` | 1 |
| 4 | `{REGION}_R64_4` | — | — | `{REGION}_R32_2` | 2 |
| 5 | `{REGION}_R64_5` | — | — | `{REGION}_R32_3` | 1 |
| 6 | `{REGION}_R64_6` | — | — | `{REGION}_R32_3` | 2 |
| 7 | `{REGION}_R64_7` | — | — | `{REGION}_R32_4` | 1 |
| 8 | `{REGION}_R64_8` | — | — | `{REGION}_R32_4` | 2 |
| 9 | `{REGION}_R32_1` | `{REGION}_R64_1` | `{REGION}_R64_2` | `{REGION}_S16_1` | 1 |
| 10 | `{REGION}_R32_2` | `{REGION}_R64_3` | `{REGION}_R64_4` | `{REGION}_S16_1` | 2 |
| 11 | `{REGION}_R32_3` | `{REGION}_R64_5` | `{REGION}_R64_6` | `{REGION}_S16_2` | 1 |
| 12 | `{REGION}_R32_4` | `{REGION}_R64_7` | `{REGION}_R64_8` | `{REGION}_S16_2` | 2 |
| 13 | `{REGION}_S16_1` | `{REGION}_R32_1` | `{REGION}_R32_2` | `{REGION}_E8_1` | 1 |
| 14 | `{REGION}_S16_2` | `{REGION}_R32_3` | `{REGION}_R32_4` | `{REGION}_E8_1` | 2 |
| 15 | `{REGION}_E8_1` | `{REGION}_S16_1` | `{REGION}_S16_2` | `F4_1` or `F4_2` | 1 or 2 |

**Per region:** 15 games × 4 regions = 60 games + 2 F4 + 1 CHIP = **63 total**

---

## Appendix B: Seed-to-Slot Mapping

Standard NCAA bracket position by seed:

| Slot | R64 Matchup | Seeds |
|------|-------------|-------|
| 1 | 1 vs 16 | 1, 16 |
| 2 | 8 vs 9 | 8, 9 |
| 3 | 5 vs 12 | 5, 12 |
| 4 | 4 vs 13 | 4, 13 |
| 5 | 6 vs 11 | 6, 11 |
| 6 | 3 vs 14 | 3, 14 |
| 7 | 7 vs 10 | 7, 10 |
| 8 | 2 vs 15 | 2, 15 |

This mapping is fixed and should be used in `generateFullBracket()`.

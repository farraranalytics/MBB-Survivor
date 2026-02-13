# Task: Fix Cascade Game Creation — Cross-Region Pairing Bug

## Problem

When admin test mode completes R64 games, the cascade logic creates R32 games that pair teams from DIFFERENT regions. For example: Houston (Midwest #1) vs Auburn (South #1). R32 games must always be within the same region.

This breaks both the pick page and analyze page because all matchups are wrong.

## Root Cause

`cascadeGameResult()` in `src/lib/game-processing.ts` lines ~324-329. The first game-matching check:

```typescript
nextGame = existingGames.find(g =>
    g.bracket_position === nextBracketPos &&
    ((g as any).team1?.region === winnerRegion ||
     (g as any).team2?.region === winnerRegion ||
     !g.team1_id || !g.team2_id)   // ← BUG
);
```

The `!g.team1_id || !g.team2_id` condition matches ANY game with an empty slot at the same bracket position, ignoring region entirely.

**What happens step by step:**

1. Houston (Midwest #1) wins R64 → `bracket_position = 0` → no existing R32 game → creates new game: `team1 = Houston, team2 = null, bracket_position = 0`
2. Auburn (South #1) wins R64 → `bracket_position = 0` → searches R32 games → finds Houston's game because `bracket_position === 0` AND `!team2_id` (null) → fills `team2 = Auburn`
3. Result: Houston vs Auburn (cross-region). Should be Houston vs [Midwest #8/9 winner].

This happens at every bracket position — that's why we see 1v1, 2v2, 3v3, 4v4 across regions.

## Fix

**`src/lib/game-processing.ts`** — One line change at ~line 326:

```typescript
// BEFORE (line ~324-329):
nextGame = existingGames.find(g =>
    g.bracket_position === nextBracketPos &&
    ((g as any).team1?.region === winnerRegion ||
     (g as any).team2?.region === winnerRegion ||
     !g.team1_id || !g.team2_id)
);

// AFTER:
nextGame = existingGames.find(g =>
    g.bracket_position === nextBracketPos &&
    ((g as any).team1?.region === winnerRegion ||
     (g as any).team2?.region === winnerRegion)
);
```

Remove `!g.team1_id || !g.team2_id` from the condition. Now a winner only matches an existing game if that game already has a team from the SAME region. If no same-region game exists yet, it falls through to create a new one — which is correct. The second winner from the same region will then find it via the region check and fill the empty slot.

**Do NOT change:**
- The second fallback (lines ~332-339) — this correctly requires region match AND empty slot
- The E8→F4 cascade — uses separate `F4_PAIRINGS` logic, works correctly
- The F4→Championship cascade — works correctly
- Anything in `bracket.ts` — the matchup display logic is correct

## After Deploying

The corrupted R32 games must be cleaned up. In admin test mode:

1. Use "Full Reset" to reset all rounds back to scheduled state, OR
2. Use "Reset Round" on Round 2 to delete the bad cascade games, then re-run "Complete Round" on Round 1

## Testing

After fix + reset:

1. Complete R64 via admin test mode
2. Query R32 games:
   ```sql
   SELECT r.name, t1.region, t1.name as team1, t1.seed as t1_seed,
     t2.region as t2_region, t2.name as team2, t2.seed as t2_seed
   FROM games g
   JOIN rounds r ON r.id = g.round_id
   LEFT JOIN teams t1 ON t1.id = g.team1_id
   LEFT JOIN teams t2 ON t2.id = g.team2_id
   WHERE r.name LIKE 'Round 2%'
   ORDER BY r.name, t1.region, t1.seed;
   ```
3. Verify: every game has `t1.region = t2.region` (same region)
4. Verify: matchups make bracket sense (e.g. #1 vs #8/#9 winner, #4 vs #5/#12 winner)
5. Check analyze page — matchups should look correct
6. Check pick page — should show same matchups as analyze

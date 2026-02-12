# Task: Fix Pick Round ID Mismatch — Entries Not Being Eliminated

## The Bug

When admin test mode completes games, entries that picked the losing team are NOT being eliminated. Only entries that missed picks entirely are eliminated. This is a critical bug in the core game logic.

## Root Cause

The pick page saves every pick with the **active round's** `round_id`. But the active round might be "Round 1 Day 1" while the user picks a team that plays on "Round 1 Day 2."

Example:
1. R64 Day 1 is the active round (round_id = `fb5b96b4...`)
2. User picks Duke — but Duke plays on R64 Day 2 (round_id = `0179534e...`)
3. Pick is saved as: `{ round_id: 'fb5b96b4...', team_id: duke_id }` ← Day 1's ID
4. Duke's game completes → `processCompletedGame('0179534e...', winnerId, loserId)` ← Day 2's ID
5. Query: `picks WHERE round_id = '0179534e...' AND team_id = duke_id` → **ZERO RESULTS**
6. Pick is never marked correct/incorrect, player is never eliminated

The `round_id` on the pick doesn't match the `round_id` on the game, so the elimination query finds nothing.

## The Fix

When saving a pick, use the **round_id of the game the picked team is playing in**, not the active round's ID. This ensures the pick's round_id always matches the game's round_id, and all downstream processing (marking correct/incorrect, eliminating losers) works correctly.

### Change 1: `src/lib/picks.ts` — `submitPick()` function

Currently the pick page passes `round_id` from the active round. Instead, the submit function should look up which round the picked team's game is actually in.

```typescript
// BEFORE: pick is saved with whatever round_id the caller passes
export async function submitPick({ pool_player_id, round_id, team_id }) {
  // ... inserts with round_id as-is
}

// AFTER: look up the correct round_id from the team's game
export async function submitPick({ pool_player_id, round_id, team_id }) {
  // Find the game this team is playing in (for the current tournament phase)
  // The team could be team1 or team2 in the games table
  const { data: game } = await supabase
    .from('games')
    .select('round_id')
    .or(`team1_id.eq.${team_id},team2_id.eq.${team_id}`)
    .eq('status', 'scheduled')
    .limit(1)
    .single();

  // Use the game's round_id if found, fall back to the passed round_id
  const actualRoundId = game?.round_id || round_id;

  // ... insert pick with actualRoundId
}
```

**Important:** The query should find the team's NEXT scheduled game. If a team has already completed R64, their next game is R32. The `.eq('status', 'scheduled')` filter handles this — it finds the upcoming game, not a completed one.

### Change 2: `src/app/pools/[id]/pick/page.tsx` — Pick page

The pick page currently passes `round.id` (the active round) to `submitPick()`. After the Change 1 fix, this still works as a fallback, but the actual round_id will be determined by the team's game.

No changes strictly needed here, but verify that the pick page doesn't do any round_id validation that would reject a pick if the resolved round_id differs from the active round.

### Change 3: `src/lib/picks.ts` — `getPickDeadline()` and deadline checks

Currently the deadline is checked against the active round's deadline. But if the pick is being saved against a different round (e.g., Day 2 instead of Day 1), the deadline check should use the EARLIER of the two deadlines, or the specific game's round deadline.

For survivor pools, the user makes ONE pick per day. If R64 Day 1 and Day 2 are on different calendar days, this isn't an issue — Day 1 picks lock before Day 1 games, Day 2 picks lock before Day 2 games.

But if the active round is Day 1 and the user picks a Day 2 team, the pick should still be allowed (Day 2's deadline hasn't passed yet). The DB trigger `enforce_pick_deadline()` checks the pick's round_id's deadline, so if the pick is saved with Day 2's round_id, it checks Day 2's deadline. This is correct behavior.

### Change 4: Verify `processCompletedGame()` — No changes needed

After the fix, picks will have the correct round_id matching the game's round_id. The existing query works:
```typescript
.eq('round_id', roundId)  // game's round_id
.eq('team_id', loserId)   // losing team
.is('is_correct', null)   // not yet processed
```

### Change 5: Verify `processMissedPicks()` — Needs attention

`processMissedPicks()` checks for alive players who don't have a pick for the round. With the fix, a player who picked a Day 2 team will have a pick with `round_id = Day2`, not Day1. When Day 1's games all complete, `processMissedPicks(Day1_roundId)` runs and looks for players without picks for Day 1.

This player DOES have a pick, but it's under Day 2's round_id. So `processMissedPicks` for Day 1 won't find their pick and might incorrectly eliminate them for "missing" Day 1.

**Fix:** `processMissedPicks` should check for picks across BOTH Day 1 and Day 2 round_ids for the same tournament round (R64). A player who has a pick in either Day 1 or Day 2 should NOT be eliminated for missing picks.

```typescript
export async function processMissedPicks(roundId: string, results: ProcessingResults) {
  // ... existing check that all games in this round are final ...

  // Get the round code (R64, R32, etc.)
  const { data: thisRound } = await supabaseAdmin
    .from('rounds')
    .select('name')
    .eq('id', roundId)
    .single();
  
  const roundCode = mapRoundNameToCode(thisRound?.name || '');

  // Get ALL round_ids for the same tournament round (both Day 1 and Day 2)
  const { data: allRounds } = await supabaseAdmin
    .from('rounds')
    .select('id, name');
  
  const sameRoundIds = (allRounds || [])
    .filter(r => mapRoundNameToCode(r.name) === roundCode)
    .map(r => r.id);

  // Check if ALL rounds in this tournament round are complete
  for (const rid of sameRoundIds) {
    const { data: pending } = await supabaseAdmin
      .from('games')
      .select('id')
      .eq('round_id', rid)
      .in('status', ['scheduled', 'in_progress']);
    
    if (pending && pending.length > 0) {
      return; // Not all games in this tournament round are done yet
    }
  }

  // Now check for missed picks across ALL round_ids in this tournament round
  const { data: alivePlayers } = await supabaseAdmin
    .from('pool_players')
    .select('id, pool_id')
    .eq('is_eliminated', false);

  if (!alivePlayers || alivePlayers.length === 0) return;

  const alivePlayerIds = alivePlayers.map(p => p.id);
  
  // Get picks for ANY of the round_ids in this tournament round
  const { data: picksForRound } = await supabaseAdmin
    .from('picks')
    .select('pool_player_id')
    .in('round_id', sameRoundIds)
    .in('pool_player_id', alivePlayerIds);

  const playerIdsWithPicks = new Set(picksForRound?.map(p => p.pool_player_id) || []);
  const playersWithoutPicks = alivePlayers.filter(p => !playerIdsWithPicks.has(p.id));

  // ... rest of elimination logic unchanged ...
}
```

### Change 6: Pick page display — Show picks for both Day 1 and Day 2

The pick page timeline shows picks per round. Currently it matches `picks.round_id === round.id`. With the fix, a pick for a Day 2 team will have Day 2's round_id, but the user might be viewing Day 1 as the active round.

The pick timeline should show the user's pick for the current TOURNAMENT round (R64), regardless of which Day sub-round it's saved under. Update the pick lookup to check both Day 1 and Day 2 round_ids:

```typescript
// In pick page, when showing the user's pick for a round:
// BEFORE:
const pick = picks.find(p => p.round_id === round.id);

// AFTER: 
const roundCode = mapRoundNameToCode(round.name);
const sameRoundIds = rounds
  .filter(r => mapRoundNameToCode(r.name) === roundCode)
  .map(r => r.id);
const pick = picks.find(p => sameRoundIds.includes(p.round_id));
```

## Testing

After implementing:
1. Reset tournament (full reset via admin panel)
2. Set clock to R64 Day 1 pre-round
3. Submit picks for multiple entries — make sure some pick Day 1 teams and some pick Day 2 teams
4. Complete R64 Day 1 games
5. Verify: entries that picked Day 1 losers ARE eliminated
6. Verify: entries that picked Day 2 teams are NOT eliminated yet (their games haven't happened)
7. Complete R64 Day 2 games
8. Verify: entries that picked Day 2 losers ARE now eliminated
9. Verify: entries with no picks at all ARE eliminated after both days complete

## Files to Modify

1. `src/lib/picks.ts` — `submitPick()`: resolve correct round_id from team's game
2. `src/lib/game-processing.ts` — `processMissedPicks()`: check picks across all sub-rounds
3. `src/app/pools/[id]/pick/page.tsx` — Pick timeline: show picks across sub-rounds

## What NOT to Change

- `processCompletedGame()` — works correctly once picks have the right round_id
- `cascadeGameResult()` — unrelated to picks
- Game completion routes — they pass the game's round_id, which is correct
- The `enforce_pick_deadline` trigger — uses the pick's round_id to check deadline, which is correct

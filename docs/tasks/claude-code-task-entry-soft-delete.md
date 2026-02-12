# Task: Entry Soft-Delete with `entry_deleted` Column

## Problem

When a user removes an entry, the DELETE on `pool_players` can fail silently (RLS). The row stays, counts toward max entries, and blocks adding new ones. Fix: soft-delete entries with a boolean column, and use RLS to automatically hide deleted entries from all client queries.

## Approach

1. Add `entry_deleted` column to `pool_players`
2. Update the SELECT RLS policy to exclude deleted entries — this automatically filters them from ALL client-side queries (no need to touch 30+ query sites)
3. Change "remove entry" from DELETE to UPDATE (set `entry_deleted = true`)
4. Add `.eq('entry_deleted', false)` ONLY to server-side `supabaseAdmin` queries (which bypass RLS)
5. Keep "leave pool" as hard DELETE (user leaving entirely)

## Migration: `supabase/migrations/004_entry_soft_delete.sql`

```sql
-- 1. Add soft-delete columns
ALTER TABLE pool_players ADD COLUMN IF NOT EXISTS entry_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pool_players ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Index for performance (most queries filter on active entries)
CREATE INDEX IF NOT EXISTS idx_pool_players_active 
  ON pool_players(pool_id, user_id) 
  WHERE entry_deleted = false;

-- 3. Update SELECT RLS policy to exclude deleted entries
-- This automatically hides deleted entries from ALL client-side queries
DROP POLICY IF EXISTS "Pool players visible to pool members" ON pool_players;
CREATE POLICY "Pool players visible to pool members" ON pool_players
    FOR SELECT USING (
        entry_deleted = false
        AND auth.uid() IN (
            SELECT user_id FROM pool_players pp 
            WHERE pp.pool_id = pool_players.pool_id 
            AND pp.entry_deleted = false
        )
    );

-- 4. Add UPDATE policy so users and creators can soft-delete entries
CREATE POLICY "Users can soft-delete own entries" ON pool_players
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Pool creators can soft-delete member entries" ON pool_players
    FOR UPDATE USING (
        auth.uid() IN (SELECT creator_id FROM pools WHERE id = pool_players.pool_id)
    )
    WITH CHECK (
        auth.uid() IN (SELECT creator_id FROM pools WHERE id = pool_players.pool_id)
    );

-- 5. Update max entries trigger to count only active entries
CREATE OR REPLACE FUNCTION enforce_max_entries_per_user()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM pool_players
  WHERE pool_id = NEW.pool_id 
    AND user_id = NEW.user_id
    AND entry_deleted = false;

  SELECT max_entries_per_user INTO max_allowed
  FROM pools
  WHERE id = NEW.pool_id;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Maximum entries per user (%) reached for this pool', max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## File Changes

### `src/lib/admin.ts` — Change removePoolMember to soft-delete

```typescript
// BEFORE:
export async function removePoolMember(poolPlayerId: string): Promise<void> {
  const { error, data } = await supabase
    .from('pool_players')
    .delete()
    .eq('id', poolPlayerId)
    .select('id');
  // ...
}

// AFTER:
export async function removePoolMember(poolPlayerId: string): Promise<void> {
  const { error, data } = await supabase
    .from('pool_players')
    .update({ entry_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', poolPlayerId)
    .select('id');

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('Failed to remove entry. Please try again.');
}
```

Keep `leavePool()` as hard DELETE — user is leaving the pool entirely.

### Server-side queries that use `supabaseAdmin` (bypasses RLS)

These are the ONLY queries that need a manual `.eq('entry_deleted', false)` filter. All client-side queries are automatically filtered by the updated RLS policy.

**`src/lib/game-processing.ts`** — 4 queries:

1. **Line ~107** `processMissedPicks` alive players query — ADD `.eq('entry_deleted', false)`:
```typescript
const { data: alivePlayers } = await supabaseAdmin
    .from('pool_players')
    .select('id, pool_id')
    .eq('is_eliminated', false)
    .eq('entry_deleted', false);  // ADD THIS
```

2. **Line ~75** `processCompletedGame` elimination update — No change needed. It updates by specific `pool_player_id` from picks. A deleted entry wouldn't have picks processed.

3. **Line ~127** `processMissedPicks` elimination update — No change needed. It operates on IDs from the filtered alive query above.

4. **Line ~600** `checkRoundCompletion` alive count — ADD `.eq('entry_deleted', false)`:
```typescript
const { data: alivePlayers } = await supabaseAdmin
    .from('pool_players')
    .select('user_id')
    .eq('pool_id', pool.id)
    .eq('is_eliminated', false)
    .eq('entry_deleted', false)  // ADD THIS
    .limit(1);
```

**`src/app/api/pools/[id]/standings/route.ts`** — 2 queries:

1. **Line ~26** membership check — ADD `.eq('entry_deleted', false)`:
```typescript
const { data: membership } = await supabaseAdmin
    .from('pool_players')
    .select('id')
    .eq('pool_id', poolId)
    .eq('user_id', user.id)
    .eq('entry_deleted', false)  // ADD THIS
    .limit(1);
```

2. **Line ~73** all players query — ADD `.eq('entry_deleted', false)`:
```typescript
const { data: players } = await supabaseAdmin
    .from('pool_players')
    .select('id, user_id, display_name, entry_label, is_eliminated, elimination_round_id, elimination_reason, joined_at')
    .eq('pool_id', poolId)
    .eq('entry_deleted', false);  // ADD THIS
```

**`src/app/api/pools/[id]/most-picked/route.ts`** — 2 queries:

1. **Line ~49** membership check — ADD `.eq('entry_deleted', false)`
2. **Line ~75** pool players query — ADD `.eq('entry_deleted', false)`

**`src/app/api/admin/test/reset-round/route.ts`** — 2 queries:

1. **Line ~74** full reset un-eliminate — ADD `.eq('entry_deleted', false)` (don't revive deleted entries)
2. **Line ~177** single round un-eliminate — ADD `.eq('entry_deleted', false)`

**`src/app/api/admin/test/set-round-state/route.ts`** — 1 query:

1. **Line ~182** — ADD `.eq('entry_deleted', false)`

### Pick page entry addition

In `src/app/pools/[id]/pick/page.tsx`, when adding a new entry, the `entry_number` should be calculated from active entries only. The RLS policy already filters deleted entries from the client query, so the existing code should work. But verify that the INSERT sets `entry_deleted: false` (the DEFAULT handles this, but be explicit if building the insert object).

## What NOT to change

- All client-side queries (`supabase.from('pool_players')...`) — automatically filtered by RLS
- `leavePool()` — keep as hard DELETE
- The DELETE RLS policies — keep them for `leavePool()` 
- Picks table — picks from deleted entries stay in DB but the entry won't show in standings

## Testing

1. Create a pool with max 3 entries per user
2. Add 3 entries
3. Remove 1 entry (should soft-delete)
4. Verify the removed entry doesn't appear in standings, pick page, settings, or dashboard
5. Add a new entry (should succeed — only 2 active entries, under the limit of 3)
6. Verify the new entry appears everywhere correctly
7. Run "Complete Round" in admin test mode — verify deleted entries aren't processed for missed picks
8. Check standings API response — deleted entries should not appear

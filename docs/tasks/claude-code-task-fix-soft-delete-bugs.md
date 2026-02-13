# Task: Fix Entry Soft-Delete Bugs

There are 3 bugs introduced by the soft-delete migration that need to be fixed together.

## Bug 1: "Failed to remove member" — removePoolMember false error

### Root Cause
`removePoolMember()` in `src/lib/admin.ts` does `.update({ entry_deleted: true }).eq('id', poolPlayerId).select('id')` then checks if data is empty. The `.select('id')` reads the row back through the RLS SELECT policy, which requires `entry_deleted = false`. The row was just set to `true`, so RLS hides it. Empty result. Function throws even though the update succeeded.

### Fix — `src/lib/admin.ts`

Replace the entire `removePoolMember` function:

```typescript
// BEFORE (broken):
export async function removePoolMember(poolPlayerId: string): Promise<void> {
  const { error, data } = await supabase
    .from('pool_players')
    .update({ entry_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', poolPlayerId)
    .select('id');

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('Failed to remove entry. Please try again.');
}

// AFTER (fixed):
export async function removePoolMember(poolPlayerId: string): Promise<void> {
  const { error } = await supabase
    .from('pool_players')
    .update({ entry_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', poolPlayerId);

  if (error) throw new Error(error.message);
}
```

That's it. Remove `.select('id')` and the data length check. The only caller (`settings/page.tsx` line 432) doesn't use any return data — it calls `loadData()` on success to refresh the UI.

---

## Bug 2: "Nothing happens" adding entry — entry_number collision

### Root Cause
Pick page line 684: `const entryNumber = entries.length + 1`. The `entries` array is RLS-filtered (soft-deleted entries hidden). If user had entries [1, 2, 3] and soft-deleted #2, `entries` shows [entry1, entry3], length = 2, so `entryNumber = 3`. But active entry #3 already exists. The UNIQUE constraint fires error 23505. The code silently swallows 23505 (lines 694-701), closes the form, and does nothing.

### Fix Part A — entry_number calculation

**`src/app/pools/[id]/pick/page.tsx`** — change line 684:

```typescript
// BEFORE:
const entryNumber = entries.length + 1;

// AFTER:
const entryNumber = Math.max(...entries.map(e => e.entry_number), 0) + 1;
```

**`src/app/pools/join/page.tsx`** — change line 118:

```typescript
// BEFORE:
const entryNumber = existingEntryCount + 1;

// AFTER — need the actual entries, not just the count:
```

For the join page, `existingEntryCount` is a number, not an array. The existing entries query is on line 72:
```typescript
const { data: existingEntries } = await supabase
    .from('pool_players')
    .select('id')
    .eq('pool_id', pool.id)
    .eq('user_id', user?.id);
```

Change that select to also fetch entry_number, then compute max:

```typescript
// BEFORE (line 72-73):
const { data: existingEntries } = await supabase
    .from('pool_players')
    .select('id')
    .eq('pool_id', pool.id)
    .eq('user_id', user?.id);

// AFTER:
const { data: existingEntries } = await supabase
    .from('pool_players')
    .select('id, entry_number')
    .eq('pool_id', pool.id)
    .eq('user_id', user?.id);
```

Then change the entryNumber calculation (line 118):

```typescript
// BEFORE:
const entryNumber = existingEntryCount + 1;

// AFTER:
const entryNumber = existingEntries && existingEntries.length > 0
    ? Math.max(...existingEntries.map((e: any) => e.entry_number ?? 0)) + 1
    : 1;
```

### Fix Part B — partial unique index (SQL)

Even with the max() fix, there's still a problem: if the HIGHEST entry_number was the one soft-deleted, max of active entries gives a lower number, and the new entry reuses the deleted entry's number. The full UNIQUE constraint still sees the deleted row and blocks it.

Run this in Supabase SQL Editor:

```sql
-- Replace full constraint with partial index that only covers active entries
ALTER TABLE pool_players DROP CONSTRAINT IF EXISTS pool_players_pool_user_entry_unique;
CREATE UNIQUE INDEX IF NOT EXISTS pool_players_pool_user_entry_active 
    ON pool_players(pool_id, user_id, entry_number) 
    WHERE entry_deleted = false;
```

This allows a new active entry to reuse an entry_number from a soft-deleted row.

---

## Bug 3: Migration file has recursive RLS policy

### Root Cause
`supabase/migrations/004_entry_soft_delete.sql` lines 16-24 create a SELECT policy that references `pool_players` inside the policy on `pool_players`, causing infinite recursion. The user already applied a production fix using `get_user_pool_ids()` function, but the migration file is wrong.

### Fix — `supabase/migrations/004_entry_soft_delete.sql`

Replace the ENTIRE file with this corrected version:

```sql
-- Migration: Entry soft-delete on pool_players
-- Hides deleted entries from all client queries via RLS; server-side admin queries must filter manually.

-- 1. Add soft-delete columns
ALTER TABLE pool_players ADD COLUMN IF NOT EXISTS entry_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pool_players ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Index for performance (most queries filter on active entries)
CREATE INDEX IF NOT EXISTS idx_pool_players_active
  ON pool_players(pool_id, user_id)
  WHERE entry_deleted = false;

-- 3. Security definer function to check pool membership without triggering RLS
CREATE OR REPLACE FUNCTION get_user_pool_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT pool_id FROM pool_players WHERE user_id = uid AND entry_deleted = false;
$$;

-- 4. Update SELECT RLS policy to exclude deleted entries (non-recursive)
DROP POLICY IF EXISTS "Pool players visible to pool members" ON pool_players;
CREATE POLICY "Pool players visible to pool members" ON pool_players
    FOR SELECT USING (
        entry_deleted = false
        AND pool_id IN (SELECT get_user_pool_ids(auth.uid()))
    );

-- 5. Add UPDATE policies so users and creators can soft-delete entries
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

-- 6. Update max entries trigger to count only active entries
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

-- 7. Replace full unique constraint with partial index (allows entry_number reuse after soft-delete)
ALTER TABLE pool_players DROP CONSTRAINT IF EXISTS pool_players_pool_user_entry_unique;
CREATE UNIQUE INDEX IF NOT EXISTS pool_players_pool_user_entry_active 
    ON pool_players(pool_id, user_id, entry_number) 
    WHERE entry_deleted = false;
```

---

## Files to modify

1. `src/lib/admin.ts` — Fix `removePoolMember()` (remove `.select('id')` and length check)
2. `src/app/pools/[id]/pick/page.tsx` — Fix entry_number calculation (use max instead of length+1)
3. `src/app/pools/join/page.tsx` — Fix entry_number calculation (fetch entry_number, use max)
4. `supabase/migrations/004_entry_soft_delete.sql` — Replace with corrected version above

## SQL to run in Supabase (production fix for Bug 2)

The migration file fix is for future runs. For production RIGHT NOW, run this:

```sql
ALTER TABLE pool_players DROP CONSTRAINT IF EXISTS pool_players_pool_user_entry_unique;
CREATE UNIQUE INDEX IF NOT EXISTS pool_players_pool_user_entry_active 
    ON pool_players(pool_id, user_id, entry_number) 
    WHERE entry_deleted = false;
```

## What NOT to change

- The `get_user_pool_ids` function and SELECT RLS policy already applied in production — leave those as-is
- `leavePool()` — stays as hard DELETE
- All server-side `supabaseAdmin` queries with `.eq('entry_deleted', false)` — agent did these correctly
- The `enforce_max_entries_per_user` trigger — agent updated this correctly
- The UPDATE RLS policies — these are working fine

## Testing

1. Go to settings page, remove an entry → should succeed with "Member removed" toast, entry disappears
2. Go to pick page, add a new entry → should succeed, entry appears with next entry_number
3. Add entries up to max, soft-delete one, add another → should succeed (not hit max limit)
4. Verify soft-deleted entries don't appear in standings, pick page, settings, or dashboard

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

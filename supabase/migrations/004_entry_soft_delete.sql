-- Migration: Entry soft-delete on pool_players
-- Run in Supabase SQL Editor
-- Hides deleted entries from all client queries via RLS; server-side admin queries must filter manually.

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

-- Migration: Multi-Bracket Support
-- Run this in Supabase SQL Editor
-- Allows pools to let users have multiple entries (brackets) per pool

-- 1. Add max_entries_per_user to pools (default 1 = original behavior)
ALTER TABLE pools
ADD COLUMN IF NOT EXISTS max_entries_per_user INTEGER NOT NULL DEFAULT 1;

ALTER TABLE pools
ADD CONSTRAINT check_max_entries
CHECK (max_entries_per_user >= 1 AND max_entries_per_user <= 10);

-- 2. Add entry_number and entry_label to pool_players
ALTER TABLE pool_players
ADD COLUMN IF NOT EXISTS entry_number INTEGER NOT NULL DEFAULT 1;

ALTER TABLE pool_players
ADD COLUMN IF NOT EXISTS entry_label VARCHAR(60);

-- 3. Drop old unique constraint and add new one that allows multiple entries
ALTER TABLE pool_players
DROP CONSTRAINT IF EXISTS pool_players_pool_id_user_id_key;

ALTER TABLE pool_players
ADD CONSTRAINT pool_players_pool_user_entry_unique
UNIQUE(pool_id, user_id, entry_number);

-- 4. Trigger to enforce max entries per user at insert time
CREATE OR REPLACE FUNCTION enforce_max_entries_per_user()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM pool_players
  WHERE pool_id = NEW.pool_id AND user_id = NEW.user_id;

  SELECT max_entries_per_user INTO max_allowed
  FROM pools
  WHERE id = NEW.pool_id;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Maximum entries per user (%) reached for this pool', max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pool_players_enforce_max_entries
  BEFORE INSERT ON pool_players
  FOR EACH ROW
  EXECUTE FUNCTION enforce_max_entries_per_user();

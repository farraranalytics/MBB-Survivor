-- Migration 005: Bracket Structure — Pre-Generated 63-Game Advancement
-- Adds matchup_code, advances_to_game_id, advances_to_slot columns to games
-- for explicit bracket wiring (replaces dynamic cascadeGameResult).

-- ═══════════════════════════════════════════════════════════════
-- 1. Add new columns to games
-- ═══════════════════════════════════════════════════════════════

DO $$ BEGIN
  -- Human-readable positional ID: e.g. EAST_R64_1, F4_2, CHIP_1
  ALTER TABLE games ADD COLUMN IF NOT EXISTS matchup_code VARCHAR(20);

  -- Where the winner of this game advances to
  ALTER TABLE games ADD COLUMN IF NOT EXISTS advances_to_game_id UUID REFERENCES games(id);

  -- Which slot the winner fills in the target game (1 = team1, 2 = team2)
  ALTER TABLE games ADD COLUMN IF NOT EXISTS advances_to_slot INTEGER;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 2. Add constraints
-- ═══════════════════════════════════════════════════════════════

-- advances_to_slot must be 1 or 2
DO $$ BEGIN
  ALTER TABLE games ADD CONSTRAINT games_advances_to_slot_check
    CHECK (advances_to_slot IN (1, 2));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 3. Add indexes
-- ═══════════════════════════════════════════════════════════════

-- Unique partial index on matchup_code (only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_games_matchup_code
  ON games (matchup_code) WHERE matchup_code IS NOT NULL;

-- FK index for looking up games that advance to a given game
CREATE INDEX IF NOT EXISTS idx_games_advances_to_game_id
  ON games (advances_to_game_id) WHERE advances_to_game_id IS NOT NULL;

-- Index on tournament_round for filtering by round code
CREATE INDEX IF NOT EXISTS idx_games_tournament_round
  ON games (tournament_round) WHERE tournament_round IS NOT NULL;

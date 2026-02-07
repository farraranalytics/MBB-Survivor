-- Add odds columns to games table (for Task 14 — Odds API integration)
-- Adding now so the schema is ready when we build the odds sync

ALTER TABLE games ADD COLUMN IF NOT EXISTS team1_moneyline INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS team2_moneyline INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS team1_spread DECIMAL(4,1);
ALTER TABLE games ADD COLUMN IF NOT EXISTS team1_win_probability DECIMAL(4,3);
ALTER TABLE games ADD COLUMN IF NOT EXISTS team2_win_probability DECIMAL(4,3);
ALTER TABLE games ADD COLUMN IF NOT EXISTS odds_updated_at TIMESTAMPTZ;

-- Add notes column to pools table (for Task 12 — Pool Settings)
ALTER TABLE pools ADD COLUMN IF NOT EXISTS notes TEXT;

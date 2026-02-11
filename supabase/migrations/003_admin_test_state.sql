-- Migration 003: Admin Test State (Simulated Clock)
-- Creates the admin_test_state singleton table and effective_now() function
-- for simulated time in test mode. Updates RLS policies and triggers to use it.

-- ═══════════════════════════════════════════════════════════════
-- 1. Create admin_test_state table
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS admin_test_state (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    is_test_mode BOOLEAN NOT NULL DEFAULT false,
    simulated_datetime TIMESTAMPTZ,
    target_round_id uuid REFERENCES rounds(id),
    phase VARCHAR(20) DEFAULT 'pre_round',  -- 'pre_round', 'live', 'post_round'
    updated_by uuid REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Singleton: only one row ever exists
INSERT INTO admin_test_state (is_test_mode) VALUES (false);

-- RLS: anyone authenticated can read, admins can update
ALTER TABLE admin_test_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read test state"
    ON admin_test_state FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can update test state"
    ON admin_test_state FOR UPDATE TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════
-- 1b. Add bracket cascade columns to games (if they don't already exist)
-- ═══════════════════════════════════════════════════════════════

DO $$ BEGIN
  ALTER TABLE games ADD COLUMN IF NOT EXISTS bracket_position INTEGER;
  ALTER TABLE games ADD COLUMN IF NOT EXISTS tournament_round VARCHAR(10);
  ALTER TABLE games ADD COLUMN IF NOT EXISTS parent_game_a_id uuid REFERENCES games(id);
  ALTER TABLE games ADD COLUMN IF NOT EXISTS parent_game_b_id uuid REFERENCES games(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 2. Create effective_now() function
-- ═══════════════════════════════════════════════════════════════
-- Returns simulated_datetime when test mode is on, NOW() otherwise.
-- Used by triggers, RLS policies, and can be called from app code.

CREATE OR REPLACE FUNCTION effective_now()
RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_test_mode BOOLEAN;
    v_sim_time TIMESTAMPTZ;
BEGIN
    SELECT is_test_mode, simulated_datetime
    INTO v_test_mode, v_sim_time
    FROM admin_test_state
    LIMIT 1;

    IF v_test_mode AND v_sim_time IS NOT NULL THEN
        RETURN v_sim_time;
    END IF;
    RETURN NOW();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- 3. Update enforce_pick_deadline() trigger to use effective_now()
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION enforce_pick_deadline()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM rounds
        WHERE id = NEW.round_id AND deadline_datetime < effective_now()
    ) THEN
        RAISE EXCEPTION 'Cannot submit pick after deadline';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- 4. Update RLS policies on picks to use effective_now()
-- ═══════════════════════════════════════════════════════════════

-- Drop old policies
DROP POLICY IF EXISTS "Picks visible to pool members after deadline" ON picks;
DROP POLICY IF EXISTS "Users can submit their own picks" ON picks;

-- Recreate with effective_now()
CREATE POLICY "Picks visible to pool members after deadline" ON picks
    FOR SELECT USING (
        -- Own picks always visible
        auth.uid() IN (SELECT user_id FROM pool_players WHERE id = picks.pool_player_id)
        OR
        -- Other picks visible after deadline
        (auth.uid() IN (
            SELECT pp.user_id FROM pool_players pp
            JOIN pool_players my_pp ON my_pp.pool_id = pp.pool_id
            WHERE picks.pool_player_id = pp.id AND my_pp.user_id = auth.uid()
        ) AND EXISTS (
            SELECT 1 FROM rounds WHERE id = picks.round_id AND deadline_datetime < effective_now()
        ))
    );

CREATE POLICY "Users can submit their own picks" ON picks
    FOR INSERT WITH CHECK (
        auth.uid() IN (SELECT user_id FROM pool_players WHERE id = picks.pool_player_id)
        AND EXISTS (SELECT 1 FROM rounds WHERE id = picks.round_id AND deadline_datetime > effective_now())
    );

-- ═══════════════════════════════════════════════════════════════
-- 5. Add missing DELETE policies on pool_players
-- ═══════════════════════════════════════════════════════════════
-- Without these, leavePool() and removePoolMember() silently fail
-- because RLS blocks all deletes by default.

DROP POLICY IF EXISTS "Users can leave pools" ON pool_players;
CREATE POLICY "Users can leave pools" ON pool_players
    FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Pool creators can remove members" ON pool_players;
CREATE POLICY "Pool creators can remove members" ON pool_players
    FOR DELETE USING (
        auth.uid() IN (SELECT creator_id FROM pools WHERE id = pool_players.pool_id)
    );

-- ═══════════════════════════════════════════════════════════════
-- 6. Server-side enforcement: block pool creation & joining after
--    tournament starts. Client-side checks alone are insufficient.
-- ═══════════════════════════════════════════════════════════════

-- Helper: returns true if any game is no longer 'scheduled'
CREATE OR REPLACE FUNCTION tournament_has_started()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM games WHERE status != 'scheduled');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Block pool creation after tournament starts
CREATE OR REPLACE FUNCTION enforce_pre_tournament_pool_creation()
RETURNS TRIGGER AS $$
BEGIN
    IF tournament_has_started() THEN
        RAISE EXCEPTION 'Cannot create pools after the tournament has started';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_pool_creation_timing ON pools;
CREATE TRIGGER check_pool_creation_timing
    BEFORE INSERT ON pools
    FOR EACH ROW
    EXECUTE FUNCTION enforce_pre_tournament_pool_creation();

-- Block joining pools after tournament starts
CREATE OR REPLACE FUNCTION enforce_pre_tournament_join()
RETURNS TRIGGER AS $$
BEGIN
    IF tournament_has_started() THEN
        RAISE EXCEPTION 'Cannot join pools after the tournament has started';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_pool_join_timing ON pool_players;
CREATE TRIGGER check_pool_join_timing
    BEFORE INSERT ON pool_players
    FOR EACH ROW
    EXECUTE FUNCTION enforce_pre_tournament_join();

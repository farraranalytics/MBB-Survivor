-- MBB Survivor Pool Database Schema
-- This schema supports March Madness survivor pools where players pick one team per day
-- Wrong pick or missed pick = elimination, last player standing wins

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Rounds/Days table - represents each day of the tournament
CREATE TABLE rounds (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(50) NOT NULL, -- 'First Four', 'Round 1', 'Round 2', etc.
    date DATE NOT NULL,
    deadline_datetime TIMESTAMPTZ NOT NULL, -- 30 min before first game
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams table
CREATE TABLE teams (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    mascot VARCHAR(100),
    abbreviation VARCHAR(10),
    seed INTEGER, -- tournament seed (1-16, or null for play-in)
    region VARCHAR(20), -- 'East', 'West', 'South', 'Midwest'
    logo_url TEXT,
    is_eliminated BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Games table - tournament games
CREATE TABLE games (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    round_id uuid REFERENCES rounds(id) ON DELETE CASCADE,
    team1_id uuid REFERENCES teams(id),
    team2_id uuid REFERENCES teams(id),
    game_datetime TIMESTAMPTZ NOT NULL,
    winner_id uuid REFERENCES teams(id), -- null until game is complete
    team1_score INTEGER,
    team2_score INTEGER,
    status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'final'
    espn_game_id VARCHAR(50), -- for API integration
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pools table - survivor pool instances
CREATE TABLE pools (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    join_code VARCHAR(10) UNIQUE NOT NULL, -- 6-8 char code for joining
    creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    entry_fee DECIMAL(10,2) DEFAULT 0.00,
    prize_pool DECIMAL(10,2) DEFAULT 0.00,
    max_players INTEGER,
    is_private BOOLEAN DEFAULT true,
    tournament_year INTEGER NOT NULL DEFAULT 2026,
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'active', 'complete'
    winner_id uuid REFERENCES auth.users(id), -- null until pool complete
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pool players - tracks who's in each pool and their survival status
CREATE TABLE pool_players (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    pool_id uuid REFERENCES pools(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name VARCHAR(50) NOT NULL,
    is_eliminated BOOLEAN DEFAULT false,
    elimination_round_id uuid REFERENCES rounds(id), -- when they were eliminated
    elimination_reason VARCHAR(50), -- 'wrong_pick', 'missed_pick', 'manual'
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(pool_id, user_id) -- user can only join pool once
);

-- Picks table - daily team selections
CREATE TABLE picks (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    pool_player_id uuid REFERENCES pool_players(id) ON DELETE CASCADE,
    round_id uuid REFERENCES rounds(id) ON DELETE CASCADE,
    team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
    confidence INTEGER, -- 1-10 rating for potential tiebreakers
    is_correct BOOLEAN, -- null until round complete
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(pool_player_id, round_id), -- one pick per player per round
    UNIQUE(pool_player_id, team_id) -- can't pick same team twice
);

-- User profiles (extends Supabase auth.users)
CREATE TABLE user_profiles (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    display_name VARCHAR(50),
    avatar_url TEXT,
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    notification_preferences JSONB DEFAULT '{"email": true, "push": false}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table - for deadline reminders, eliminations, etc.
CREATE TABLE notifications (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    pool_id uuid REFERENCES pools(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'deadline_reminder', 'elimination', 'winner', etc.
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_pools_join_code ON pools(join_code);
CREATE INDEX idx_pool_players_pool_id ON pool_players(pool_id);
CREATE INDEX idx_pool_players_user_id ON pool_players(user_id);
CREATE INDEX idx_picks_pool_player_id ON picks(pool_player_id);
CREATE INDEX idx_picks_round_id ON picks(round_id);
CREATE INDEX idx_games_round_id ON games(round_id);
CREATE INDEX idx_games_datetime ON games(game_datetime);
CREATE INDEX idx_rounds_date ON rounds(date);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Row Level Security (RLS) Policies
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Public read access to reference tables
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Policies for pools
CREATE POLICY "Public pools are viewable by everyone" ON pools
    FOR SELECT USING (NOT is_private OR auth.uid() IN (
        SELECT user_id FROM pool_players WHERE pool_id = pools.id
    ));

CREATE POLICY "Users can create pools" ON pools
    FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Pool creators can update their pools" ON pools
    FOR UPDATE USING (auth.uid() = creator_id);

-- Policies for pool_players
CREATE POLICY "Pool players visible to pool members" ON pool_players
    FOR SELECT USING (auth.uid() IN (
        SELECT user_id FROM pool_players pp WHERE pp.pool_id = pool_players.pool_id
    ));

CREATE POLICY "Users can join pools" ON pool_players
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave pools" ON pool_players
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Pool creators can remove members" ON pool_players
    FOR DELETE USING (
        auth.uid() IN (SELECT creator_id FROM pools WHERE id = pool_players.pool_id)
    );

-- Policies for picks
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
            SELECT 1 FROM rounds WHERE id = picks.round_id AND deadline_datetime < NOW()
        ))
    );

CREATE POLICY "Users can submit their own picks" ON picks
    FOR INSERT WITH CHECK (
        auth.uid() IN (SELECT user_id FROM pool_players WHERE id = picks.pool_player_id)
        AND EXISTS (SELECT 1 FROM rounds WHERE id = picks.round_id AND deadline_datetime > NOW())
    );

-- Policies for user profiles
CREATE POLICY "Users can view and edit own profile" ON user_profiles
    FOR ALL USING (auth.uid() = id);

CREATE POLICY "Pool members can see each other's profiles" ON user_profiles
    FOR SELECT USING (auth.uid() IN (
        SELECT pp1.user_id FROM pool_players pp1
        JOIN pool_players pp2 ON pp1.pool_id = pp2.pool_id
        WHERE pp2.user_id = user_profiles.id
    ));

-- Policies for notifications
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Reference data policies (public read)
CREATE POLICY "Everyone can view rounds" ON rounds FOR SELECT USING (true);
CREATE POLICY "Everyone can view teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Everyone can view games" ON games FOR SELECT USING (true);

-- Functions for business logic

-- Function to generate unique join codes
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TEXT AS $$
DECLARE
    characters TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- avoid ambiguous chars
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(characters, floor(random() * length(characters) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate join codes
CREATE OR REPLACE FUNCTION set_join_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.join_code IS NULL OR NEW.join_code = '' THEN
        LOOP
            NEW.join_code := generate_join_code();
            EXIT WHEN NOT EXISTS (SELECT 1 FROM pools WHERE join_code = NEW.join_code);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pools_set_join_code_trigger
    BEFORE INSERT ON pools
    FOR EACH ROW
    EXECUTE FUNCTION set_join_code();

-- Function to auto-create user profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Function to check pick deadline enforcement
CREATE OR REPLACE FUNCTION enforce_pick_deadline()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM rounds 
        WHERE id = NEW.round_id AND deadline_datetime < NOW()
    ) THEN
        RAISE EXCEPTION 'Cannot submit pick after deadline';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER picks_deadline_enforcement_trigger
    BEFORE INSERT OR UPDATE ON picks
    FOR EACH ROW
    EXECUTE FUNCTION enforce_pick_deadline();

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rounds_updated_at BEFORE UPDATE ON rounds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pools_updated_at BEFORE UPDATE ON pools FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
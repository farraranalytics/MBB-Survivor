-- MBB Survivor Database Schema
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pools table
CREATE TABLE IF NOT EXISTS pools (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES profiles(id) NOT NULL,
  join_code TEXT UNIQUE NOT NULL,
  max_players INTEGER DEFAULT 100,
  entry_fee DECIMAL(10,2) DEFAULT 0,
  prize_pool DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'active', 'completed')),
  tournament_year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pool memberships
CREATE TABLE IF NOT EXISTS pool_players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'eliminated')),
  elimination_date DATE,
  elimination_round INTEGER,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pool_id, user_id)
);

-- Tournament rounds
CREATE TABLE IF NOT EXISTS rounds (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_year INTEGER NOT NULL,
  round_number INTEGER NOT NULL,
  round_name TEXT NOT NULL, -- "First Round", "Second Round", "Sweet 16", etc.
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  pick_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tournament_year, round_number)
);

-- Games
CREATE TABLE IF NOT EXISTS games (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  espn_id TEXT UNIQUE,
  tournament_year INTEGER NOT NULL,
  round_id UUID REFERENCES rounds(id),
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_seed INTEGER,
  away_seed INTEGER,
  game_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed')),
  home_score INTEGER DEFAULT 0,
  away_score INTEGER DEFAULT 0,
  winner TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player picks
CREATE TABLE IF NOT EXISTS picks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  round_id UUID REFERENCES rounds(id),
  team_name TEXT NOT NULL,
  game_id UUID REFERENCES games(id),
  is_correct BOOLEAN,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pool_id, user_id, round_id)
);

-- Team usage tracking (one team per tournament per player per pool)
CREATE TABLE IF NOT EXISTS team_usage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  used_in_round INTEGER NOT NULL,
  tournament_year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pool_id, user_id, team_name, tournament_year)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pools_owner ON pools(owner_id);
CREATE INDEX IF NOT EXISTS idx_pools_join_code ON pools(join_code);
CREATE INDEX IF NOT EXISTS idx_pool_players_pool ON pool_players(pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_players_user ON pool_players(user_id);
CREATE INDEX IF NOT EXISTS idx_games_round ON games(round_id);
CREATE INDEX IF NOT EXISTS idx_games_date ON games(game_date);
CREATE INDEX IF NOT EXISTS idx_picks_pool_user ON picks(pool_id, user_id);
CREATE INDEX IF NOT EXISTS idx_picks_round ON picks(round_id);
CREATE INDEX IF NOT EXISTS idx_team_usage_pool_user ON team_usage(pool_id, user_id);

-- Row Level Security (RLS) Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_usage ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Pools policies
CREATE POLICY "Anyone can view pools" ON pools FOR SELECT TO authenticated USING (true);
CREATE POLICY "Pool owners can update their pools" ON pools FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Authenticated users can create pools" ON pools FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

-- Pool players policies
CREATE POLICY "Pool members can view pool membership" ON pool_players FOR SELECT 
  USING (EXISTS (SELECT 1 FROM pool_players pp WHERE pp.pool_id = pool_players.pool_id AND pp.user_id = auth.uid()));
CREATE POLICY "Users can join pools" ON pool_players FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Games and rounds are public read
CREATE POLICY "Anyone can view rounds" ON rounds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view games" ON games FOR SELECT TO authenticated USING (true);

-- Picks policies  
CREATE POLICY "Users can view picks in their pools" ON picks FOR SELECT
  USING (EXISTS (SELECT 1 FROM pool_players pp WHERE pp.pool_id = picks.pool_id AND pp.user_id = auth.uid()));
CREATE POLICY "Users can insert own picks" ON picks FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM pool_players pp WHERE pp.pool_id = picks.pool_id AND pp.user_id = auth.uid()));
CREATE POLICY "Users can update own picks before deadline" ON picks FOR UPDATE
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM rounds r WHERE r.id = picks.round_id AND r.pick_deadline > NOW()));

-- Team usage policies
CREATE POLICY "Users can view team usage in their pools" ON team_usage FOR SELECT
  USING (EXISTS (SELECT 1 FROM pool_players pp WHERE pp.pool_id = team_usage.pool_id AND pp.user_id = auth.uid()));
CREATE POLICY "Users can insert own team usage" ON team_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Functions for common operations
CREATE OR REPLACE FUNCTION get_pool_standings(pool_uuid UUID)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  status TEXT,
  picks_made INTEGER,
  correct_picks INTEGER,
  elimination_round INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pp.user_id,
    p.display_name,
    pp.status,
    COUNT(picks.id)::INTEGER as picks_made,
    COUNT(CASE WHEN picks.is_correct = true THEN 1 END)::INTEGER as correct_picks,
    pp.elimination_round
  FROM pool_players pp
  LEFT JOIN profiles p ON p.id = pp.user_id
  LEFT JOIN picks ON picks.pool_id = pp.pool_id AND picks.user_id = pp.user_id
  WHERE pp.pool_id = pool_uuid
  GROUP BY pp.user_id, p.display_name, pp.status, pp.elimination_round
  ORDER BY pp.status DESC, correct_picks DESC, picks_made DESC;
END;
$$;

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
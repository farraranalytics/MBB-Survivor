-- Seed data for MBB Survivor Pool
-- Run this after applying the main schema

-- Insert 2026 tournament rounds
INSERT INTO rounds (name, date, deadline_datetime, is_active) VALUES
('First Four', '2026-03-17', '2026-03-17 18:00:00-04', false),
('First Round', '2026-03-19', '2026-03-19 11:30:00-04', false),
('First Round Day 2', '2026-03-20', '2026-03-20 11:30:00-04', false),
('Second Round', '2026-03-21', '2026-03-21 11:30:00-04', false),
('Second Round Day 2', '2026-03-22', '2026-03-22 11:30:00-04', false),
('Sweet 16', '2026-03-26', '2026-03-26 18:00:00-04', false),
('Sweet 16 Day 2', '2026-03-27', '2026-03-27 18:00:00-04', false),
('Elite Eight', '2026-03-28', '2026-03-28 18:00:00-04', false),
('Elite Eight Day 2', '2026-03-29', '2026-03-29 18:00:00-04', false),
('Final Four', '2026-04-05', '2026-04-05 17:30:00-04', false),
('Championship', '2026-04-07', '2026-04-07 20:30:00-04', false);

-- Insert sample teams (we'll populate full 68-team field later from ESPN API)
INSERT INTO teams (name, mascot, abbreviation, seed, region, is_eliminated) VALUES
-- Sample 1-seeds
('Duke', 'Blue Devils', 'DUKE', 1, 'East', false),
('North Carolina', 'Tar Heels', 'UNC', 1, 'West', false),
('Kansas', 'Jayhawks', 'KU', 1, 'South', false),
('Gonzaga', 'Bulldogs', 'GONZ', 1, 'Midwest', false),

-- Sample 2-seeds
('Villanova', 'Wildcats', 'NOVA', 2, 'East', false),
('Arizona', 'Wildcats', 'ARIZ', 2, 'West', false),
('Kentucky', 'Wildcats', 'UK', 2, 'South', false),
('Baylor', 'Bears', 'BAY', 2, 'Midwest', false),

-- Sample lower seeds
('Davidson', 'Wildcats', 'DAV', 10, 'East', false),
('Saint Peters', 'Peacocks', 'SPC', 15, 'East', false),
('Vermont', 'Catamounts', 'VT', 13, 'West', false),
('Wright State', 'Raiders', 'WSU', 14, 'South', false);

-- Create a sample pool for testing
INSERT INTO pools (name, join_code, creator_id, entry_fee, prize_pool, max_players, is_private, tournament_year, status) 
VALUES ('Test Pool 2026', 'TEST2026', (SELECT id FROM auth.users LIMIT 1), 10.00, 0.00, 50, true, 2026, 'open');

-- Note: Additional seed data (games, picks, etc.) will be populated via API integration
-- or can be added manually through the admin interface once the app is running
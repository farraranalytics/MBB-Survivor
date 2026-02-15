-- MBB Survivor — Test Seed Data
-- Run in Supabase SQL Editor after schema is applied
-- Uses fake 2026 bracket with real school names, dates set near Feb 7-8 2026 for testing
-- If dates have passed, update the round dates/deadlines before running

-- ============================================================
-- CLEAR EXISTING DATA
-- ============================================================
TRUNCATE picks, pool_players, pools, notifications, games, teams, rounds CASCADE;

-- ============================================================
-- ROUNDS (dates near-future for testing)
-- ============================================================
INSERT INTO rounds (name, date, deadline_datetime, is_active) VALUES
('Round 1 Day 1',  '2026-02-07', '2026-02-07 11:30:00-07', true),
('Round 1 Day 2',  '2026-02-08', '2026-02-08 11:30:00-07', false),
('Round 2 Day 1',  '2026-02-09', '2026-02-09 11:30:00-07', false),
('Round 2 Day 2',  '2026-02-10', '2026-02-10 11:30:00-07', false),
('Sweet 16',       '2026-02-13', '2026-02-13 18:00:00-07', false),
('Elite Eight',    '2026-02-14', '2026-02-14 18:00:00-07', false),
('Final Four',     '2026-02-20', '2026-02-20 17:30:00-07', false),
('Championship',   '2026-02-22', '2026-02-22 20:30:00-07', false);

-- ============================================================
-- 64 TEAMS — 4 regions, seeds 1-16
-- ============================================================

-- EAST region
INSERT INTO teams (name, mascot, abbreviation, seed, region, is_eliminated) VALUES
('Duke',            'Blue Devils',   'DUKE', 1,  'East', false),
('Villanova',       'Wildcats',      'NOVA', 2,  'East', false),
('Purdue',          'Boilermakers',  'PUR',  3,  'East', false),
('Marquette',       'Golden Eagles', 'MARQ', 4,  'East', false),
('San Diego State', 'Aztecs',        'SDSU', 5,  'East', false),
('Creighton',       'Bluejays',      'CREI', 6,  'East', false),
('Missouri',        'Tigers',        'MIZZ', 7,  'East', false),
('Memphis',         'Tigers',        'MEM',  8,  'East', false),
('Florida Atlantic','Owls',          'FAU',  9,  'East', false),
('Davidson',        'Wildcats',      'DAV',  10, 'East', false),
('Drake',           'Bulldogs',      'DRKE', 11, 'East', false),
('Richmond',        'Spiders',       'RICH', 12, 'East', false),
('Vermont',         'Catamounts',    'UVM',  13, 'East', false),
('Colgate',         'Raiders',       'COLG', 14, 'East', false),
('Saint Peters',    'Peacocks',      'SPU',  15, 'East', false),
('Norfolk State',   'Spartans',      'NORF', 16, 'East', false);

-- WEST region
INSERT INTO teams (name, mascot, abbreviation, seed, region, is_eliminated) VALUES
('North Carolina',     'Tar Heels',       'UNC',  1,  'West', false),
('Arizona',            'Wildcats',        'ARIZ', 2,  'West', false),
('Baylor',             'Bears',           'BAY',  3,  'West', false),
('Auburn',             'Tigers',          'AUB',  4,  'West', false),
('Iowa State',         'Cyclones',        'ISU',  5,  'West', false),
('TCU',                'Horned Frogs',    'TCU',  6,  'West', false),
('Michigan State',     'Spartans',        'MSU',  7,  'West', false),
('Arkansas',           'Razorbacks',      'ARK',  8,  'West', false),
('VCU',                'Rams',            'VCU',  9,  'West', false),
('Penn State',         'Nittany Lions',   'PSU',  10, 'West', false),
('Providence',         'Friars',          'PROV', 11, 'West', false),
('Oral Roberts',       'Golden Eagles',   'ORU',  12, 'West', false),
('Iona',               'Gaels',           'IONA', 13, 'West', false),
('UC Santa Barbara',   'Gauchos',         'UCSB', 14, 'West', false),
('Princeton',          'Tigers',          'PRIN', 15, 'West', false),
('Fairleigh Dickinson','Knights',         'FDU',  16, 'West', false);

-- SOUTH region
INSERT INTO teams (name, mascot, abbreviation, seed, region, is_eliminated) VALUES
('Kansas',           'Jayhawks',       'KU',   1,  'South', false),
('Kentucky',         'Wildcats',       'UK',   2,  'South', false),
('Houston',          'Cougars',        'HOU',  3,  'South', false),
('Tennessee',        'Volunteers',     'TENN', 4,  'South', false),
('Miami',            'Hurricanes',     'MIA',  5,  'South', false),
('Indiana',          'Hoosiers',       'IND',  6,  'South', false),
('Texas A&M',        'Aggies',         'TAMU', 7,  'South', false),
('Iowa',             'Hawkeyes',       'IOWA', 8,  'South', false),
('West Virginia',    'Mountaineers',   'WVU',  9,  'South', false),
('Utah State',       'Aggies',         'USU',  10, 'South', false),
('Pittsburgh',       'Panthers',       'PITT', 11, 'South', false),
('Charleston',       'Cougars',        'COFC', 12, 'South', false),
('Furman',           'Paladins',       'FUR',  13, 'South', false),
('Montana State',    'Bobcats',        'MTST', 14, 'South', false),
('Kennesaw State',   'Owls',           'KSU',  15, 'South', false),
('Northern Kentucky','Norse',          'NKU',  16, 'South', false);

-- MIDWEST region
INSERT INTO teams (name, mascot, abbreviation, seed, region, is_eliminated) VALUES
('Gonzaga',          'Bulldogs',       'GONZ', 1,  'Midwest', false),
('UCLA',             'Bruins',         'UCLA', 2,  'Midwest', false),
('Xavier',           'Musketeers',     'XAV',  3,  'Midwest', false),
('UConn',            'Huskies',        'UCON', 4,  'Midwest', false),
('Saint Marys',      'Gaels',          'SMC',  5,  'Midwest', false),
('Texas Tech',       'Red Raiders',    'TTU',  6,  'Midwest', false),
('Northwestern',     'Wildcats',       'NW',   7,  'Midwest', false),
('Maryland',         'Terrapins',      'UMD',  8,  'Midwest', false),
('Florida State',    'Seminoles',      'FSU',  9,  'Midwest', false),
('Nevada',           'Wolf Pack',      'NEV',  10, 'Midwest', false),
('USC',              'Trojans',        'USC',  11, 'Midwest', false),
('Oregon',           'Ducks',          'ORE',  12, 'Midwest', false),
('Kent State',       'Golden Flashes', 'KENT', 13, 'Midwest', false),
('Wright State',     'Raiders',        'WRST', 14, 'Midwest', false),
('Grambling State',  'Tigers',         'GRAM', 15, 'Midwest', false),
('Texas Southern',   'Tigers',         'TXSO', 16, 'Midwest', false);

-- ============================================================
-- ROUND 1 DAY 1 GAMES — East + South (16 games)
-- Matchups: 1v16, 2v15, 3v14, 4v13, 5v12, 6v11, 7v10, 8v9
-- Game times staggered: 12pm, 2pm, 4:30pm, 7pm MT
-- ============================================================

-- East region games (slot order: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15)
INSERT INTO games (round_id, team1_id, team2_id, game_datetime, status, tournament_round, matchup_code, bracket_position) VALUES
((SELECT id FROM rounds WHERE name = 'Round 1 Day 1'),
 (SELECT id FROM teams WHERE abbreviation = 'DUKE'),
 (SELECT id FROM teams WHERE abbreviation = 'NORF'),
 '2026-02-07 12:00:00-07', 'scheduled', 'R64', 'EAST_R64_1', 0),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 1'),
 (SELECT id FROM teams WHERE abbreviation = 'MEM'),
 (SELECT id FROM teams WHERE abbreviation = 'FAU'),
 '2026-02-07 12:00:00-07', 'scheduled', 'R64', 'EAST_R64_2', 1),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 1'),
 (SELECT id FROM teams WHERE abbreviation = 'SDSU'),
 (SELECT id FROM teams WHERE abbreviation = 'RICH'),
 '2026-02-07 14:00:00-07', 'scheduled', 'R64', 'EAST_R64_3', 2),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 1'),
 (SELECT id FROM teams WHERE abbreviation = 'MARQ'),
 (SELECT id FROM teams WHERE abbreviation = 'UVM'),
 '2026-02-07 14:00:00-07', 'scheduled', 'R64', 'EAST_R64_4', 3),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 1'),
 (SELECT id FROM teams WHERE abbreviation = 'CREI'),
 (SELECT id FROM teams WHERE abbreviation = 'DRKE'),
 '2026-02-07 16:30:00-07', 'scheduled', 'R64', 'EAST_R64_5', 4),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 1'),
 (SELECT id FROM teams WHERE abbreviation = 'PUR'),
 (SELECT id FROM teams WHERE abbreviation = 'COLG'),
 '2026-02-07 16:30:00-07', 'scheduled', 'R64', 'EAST_R64_6', 5),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 1'),
 (SELECT id FROM teams WHERE abbreviation = 'MIZZ'),
 (SELECT id FROM teams WHERE abbreviation = 'DAV'),
 '2026-02-07 19:00:00-07', 'scheduled', 'R64', 'EAST_R64_7', 6),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 1'),
 (SELECT id FROM teams WHERE abbreviation = 'NOVA'),
 (SELECT id FROM teams WHERE abbreviation = 'SPU'),
 '2026-02-07 19:00:00-07', 'scheduled', 'R64', 'EAST_R64_8', 7);

-- South region games (slot order: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15)
INSERT INTO games (round_id, team1_id, team2_id, game_datetime, status, tournament_round, matchup_code, bracket_position) VALUES
((SELECT id FROM rounds WHERE name = 'Round 1 Day 1'),
 (SELECT id FROM teams WHERE abbreviation = 'KU'),
 (SELECT id FROM teams WHERE abbreviation = 'NKU'),
 '2026-02-07 12:30:00-07', 'scheduled', 'R64', 'SOUTH_R64_1', 0),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 1'),
 (SELECT id FROM teams WHERE abbreviation = 'IOWA'),
 (SELECT id FROM teams WHERE abbreviation = 'WVU'),
 '2026-02-07 12:30:00-07', 'scheduled', 'R64', 'SOUTH_R64_2', 1),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 1'),
 (SELECT id FROM teams WHERE abbreviation = 'MIA'),
 (SELECT id FROM teams WHERE abbreviation = 'COFC'),
 '2026-02-07 14:30:00-07', 'scheduled', 'R64', 'SOUTH_R64_3', 2),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 1'),
 (SELECT id FROM teams WHERE abbreviation = 'TENN'),
 (SELECT id FROM teams WHERE abbreviation = 'FUR'),
 '2026-02-07 14:30:00-07', 'scheduled', 'R64', 'SOUTH_R64_4', 3),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 1'),
 (SELECT id FROM teams WHERE abbreviation = 'IND'),
 (SELECT id FROM teams WHERE abbreviation = 'PITT'),
 '2026-02-07 17:00:00-07', 'scheduled', 'R64', 'SOUTH_R64_5', 4),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 1'),
 (SELECT id FROM teams WHERE abbreviation = 'HOU'),
 (SELECT id FROM teams WHERE abbreviation = 'MTST'),
 '2026-02-07 17:00:00-07', 'scheduled', 'R64', 'SOUTH_R64_6', 5),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 1'),
 (SELECT id FROM teams WHERE abbreviation = 'TAMU'),
 (SELECT id FROM teams WHERE abbreviation = 'USU'),
 '2026-02-07 19:30:00-07', 'scheduled', 'R64', 'SOUTH_R64_7', 6),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 1'),
 (SELECT id FROM teams WHERE abbreviation = 'UK'),
 (SELECT id FROM teams WHERE abbreviation = 'KSU'),
 '2026-02-07 19:30:00-07', 'scheduled', 'R64', 'SOUTH_R64_8', 7);

-- ============================================================
-- ROUND 1 DAY 2 GAMES — West + Midwest (16 games)
-- ============================================================

-- West region games (slot order: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15)
INSERT INTO games (round_id, team1_id, team2_id, game_datetime, status, tournament_round, matchup_code, bracket_position) VALUES
((SELECT id FROM rounds WHERE name = 'Round 1 Day 2'),
 (SELECT id FROM teams WHERE abbreviation = 'UNC'),
 (SELECT id FROM teams WHERE abbreviation = 'FDU'),
 '2026-02-08 12:00:00-07', 'scheduled', 'R64', 'WEST_R64_1', 0),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 2'),
 (SELECT id FROM teams WHERE abbreviation = 'ARK'),
 (SELECT id FROM teams WHERE abbreviation = 'VCU'),
 '2026-02-08 12:00:00-07', 'scheduled', 'R64', 'WEST_R64_2', 1),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 2'),
 (SELECT id FROM teams WHERE abbreviation = 'ISU'),
 (SELECT id FROM teams WHERE abbreviation = 'ORU'),
 '2026-02-08 14:00:00-07', 'scheduled', 'R64', 'WEST_R64_3', 2),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 2'),
 (SELECT id FROM teams WHERE abbreviation = 'AUB'),
 (SELECT id FROM teams WHERE abbreviation = 'IONA'),
 '2026-02-08 14:00:00-07', 'scheduled', 'R64', 'WEST_R64_4', 3),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 2'),
 (SELECT id FROM teams WHERE abbreviation = 'TCU'),
 (SELECT id FROM teams WHERE abbreviation = 'PROV'),
 '2026-02-08 16:30:00-07', 'scheduled', 'R64', 'WEST_R64_5', 4),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 2'),
 (SELECT id FROM teams WHERE abbreviation = 'BAY'),
 (SELECT id FROM teams WHERE abbreviation = 'UCSB'),
 '2026-02-08 16:30:00-07', 'scheduled', 'R64', 'WEST_R64_6', 5),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 2'),
 (SELECT id FROM teams WHERE abbreviation = 'MSU'),
 (SELECT id FROM teams WHERE abbreviation = 'PSU'),
 '2026-02-08 19:00:00-07', 'scheduled', 'R64', 'WEST_R64_7', 6),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 2'),
 (SELECT id FROM teams WHERE abbreviation = 'ARIZ'),
 (SELECT id FROM teams WHERE abbreviation = 'PRIN'),
 '2026-02-08 19:00:00-07', 'scheduled', 'R64', 'WEST_R64_8', 7);

-- Midwest region games (slot order: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15)
INSERT INTO games (round_id, team1_id, team2_id, game_datetime, status, tournament_round, matchup_code, bracket_position) VALUES
((SELECT id FROM rounds WHERE name = 'Round 1 Day 2'),
 (SELECT id FROM teams WHERE abbreviation = 'GONZ'),
 (SELECT id FROM teams WHERE abbreviation = 'TXSO'),
 '2026-02-08 12:30:00-07', 'scheduled', 'R64', 'MIDWEST_R64_1', 0),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 2'),
 (SELECT id FROM teams WHERE abbreviation = 'UMD'),
 (SELECT id FROM teams WHERE abbreviation = 'FSU'),
 '2026-02-08 12:30:00-07', 'scheduled', 'R64', 'MIDWEST_R64_2', 1),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 2'),
 (SELECT id FROM teams WHERE abbreviation = 'SMC'),
 (SELECT id FROM teams WHERE abbreviation = 'ORE'),
 '2026-02-08 14:30:00-07', 'scheduled', 'R64', 'MIDWEST_R64_3', 2),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 2'),
 (SELECT id FROM teams WHERE abbreviation = 'UCON'),
 (SELECT id FROM teams WHERE abbreviation = 'KENT'),
 '2026-02-08 14:30:00-07', 'scheduled', 'R64', 'MIDWEST_R64_4', 3),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 2'),
 (SELECT id FROM teams WHERE abbreviation = 'TTU'),
 (SELECT id FROM teams WHERE abbreviation = 'USC'),
 '2026-02-08 17:00:00-07', 'scheduled', 'R64', 'MIDWEST_R64_5', 4),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 2'),
 (SELECT id FROM teams WHERE abbreviation = 'XAV'),
 (SELECT id FROM teams WHERE abbreviation = 'WRST'),
 '2026-02-08 17:00:00-07', 'scheduled', 'R64', 'MIDWEST_R64_6', 5),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 2'),
 (SELECT id FROM teams WHERE abbreviation = 'NW'),
 (SELECT id FROM teams WHERE abbreviation = 'NEV'),
 '2026-02-08 19:30:00-07', 'scheduled', 'R64', 'MIDWEST_R64_7', 6),

((SELECT id FROM rounds WHERE name = 'Round 1 Day 2'),
 (SELECT id FROM teams WHERE abbreviation = 'UCLA'),
 (SELECT id FROM teams WHERE abbreviation = 'GRAM'),
 '2026-02-08 19:30:00-07', 'scheduled', 'R64', 'MIDWEST_R64_8', 7);

-- ============================================================
-- TEST POOL
-- Creates a pool owned by the first registered user.
-- Sign up in the app FIRST, then run this section.
-- ============================================================
DO $$
DECLARE
  v_user_id uuid;
  v_pool_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No users found — sign up in the app first, then re-run this block.';
    RETURN;
  END IF;

  INSERT INTO pools (name, join_code, creator_id, entry_fee, prize_pool, max_players, is_private, tournament_year, status)
  VALUES ('Dillon''s Test Pool', 'TEST2026', v_user_id, 10.00, 100.00, 20, false, 2026, 'active')
  RETURNING id INTO v_pool_id;

  -- Add the creator as a pool player
  INSERT INTO pool_players (pool_id, user_id, display_name, is_eliminated)
  VALUES (v_pool_id, v_user_id, 'Dillon', false);

  RAISE NOTICE 'Pool created! Join code: TEST2026, Pool ID: %', v_pool_id;
END $$;

-- ============================================================
-- GENERATE BRACKET (run after seed data is loaded)
-- ============================================================
-- After running this seed.sql, call the admin API to generate
-- the remaining 31 shell games (R32 through Championship):
--
-- POST /api/admin/generate-bracket
--
-- This creates shell games with NULL teams and wires all
-- advances_to_game_id + advances_to_slot FKs.

-- ============================================================
-- VERIFICATION QUERIES (run these to confirm data loaded)
-- ============================================================
-- SELECT count(*) as team_count FROM teams;          -- should be 64
-- SELECT count(*) as game_count FROM games;          -- should be 32 (before generate-bracket)
-- SELECT count(*) as round_count FROM rounds;        -- should be 8
-- SELECT * FROM rounds WHERE is_active = true;       -- Round 1 Day 1
-- SELECT * FROM pools;                               -- Dillon's Test Pool
--
-- After generate-bracket:
-- SELECT count(*) FROM games;                                          -- should be 63
-- SELECT count(*) FROM games WHERE matchup_code IS NOT NULL;           -- should be 63
-- SELECT count(*) FROM games WHERE advances_to_game_id IS NOT NULL;    -- should be 62
-- SELECT count(*) FROM games WHERE tournament_round = 'R64' AND team1_id IS NOT NULL; -- 32
-- SELECT count(*) FROM games WHERE tournament_round != 'R64' AND team1_id IS NULL;    -- 31

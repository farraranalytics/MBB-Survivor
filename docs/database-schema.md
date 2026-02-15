# Database Schema — "Survive the Dance"

> Generated from live Supabase database on Feb 14, 2026
> Includes base schema + migrations 001–004 + production hotfixes

---

## Table of Contents

1. [ER Diagram](#er-diagram)
2. [Tables & Columns](#tables--columns)
3. [RLS Policies](#rls-policies)
4. [Functions](#functions)
5. [Triggers](#triggers)
6. [Constraints](#constraints)
7. [Indexes](#indexes)
8. [Known Issues & Notes](#known-issues--notes)

---

## ER Diagram

```
┌──────────────────┐
│   auth.users     │  (Supabase built-in)
│──────────────────│
│  id              │◄──────────────────────────────────────────────┐
│  email           │◄───────────────────────┐                     │
│  user_metadata   │                        │                     │
└──────────────────┘                        │                     │
        │ trigger: handle_new_user()        │                     │
        ▼                                   │                     │
┌──────────────────┐                ┌───────┴──────────┐          │
│  user_profiles   │                │      pools       │          │
│──────────────────│                │──────────────────│          │
│  id (FK users)   │                │  id              │          │
│  display_name    │                │  name            │          │
│  avatar_url      │                │  join_code (UQ)  │          │
│  timezone        │                │  creator_id (FK)─┘          │
│  notification_   │                │  entry_fee                  │
│    preferences   │                │  prize_pool                 │
└──────────────────┘                │  max_entries_per_user       │
                                    │  notes                      │
                                    │  status                     │
                                    │  winner_id (FK users)───────┘
                                    └──────────┬───────┘
                                               │ 1:many
                                               ▼
┌──────────────────┐                ┌───────────────────────┐
│     rounds       │                │    pool_players       │
│──────────────────│                │───────────────────────│
│  id              │◄───────┐       │  id                   │
│  name            │        │       │  pool_id (FK pools)───┘
│  date            │        │       │  user_id (FK users)
│  deadline_       │        │       │  display_name
│    datetime      │        │       │  entry_number
│  is_active       │        │       │  entry_label
└────────┬─────────┘        │       │  is_eliminated
         │ 1:many           │       │  elimination_round_id (FK)──┐
         ▼                  │       │  elimination_reason          │
┌──────────────────────┐    │       │  entry_deleted (soft del)    │
│     games            │    │       │  deleted_at                  │
│──────────────────────│    │       └──────────┬───────────────────┘
│  id                  │    │                  │ 1:many
│  round_id (FK)───────┘    │                  ▼
│  team1_id (FK)────┐       │       ┌──────────────────┐
│  team2_id (FK)────┤       │       │     picks        │
│  game_datetime    │       │       │──────────────────│
│  winner_id (FK)───┤       │       │  id              │
│  team1/2_score    │       │       │  pool_player_id──┘
│  status           │       │       │  round_id (FK)───┘
│  espn_game_id     │       │       │  team_id (FK)────┐
│  bracket_position │       │       │  is_correct      │
│  tournament_round │       │       │  submitted_at    │
│  parent_game_a/b  │       │       └──────────────────┘
│  odds columns     │       │       UQ(pool_player_id, round_id)
└──────────────────────┘    │       UQ(pool_player_id, team_id)
                            │
┌──────────────────┐        │       ┌───────────────────────────┐
│     teams        │        │       │  admin_test_state         │
│──────────────────│        │       │  (singleton)              │
│  id              │◄───────┘       │───────────────────────────│
│  name            │                │  is_test_mode             │
│  seed / region   │                │  simulated_datetime       │
│  logo_url        │                │  target_round_id (FK)     │
│  is_eliminated   │                │  phase                    │
│  espn_team_id    │                └───────────────────────────┘
└──────────────────┘
                            ┌───────────────────────────┐
┌──────────────────┐        │  region_sweet16_schedule   │
│  team_records    │        │───────────────────────────│
│──────────────────│        │  region / sweet16_day      │
│  team_id (FK)    │        │  sweet16_date / e8_date    │
│  wins / losses   │        │  venue                     │
│  conference      │        └───────────────────────────┘
│  kenpom / net    │
└──────────────────┘        ┌───────────────────────────┐
                            │  round_day_mapping         │
                            │───────────────────────────│
                            │  source_round / source_day │
                            │  target_round / target_day │
                            │  is_deterministic          │
                            └───────────────────────────┘
```

---

## Tables & Columns

### `rounds` — Tournament days

Each row = one day of games (e.g. "Round 1 Day 1", "Sweet 16 Day 2").

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| name | varchar(50) | NO | — | e.g. "Round 1 Day 1", "Sweet 16 Day 1" |
| date | date | NO | — | Calendar date of games |
| deadline_datetime | timestamptz | NO | — | Pick cutoff (typically first game - 5 min) |
| is_active | boolean | YES | false | Only one round active at a time |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | Auto-set by trigger |

### `teams` — 64 tournament teams

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| name | varchar(100) | NO | — | e.g. "Duke" |
| mascot | varchar(100) | YES | — | e.g. "Blue Devils" |
| abbreviation | varchar(10) | YES | — | e.g. "DUKE" |
| seed | integer | YES | — | 1–16 |
| region | varchar(20) | YES | — | East, West, South, Midwest |
| logo_url | text | YES | — | ESPN logo URL |
| is_eliminated | boolean | YES | false | Set true when team loses |
| espn_team_id | integer | YES | — | ESPN API identifier |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | Auto-set by trigger |

### `games` — Individual matchups

Status lifecycle: `scheduled` → `in_progress` → `final`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| round_id | uuid | YES | — | FK → rounds |
| team1_id | uuid | YES | — | FK → teams (higher seed) |
| team2_id | uuid | YES | — | FK → teams (lower seed) |
| game_datetime | timestamptz | NO | — | Tip-off time |
| winner_id | uuid | YES | — | FK → teams, set when final |
| team1_score | integer | YES | — | |
| team2_score | integer | YES | — | |
| status | varchar(20) | YES | 'scheduled' | scheduled / in_progress / final |
| espn_game_id | varchar(50) | YES | — | ESPN API game identifier |
| bracket_position | integer | YES | — | Position within round+region (cascade-created games) |
| tournament_round | varchar(10) | YES | — | R64/R32/S16/E8/F4/CHIP (cascade-created) |
| parent_game_a_id | uuid | YES | — | FK → games (self-ref, feeder game for team1) |
| parent_game_b_id | uuid | YES | — | FK → games (self-ref, feeder game for team2) |
| future_game_id | uuid | YES | — | FK → games (self-ref, legacy) |
| team1_moneyline | integer | YES | — | Odds API |
| team2_moneyline | integer | YES | — | Odds API |
| team1_spread | numeric(4,1) | YES | — | Odds API |
| team1_win_probability | numeric(4,3) | YES | — | Odds API |
| team2_win_probability | numeric(4,3) | YES | — | Odds API |
| odds_updated_at | timestamptz | YES | — | Last odds sync |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | Auto-set by trigger |

### `pools` — Survivor pool instances

Status lifecycle: `open` → `active` → `complete`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| name | varchar(100) | NO | — | Pool display name |
| join_code | varchar(10) | NO | — | Auto-generated 8-char code (trigger) |
| creator_id | uuid | YES | — | FK → auth.users |
| entry_fee | numeric | YES | 0.00 | Buy-in amount |
| prize_pool | numeric | YES | 0.00 | Total pot |
| max_players | integer | YES | — | null = unlimited |
| max_entries_per_user | integer | NO | 1 | 1–10 (CHECK constraint) |
| is_private | boolean | YES | true | If false, visible to non-members |
| tournament_year | integer | NO | 2026 | |
| status | varchar(20) | YES | 'open' | open / active / complete |
| notes | text | YES | — | Admin notes |
| winner_id | uuid | YES | — | FK → auth.users, set when pool completes |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | Auto-set by trigger |

### `pool_players` — Entries in a pool

Links a user to a pool. Supports multi-entry. Tracks elimination and soft-delete state.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| pool_id | uuid | YES | — | FK → pools |
| user_id | uuid | YES | — | FK → auth.users |
| display_name | varchar(50) | NO | — | Denormalized from user |
| entry_number | integer | NO | 1 | 1-based per user per pool |
| entry_label | varchar(60) | YES | — | Custom name for entry |
| is_eliminated | boolean | YES | false | |
| elimination_round_id | uuid | YES | — | FK → rounds |
| elimination_reason | varchar(50) | YES | — | wrong_pick / missed_pick / manual |
| entry_deleted | boolean | NO | false | Soft-delete flag (Mig 004) |
| deleted_at | timestamptz | YES | — | When soft-deleted |
| joined_at | timestamptz | YES | now() | |

### `picks` — Daily team selections

One pick per entry per round. Can't reuse a team across rounds.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| pool_player_id | uuid | YES | — | FK → pool_players |
| round_id | uuid | YES | — | FK → rounds |
| team_id | uuid | YES | — | FK → teams |
| confidence | integer | YES | — | Not currently used |
| is_correct | boolean | YES | — | null=pending, true/false after grading |
| submitted_at | timestamptz | YES | now() | |

### `admin_test_state` — Simulated clock (singleton)

Single row. Controls test mode for admin time simulation.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| is_test_mode | boolean | NO | false | Enables simulated time |
| simulated_datetime | timestamptz | YES | — | The "fake now" when test mode on |
| target_round_id | uuid | YES | — | FK → rounds, which round is being tested |
| phase | varchar(20) | YES | 'pre_round' | pre_round / live / post_round |
| updated_by | uuid | YES | — | FK → auth.users |
| updated_at | timestamptz | YES | now() | |

### `user_profiles` — Extended user data

Auto-created via DB trigger on signup.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | — | PK, FK → auth.users |
| display_name | varchar(50) | YES | — | |
| avatar_url | text | YES | — | |
| timezone | varchar(50) | YES | 'America/New_York' | |
| notification_preferences | jsonb | YES | {"push":false,"email":true} | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | Auto-set by trigger |

### `team_records` — Season stats per team

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| team_id | uuid | NO | — | FK → teams |
| wins | integer | NO | 0 | |
| losses | integer | NO | 0 | |
| conference | text | YES | — | e.g. "Big 12" |
| kenpom_rank | integer | YES | — | |
| net_rank | integer | YES | — | |
| tournament_year | integer | NO | 2026 | |
| updated_at | timestamptz | YES | now() | |

**Unique:** (team_id, tournament_year)

### `region_sweet16_schedule` — Which regions play on which S16/E8 days

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| tournament_year | integer | NO | 2026 | |
| region | varchar(20) | NO | — | East/West/South/Midwest |
| sweet16_day | varchar(10) | NO | — | Day1 / Day2 |
| sweet16_date | date | YES | — | |
| elite8_date | date | YES | — | |
| venue | varchar(100) | YES | — | |

**Unique:** (tournament_year, region)

### `round_day_mapping` — How days feed into next round

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| tournament_year | integer | NO | 2026 | |
| source_round | varchar(20) | NO | — | e.g. "R64" |
| source_day | varchar(10) | NO | — | e.g. "Day1" |
| target_round | varchar(20) | NO | — | e.g. "R32" |
| target_day | varchar(10) | NO | — | e.g. "Day1" |
| is_deterministic | boolean | NO | true | |

**Unique:** (tournament_year, source_round, source_day, target_round)

### `notifications` — Not yet implemented

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| user_id | uuid | YES | — | FK → auth.users |
| pool_id | uuid | YES | — | FK → pools |
| type | varchar(50) | NO | — | |
| title | varchar(200) | NO | — | |
| message | text | NO | — | |
| is_read | boolean | YES | false | |
| sent_at | timestamptz | YES | now() | |

---

## RLS Policies

### `rounds`, `teams`, `games` — Public reference data
| Command | Policy | Rule |
|---------|--------|------|
| SELECT | Everyone can view | `true` (public read) |

### `region_sweet16_schedule`, `round_day_mapping` — Public reference data
| Command | Policy | Rule |
|---------|--------|------|
| SELECT | Everyone can view | `true` (public read) |

### `pools`
| Command | Policy | Rule |
|---------|--------|------|
| SELECT | Viewable by creator, members, or public | `auth.uid() = creator_id OR NOT is_private OR auth.uid() IN (pool member subquery)` |
| INSERT | Users can create pools | `auth.uid() = creator_id` |
| UPDATE | Pool creators can update | `auth.uid() = creator_id` |

### `pool_players`
| Command | Policy | Rule |
|---------|--------|------|
| SELECT | Visible to pool members | `entry_deleted = false AND pool_id IN get_user_pool_ids(auth.uid())` — hides soft-deleted entries, uses SECURITY DEFINER function to avoid recursion |
| INSERT | Users can join pools | `auth.uid() = user_id` |
| UPDATE | Users can soft-delete own entries | `auth.uid() = user_id` (USING + WITH CHECK) |
| UPDATE | Pool creators can soft-delete members | `auth.uid() IN (pool creator subquery)` (USING + WITH CHECK) |
| UPDATE | Users can update own pool_players | `user_id = auth.uid()` |
| DELETE | Users can leave pools | `auth.uid() = user_id` |
| DELETE | Pool creators can remove members | `auth.uid() IN (pool creator subquery)` |
| DELETE | Users/creators can delete entries | Creator can delete any; user can delete own if pool status = 'open' |

### `picks`
| Command | Policy | Rule |
|---------|--------|------|
| SELECT | Visible after deadline | Own picks: always visible. Others' picks: visible when `deadline_datetime < effective_now()` |
| INSERT | Users can submit own picks | `auth.uid()` owns the pool_player AND `deadline_datetime > effective_now()` |
| DELETE | Users can delete before deadline | `auth.uid()` owns the pool_player AND `deadline_datetime > now()` ⚠️ uses `now()` not `effective_now()` |

### `admin_test_state`
| Command | Policy | Rule |
|---------|--------|------|
| SELECT | Authenticated can read | `true` (authenticated role only) |
| UPDATE | Admins can update | `true` (authenticated role only) |

### `user_profiles`
| Command | Policy | Rule |
|---------|--------|------|
| ALL | Own profile | `auth.uid() = id` |
| SELECT | Pool members can see each other | `auth.uid()` is in a shared pool with the profile owner |

### `team_records`
| Command | Policy | Rule |
|---------|--------|------|
| SELECT | Anyone can view | `true` |
| ALL | Authenticated can manage | `auth.role() = 'authenticated'` |

### `notifications`
| Command | Policy | Rule |
|---------|--------|------|
| SELECT | Own only | `auth.uid() = user_id` |
| UPDATE | Own only | `auth.uid() = user_id` |

---

## Functions

### `effective_now()` → timestamptz
**SECURITY DEFINER** | Stable

Returns `simulated_datetime` from `admin_test_state` when test mode is on, otherwise `NOW()`. Used by RLS policies and triggers to support simulated clock in admin test mode.

### `get_user_pool_ids(uid uuid)` → SETOF uuid
**SECURITY DEFINER** | Stable

Returns all pool_ids where the user is a non-deleted member. Used by the `pool_players` SELECT policy to avoid infinite RLS recursion (the policy on pool_players can't reference pool_players in a subquery without recursion — this SECURITY DEFINER function bypasses RLS internally).

### `soft_delete_pool_player(player_id uuid)` → void
**SECURITY DEFINER** | Volatile

Sets `entry_deleted = true` and `deleted_at = now()` on a pool_player. Performs internal authorization check (must be entry owner or pool creator). Bypasses RLS to avoid infinite recursion on UPDATE. Called from `src/lib/admin.ts` via `supabase.rpc()`.

### `is_pool_member(p_pool_id uuid)` → boolean
**SECURITY DEFINER** | Volatile

Checks if current `auth.uid()` is a member of the given pool.

### `tournament_has_started()` → boolean
**SECURITY DEFINER** | Stable

Returns true if any game is not 'scheduled' OR any round deadline has passed (using `effective_now()`). Used by triggers to block pool creation/joining after tournament starts.

### `generate_join_code()` → text
Generates random 8-character alphanumeric join code for pools.

### `set_join_code()` → trigger
Calls `generate_join_code()` on pool INSERT to auto-populate `join_code`.

### `handle_new_user()` → trigger
**SECURITY DEFINER**

Auto-creates a `user_profiles` row when a new `auth.users` row is created.

### `enforce_pick_deadline()` → trigger
Blocks pick INSERT/UPDATE if `deadline_datetime < effective_now()`. Uses simulated clock.

### `enforce_max_entries_per_user()` → trigger
Blocks pool_player INSERT if user already has `max_entries_per_user` active (non-deleted) entries in that pool.

### `enforce_pre_tournament_pool_creation()` → trigger
Blocks pool INSERT if `tournament_has_started()` returns true.

### `enforce_pre_tournament_join()` → trigger
Blocks pool_player INSERT if `tournament_has_started()` returns true.

### `update_updated_at_column()` → trigger
Sets `updated_at = NOW()` on any UPDATE. Applied to: rounds, teams, games, pools, user_profiles.

### `get_round_date_for_region(region, target_round, year)` → date
Returns the scheduled date for a region's game in a given round, using `region_sweet16_schedule`.

### `predict_game_day(game_id, year)` → varchar
Predicts which day (Day1/Day2) a game will fall on based on bracket structure.

---

## Triggers

| Trigger | Table | Event | Timing | Function |
|---------|-------|-------|--------|----------|
| update_games_updated_at | games | UPDATE | BEFORE | update_updated_at_column() |
| picks_deadline_enforcement_trigger | picks | INSERT, UPDATE | BEFORE | enforce_pick_deadline() |
| check_pool_join_timing | pool_players | INSERT | BEFORE | enforce_pre_tournament_join() |
| pool_players_enforce_max_entries | pool_players | INSERT | BEFORE | enforce_max_entries_per_user() |
| check_pool_creation_timing | pools | INSERT | BEFORE | enforce_pre_tournament_pool_creation() |
| pools_set_join_code_trigger | pools | INSERT | BEFORE | set_join_code() |
| update_pools_updated_at | pools | UPDATE | BEFORE | update_updated_at_column() |
| update_rounds_updated_at | rounds | UPDATE | BEFORE | update_updated_at_column() |
| update_teams_updated_at | teams | UPDATE | BEFORE | update_updated_at_column() |
| update_user_profiles_updated_at | user_profiles | UPDATE | BEFORE | update_updated_at_column() |

---

## Constraints

### Primary Keys
Every table has a uuid PK named `{table}_pkey`.

### Foreign Keys
| Table | Column | References |
|-------|--------|------------|
| admin_test_state | target_round_id | rounds.id |
| admin_test_state | updated_by | auth.users.id |
| games | round_id | rounds.id |
| games | team1_id | teams.id |
| games | team2_id | teams.id |
| games | winner_id | teams.id |
| games | future_game_id | games.id (self) |
| games | parent_game_a_id | games.id (self) |
| games | parent_game_b_id | games.id (self) |
| notifications | user_id | auth.users.id |
| notifications | pool_id | pools.id |
| picks | pool_player_id | pool_players.id |
| picks | round_id | rounds.id |
| picks | team_id | teams.id |
| pool_players | pool_id | pools.id |
| pool_players | user_id | auth.users.id |
| pool_players | elimination_round_id | rounds.id |
| pools | creator_id | auth.users.id |
| pools | winner_id | auth.users.id |
| team_records | team_id | teams.id |
| user_profiles | id | auth.users.id |

### Unique Constraints
| Table | Columns | Notes |
|-------|---------|-------|
| picks | (pool_player_id, round_id) | One pick per entry per round |
| picks | (pool_player_id, team_id) | Can't reuse a team |
| pools | (join_code) | Unique invite codes |
| pool_players | (pool_id, user_id, entry_number) WHERE entry_deleted=false | Partial unique — active entries only |
| region_sweet16_schedule | (tournament_year, region) | One schedule per region per year |
| round_day_mapping | (tournament_year, source_round, source_day, target_round) | |
| team_records | (team_id, tournament_year) | One record per team per year |

### Check Constraints
| Table | Constraint | Rule |
|-------|-----------|------|
| pools | check_max_entries | max_entries_per_user BETWEEN 1 AND 10 |

---

## Indexes

### games
| Index | Type | Columns |
|-------|------|---------|
| games_pkey | UNIQUE | (id) |
| idx_games_round_id | btree | (round_id) |
| idx_games_datetime | btree | (game_datetime) |
| idx_games_bracket_position | btree | (bracket_position) |
| idx_games_tournament_round | btree | (tournament_round) |
| idx_games_future_game_id | btree | (future_game_id) |

### picks
| Index | Type | Columns |
|-------|------|---------|
| picks_pkey | UNIQUE | (id) |
| picks_pool_player_id_round_id_key | UNIQUE | (pool_player_id, round_id) |
| picks_pool_player_id_team_id_key | UNIQUE | (pool_player_id, team_id) |
| idx_picks_pool_player_id | btree | (pool_player_id) |
| idx_picks_round_id | btree | (round_id) |

### pool_players
| Index | Type | Columns |
|-------|------|---------|
| pool_players_pkey | UNIQUE | (id) |
| pool_players_pool_user_entry_active | UNIQUE (partial) | (pool_id, user_id, entry_number) WHERE entry_deleted = false |
| idx_pool_players_active | btree (partial) | (pool_id, user_id) WHERE entry_deleted = false |
| idx_pool_players_pool_id | btree | (pool_id) |
| idx_pool_players_user_id | btree | (user_id) |

### pools
| Index | Type | Columns |
|-------|------|---------|
| pools_pkey | UNIQUE | (id) |
| pools_join_code_key | UNIQUE | (join_code) |
| idx_pools_join_code | btree | (join_code) |

### rounds
| Index | Type | Columns |
|-------|------|---------|
| rounds_pkey | UNIQUE | (id) |
| idx_rounds_date | btree | (date) |

### team_records
| Index | Type | Columns |
|-------|------|---------|
| team_records_pkey | UNIQUE | (id) |
| team_records_team_id_tournament_year_key | UNIQUE | (team_id, tournament_year) |
| idx_team_records_team_id | btree | (team_id) |
| idx_team_records_year | btree | (tournament_year) |

### Other tables
teams, user_profiles, notifications, admin_test_state, region_sweet16_schedule, round_day_mapping — PK index only.

---

## Notes (from live data)

### Picks DELETE policy uses `now()` not `effective_now()`
The DELETE policy on picks uses raw `now()` while the INSERT policy uses `effective_now()`. Visible in the policies query — the SELECT and INSERT policies reference `effective_now()` but the DELETE policy does not.

### picks_deadline_enforcement_trigger fires on both INSERT and UPDATE
Visible in the triggers query — the trigger is registered for both INSERT and UPDATE events on the picks table.

### pool_players has 3 overlapping DELETE policies
Visible in the policies query. Three separate DELETE policies exist: "Users can leave pools", "Pool creators can remove members", and "Users can delete own entries or pool creator can delete any". The third covers both of the other two.

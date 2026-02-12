# Database Schema — "Survive the Dance"

## ER Diagram

```
┌──────────────────┐
│   auth.users     │  (Supabase built-in)
│──────────────────│
│  id              │◄─────────────────────────────────────────┐
│  email           │◄──────────────────────┐                  │
│  user_metadata   │                       │                  │
└──────────────────┘                       │                  │
        │ trigger: handle_new_user()       │                  │
        ▼                                  │                  │
┌──────────────────┐               ┌───────┴──────────┐      │
│  user_profiles   │               │      pools       │      │
│──────────────────│               │──────────────────│      │
│  id (FK users)   │               │  id              │      │
│  display_name    │               │  name            │      │
│  avatar_url      │               │  join_code (UQ)  │      │
│  timezone        │               │  creator_id (FK)─┘      │
│  notification_   │               │  entry_fee              │
│    preferences   │               │  prize_pool             │
└──────────────────┘               │  max_players            │
                                   │  max_entries_per_user   │
                                   │  is_private             │
                                   │  status                 │
                                   │  winner_id (FK users)───┘
                                   └──────────┬───────┘
                                              │ 1:many
                                              ▼
┌──────────────────┐               ┌──────────────────┐
│     rounds       │               │  pool_players    │
│──────────────────│               │──────────────────│
│  id              │◄──────┐       │  id              │
│  name            │       │       │  pool_id (FK)────┘
│  date            │       │       │  user_id (FK users)
│  deadline_       │       │       │  display_name
│    datetime      │       │       │  entry_number
│  is_active       │       │       │  entry_label
└────────┬─────────┘       │       │  is_eliminated
         │ 1:many          │       │  elimination_round_id (FK)──┐
         ▼                 │       │  elimination_reason         │
┌──────────────────┐       │       └──────────┬───────┘          │
│     games        │       │                  │ 1:many           │
│──────────────────│       │                  ▼                  │
│  id              │       │       ┌──────────────────┐          │
│  round_id (FK)───┘       │       │     picks        │          │
│  team1_id (FK)───┐       │       │──────────────────│          │
│  team2_id (FK)───┤       │       │  id              │          │
│  game_datetime   │       │       │  pool_player_id  │──────────┘
│  winner_id (FK)──┤       │       │  round_id (FK)───┘
│  team1_score     │       │       │  team_id (FK)────┐
│  team2_score     │       │       │  confidence      │
│  status          │       │       │  is_correct      │
│  espn_game_id    │       │       │  submitted_at    │
└──────────────────┘       │       └──────────────────┘
                           │       UQ(pool_player_id, round_id)
┌──────────────────┐       │       UQ(pool_player_id, team_id)
│     teams        │       │
│──────────────────│       │
│  id              │◄──────┘
│  name            │
│  mascot          │
│  abbreviation    │
│  seed            │
│  region          │
│  logo_url        │
│  espn_team_id    │
│  is_eliminated   │
└──────────────────┘

┌──────────────────┐
│  notifications   │  (not yet used in app)
│──────────────────│
│  id              │
│  user_id (FK)    │
│  pool_id (FK)    │
│  type            │
│  title / message │
│  is_read         │
└──────────────────┘
```

## Table-by-Table Usage

### `rounds` — Tournament days

Each row = one day of games (e.g. "Round 1 Day 1", "Sweet 16 Day 1").

| Used in | What for |
|---------|----------|
| `src/lib/status.ts`, `src/lib/status-server.ts` | Find current active round (`is_active = true`) |
| `src/lib/picks.ts` | `getActiveRound()`, `getPickDeadline()` (earliest game - 5 min) |
| `src/lib/bracket.ts` | `getAllRounds()` for bracket columns & planner days |
| `src/lib/standings.ts`, `src/app/api/pools/[id]/standings/route.ts` | Current round context for standings |
| `src/app/pools/[id]/pick/page.tsx` | Fetch all rounds for pick timeline |
| `src/app/pools/[id]/analyze/page.tsx` | Round selector tabs |
| `src/lib/game-processing.ts` | `checkRoundCompletion()` to advance rounds |
| `src/app/api/cron/sync-games/route.ts` | Find active round to sync ESPN data |
| Admin test routes | Reset/advance round state for testing |

### `teams` — 64 tournament teams

Seed, region, name, logo, elimination status.

| Used in | What for |
|---------|----------|
| `src/lib/game-processing.ts` | Mark losing team `is_eliminated = true` |
| `src/lib/analyze.ts` | Team popularity stats, pick distribution |
| `src/lib/standings.ts` | Team info joined via picks |
| `src/app/pools/[id]/analyze/page.tsx` | Team data for matchup cards |
| `src/app/api/cron/process-results/route.ts` | Eliminate losing teams |
| Admin test routes | Un-eliminate teams on round reset |

### `games` — Individual matchups

Each game belongs to a round. Has two teams, a datetime, scores, and status lifecycle: `scheduled` → `in_progress` → `final`.

| Used in | What for |
|---------|----------|
| `src/lib/picks.ts` | `getTodaysGames()`, `getPickDeadline()` (earliest game time) |
| `src/lib/bracket.ts` | `getAllGamesWithTeams()` for bracket display |
| `src/app/api/pools/[id]/standings/route.ts` | All games for standings context |
| `src/components/SplashOverlay.tsx` | Countdown to next game |
| `src/components/TournamentInProgress.tsx` | Live game scores |
| `src/lib/activity.ts` | Recent results for activity feed |
| `src/app/api/cron/sync-games/route.ts` | UPDATE scores/status from ESPN API |
| `src/app/api/cron/process-results/route.ts` | Read final games to grade picks |
| `src/lib/game-processing.ts` | `processCompletedGame()` |
| Admin test routes | Set game status, scores, winners for testing |

### `pools` — Survivor pool instances

Status lifecycle: `open` → `active` → `complete`. Join via 8-char code (auto-generated by trigger).

| Used in | What for |
|---------|----------|
| `src/app/dashboard/page.tsx` | List user's pools, pool cards |
| `src/app/pools/create/page.tsx` | INSERT new pool |
| `src/app/pools/join/page.tsx` | Look up pool by join_code |
| `src/app/pools/[id]/pick/page.tsx` | Check `max_entries_per_user`, `status` |
| `src/app/pools/[id]/settings/page.tsx` | Pool admin settings |
| `src/lib/admin.ts` | Pool management functions |
| `src/lib/settings.ts` | Pool config updates |
| `src/lib/standings.ts` | Pool metadata for standings header |
| `src/lib/game-processing.ts` | `checkRoundCompletion()` → set `status = 'complete'` |
| `src/components/SplashOverlay.tsx` | Pool status for splash screen |
| `src/app/api/cron/activate-rounds/route.ts` | Transition pools `open` → `active` |
| Admin test routes | Reset pool status |

### `pool_players` — Entries in a pool

Links a user to a pool. Supports multi-entry (`entry_number`). Tracks elimination state.

| Used in | What for |
|---------|----------|
| `src/app/dashboard/page.tsx` | List user's entries per pool |
| `src/app/pools/[id]/pick/page.tsx` | Fetch entries for entry switcher, INSERT new entry |
| `src/lib/picks.ts` | `getPoolPlayer()`, check `is_eliminated` |
| `src/lib/standings.ts`, `src/app/api/pools/[id]/standings/route.ts` | All players for standings table |
| `src/app/pools/[id]/analyze/page.tsx` | Entry tabs, active entry |
| `src/app/pools/join/page.tsx` | INSERT on pool join |
| `src/app/pools/create/page.tsx` | INSERT creator as first player |
| `src/components/SplashOverlay.tsx` | Check if user is in a pool |
| `src/lib/activity.ts` | Player names for activity feed |
| `src/lib/analyze.ts` | Pick distribution per player |
| `src/lib/game-processing.ts` | UPDATE `is_eliminated`, `elimination_round_id`, `elimination_reason` |
| `src/lib/admin.ts` | Remove/manage players |
| Admin test routes | Un-eliminate players on reset |

### `picks` — Daily team selections

One pick per entry per round. Can't reuse a team (enforced by unique constraint). `is_correct` graded after games finish.

| Used in | What for |
|---------|----------|
| `src/lib/picks.ts` | `getPlayerPick()`, `getPlayerPicks()`, `getUsedTeams()`, `submitPick()` (INSERT/DELETE) |
| `src/app/pools/[id]/pick/page.tsx` | Check which entries have picked (pick status dots) |
| `src/lib/standings.ts`, `src/app/api/pools/[id]/standings/route.ts` | Pick history, current pick, survival streak |
| `src/app/pools/[id]/analyze/page.tsx` | Pick distribution analysis |
| `src/lib/analyze.ts` | Aggregate pick stats |
| `src/components/SplashOverlay.tsx` | Check if user has picked today |
| `src/lib/game-processing.ts` | Grade picks (`is_correct = true/false`), process missed picks |
| Admin test routes | Clear `is_correct` on reset |

### `user_profiles` — Extended user data

Auto-created via DB trigger when a user signs up. **Not currently queried directly** — `display_name` is read from `auth.users` metadata and denormalized into `pool_players`.

### `notifications` — Deadline reminders, eliminations

**Not yet implemented in app.** Schema is ready for future use.

## Key Constraints & Triggers

| Mechanism | What it does |
|-----------|-------------|
| `UQ(pool_player_id, round_id)` on picks | One pick per entry per round |
| `UQ(pool_player_id, team_id)` on picks | Can't pick same team twice in a tournament |
| `pools_set_join_code_trigger` | Auto-generates 8-char join code on pool INSERT |
| `on_auth_user_created` | Auto-creates `user_profiles` row on signup |
| `picks_deadline_enforcement_trigger` | DB-level block on picks after `rounds.deadline_datetime` |
| `update_*_updated_at` triggers | Auto-sets `updated_at` on UPDATE for rounds, teams, games, pools, user_profiles |

## RLS Summary

| Table | Policy |
|-------|--------|
| rounds, teams, games | Public read for everyone |
| pools | Read if public OR you're a member |
| pool_players | Read if you're in the same pool |
| picks | Own picks always visible; others' picks visible after deadline |
| user_profiles | Own profile full access; pool-mates can read |
| notifications | Own only |

# Task 13: Deadline Automation, Round Management & Game Results Processing

**CRITICAL PRE-LAUNCH TASK** — This must ship before the tournament starts.

This task creates the backend automation that makes the app run without manual intervention:
- Auto-sync game times from ESPN → set pick deadlines (5 min before first game)
- Auto-activate rounds on game days
- Auto-score games from ESPN live data
- Auto-eliminate players who picked wrong or missed picks
- Auto-transition pool status (open → active → complete)

## Files to Read Before Writing Code

Read ALL of these fully:
- `src/lib/espn.ts` — existing ESPN API client (fetchLiveScores, fetchGamesForDate, etc.)
- `src/types/tournament.ts` — ESPN response types (ESPNScoreboardResponse, ESPNTournamentResponse)
- `src/types/picks.ts` — Game, Round, PoolPlayer, Pick types
- `src/lib/picks.ts` — getActiveRound, getTodaysGames, getPickDeadline
- `src/lib/supabase/server.ts` — existing server-side Supabase client pattern
- `src/lib/supabase/client.ts` — client-side Supabase client (for reference)
- `supabase/schema.sql` — full database schema including RLS policies
- `supabase/seed.sql` — test data structure (rounds, games, teams)

---

## Part 1: Service Role Supabase Client

Create `src/lib/supabase/admin.ts`:

```typescript
// Server-side Supabase client with service_role key
// Bypasses RLS — ONLY use in API routes and cron jobs, NEVER in client components
import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Missing SUPABASE_URL');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
```

**IMPORTANT:** This client bypasses Row Level Security. It can read/write anything. Only use it in `src/app/api/` routes, never import it in page components or client-side code.

---

## Part 2: Cron Auth Helper

Create `src/lib/cron-auth.ts`:

```typescript
// Verify cron job requests are authorized
// Vercel Cron sends Authorization header automatically
// Manual triggers can pass the CRON_SECRET as a query param or header

export function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  const secret = process.env.CRON_SECRET;
  
  if (!secret) {
    console.warn('CRON_SECRET not set — allowing request in development');
    return process.env.NODE_ENV === 'development';
  }
  
  // Vercel sends: Authorization: Bearer <CRON_SECRET>
  return authHeader === `Bearer ${secret}`;
}
```

---

## Part 3: ESPN Game Sync — `/api/cron/sync-games`

Create `src/app/api/cron/sync-games/route.ts`:

### Purpose
Sync game schedules and times from ESPN. Update `games.game_datetime` and calculate `rounds.deadline_datetime` as the earliest game time minus 5 minutes.

### When It Runs
- Vercel Cron: Daily at 6:00 AM ET (`0 11 * * *` UTC)
- Also callable manually by admin

### Implementation

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyCronAuth } from '@/lib/cron-auth';

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball';

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = { synced: 0, deadlinesUpdated: 0, errors: [] as string[] };

    // 1. Get all rounds from our DB that haven't completed yet
    const { data: rounds } = await supabaseAdmin
      .from('rounds')
      .select('id, name, date, deadline_datetime')
      .order('date', { ascending: true });

    if (!rounds || rounds.length === 0) {
      return NextResponse.json({ message: 'No rounds found', results });
    }

    // 2. For each round, fetch ESPN games for that date
    for (const round of rounds) {
      try {
        const dateFormatted = round.date.replace(/-/g, ''); // '2026-03-20' → '20260320'
        const url = `${ESPN_BASE_URL}/scoreboard?dates=${dateFormatted}&seasontype=3&division=50`;
        
        const response = await fetch(url, {
          headers: { 'User-Agent': 'MBB-Survivor-Pool/1.0', 'Accept': 'application/json' },
          next: { revalidate: 0 }, // no cache
        });

        if (!response.ok) {
          results.errors.push(`ESPN returned ${response.status} for ${round.date}`);
          continue;
        }

        const data = await response.json();
        const events = data.events || [];

        // 3. Get our games for this round
        const { data: ourGames } = await supabaseAdmin
          .from('games')
          .select('id, team1_id, team2_id, espn_game_id, game_datetime, teams_t1:team1_id(name, abbreviation), teams_t2:team2_id(name, abbreviation)')
          .eq('round_id', round.id);

        if (!ourGames) continue;

        // 4. Match ESPN events to our games and update times
        for (const event of events) {
          const espnId = event.id;
          const espnDate = event.date; // ISO datetime
          const competitors = event.competitions?.[0]?.competitors || [];
          
          if (competitors.length < 2) continue;

          const espnTeam1 = competitors[0]?.team?.displayName || competitors[0]?.team?.name || '';
          const espnTeam2 = competitors[1]?.team?.displayName || competitors[1]?.team?.name || '';

          // Find matching game in our DB
          let matchedGame = ourGames.find(g => g.espn_game_id === espnId);
          
          if (!matchedGame) {
            // Try matching by team names
            matchedGame = ourGames.find(g => {
              const t1Name = (g as any).teams_t1?.name || '';
              const t2Name = (g as any).teams_t2?.name || '';
              return (
                (espnTeam1.includes(t1Name) || espnTeam1.includes(t2Name)) &&
                (espnTeam2.includes(t1Name) || espnTeam2.includes(t2Name))
              );
            });
          }

          if (matchedGame) {
            // Update game time and ESPN ID
            await supabaseAdmin
              .from('games')
              .update({
                game_datetime: espnDate,
                espn_game_id: espnId,
              })
              .eq('id', matchedGame.id);
            results.synced++;
          }
        }

        // 5. Calculate deadline: earliest game time for this round minus 5 minutes
        const { data: roundGames } = await supabaseAdmin
          .from('games')
          .select('game_datetime')
          .eq('round_id', round.id)
          .order('game_datetime', { ascending: true })
          .limit(1);

        if (roundGames && roundGames.length > 0) {
          const earliestGame = new Date(roundGames[0].game_datetime);
          const deadline = new Date(earliestGame.getTime() - 5 * 60 * 1000); // 5 min before

          await supabaseAdmin
            .from('rounds')
            .update({ deadline_datetime: deadline.toISOString() })
            .eq('id', round.id);
          results.deadlinesUpdated++;
        }

      } catch (err: any) {
        results.errors.push(`Error syncing round ${round.name}: ${err.message}`);
      }
    }

    return NextResponse.json({ success: true, results });

  } catch (err: any) {
    console.error('sync-games error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

### Key Details
- ESPN date format is `YYYYMMDD` (no dashes)
- ESPN `event.date` is ISO 8601 UTC (e.g., `"2026-03-20T16:00:00Z"`)
- Team matching: first try `espn_game_id`, then fuzzy match on team names. ESPN uses `displayName` like "Duke Blue Devils", our DB has `name` = "Duke" and `mascot` = "Blue Devils". ESPN's displayName typically contains our `name`.
- Deadline = earliest game of the round minus 5 minutes
- All times stored as UTC in Postgres (`TIMESTAMPTZ`), displayed as ET on the frontend (Task 15)

---

## Part 4: Round Activation — `/api/cron/activate-rounds`

Create `src/app/api/cron/activate-rounds/route.ts`:

### Purpose
Automatically activate today's round and deactivate yesterday's. Also handle pool status transitions.

### When It Runs
- Vercel Cron: Every 5 minutes from 3:00 PM - 6:00 PM UTC (10 AM - 1 PM ET) on game days
- Schedule: `*/5 15-18 * 3-4 *` (March and April only)

### Implementation

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyCronAuth } from '@/lib/cron-auth';

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = { 
      activated: null as string | null, 
      deactivated: [] as string[],
      poolsTransitioned: 0 
    };

    // Current time in UTC
    const now = new Date();

    // 1. Get all rounds ordered by date
    const { data: rounds } = await supabaseAdmin
      .from('rounds')
      .select('id, name, date, deadline_datetime, is_active')
      .order('date', { ascending: true });

    if (!rounds) return NextResponse.json({ message: 'No rounds found' });

    // 2. Find today's round (where date = today in ET)
    const todayET = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayStr = todayET.toISOString().split('T')[0]; // YYYY-MM-DD

    const todayRound = rounds.find(r => r.date === todayStr);
    const currentlyActive = rounds.find(r => r.is_active);

    // 3. If today has a round and it's not already active, activate it
    if (todayRound && !todayRound.is_active) {
      // Check if deadline is within the next 6 hours (games are today)
      const deadlineTime = new Date(todayRound.deadline_datetime);
      const hoursUntilDeadline = (deadlineTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilDeadline <= 6 && hoursUntilDeadline >= -24) {
        // Deactivate any currently active round
        if (currentlyActive && currentlyActive.id !== todayRound.id) {
          await supabaseAdmin
            .from('rounds')
            .update({ is_active: false })
            .eq('id', currentlyActive.id);
          results.deactivated.push(currentlyActive.name);
        }

        // Activate today's round
        await supabaseAdmin
          .from('rounds')
          .update({ is_active: true })
          .eq('id', todayRound.id);
        results.activated = todayRound.name;

        // 4. Pool status: open → active (if this is the first round being activated)
        const isFirstRound = rounds[0]?.id === todayRound.id;
        if (isFirstRound || !rounds.some(r => r.date < todayStr)) {
          const { count } = await supabaseAdmin
            .from('pools')
            .update({ status: 'active' })
            .eq('status', 'open')
            .select('id', { count: 'exact', head: true });
          results.poolsTransitioned = count || 0;
        }
      }
    }

    return NextResponse.json({ success: true, results });

  } catch (err: any) {
    console.error('activate-rounds error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

### Key Details
- Only activates if deadline is within 6 hours (prevents activating rounds days early)
- Deactivates previous round when activating new one
- First round activation triggers ALL pools to transition from `open` → `active`
- Uses ET date to determine "today" since tournament is in the US

---

## Part 5: Game Results & Eliminations — `/api/cron/process-results`

Create `src/app/api/cron/process-results/route.ts`:

### Purpose
The big one. Fetches live scores from ESPN, updates game results, marks picks correct/incorrect, eliminates players, and handles round/pool completion.

### When It Runs
- Vercel Cron: Every 5 minutes from noon to midnight ET on game days
- Schedule: `*/5 17-5 * 3-4 *` (5 PM UTC = noon ET through 5 AM UTC = midnight ET)

### Implementation

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyCronAuth } from '@/lib/cron-auth';

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball';

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = {
      gamesUpdated: 0,
      gamesCompleted: 0,
      picksMarkedCorrect: 0,
      picksMarkedIncorrect: 0,
      playersEliminated: 0,
      missedPickEliminations: 0,
      roundsCompleted: 0,
      poolsCompleted: 0,
      errors: [] as string[],
    };

    // 1. Get active round and its games that aren't final yet
    const { data: activeRound } = await supabaseAdmin
      .from('rounds')
      .select('id, name, date')
      .eq('is_active', true)
      .single();

    if (!activeRound) {
      return NextResponse.json({ message: 'No active round', results });
    }

    const { data: pendingGames } = await supabaseAdmin
      .from('games')
      .select('id, team1_id, team2_id, espn_game_id, status, game_datetime')
      .eq('round_id', activeRound.id)
      .in('status', ['scheduled', 'in_progress']);

    if (!pendingGames || pendingGames.length === 0) {
      // All games may already be final — check for missed pick processing
      await processMissedPicks(activeRound.id, results);
      await checkRoundCompletion(activeRound.id, results);
      return NextResponse.json({ message: 'No pending games', results });
    }

    // 2. Fetch live scores from ESPN for today
    const dateFormatted = activeRound.date.replace(/-/g, '');
    const url = `${ESPN_BASE_URL}/scoreboard?dates=${dateFormatted}&seasontype=3&division=50`;
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'MBB-Survivor-Pool/1.0', 'Accept': 'application/json' },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `ESPN returned ${response.status}` }, { status: 502 });
    }

    const espnData = await response.json();
    const events = espnData.events || [];

    // 3. Process each pending game
    for (const game of pendingGames) {
      try {
        // Find matching ESPN event
        let espnEvent = events.find((e: any) => e.id === game.espn_game_id);
        
        if (!espnEvent) {
          // Try matching by team IDs — get our team names first
          const { data: t1 } = await supabaseAdmin.from('teams').select('name').eq('id', game.team1_id).single();
          const { data: t2 } = await supabaseAdmin.from('teams').select('name').eq('id', game.team2_id).single();
          
          if (t1 && t2) {
            espnEvent = events.find((e: any) => {
              const competitors = e.competitions?.[0]?.competitors || [];
              const names = competitors.map((c: any) => c.team?.displayName || c.team?.name || '');
              return names.some((n: string) => n.includes(t1.name)) && 
                     names.some((n: string) => n.includes(t2.name));
            });
          }
        }

        if (!espnEvent) continue;

        const competition = espnEvent.competitions?.[0];
        if (!competition) continue;

        const competitors = competition.competitors || [];
        const espnStatus = espnEvent.status?.type;
        const isCompleted = espnStatus?.completed === true;
        const isInProgress = espnStatus?.state === 'in';
        
        // Get scores
        const score1 = competitors[0]?.score;
        const score2 = competitors[1]?.score;
        
        // Determine which ESPN competitor maps to which of our teams
        const espnTeam1Name = competitors[0]?.team?.displayName || '';
        const espnTeam2Name = competitors[1]?.team?.displayName || '';
        
        const { data: ourTeam1 } = await supabaseAdmin.from('teams').select('name').eq('id', game.team1_id).single();
        const { data: ourTeam2 } = await supabaseAdmin.from('teams').select('name').eq('id', game.team2_id).single();

        // Figure out score mapping (ESPN order may differ from our team1/team2)
        let team1Score: number | null = null;
        let team2Score: number | null = null;
        let winnerId: string | null = null;
        let loserId: string | null = null;

        if (score1 != null && score2 != null) {
          if (espnTeam1Name.includes(ourTeam1?.name || '___')) {
            team1Score = typeof score1 === 'string' ? parseInt(score1) : score1;
            team2Score = typeof score2 === 'string' ? parseInt(score2) : score2;
          } else {
            // ESPN has them in reverse order from our DB
            team1Score = typeof score2 === 'string' ? parseInt(score2) : score2;
            team2Score = typeof score1 === 'string' ? parseInt(score1) : score1;
          }

          if (isCompleted && team1Score !== null && team2Score !== null) {
            winnerId = team1Score > team2Score ? game.team1_id : game.team2_id;
            loserId = team1Score > team2Score ? game.team2_id : game.team1_id;
          }
        }

        // Determine new status
        let newStatus: 'scheduled' | 'in_progress' | 'final' = game.status as any;
        if (isCompleted) newStatus = 'final';
        else if (isInProgress) newStatus = 'in_progress';

        // 4. Update game record
        const updateData: any = { status: newStatus };
        if (team1Score !== null) updateData.team1_score = team1Score;
        if (team2Score !== null) updateData.team2_score = team2Score;
        if (winnerId) updateData.winner_id = winnerId;
        if (!game.espn_game_id) updateData.espn_game_id = espnEvent.id;

        await supabaseAdmin.from('games').update(updateData).eq('id', game.id);
        results.gamesUpdated++;

        // 5. If game just completed, process picks
        if (isCompleted && winnerId && loserId && game.status !== 'final') {
          results.gamesCompleted++;

          // Mark winning picks correct
          const { count: correctCount } = await supabaseAdmin
            .from('picks')
            .update({ is_correct: true })
            .eq('round_id', activeRound.id)
            .eq('team_id', winnerId)
            .is('is_correct', null)
            .select('id', { count: 'exact', head: true });
          results.picksMarkedCorrect += correctCount || 0;

          // Mark losing picks incorrect
          const { data: incorrectPicks } = await supabaseAdmin
            .from('picks')
            .update({ is_correct: false })
            .eq('round_id', activeRound.id)
            .eq('team_id', loserId)
            .is('is_correct', null)
            .select('pool_player_id');
          results.picksMarkedIncorrect += incorrectPicks?.length || 0;

          // Eliminate losing team
          await supabaseAdmin
            .from('teams')
            .update({ is_eliminated: true })
            .eq('id', loserId);

          // 6. Eliminate players who picked the loser
          if (incorrectPicks && incorrectPicks.length > 0) {
            const poolPlayerIds = incorrectPicks.map(p => p.pool_player_id);
            
            const { count: elimCount } = await supabaseAdmin
              .from('pool_players')
              .update({
                is_eliminated: true,
                elimination_round_id: activeRound.id,
                elimination_reason: 'wrong_pick',
              })
              .in('id', poolPlayerIds)
              .eq('is_eliminated', false)
              .select('id', { count: 'exact', head: true });
            results.playersEliminated += elimCount || 0;
          }
        }

      } catch (err: any) {
        results.errors.push(`Error processing game ${game.id}: ${err.message}`);
      }
    }

    // 7. Check if all games in round are complete → process missed picks
    await processMissedPicks(activeRound.id, results);

    // 8. Check if round is complete → advance to next
    await checkRoundCompletion(activeRound.id, results);

    return NextResponse.json({ success: true, results });

  } catch (err: any) {
    console.error('process-results error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * After ALL games in a round are final, eliminate players who didn't submit a pick.
 * We wait until all games are done to avoid false positives.
 */
async function processMissedPicks(
  roundId: string,
  results: { missedPickEliminations: number; errors: string[] }
) {
  // Check if all games in this round are final
  const { data: pendingGames } = await supabaseAdmin
    .from('games')
    .select('id')
    .eq('round_id', roundId)
    .in('status', ['scheduled', 'in_progress']);

  if (pendingGames && pendingGames.length > 0) {
    return; // Still games in progress — don't process missed picks yet
  }

  // Find alive players who have no pick for this round
  // Get all pool_players who are NOT eliminated
  const { data: alivePlayers } = await supabaseAdmin
    .from('pool_players')
    .select('id, pool_id')
    .eq('is_eliminated', false);

  if (!alivePlayers || alivePlayers.length === 0) return;

  // For each alive player, check if they have a pick for this round
  const alivePlayerIds = alivePlayers.map(p => p.id);
  const { data: picksForRound } = await supabaseAdmin
    .from('picks')
    .select('pool_player_id')
    .eq('round_id', roundId)
    .in('pool_player_id', alivePlayerIds);

  const playerIdsWithPicks = new Set(picksForRound?.map(p => p.pool_player_id) || []);
  const playersWithoutPicks = alivePlayers.filter(p => !playerIdsWithPicks.has(p.id));

  if (playersWithoutPicks.length === 0) return;

  // Eliminate players who missed their pick
  const missedIds = playersWithoutPicks.map(p => p.id);
  const { count } = await supabaseAdmin
    .from('pool_players')
    .update({
      is_eliminated: true,
      elimination_round_id: roundId,
      elimination_reason: 'missed_pick',
    })
    .in('id', missedIds)
    .eq('is_eliminated', false)
    .select('id', { count: 'exact', head: true });

  results.missedPickEliminations = count || 0;
}

/**
 * Check if a round is complete (all games final) and handle advancement.
 */
async function checkRoundCompletion(
  roundId: string,
  results: { roundsCompleted: number; poolsCompleted: number; errors: string[] }
) {
  // Check if all games in this round are final
  const { data: nonFinalGames } = await supabaseAdmin
    .from('games')
    .select('id')
    .eq('round_id', roundId)
    .neq('status', 'final');

  if (nonFinalGames && nonFinalGames.length > 0) {
    return; // Not all games are done
  }

  // Round is complete — deactivate it
  await supabaseAdmin
    .from('rounds')
    .update({ is_active: false })
    .eq('id', roundId);
  results.roundsCompleted++;

  // Check if this was the LAST round (Championship)
  const { data: futureRounds } = await supabaseAdmin
    .from('rounds')
    .select('id, name, date')
    .gt('date', (await supabaseAdmin.from('rounds').select('date').eq('id', roundId).single()).data?.date || '')
    .order('date', { ascending: true });

  if (!futureRounds || futureRounds.length === 0) {
    // Tournament is over — complete all active pools
    // For each pool, find the winner (last alive player)
    const { data: pools } = await supabaseAdmin
      .from('pools')
      .select('id')
      .eq('status', 'active');

    for (const pool of (pools || [])) {
      const { data: alivePlayers } = await supabaseAdmin
        .from('pool_players')
        .select('user_id')
        .eq('pool_id', pool.id)
        .eq('is_eliminated', false)
        .limit(1);

      const winnerId = alivePlayers?.[0]?.user_id || null;

      await supabaseAdmin
        .from('pools')
        .update({ status: 'complete', winner_id: winnerId })
        .eq('id', pool.id);
      results.poolsCompleted++;
    }
  }
  // If there are future rounds, the activate-rounds cron will handle activating the next one
}
```

### Key Details — Game Matching
- ESPN events have `event.id` (string like "401524567") which we store in `games.espn_game_id`
- First pass: match on `espn_game_id` (fast, exact)
- Fallback: match on team names (ESPN `displayName` contains our DB `name`)
- ESPN competitor order may not match our `team1_id`/`team2_id` order — the code handles this by checking which ESPN team name matches which of our teams

### Key Details — Score Parsing
- ESPN scores come as numbers on the `competitors[].score` field
- But they could be strings in some response formats — parse with `parseInt()` as safety
- `status.type.completed === true` means game is final
- `status.type.state === 'in'` means game is live

### Key Details — Elimination Timing
- **Wrong picks**: Eliminated immediately when game completes
- **Missed picks**: Eliminated ONLY after ALL games in the round are final
  - This prevents eliminating someone at 1 PM for "no pick" when late games haven't started yet
  - If a player hasn't picked but games are still playing, they're not eliminated yet

### Key Details — Pool Completion
- When the last round has all games final: 
  - Each pool's last alive player becomes `winner_id`
  - Pool status → `complete`
  - If multiple players survive the whole tournament: first one found becomes winner (future: handle co-champions)

---

## Part 6: Vercel Cron Configuration

Create `vercel.json` in the project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-games",
      "schedule": "0 11 * * *"
    },
    {
      "path": "/api/cron/activate-rounds",
      "schedule": "*/5 15-18 * 3-4 *"
    },
    {
      "path": "/api/cron/process-results",
      "schedule": "*/5 17-5 * 3-4 *"
    }
  ]
}
```

**Schedule explanations (all UTC):**
- `sync-games`: `0 11 * * *` = 11:00 UTC = **6:00 AM ET** daily
- `activate-rounds`: `*/5 15-18 * 3-4 *` = every 5 min from 3-6 PM UTC = **10 AM - 1 PM ET**, March & April
- `process-results`: `*/5 17-5 * 3-4 *` = every 5 min from 5 PM - 5 AM UTC = **noon - midnight ET**, March & April

**Note on Vercel Hobby plan:** Cron runs once per day on Hobby. For more frequent execution (every 5 min), you need Vercel Pro ($20/month) OR use an external cron service like cron-job.org (free) to hit the API routes directly.

If using an external cron service, the routes accept GET requests with `Authorization: Bearer <CRON_SECRET>` header.

---

## Part 7: Admin Manual Trigger (Optional but Recommended)

Add a "Sync Now" button on the pool settings page (for pool creators) that manually triggers the sync endpoints. This is useful for testing and for when cron timing doesn't catch something.

Create `src/app/api/admin/trigger-sync/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // Verify user is authenticated and is a pool creator
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is a pool creator
  const { data: pools } = await supabase
    .from('pools')
    .select('id')
    .eq('creator_id', user.id)
    .limit(1);

  if (!pools || pools.length === 0) {
    return NextResponse.json({ error: 'Not a pool creator' }, { status: 403 });
  }

  const { action } = await request.json();

  // Forward to the appropriate cron endpoint
  const baseUrl = request.nextUrl.origin;
  const secret = process.env.CRON_SECRET || '';

  let targetUrl: string;
  switch (action) {
    case 'sync-games':
      targetUrl = `${baseUrl}/api/cron/sync-games`;
      break;
    case 'process-results':
      targetUrl = `${baseUrl}/api/cron/process-results`;
      break;
    case 'activate-rounds':
      targetUrl = `${baseUrl}/api/cron/activate-rounds`;
      break;
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const response = await fetch(targetUrl, {
    headers: { 'Authorization': `Bearer ${secret}` },
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
```

---

## Part 8: Database Migration

Create `supabase/migrations/002_game_odds_columns.sql`:

```sql
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
```

**Run this migration in Supabase SQL Editor before deploying.**

---

## Environment Variables Checklist

Add these to your Vercel project settings (Settings → Environment Variables):

| Variable | Value | Scope |
|----------|-------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | Get from Supabase Dashboard → Settings → API → `service_role` key | Server only (NOT prefixed with NEXT_PUBLIC_) |
| `CRON_SECRET` | Generate a random 32+ char string (e.g., run `openssl rand -hex 32`) | Server only |
| `ODDS_API_KEY` | `eef96f98f903e4af4bfdeb928295dec5` | Server only (for Task 14) |

**EXISTING (already set):**
- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon key

---

## Testing Plan

### Local Testing
1. Set the env vars in `.env.local`
2. Start the dev server: `npm run dev`
3. Hit the endpoints directly:
   - `GET http://localhost:3000/api/cron/sync-games` (will fail auth — add `?secret=<CRON_SECRET>` or remove auth check temporarily)
   - Check the console output and Supabase dashboard to verify data updates

### Pre-Tournament Testing
1. Seed the database with test data (rounds for today/tomorrow, games at known times)
2. Run `sync-games` → verify `deadline_datetime` is set to earliest game - 5 min
3. Run `activate-rounds` → verify today's round becomes active
4. Manually set a game to `final` with a winner in Supabase → run `process-results` → verify:
   - Correct picks marked `is_correct = true`
   - Incorrect picks marked `is_correct = false`
   - Losing players marked `is_eliminated = true` with `elimination_reason = 'wrong_pick'`
5. Remove a player's pick for the round → run `process-results` after all games final → verify `missed_pick` elimination

---

## Files to Create

1. `src/lib/supabase/admin.ts` — service role client
2. `src/lib/cron-auth.ts` — auth helper
3. `src/app/api/cron/sync-games/route.ts` — ESPN game sync
4. `src/app/api/cron/activate-rounds/route.ts` — round activation
5. `src/app/api/cron/process-results/route.ts` — results + eliminations
6. `src/app/api/admin/trigger-sync/route.ts` — manual admin trigger
7. `vercel.json` — cron configuration
8. `supabase/migrations/002_game_odds_columns.sql` — DB migration

## Files NOT to Modify

- Don't change any existing page components
- Don't change `src/lib/picks.ts` (client-side pick logic stays the same)
- Don't change `src/lib/espn.ts` (the cron routes fetch ESPN data directly, don't need the existing client which is designed for client-side use)
- Don't change any types files
- Don't change the schema.sql (use migration instead)

## What NOT to Do
- Don't expose `SUPABASE_SERVICE_ROLE_KEY` or `ODDS_API_KEY` in any client-side code
- Don't import `src/lib/supabase/admin.ts` in any file under `src/app/pools/`, `src/components/`, or any page component
- Don't process missed picks before all games in the round are final
- Don't eliminate a player who already has `is_eliminated = true`
- Don't try to implement the Odds API integration (that's Task 14)

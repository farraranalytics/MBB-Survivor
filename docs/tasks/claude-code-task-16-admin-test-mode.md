# Task 16: Admin Test Mode (Tournament Simulator)

**Purpose:** Let pool creators manually simulate game results to test round advancement, eliminations, and the full tournament flow without waiting for real ESPN data. This is essential for pre-launch testing.

The test endpoints do NOT bypass the real game logic — they set game outcomes in the database, then call the **same** `process-results` elimination logic that the real cron uses. If it works here, it works in production.

## Files to Read Before Writing Code

Read ALL of these:
- `src/app/api/cron/process-results/route.ts` — the real elimination logic (processMissedPicks, checkRoundCompletion)
- `src/app/api/cron/activate-rounds/route.ts` — round activation logic
- `src/app/api/admin/trigger-sync/route.ts` — existing admin auth pattern (verify pool creator)
- `src/lib/supabase/admin.ts` — service role client
- `src/lib/cron-auth.ts` — cron auth helper
- `src/app/pools/[id]/settings/page.tsx` — where the test UI will go
- `supabase/seed.sql` — understand the test data (rounds, games, teams)

---

## Part 1: Extract Shared Elimination Logic

The elimination logic currently lives inside `process-results/route.ts` as local functions (`processMissedPicks`, `checkRoundCompletion`). The test endpoints need to call this same logic.

Create `src/lib/game-processing.ts`:

Extract `processMissedPicks` and `checkRoundCompletion` from `process-results/route.ts` into this shared module. Then update `process-results/route.ts` to import from here instead of defining them locally.

```typescript
// src/lib/game-processing.ts
// Shared game result processing logic used by both:
// - /api/cron/process-results (real ESPN flow)
// - /api/admin/test/* (manual test flow)

import { supabaseAdmin } from '@/lib/supabase/admin';

export interface ProcessingResults {
  gamesCompleted: number;
  picksMarkedCorrect: number;
  picksMarkedIncorrect: number;
  playersEliminated: number;
  missedPickEliminations: number;
  roundsCompleted: number;
  poolsCompleted: number;
  errors: string[];
}

export function createEmptyResults(): ProcessingResults {
  return {
    gamesCompleted: 0,
    picksMarkedCorrect: 0,
    picksMarkedIncorrect: 0,
    playersEliminated: 0,
    missedPickEliminations: 0,
    roundsCompleted: 0,
    poolsCompleted: 0,
    errors: [],
  };
}

/**
 * Process a single completed game: mark picks correct/incorrect, eliminate losers.
 * Called after a game is set to 'final' with a winner_id.
 */
export async function processCompletedGame(
  roundId: string,
  winnerId: string,
  loserId: string,
  results: ProcessingResults
) {
  results.gamesCompleted++;

  // Mark winning picks correct
  const { data: correctPicks } = await supabaseAdmin
    .from('picks')
    .update({ is_correct: true })
    .eq('round_id', roundId)
    .eq('team_id', winnerId)
    .is('is_correct', null)
    .select('id');
  results.picksMarkedCorrect += correctPicks?.length || 0;

  // Mark losing picks incorrect
  const { data: incorrectPicks } = await supabaseAdmin
    .from('picks')
    .update({ is_correct: false })
    .eq('round_id', roundId)
    .eq('team_id', loserId)
    .is('is_correct', null)
    .select('pool_player_id');
  results.picksMarkedIncorrect += incorrectPicks?.length || 0;

  // Eliminate losing team from tournament
  await supabaseAdmin
    .from('teams')
    .update({ is_eliminated: true })
    .eq('id', loserId);

  // Eliminate players who picked the loser
  if (incorrectPicks && incorrectPicks.length > 0) {
    const poolPlayerIds = incorrectPicks.map(p => p.pool_player_id);

    const { data: eliminated } = await supabaseAdmin
      .from('pool_players')
      .update({
        is_eliminated: true,
        elimination_round_id: roundId,
        elimination_reason: 'wrong_pick',
      })
      .in('id', poolPlayerIds)
      .eq('is_eliminated', false)
      .select('id');
    results.playersEliminated += eliminated?.length || 0;
  }
}

/**
 * After ALL games in a round are final, eliminate players who didn't submit a pick.
 */
export async function processMissedPicks(
  roundId: string,
  results: ProcessingResults
) {
  // Check if all games in this round are final
  const { data: pendingGames } = await supabaseAdmin
    .from('games')
    .select('id')
    .eq('round_id', roundId)
    .in('status', ['scheduled', 'in_progress']);

  if (pendingGames && pendingGames.length > 0) {
    return; // Still games in progress
  }

  const { data: alivePlayers } = await supabaseAdmin
    .from('pool_players')
    .select('id, pool_id')
    .eq('is_eliminated', false);

  if (!alivePlayers || alivePlayers.length === 0) return;

  const alivePlayerIds = alivePlayers.map(p => p.id);
  const { data: picksForRound } = await supabaseAdmin
    .from('picks')
    .select('pool_player_id')
    .eq('round_id', roundId)
    .in('pool_player_id', alivePlayerIds);

  const playerIdsWithPicks = new Set(picksForRound?.map(p => p.pool_player_id) || []);
  const playersWithoutPicks = alivePlayers.filter(p => !playerIdsWithPicks.has(p.id));

  if (playersWithoutPicks.length === 0) return;

  const missedIds = playersWithoutPicks.map(p => p.id);
  const { data: missedEliminated } = await supabaseAdmin
    .from('pool_players')
    .update({
      is_eliminated: true,
      elimination_round_id: roundId,
      elimination_reason: 'missed_pick',
    })
    .in('id', missedIds)
    .eq('is_eliminated', false)
    .select('id');

  results.missedPickEliminations = missedEliminated?.length || 0;
}

/**
 * Check if a round is complete (all games final) and handle advancement.
 */
export async function checkRoundCompletion(
  roundId: string,
  results: ProcessingResults
) {
  const { data: nonFinalGames } = await supabaseAdmin
    .from('games')
    .select('id')
    .eq('round_id', roundId)
    .neq('status', 'final');

  if (nonFinalGames && nonFinalGames.length > 0) {
    return;
  }

  // Round is complete — deactivate it
  await supabaseAdmin
    .from('rounds')
    .update({ is_active: false })
    .eq('id', roundId);
  results.roundsCompleted++;

  // Check if this was the LAST round
  const { data: currentRound } = await supabaseAdmin
    .from('rounds')
    .select('date')
    .eq('id', roundId)
    .single();

  const { data: futureRounds } = await supabaseAdmin
    .from('rounds')
    .select('id, name, date')
    .gt('date', currentRound?.date || '')
    .order('date', { ascending: true });

  if (!futureRounds || futureRounds.length === 0) {
    // Tournament is over — complete all active pools
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
}
```

**Then update `src/app/api/cron/process-results/route.ts`:** Remove the local `processMissedPicks` and `checkRoundCompletion` functions. Import them from `@/lib/game-processing` instead. Also import `processCompletedGame` and use it in the game processing loop (replace the inline pick marking + elimination code). The route's behavior must stay identical — this is purely a refactor for code sharing.

---

## Part 2: Complete a Single Game

Create `src/app/api/admin/test/complete-game/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  processCompletedGame,
  processMissedPicks,
  checkRoundCompletion,
  createEmptyResults,
} from '@/lib/game-processing';

export async function POST(request: NextRequest) {
  // Auth: must be a pool creator
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: pools } = await supabase
    .from('pools')
    .select('id')
    .eq('creator_id', user.id)
    .limit(1);

  if (!pools || pools.length === 0) {
    return NextResponse.json({ error: 'Not a pool creator' }, { status: 403 });
  }

  try {
    const { gameId, winnerId } = await request.json();

    if (!gameId || !winnerId) {
      return NextResponse.json({ error: 'gameId and winnerId are required' }, { status: 400 });
    }

    // Get the game
    const { data: game } = await supabaseAdmin
      .from('games')
      .select('id, round_id, team1_id, team2_id, status')
      .eq('id', gameId)
      .single();

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (game.status === 'final') {
      return NextResponse.json({ error: 'Game is already final' }, { status: 400 });
    }

    // Validate winnerId is one of the two teams
    if (winnerId !== game.team1_id && winnerId !== game.team2_id) {
      return NextResponse.json({ error: 'winnerId must be team1_id or team2_id' }, { status: 400 });
    }

    const loserId = winnerId === game.team1_id ? game.team2_id : game.team1_id;

    // Generate fake scores (winner gets 70-95, loser gets 50-70)
    const winnerScore = Math.floor(Math.random() * 26) + 70;
    const loserScore = Math.floor(Math.random() * 21) + 50;

    const team1Score = winnerId === game.team1_id ? winnerScore : loserScore;
    const team2Score = winnerId === game.team2_id ? winnerScore : loserScore;

    // Update game to final
    await supabaseAdmin
      .from('games')
      .update({
        status: 'final',
        winner_id: winnerId,
        team1_score: team1Score,
        team2_score: team2Score,
      })
      .eq('id', gameId);

    // Process picks and eliminations using the SAME logic as the real cron
    const results = createEmptyResults();
    await processCompletedGame(game.round_id, winnerId, loserId, results);

    // Check if all games in round are now final → process missed picks + round completion
    await processMissedPicks(game.round_id, results);
    await checkRoundCompletion(game.round_id, results);

    return NextResponse.json({
      success: true,
      game: {
        id: gameId,
        winner: winnerId,
        score: `${team1Score}-${team2Score}`,
      },
      results,
    });

  } catch (err: any) {
    console.error('complete-game error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

---

## Part 3: Complete All Games in Active Round

Create `src/app/api/admin/test/complete-round/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  processCompletedGame,
  processMissedPicks,
  checkRoundCompletion,
  createEmptyResults,
} from '@/lib/game-processing';

export async function POST(request: NextRequest) {
  // Auth: must be a pool creator
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: pools } = await supabase
    .from('pools')
    .select('id')
    .eq('creator_id', user.id)
    .limit(1);

  if (!pools || pools.length === 0) {
    return NextResponse.json({ error: 'Not a pool creator' }, { status: 403 });
  }

  try {
    // Option: pass a roundId, or default to the active round
    const body = await request.json().catch(() => ({}));
    const mode = body.mode || 'favorites'; // 'favorites' = higher seed wins, 'random' = coin flip

    // Get active round
    const { data: activeRound } = await supabaseAdmin
      .from('rounds')
      .select('id, name, date')
      .eq('is_active', true)
      .single();

    if (!activeRound) {
      return NextResponse.json({ error: 'No active round' }, { status: 400 });
    }

    // Get all non-final games for this round
    const { data: pendingGames } = await supabaseAdmin
      .from('games')
      .select(`
        id, team1_id, team2_id, status,
        team1:team1_id(seed),
        team2:team2_id(seed)
      `)
      .eq('round_id', activeRound.id)
      .in('status', ['scheduled', 'in_progress']);

    if (!pendingGames || pendingGames.length === 0) {
      return NextResponse.json({ message: 'No pending games in active round' });
    }

    const results = createEmptyResults();
    const gameResults: any[] = [];

    for (const game of pendingGames) {
      // Determine winner based on mode
      let winnerId: string;
      let loserId: string;

      if (mode === 'random') {
        // Coin flip
        winnerId = Math.random() > 0.5 ? game.team1_id : game.team2_id;
      } else {
        // Favorites: lower seed number wins (1 beats 16)
        const seed1 = (game as any).team1?.seed ?? 8;
        const seed2 = (game as any).team2?.seed ?? 8;
        winnerId = seed1 <= seed2 ? game.team1_id : game.team2_id;
      }
      loserId = winnerId === game.team1_id ? game.team2_id : game.team1_id;

      // Generate fake scores
      const winnerScore = Math.floor(Math.random() * 26) + 70;
      const loserScore = Math.floor(Math.random() * 21) + 50;
      const team1Score = winnerId === game.team1_id ? winnerScore : loserScore;
      const team2Score = winnerId === game.team2_id ? winnerScore : loserScore;

      // Update game
      await supabaseAdmin
        .from('games')
        .update({
          status: 'final',
          winner_id: winnerId,
          team1_score: team1Score,
          team2_score: team2Score,
        })
        .eq('id', game.id);

      // Process picks and eliminations
      await processCompletedGame(activeRound.id, winnerId, loserId, results);

      gameResults.push({
        gameId: game.id,
        winner: winnerId,
        loser: loserId,
        score: `${team1Score}-${team2Score}`,
      });
    }

    // All games done — process missed picks + round completion
    await processMissedPicks(activeRound.id, results);
    await checkRoundCompletion(activeRound.id, results);

    return NextResponse.json({
      success: true,
      round: activeRound.name,
      mode,
      gamesCompleted: gameResults.length,
      gameResults,
      results,
    });

  } catch (err: any) {
    console.error('complete-round error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

---

## Part 4: Activate Next Round

Create `src/app/api/admin/test/activate-next-round/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  // Auth: must be a pool creator
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: pools } = await supabase
    .from('pools')
    .select('id')
    .eq('creator_id', user.id)
    .limit(1);

  if (!pools || pools.length === 0) {
    return NextResponse.json({ error: 'Not a pool creator' }, { status: 403 });
  }

  try {
    // Get all rounds ordered by date
    const { data: rounds } = await supabaseAdmin
      .from('rounds')
      .select('id, name, date, is_active')
      .order('date', { ascending: true });

    if (!rounds || rounds.length === 0) {
      return NextResponse.json({ error: 'No rounds found' }, { status: 400 });
    }

    const currentlyActive = rounds.find(r => r.is_active);

    // Find the next round after the active one (or the first round if none active)
    let nextRound;
    if (currentlyActive) {
      const currentIndex = rounds.findIndex(r => r.id === currentlyActive.id);
      nextRound = rounds[currentIndex + 1];

      if (!nextRound) {
        return NextResponse.json({ error: 'No more rounds — tournament is complete' }, { status: 400 });
      }

      // Deactivate current
      await supabaseAdmin
        .from('rounds')
        .update({ is_active: false })
        .eq('id', currentlyActive.id);
    } else {
      // No active round — activate the first one that has non-final games
      nextRound = rounds.find(r => !r.is_active);
      if (!nextRound) {
        return NextResponse.json({ error: 'All rounds are complete' }, { status: 400 });
      }
    }

    // Activate next round
    await supabaseAdmin
      .from('rounds')
      .update({ is_active: true })
      .eq('id', nextRound.id);

    // If this is the first round activation, transition pools from open → active
    const isFirstRound = rounds[0]?.id === nextRound.id;
    let poolsTransitioned = 0;
    if (isFirstRound) {
      const { data: transitioned } = await supabaseAdmin
        .from('pools')
        .update({ status: 'active' })
        .eq('status', 'open')
        .select('id');
      poolsTransitioned = transitioned?.length || 0;
    }

    return NextResponse.json({
      success: true,
      deactivated: currentlyActive?.name || null,
      activated: nextRound.name,
      poolsTransitioned,
    });

  } catch (err: any) {
    console.error('activate-next-round error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

---

## Part 5: Reset a Round

Create `src/app/api/admin/test/reset-round/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  // Auth: must be a pool creator
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: pools } = await supabase
    .from('pools')
    .select('id')
    .eq('creator_id', user.id)
    .limit(1);

  if (!pools || pools.length === 0) {
    return NextResponse.json({ error: 'Not a pool creator' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const roundId = body.roundId; // Optional — defaults to active round

    // Get the round to reset
    let round;
    if (roundId) {
      const { data } = await supabaseAdmin
        .from('rounds')
        .select('id, name')
        .eq('id', roundId)
        .single();
      round = data;
    } else {
      // Default to active round
      const { data } = await supabaseAdmin
        .from('rounds')
        .select('id, name')
        .eq('is_active', true)
        .single();
      round = data;
    }

    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // 1. Reset all games in this round
    const { data: games } = await supabaseAdmin
      .from('games')
      .select('id, team1_id, team2_id, winner_id')
      .eq('round_id', round.id);

    const loserIds: string[] = [];
    for (const game of (games || [])) {
      if (game.winner_id) {
        const loserId = game.winner_id === game.team1_id ? game.team2_id : game.team1_id;
        loserIds.push(loserId);
      }
    }

    await supabaseAdmin
      .from('games')
      .update({
        status: 'scheduled',
        winner_id: null,
        team1_score: null,
        team2_score: null,
      })
      .eq('round_id', round.id);

    // 2. Un-eliminate teams that lost in this round
    if (loserIds.length > 0) {
      await supabaseAdmin
        .from('teams')
        .update({ is_eliminated: false })
        .in('id', loserIds);
    }

    // 3. Reset picks for this round (clear is_correct)
    await supabaseAdmin
      .from('picks')
      .update({ is_correct: null })
      .eq('round_id', round.id);

    // 4. Un-eliminate players eliminated in this round
    const { data: revivedPlayers } = await supabaseAdmin
      .from('pool_players')
      .update({
        is_eliminated: false,
        elimination_round_id: null,
        elimination_reason: null,
      })
      .eq('elimination_round_id', round.id)
      .select('id');

    // 5. Re-activate this round
    await supabaseAdmin
      .from('rounds')
      .update({ is_active: true })
      .eq('id', round.id);

    // 6. Revert pools back to active (in case they were completed)
    await supabaseAdmin
      .from('pools')
      .update({ status: 'active', winner_id: null })
      .eq('status', 'complete');

    return NextResponse.json({
      success: true,
      round: round.name,
      gamesReset: games?.length || 0,
      teamsRevived: loserIds.length,
      playersRevived: revivedPlayers?.length || 0,
    });

  } catch (err: any) {
    console.error('reset-round error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

---

## Part 6: Test Controls UI

Add a "Tournament Simulator" section to the pool settings page, visible **only to pool creators**.

In `src/app/pools/[id]/settings/page.tsx`, add a new section inside the creator-only area (after the existing Pool Admin section). This section contains buttons that call the test API routes.

### UI Design

```
┌─────────────────────────────────────────────┐
│  🧪 TOURNAMENT SIMULATOR                    │
│  Test round advancement and eliminations     │
│                                              │
│  Active Round: Round 1 Day 1                 │
│  Games: 2 scheduled · 0 in progress · 0 final│
│  Alive Players: 4 · Eliminated: 0            │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │  GAMES IN THIS ROUND                    │ │
│  │                                          │ │
│  │  (1) Duke vs (16) Norfolk St  scheduled  │ │
│  │  [Duke Wins]  [Norfolk St Wins]          │ │
│  │                                          │ │
│  │  (1) Kansas vs (16) NKU       scheduled  │ │
│  │  [Kansas Wins]  [NKU Wins]               │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  [Complete Round — Favorites Win]            │
│  [Complete Round — Random Winners]           │
│  [Activate Next Round]                       │
│  [Reset This Round]                          │
│                                              │
│  Response Log:                               │
│  ┌─────────────────────────────────────────┐ │
│  │ { success: true, gamesCompleted: 2,     │ │
│  │   playersEliminated: 1, ... }           │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Implementation Notes

- Fetch the active round and its games on mount to populate the UI
- Each "Team Wins" button calls `POST /api/admin/test/complete-game` with `{ gameId, winnerId }`
- "Complete Round" buttons call `POST /api/admin/test/complete-round` with `{ mode: 'favorites' }` or `{ mode: 'random' }`
- "Activate Next Round" calls `POST /api/admin/test/activate-next-round`
- "Reset This Round" calls `POST /api/admin/test/reset-round`
- Show the JSON response in a log area so the creator can see what happened (games completed, players eliminated, etc.)
- After each action, re-fetch the round/game data to update the UI
- Style consistently with the existing settings page — use the same surface colors, fonts, spacing

### Fetching Round/Game Data for the UI

Create a small helper that loads the data for the simulator panel. This runs client-side using the normal supabase client (not admin):

```typescript
async function loadSimulatorData() {
  // Get active round
  const { data: round } = await supabase
    .from('rounds')
    .select('id, name, date, is_active')
    .eq('is_active', true)
    .single();

  if (!round) return { round: null, games: [], stats: null };

  // Get games for this round with team info
  const { data: games } = await supabase
    .from('games')
    .select(`
      id, status, team1_score, team2_score, winner_id,
      team1:team1_id(id, name, abbreviation, seed),
      team2:team2_id(id, name, abbreviation, seed)
    `)
    .eq('round_id', round.id)
    .order('game_datetime', { ascending: true });

  // Get alive/eliminated counts
  const { count: aliveCount } = await supabase
    .from('pool_players')
    .select('id', { count: 'exact', head: true })
    .eq('is_eliminated', false);

  const { count: eliminatedCount } = await supabase
    .from('pool_players')
    .select('id', { count: 'exact', head: true })
    .eq('is_eliminated', true);

  return {
    round,
    games: games || [],
    stats: {
      alive: aliveCount || 0,
      eliminated: eliminatedCount || 0,
      scheduled: (games || []).filter(g => g.status === 'scheduled').length,
      inProgress: (games || []).filter(g => g.status === 'in_progress').length,
      final: (games || []).filter(g => g.status === 'final').length,
    },
  };
}
```

---

## Files to Create

1. `src/lib/game-processing.ts` — shared elimination logic (extracted from process-results)
2. `src/app/api/admin/test/complete-game/route.ts` — complete single game
3. `src/app/api/admin/test/complete-round/route.ts` — complete all games in round
4. `src/app/api/admin/test/activate-next-round/route.ts` — activate next round
5. `src/app/api/admin/test/reset-round/route.ts` — reset round (undo)

## Files to Modify

1. `src/app/api/cron/process-results/route.ts` — refactor to use shared `game-processing.ts` (import instead of local functions). **Behavior must stay identical.**
2. `src/app/pools/[id]/settings/page.tsx` — add Tournament Simulator section for creators

## What NOT to Do
- Don't create a separate elimination code path — the test endpoints must call the SAME functions as the real cron
- Don't skip the auth check — all test endpoints verify the user is a pool creator
- Don't expose test endpoints publicly — they require authentication
- Don't delete or rename any existing API routes
- Don't modify the process-results behavior — only refactor where the functions live
- Don't add the simulator UI for non-creators — it must be gated behind `isCreator` check

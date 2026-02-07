# Task 9: Analyze Tab — Full Build

The Analyze tab is the product's competitive differentiator. It has 5 modules. Modules 1-2 use real data from existing backend functions. Modules 3-5 use mocked/placeholder data for now but with real UI shells that will be wired up later.

This is a new feature build, not a refactor. The current file at `src/app/pools/[id]/analyze/page.tsx` is a one-line placeholder that says "Analyze — coming soon."

## Files to Read Before Writing Code

Read ALL of these fully:
- `src/app/pools/[id]/analyze/page.tsx` — placeholder to replace
- `src/app/pools/[id]/pick/page.tsx` — reference for how pool pages use `useParams`, `useAuth`, `getPoolPlayer`, `getActiveRound`, `getPickableTeams`, `getPickDeadline`
- `src/lib/picks.ts` — functions: `getActiveRound`, `getPickableTeams`, `getPickDeadline`, `getPoolPlayer`, `getUsedTeams`, `getPoolStandings`, `getTodaysGames`
- `src/types/picks.ts` — types: `PickableTeam`, `Game`, `TeamInfo`, `Round`, `PickDeadline`, `PoolStandings`, `PlayerStatus`
- `src/lib/bracket.ts` — `getAllGamesWithTeams` (to get all teams in tournament)
- `src/types/bracket.ts` — `BracketGame`
- `src/lib/supabase/client.ts` — supabase import for direct queries

---

## Architecture

### New file: `src/lib/analyze.ts`

Create this utility file with functions the analyze page will call. This keeps the page component clean.

### New file: `src/app/pools/[id]/analyze/page.tsx`

Full rewrite of the placeholder. Contains the page component and all 5 module sub-components.

---

## Part 1: `src/lib/analyze.ts` — Data Functions

### Function 1: `getTeamInventory(poolPlayerId: string)`

Returns all 68 tournament teams categorized by status for this player.

```typescript
import { supabase } from '@/lib/supabase/client';

export interface InventoryTeam {
  id: string;
  name: string;
  abbreviation: string;
  seed: number;
  region: string;
  is_eliminated: boolean; // eliminated from tournament (lost a game)
  status: 'available' | 'used' | 'eliminated'; // available = still in tourney + not used by player
}

export async function getTeamInventory(poolPlayerId: string): Promise<InventoryTeam[]> {
  // 1. Get all teams
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, abbreviation, seed, region, is_eliminated')
    .order('seed', { ascending: true });

  if (teamsError) throw new Error(`Failed to fetch teams: ${teamsError.message}`);

  // 2. Get team IDs this player has already used (no round exclusion — we want ALL used)
  const { data: picks, error: picksError } = await supabase
    .from('picks')
    .select('team_id')
    .eq('pool_player_id', poolPlayerId);

  if (picksError) throw new Error(`Failed to fetch picks: ${picksError.message}`);

  const usedTeamIds = new Set(picks?.map(p => p.team_id) || []);

  // 3. Categorize
  return (teams || []).map(team => ({
    id: team.id,
    name: team.name,
    abbreviation: team.abbreviation,
    seed: team.seed,
    region: team.region,
    is_eliminated: team.is_eliminated,
    status: usedTeamIds.has(team.id)
      ? 'used'
      : team.is_eliminated
        ? 'eliminated'
        : 'available',
  }));
}
```

### Function 2: `getOpponentInventories(poolId: string, currentPoolPlayerId: string)`

Returns what teams each alive opponent has available vs used. This is the data for the Opponent X-Ray.

```typescript
export interface OpponentInventory {
  pool_player_id: string;
  display_name: string;
  entry_label: string;
  is_eliminated: boolean;
  used_team_ids: string[];
}

export async function getOpponentInventories(poolId: string, currentPoolPlayerId: string): Promise<OpponentInventory[]> {
  // Get all pool players
  const { data: players, error: playersError } = await supabase
    .from('pool_players')
    .select('id, display_name, entry_label, is_eliminated')
    .eq('pool_id', poolId)
    .eq('is_eliminated', false) // only alive players
    .order('display_name', { ascending: true });

  if (playersError) throw new Error(`Failed to fetch players: ${playersError.message}`);

  const opponents: OpponentInventory[] = [];

  for (const player of (players || [])) {
    const { data: picks } = await supabase
      .from('picks')
      .select('team_id')
      .eq('pool_player_id', player.id);

    opponents.push({
      pool_player_id: player.id,
      display_name: player.display_name,
      entry_label: player.entry_label || `Entry ${player.entry_number ?? 1}`,
      is_eliminated: player.is_eliminated,
      used_team_ids: picks?.map(p => p.team_id) || [],
    });
  }

  return opponents;
}
```

### Function 3: `getSeedWinProbability(teamSeed: number, opponentSeed: number): number`

A pure function (no API call) that returns an estimated win probability based on historical seed matchup data. This is the seed-based model the audit references as a fallback when we don't have odds API data.

```typescript
// Historical NCAA tournament win rates by seed matchup
// Source: aggregated historical data (approximate)
const SEED_WIN_RATES: Record<string, number> = {
  '1v16': 0.99, '2v15': 0.94, '3v14': 0.85, '4v13': 0.79,
  '5v12': 0.64, '6v11': 0.62, '7v10': 0.61, '8v9': 0.51,
  '1v8': 0.80, '2v7': 0.67, '3v6': 0.58, '4v5': 0.55,
  '1v4': 0.72, '2v3': 0.57,
  '1v2': 0.65,
};

export function getSeedWinProbability(teamSeed: number, opponentSeed: number): number {
  // Normalize so lower seed is first
  const low = Math.min(teamSeed, opponentSeed);
  const high = Math.max(teamSeed, opponentSeed);
  const key = `${low}v${high}`;

  const baseRate = SEED_WIN_RATES[key];
  if (baseRate !== undefined) {
    return teamSeed <= opponentSeed ? baseRate : 1 - baseRate;
  }

  // Fallback: estimate based on seed difference
  const diff = opponentSeed - teamSeed;
  const prob = 0.5 + (diff * 0.03); // ~3% per seed difference
  return Math.max(0.05, Math.min(0.95, prob));
}
```

---

## Part 2: `src/app/pools/[id]/analyze/page.tsx` — Full Page

### Page Structure

```
┌─────────────────────────────────────────┐
│ [Module 1: Today's Games]    ← expanded │
│ [Module 5: Pick Optimizer]   ← expanded │
│ [Module 2: Team Inventory]   ← collapsed│
│ [Module 3: Opponent X-Ray]   ← collapsed│
│ [Module 4: Path Simulator]   ← collapsed│
└─────────────────────────────────────────┘
```

Per the audit: "Modules 1 and 5 are visible on load. Modules 2, 3, 4 are collapsed with summary headers that expand on tap."

### Page Component

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  getPoolPlayer,
  getActiveRound,
  getPickDeadline,
  getPickableTeams,
  getPlayerPick,
  getPoolStandings,
} from '@/lib/picks';
import { getTeamInventory, getOpponentInventories, getSeedWinProbability } from '@/lib/analyze';
import type { PickableTeam, PickDeadline, Round, Pick, PoolStandings } from '@/types/picks';
import type { InventoryTeam, OpponentInventory } from '@/lib/analyze';
```

**Data loading:** On mount, fetch:
1. `getPoolPlayer(poolId, userId)` → get pool_player_id
2. `getActiveRound()` → get current round
3. If active round: `getPickableTeams(poolPlayerId, roundId)` → today's games with win probs
4. If active round: `getPickDeadline(roundId)` → deadline info
5. If active round: `getPlayerPick(poolPlayerId, roundId)` → existing pick
6. `getTeamInventory(poolPlayerId)` → team inventory for Module 2
7. `getOpponentInventories(poolId, poolPlayerId)` → opponent data for Module 3
8. `getPoolStandings(poolId, userId)` → alive count for context

### State Variables

```typescript
const [poolPlayerId, setPoolPlayerId] = useState<string | null>(null);
const [round, setRound] = useState<Round | null>(null);
const [deadline, setDeadline] = useState<PickDeadline | null>(null);
const [games, setGames] = useState<PickableTeam[]>([]);
const [existingPick, setExistingPick] = useState<Pick | null>(null);
const [inventory, setInventory] = useState<InventoryTeam[]>([]);
const [opponents, setOpponents] = useState<OpponentInventory[]>([]);
const [standings, setStandings] = useState<PoolStandings | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// Collapse state for modules
const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
  todaysGames: true,
  pickOptimizer: true,
  teamInventory: false,
  opponentXray: false,
  pathSimulator: false,
});
```

### Collapsible Module Wrapper

Create a reusable wrapper for progressive disclosure:

```typescript
function ModuleSection({
  id,
  title,
  subtitle,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div>
          <h2 className="text-sm font-bold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-[#8A8694] mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {subtitle}
            </p>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-[#8A8694] transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-[rgba(255,255,255,0.05)]">
          {children}
        </div>
      )}
    </div>
  );
}
```

---

## Part 3: Module Specifications

### Module 1: Today's Games (REAL DATA)

**Data source:** `games` array from `getPickableTeams` — these are today's matchups with teams, seeds, and opponents.

**Win probability:** Call `getSeedWinProbability(team.seed, opponent.seed)` for each team.

**Layout per matchup:**
```
┌──────────────────────────────────────────┐
│  (1) Kansas  96%  ██████████████████░░  │
│  vs                                      │
│  (16) Norfolk St.  4%  █░░░░░░░░░░░░░░  │
│  12:15 PM ET                             │
└──────────────────────────────────────────┘
```

For each unique game, show both teams with:
- Seed + name
- Win probability as percentage + progress bar
- Game time
- If the user has already picked a team in this game, show a small "YOUR PICK" badge on that team

**Styling:**
- Progress bar: orange fill for the favored team, muted for underdog
- Higher probability team gets bolder text
- Group by game time, sorted chronologically

**No-data states:**
- No active round: "No games scheduled. Check back on game day."
- Pre-tournament: "Pre-tournament analysis coming soon"

### Module 2: Team Inventory (REAL DATA)

**Data source:** `inventory` array from `getTeamInventory`.

**Three sections with counts in headers:**
- **Available** (green) — `status === 'available'` — teams still alive in tournament that you haven't used
- **Used** (gray) — `status === 'used'` — teams you've already picked in previous rounds
- **Eliminated** (red, collapsed by default) — `status === 'eliminated'` — teams knocked out of tournament that you haven't used

**Layout:**
```
AVAILABLE (12)
  🟢 (1) Kansas · East
  🟢 (2) Duke · West
  🟢 (4) Purdue · Midwest
  ...

USED (4)
  ⬛ (3) Baylor · South — Used Round 1
  ⬛ (8) Memphis · East — Used Round 2
  ...

ELIMINATED (48)  ▼ (tap to expand)
  🔴 (16) Norfolk St. · East
  🔴 (15) Colgate · South
  ...
```

Each team row: colored dot, seed in parens, team name, region. For used teams, note which round they were used (if available — we may not have round data easily; if not, just show "Used").

Sort each section by seed ascending.

**Summary subtitle for collapsed state:** "12 available · 4 used · 48 eliminated"

### Module 3: Opponent X-Ray (REAL DATA — but behind "coming soon" for Modules 3-5 if you prefer)

Actually, per the audit priorities:
- **P0 (must have):** Modules 1-2
- **P1 (should have):** Modules 3-4
- **P2 (nice to have):** Module 5

Since we have `getOpponentInventories` which fetches real data, **build Module 3 with real data too.** It's the "strategic gold" per the audit.

**Data source:** `opponents` array + `inventory` array. Cross-reference which available teams each alive player still has.

**Layout:**
Build a comparison table. Only show teams that are still available (in tournament + not eliminated). For each available team, show which alive players still have it (haven't used it).

```
OPPONENT X-RAY · 5 survivors

Team             You  Mike  Sarah  Jay  Pat
(1) Kansas        ✓    ✓     ✓     ✓    ✗
(2) Duke          ✓    ✗     ✓     ✓    ✓
(4) Purdue        ✓    ✓     ✗     ✓    ✓

⚠ Kansas: 4/5 survivors still have it — high collision risk
⭐ Duke: Only you + Sarah have it — potential edge
```

**Logic:**
- For each available team (not eliminated from tournament): check each alive opponent's `used_team_ids`. If the team ID is NOT in their used list AND the team is not eliminated, they still have it (✓). Otherwise ✗.
- Below the table: show "insights" — teams where the current user has a unique or near-unique advantage (few opponents have it) vs teams with high collision (most opponents have it).
- Sort teams by seed ascending.
- On mobile, the table might need horizontal scroll if there are many opponents. Limit to first 8 opponents, with "and X more" note.

**Summary subtitle:** "X teams only you have · Y teams everyone has"

### Module 4: Path Simulator (MOCKED)

**This module uses mocked data.** The real Monte Carlo simulation is a backend task for later.

**Show a placeholder with example data:**
```
PATH TO VICTORY

Based on your remaining team strength:

Survive to Sweet 16:  —%  (Coming soon)
Survive to Elite 8:   —%  (Coming soon)
Survive to Final 4:   —%  (Coming soon)
Win the pool:         —%  (Coming soon)

This module will calculate your survival odds
based on team win probabilities and remaining schedule.
```

**Style it as a real module** with the progress bar layout, but with dashed/empty bars and "Coming soon" labels. This way the UI is built and just needs data wired in.

### Module 5: Pick Optimizer (SEMI-REAL)

**This module can use existing data** to generate basic recommendations. It doesn't need Monte Carlo — just seed-based logic.

**Data source:** `games` (today's matchups) + `inventory` (what's available) + `opponents` (who else has what).

**Logic for three recommendation tiers:**

1. **Best Pick (🏆):** The available team playing today with the highest win probability (lowest seed in a favorable matchup). Show the win probability.

2. **Smart Pick (🎯):** An available team playing today with a good win probability (>70%) AND fewer opponents still have it. Calculated as: `winProb * (1 - opponentsWithTeam/totalOpponents)`. This balances safety with strategic value.

3. **Contrarian Pick (🎲):** An available team playing today where no or very few opponents still have it. Highest "uniqueness score" regardless of win probability (but still >50%).

**If the user has already picked:** Show "You picked (seed) Team — [win probability]%" with their pick highlighted. De-emphasize the recommendations (show them dimmed with "For next time" label).

**If deadline has passed:** Hide the recommendations entirely. Show "Picks are locked for this round."

**Disclaimer at bottom:** "⚠ This is strategy analysis, not a guarantee. Trust your gut."

**Summary subtitle:** "Top pick: (1) Kansas — 96% win"

---

## Part 4: Timing Behavior (from audit §5)

The page adapts based on timing state:

| State | Module 1 | Module 2 | Module 3 | Module 4 | Module 5 |
|---|---|---|---|---|---|
| Pre-tournament (no active round) | "No games scheduled" | Full inventory (all available) | Show but note "Pre-tournament" | Mocked/Coming soon | Hidden |
| Pre-pick (active round, no pick) | Full games + probs | Full inventory | Full opponent data | Mocked/Coming soon | Full recommendations |
| Post-pick (active round, pick submitted) | Games + "Your pick" badge | Full inventory | Full opponent data | Mocked/Coming soon | Show pick context, dim recommendations |
| Post-deadline (deadline passed) | Games, read-only | Full inventory | Full opponent data (all picks revealed) | Mocked/Coming soon | Hidden ("Picks locked") |
| Eliminated | Games (read-only) | Inventory (for reference) | Opponent data | Mocked/Coming soon | Hidden |
| Tournament complete | "Tournament complete" | Final inventory | Final state | Mocked/Coming soon | Hidden |

---

## Part 5: State Matrix (from audit §6)

| Condition | What to Show |
|---|---|
| Loading | Skeleton: 5 pulsing module rectangles |
| Error | "Analysis unavailable" + retry button |
| No pool selected / not a member | "Join a pool to see analysis" |
| Pre-tournament | Modules 1-2 with pre-tournament state, Module 5 hidden, 3-4 show "Pre-tournament" |
| Active tournament | Full modules per timing table above |
| Post-tournament | "Final Analysis" header, retrospective view |
| Eliminated | All modules visible but Module 5 hidden, read-only context |

---

## Part 6: Styling Notes

- Use the same color palette and font families as all other pages
- Module cards: `bg-[#111118]` with `border border-[rgba(255,255,255,0.05)]` and `rounded-[12px]`
- Section headers: Oswald uppercase
- Body text: DM Sans
- Numbers/data: Space Mono
- Progress bars: Use a simple div-based bar. Orange fill (`bg-[#FF5722]`) on dark track (`bg-[#1A1A24]`). Round corners.
- Win probabilities: bold, color-coded (green >80%, amber 60-80%, red <60%)
- ✓ symbols: green (#4CAF50). ✗ symbols: red (#EF5350) or muted (#8A8694)
- The opponent X-ray table should use a horizontally scrollable container on mobile

---

## Audit Cross-Reference Checklist

| Audit Section | Requirement | Where Addressed |
|---|---|---|
| §5 Analyze | Module 1: Today's Games with win probabilities | Part 3: Module 1 (real data) |
| §5 Analyze | Module 2: Team Inventory Grid (available/used/eliminated) | Part 3: Module 2 (real data) |
| §5 Analyze | Module 3: Opponent X-Ray comparison table | Part 3: Module 3 (real data) |
| §5 Analyze | Module 4: Path Simulator with survival projections | Part 3: Module 4 (mocked) |
| §5 Analyze | Module 5: Pick Optimizer (best/smart/contrarian) | Part 3: Module 5 (semi-real) |
| §5 Analyze | Progressive disclosure: 1+5 expanded, 2+3+4 collapsed | Part 2: expandedModules default state |
| §5 Analyze | Timing behavior: pre-pick, post-pick, post-deadline, post-game | Part 4: full timing table |
| §5 Analyze | Trust disclaimer on Module 5 | Part 3: Module 5 spec |
| §5 Analyze | Monetization gate: Modules 1-2 free, 3-5 premium | Part 3: noted but not gated yet |
| §6 State Matrix | Empty: "No pool selected" | Part 5 |
| §6 State Matrix | Loading: Skeleton modules | Part 5 |
| §6 State Matrix | Error: "Analysis unavailable" | Part 5 |
| §6 State Matrix | Pre-tournament: "coming soon" or seed preview | Part 4 + Part 5 |
| §6 State Matrix | Active: Full modules | Part 4 |
| §6 State Matrix | Complete: Retrospective | Part 5 |
| §6 State Matrix | Eliminated: Limited (no optimizer) | Part 4 |
| §7 Backend Gaps | getAnalysisData → getTeamInventory | Part 1: Function 1 |
| §7 Backend Gaps | Opponent matrix data | Part 1: Function 2 |
| §7 Backend Gaps | Win probabilities (seed model fallback) | Part 1: Function 3 |
| §9 P0 #4 | "Build Analyze tab (Modules 1-2)" | Part 3: Modules 1-2 with real data |
| §9 P1 | "Analyze Modules 3-4" | Part 3: Module 3 real, Module 4 mocked |
| §9 P2 #16 | "Analyze Modules 3-5" | Part 3: Module 5 semi-real |
| §Appendix | New file: analyze/*.tsx or inline | Part 2: all inline in page |
| §Appendix | New file: lib/analyze.ts | Part 1 |

---

## Files to Create
1. `src/lib/analyze.ts` — data functions (getTeamInventory, getOpponentInventories, getSeedWinProbability)

## Files to Modify
1. `src/app/pools/[id]/analyze/page.tsx` — full rewrite from placeholder

## What NOT to Do
- Don't create separate component files for each module (keep everything in the page file for now — we can extract later)
- Don't add `win_probability` columns to the games table (use the seed-based model)
- Don't build a real Monte Carlo simulation (Module 4 is mocked)
- Don't add payment/monetization gating yet
- Don't modify any other pages
- Don't change lib/picks.ts or the games/teams schema
- Don't add `lib/odds.ts` yet (seed model is sufficient for launch)

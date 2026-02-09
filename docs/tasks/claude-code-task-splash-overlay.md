# Task: App Splash Overlay

**Purpose:** Every time a logged-in user opens the app, show a brief context-aware splash overlay before the dashboard. It sets the mood, shows what's happening in the tournament right now, and gets people hyped. The overlay appears once per session and dismisses on tap or after 5 seconds.

## Files to Read First

- `src/app/dashboard/page.tsx` — the dashboard component (line 439+). The overlay renders on top of this.
- `src/lib/status.ts` — if it exists, this has `getTournamentState()` which provides tournament/round status. If it doesn't exist yet, you'll need to derive status from game data (query all rounds with their games, count scheduled/in_progress/final per round).
- `src/lib/standings.ts` — `getMyPools()` for the user's pool/entry data
- `src/app/globals.css` — existing animations (fade-in, slide-up, glow-pulse, etc.)
- `src/lib/timezone.ts` — `formatET()` for time display

## Overview

Create a `SplashOverlay` component that renders as a full-screen overlay on top of the dashboard. It shows different content based on tournament state. It appears once per browser session (use `sessionStorage` to track).

---

## Component: `src/components/SplashOverlay.tsx`

### Architecture

```typescript
'use client';

import { useEffect, useState } from 'react';

// The overlay needs:
// 1. Tournament state (pre_tournament, tournament_live, tournament_complete)
// 2. Current round info (name, status, deadline, game counts)
// 3. User's pick status for current round
// 4. Some aggregate stats (total players, pools, eliminations today)

interface SplashData {
  tournamentStatus: 'pre_tournament' | 'tournament_live' | 'tournament_complete';
  roundStatus: 'pre_round' | 'round_live' | 'round_complete' | null;
  roundName: string | null;
  countdownTarget: string | null;  // ISO datetime to count down to
  countdownLabel: string | null;   // "TOURNAMENT STARTS IN" / "FIRST TIP IN" etc.
  userPickStatus: 'picked' | 'needs_pick' | 'eliminated' | 'no_round' | null;
  userPickTeam: string | null;     // "Duke" if they've picked
  gamesTotal: number;
  gamesFinal: number;
  gamesInProgress: number;
  eliminationsToday: number;
  totalPlayers: number;
  totalPools: number;
  topPickedTeams: { name: string; abbreviation: string; seed: number; count: number }[];
  userSurvived: boolean | null;    // true if user survived last completed round
}
```

### State Logic — What to Show

**1. Pre-Tournament** (`tournamentStatus === 'pre_tournament'`):
```
┌─────────────────────────────────────────────┐
│                                              │
│              S U R V I V E                   │
│                 THE                          │
│               DANCE                          │
│                                              │
│     EVERY PICK COULD BE YOUR LAST            │
│                                              │
│          TIPS OFF IN                         │
│     ┌────┐  ┌────┐  ┌────┐                  │
│     │ 32 │  │ 14 │  │ 22 │                  │
│     │DAYS│  │ HRS│  │MIN │                  │
│     └────┘  └────┘  └────┘                  │
│                                              │
│     124 players · 18 pools ready             │
│                                              │
│          ─── tap to enter ───                │
│                                              │
└─────────────────────────────────────────────┘
```

- Wordmark with fade-in animation
- Tagline
- Countdown to first game of the tournament (earliest `game_datetime` across all rounds)
- Player/pool count
- "tap to enter" prompt with subtle pulse

**2. Game Day — Pre-Tipoff** (`tournamentStatus === 'tournament_live'` AND `roundStatus === 'pre_round'`):
```
┌─────────────────────────────────────────────┐
│                                              │
│           ROUND OF 64 · DAY 1               │
│                                              │
│           TIPS OFF IN                        │
│     ┌────┐  ┌────┐  ┌────┐                  │
│     │ 02 │  │ 15 │  │ 44 │                  │
│     │ HRS│  │MIN │  │SEC │                  │
│     └────┘  └────┘  └────┘                  │
│                                              │
│    16 games today · 64 teams in action       │
│                                              │
│    ┌───────────────────────────────────┐     │
│    │ YOUR PICK: (1) DUKE ✓            │     │
│    └───────────────────────────────────┘     │
│    OR                                        │
│    ┌───────────────────────────────────┐     │
│    │ ⚠️ YOU HAVEN'T PICKED YET        │     │
│    └───────────────────────────────────┘     │
│                                              │
│          ─── tap to enter ───                │
│                                              │
└─────────────────────────────────────────────┘
```

- Round name prominent
- Countdown to first tip of this round
- Game count for the day
- User's pick status — green card if picked, orange warning if not
- If user is eliminated, show "SPECTATING" instead of pick status

**3. Games Live** (`roundStatus === 'round_live'`):
```
┌─────────────────────────────────────────────┐
│                                              │
│           🏀 GAMES ARE LIVE                  │
│           Round of 64 · Day 1               │
│                                              │
│     ┌─────────────────────────────────┐     │
│     │  8 of 16 games final            │     │
│     │  ████████░░░░░░░░  50%          │     │
│     └─────────────────────────────────┘     │
│                                              │
│     12 players eliminated today              │
│                                              │
│     MOST PICKED TODAY                        │
│     (1) Duke ····················· 67%       │
│     (1) Kansas ··················· 54%       │
│     (2) UCLA ····················· 41%       │
│     (1) UNC ·····················  38%       │
│     (2) Villanova ················ 35%       │
│                                              │
│          ─── tap to enter ───                │
│                                              │
└─────────────────────────────────────────────┘
```

- "GAMES ARE LIVE" with a pulsing animation on the basketball emoji or a red live dot
- Progress bar showing games completed out of total
- Eliminations count for today
- Top 5 most picked teams this round (after deadline, this is public info)
- No countdown — games are happening now

**4. Round Complete** (`roundStatus === 'round_complete'` AND next round exists):
```
┌─────────────────────────────────────────────┐
│                                              │
│           ROUND COMPLETE                     │
│           Round of 64 · Day 1               │
│                                              │
│     ┌─────────────────────────────────┐     │
│     │     ✓ YOU SURVIVED              │     │  (green)
│     └─────────────────────────────────┘     │
│     OR                                       │
│     ┌─────────────────────────────────┐     │
│     │     ☠️ YOU WERE ELIMINATED       │     │  (red)
│     │     Picked: Norfolk State       │     │
│     └─────────────────────────────────┘     │
│                                              │
│     18 eliminated · 106 still alive          │
│                                              │
│     Next round: Round of 64 · Day 2         │
│     Starts Mar 21                            │
│                                              │
│          ─── tap to enter ───                │
│                                              │
└─────────────────────────────────────────────┘
```

- "ROUND COMPLETE" with the round name
- User's survival result — big green checkmark or red skull
- If eliminated, show which team killed them
- Stats: eliminated count, alive count
- Next round preview with date

**5. Tournament Complete** (`tournamentStatus === 'tournament_complete'`):
```
┌─────────────────────────────────────────────┐
│                                              │
│              🏆                               │
│       TOURNAMENT COMPLETE                    │
│                                              │
│     ┌─────────────────────────────────┐     │
│     │   CHAMPION: [Winner Name]       │     │
│     │   Survived all 8 rounds         │     │
│     └─────────────────────────────────┘     │
│     OR if you won:                           │
│     ┌─────────────────────────────────┐     │
│     │   🏆 YOU WON!                   │     │
│     │   Survived all 8 rounds         │     │
│     └─────────────────────────────────┘     │
│                                              │
│     See you next March.                      │
│                                              │
│          ─── tap to enter ───                │
│                                              │
└─────────────────────────────────────────────┘
```

---

## Data Fetching

Create a helper function that fetches everything the overlay needs in one go. This should be efficient — the overlay shouldn't slow down the app load.

```typescript
async function fetchSplashData(userId: string): Promise<SplashData> {
  // 1. Get tournament state (rounds + games)
  // Either import from status.ts if it exists, or query directly:
  const { data: rounds } = await supabase
    .from('rounds')
    .select('id, name, date, games(id, status, game_datetime)')
    .order('date', { ascending: true });

  // Derive tournament status, current round, deadline from game states
  // (same logic as status.ts)

  // 2. Get user's pool_player entries for pick status
  const { data: entries } = await supabase
    .from('pool_players')
    .select('id, is_eliminated, elimination_round_id')
    .eq('user_id', userId);

  // 3. If current round exists, check if user has picked
  // Query picks for the current round for any of the user's entries

  // 4. Get aggregate stats
  // Total players: count of pool_players
  // Total pools: count of pools
  // Eliminations today: count of pool_players where elimination_round_id = current round

  // 5. Top picked teams (only if round is live or complete — picks are public)
  // Query picks for current round, group by team_id, count, join team name
  // Only fetch this if round deadline has passed

  return { ... };
}
```

For the **top picked teams** query (only when round is live/complete):
```sql
-- Get pick counts per team for the current round
SELECT t.name, t.abbreviation, t.seed, COUNT(*) as pick_count
FROM picks p
JOIN teams t ON p.team_id = t.id
WHERE p.round_id = [current_round_id]
GROUP BY t.id, t.name, t.abbreviation, t.seed
ORDER BY pick_count DESC
LIMIT 5
```

In Supabase client, this would be a raw RPC call or you can approximate with multiple queries. The simplest approach: fetch all picks for the round, then count client-side.

---

## Session Storage — Show Once Per Session

```typescript
const SPLASH_KEY = 'std_splash_shown';

function hasSeenSplash(): boolean {
  if (typeof window === 'undefined') return true;
  return sessionStorage.getItem(SPLASH_KEY) === 'true';
}

function markSplashSeen(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SPLASH_KEY, 'true');
  }
}
```

The overlay checks `hasSeenSplash()` on mount. If already seen, don't render. When dismissed, call `markSplashSeen()`.

**IMPORTANT:** sessionStorage clears when the tab/browser is closed, so users see the splash once per session, not once ever.

---

## Dismiss Behavior

- **Tap anywhere** on the overlay to dismiss
- **Auto-dismiss after 5 seconds** if user doesn't tap
- **Fade-out animation** (300ms) on dismiss, then remove from DOM
- **During fade-out**, the dashboard should already be visible behind (overlay has a semi-transparent or full background that fades)

---

## Integration with Dashboard

In `src/app/dashboard/page.tsx`:

```typescript
import { SplashOverlay } from '@/components/SplashOverlay';

export default function Dashboard() {
  const { user } = useAuth();
  // ... existing code ...

  return (
    <>
      <SplashOverlay userId={user?.id} />
      <div className="min-h-screen bg-[#0D1B2A] pb-24">
        {/* existing dashboard content */}
      </div>
    </>
  );
}
```

The overlay renders on top with `position: fixed; inset: 0; z-index: 50;` and the dashboard loads underneath.

---

## Styling

- Full-screen overlay: `position: fixed; inset: 0; z-index: 50; background: #0D1B2A;`
- Everything centered vertically and horizontally
- Wordmark uses the same style as the landing page (Barlow Condensed for SURVIVE, Oswald for THE DANCE)
- Countdown boxes: orange border, Oswald font, each digit in its own box
- "tap to enter" text: small, `#5F6B7A`, with a gentle pulse animation
- Pick status card: green border/bg for picked (`rgba(76,175,80,0.1)`), orange for needs pick (`rgba(255,87,34,0.1)`)
- "GAMES ARE LIVE" pulse: use the existing `pulse-dot` or `glow-pulse` animation from globals.css
- Progress bar: surface-3 background (`#1B2A3D`), green fill (`#4CAF50`)
- Top picked teams: Oswald for team names, Space Mono for percentages
- All text colors: headings `#E8E6E1`, body `#9BA3AE`, accents `#FF5722`
- Fade-in on mount: use the existing `fade-in` animation
- Fade-out on dismiss: add a `fade-out` keyframe (opacity 1 → 0, 300ms)

---

## Countdown Timer Component

Reuse or create a countdown that ticks every second:

```typescript
function CountdownTimer({ target, label }: { target: string; label: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const diff = Math.max(0, new Date(target).getTime() - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  // Show days if > 1 day away, otherwise show HH:MM:SS
  const showDays = days > 0;

  return (
    <div className="text-center">
      <p className="text-label-accent mb-3">{label}</p>
      <div className="flex justify-center gap-3">
        {showDays && <CountdownBox value={days} unit="DAYS" />}
        <CountdownBox value={hours} unit="HRS" />
        <CountdownBox value={minutes} unit="MIN" />
        {!showDays && <CountdownBox value={seconds} unit="SEC" />}
      </div>
    </div>
  );
}

function CountdownBox({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 rounded-[10px] border border-[rgba(255,87,34,0.3)] bg-[rgba(255,87,34,0.05)] flex items-center justify-center">
        <span className="text-2xl font-bold text-[#FF5722]" style={{ fontFamily: "'Oswald', sans-serif" }}>
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span className="text-[0.6rem] tracking-[0.2em] text-[#5F6B7A] mt-1" style={{ fontFamily: "'Space Mono', monospace" }}>
        {unit}
      </span>
    </div>
  );
}
```

---

## Files to Create

1. `src/components/SplashOverlay.tsx` — the overlay component with all 5 states

## Files to Modify

1. `src/app/dashboard/page.tsx` — import and render `<SplashOverlay />` above the dashboard content
2. `src/app/globals.css` — add `fade-out` keyframe if not present

## What NOT to Do

- Don't block the dashboard from loading — the overlay sits on top while dashboard loads underneath
- Don't use localStorage — use sessionStorage so it shows once per session (clears on tab close)
- Don't make the data fetching slow — if data takes too long, show the overlay with just the wordmark and dismiss immediately. Don't hold users hostage waiting for data.
- Don't show the overlay on non-dashboard pages (pick, standings, etc.)
- Don't show the overlay for users who aren't logged in — the landing page handles that
- Don't fetch top picked teams before the deadline — that would leak pick data. Only fetch when round is live or complete.

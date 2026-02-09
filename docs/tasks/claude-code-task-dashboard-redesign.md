# Task: Dashboard Full Redesign — Game Day Dashboard

**Purpose:** The dashboard currently functions as an admin panel (entry management, join codes, pick CTAs). Now that the picks page handles entry creation and pick management, the dashboard should transform into a **game day command center** — hype, status, activity, survival progress. Something you want to check 10 times on game day.

## Files to Read First

- `src/app/dashboard/page.tsx` — current dashboard (478 lines). **Replace entirely.**
- `src/hooks/useActivePool.ts` — `useActivePool` hook provides `pools`, `activePoolId`, `setActivePool`, `loadingPools`, `refreshPools`
- `src/types/standings.ts` — `MyPool` and `MyPoolEntry` types (what pool data looks like)
- `src/lib/status.ts` — if it exists, `getTournamentState()` for derived tournament/round status
- `src/components/SplashOverlay.tsx` — splash overlay, avoid duplicating its content
- Component library reference: survival progress bars (§11), badges (§6), standings rows (§8)

## Overview

Replace the current pool-card-centric dashboard with a single-scroll game day dashboard. The layout adapts based on tournament state. The page is organized into **sections** (not pool cards), each showing a different slice of what's happening.

---

## Page Layout — Section Order

```
┌─────────────────────────────────────────────┐
│  1. HERO BANNER (context-aware)             │
│     Tournament status + countdown/scores    │
├─────────────────────────────────────────────┤
│  2. YOUR STATUS (survival summary)          │
│     Entries across all pools with progress   │
├─────────────────────────────────────────────┤
│  3. ACTION CARD (if picks needed)           │
│     Urgent CTA to make picks                │
├─────────────────────────────────────────────┤
│  4. YOUR POOLS (simplified cards)           │
│     Compact pool overview with share/join   │
├─────────────────────────────────────────────┤
│  5. ACTIVITY FEED (live updates)            │
│     Recent events across your pools         │
├─────────────────────────────────────────────┤
│  6. CREATE / JOIN (pre-tournament only)     │
│     Pool management actions                 │
└─────────────────────────────────────────────┘
```

---

## Section 1: Hero Banner

Context-aware header at the top. Changes based on tournament state.

**Pre-Tournament:**
```
SURVIVE THE DANCE
────────────────────────
2026 NCAA Tournament
Tips off Mar 18 · 32 days away
124 players · 18 pools
```

**Game Day — Pre-Tipoff:**
```
ROUND OF 64 · DAY 1
────────────────────────
FIRST TIP IN 2h 15m
16 games today
```

**Games Live:**
```
🔴 LIVE · ROUND OF 64 · DAY 1
────────────────────────
8 of 16 games final
████████░░░░░░░░ 50%
3 upsets · 12 eliminated today
```

**Between Rounds:**
```
ROUND OF 64 COMPLETE
────────────────────────
Next: Round of 32 · Mar 22
```

**Tournament Complete:**
```
🏆 TOURNAMENT COMPLETE
────────────────────────
2026 NCAA Tournament
```

**Styling:**
- Small wordmark top-left (or centered on mobile)
- Oswald uppercase for round name
- Space Mono for stats
- Thin orange accent line below the section
- Background: subtle radial gradient `rgba(255,87,34,0.03)` center fading out
- Keep it compact — 3-4 lines max

---

## Section 2: Your Status — Survival Summary

A visual snapshot of how you're doing across ALL entries in ALL pools.

**Layout:**
```
YOUR ENTRIES                          3 alive · 1 eliminated
─────────────────────────────────────────────────────────────

Pool 1 — Padres          ●●●●●●●○○○○○○  Day 7/13   ALIVE
Pool 1 — Chargers        ●●●●●○○○○○○○○  Day 5/13   ELIMINATED
Pool 2 — My Entry        ●●●●●●●○○○○○○  Day 7/13   ALIVE
Pool 3 — Lucky Pick      ●●●●●●●○○○○○○  Day 7/13   ALIVE
```

Each row shows:
- Pool name + entry label
- Survival progress bar (from component library §11 — orange segments for survived, yellow pulse for current, red for elimination round, gray for future)
- Current day / total days
- Status badge (alive green, eliminated red + strikethrough)

**Styling:**
- Section header: `YOUR ENTRIES` in Space Mono label style, with alive/eliminated count right-aligned
- Each entry row: ~48px tall, pool name in DM Sans, progress bar takes most of the width
- Status badge uses component library badge classes
- Eliminated entries dimmed to 45% opacity
- If user has only 1 entry across all pools, still show it — the progress bar is the key visual

**Data Needed:**
- All `pool_players` for this user across all pools
- For each entry: pool name, entry label, is_eliminated, elimination_round
- Total rounds in tournament, which rounds are complete
- Derive survival day count from number of completed rounds where entry was alive

---

## Section 3: Action Card — Pick CTA

**Only shows if ANY alive entry needs a pick for the current round AND picks are open.**

```
┌─────────────────────────────────────────────┐
│  ⚠ 2 ENTRIES NEED PICKS                     │
│                                              │
│  Picks lock in 2h 15m · Round of 64 Day 1  │
│                                              │
│  ┌─────────────────────────────────┐        │
│  │       MAKE YOUR PICKS →         │        │
│  └─────────────────────────────────┘        │
└─────────────────────────────────────────────┘
```

**Styling:**
- Card with orange-accent border (`border-accent` from component library)
- Warning icon + count in orange
- Deadline countdown in Space Mono
- Big orange CTA button, full width
- Button links to the pick page for the active pool. If entries needing picks span multiple pools, link to the first one.
- If all entries have picked, this section is hidden entirely (don't show a "you're all set" — just remove it)

**Condition:**
```typescript
const entriesNeedingPicks = allEntries.filter(e => !e.is_eliminated && !e.has_picked_today);
const showPickCTA = entriesNeedingPicks.length > 0 && picksAreOpen;
```

---

## Section 4: Your Pools — Simplified Cards

Compact pool cards. No more entry management, no add entry, no make pick buttons (that's all on the picks page now). These are informational.

**Each pool card shows:**
```
┌─────────────────────────────────────────────┐
│  POOL 1                    12/15 alive       │
│  Round of 64 · Day 1      Picks Lock 2:15   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ CODE  6KLL8VMC        Copy   Share   │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

- Pool name (Oswald uppercase, orange if active)
- Alive count: `X/Y alive`
- Current round + deadline (if applicable)
- Join code row with Copy + Share buttons
- Clicking the card navigates to that pool's pick page (sets activePool)
- **No entry list** (that's in Section 2 survival summary)
- **No Make Pick button** (that's in Section 3 action card)
- **No Add Entry** (that's on the picks page now)
- Creator badge (small gear icon) if they created it

**Pre-Tournament:** Show pool name, player count, join code. No round/deadline info.
**Complete:** Show "Tournament Complete · Winner: [Name]" instead of round info.

**Hide join code row** when tournament is complete (no one's joining anymore).

---

## Section 5: Activity Feed

A chronological feed of recent events across all the user's pools. This is what makes people check the app constantly.

**Feed items (newest first, max 20 items):**

- **Elimination:** `☠️ Mike eliminated · Picked (5) San Diego State · Pool 1 · 2h ago`
- **Survival:** `✓ You survived Day 5 · Picked (2) Duke · Pool 1 · 3h ago`
- **Upset Alert:** `🚨 (13) Furman upsets (4) Virginia! · 1h ago`
- **Round Complete:** `Round of 64 Day 1 complete · 8 upsets · 14 eliminated · 5h ago`
- **Game Final:** `Final: (1) Duke 78, (16) Norfolk State 55 · 45m ago`
- **Pick Made:** `You picked (2) Villanova for Pool 1 — Padres · 6h ago`
- **Player Joined:** `Sarah joined Pool 1 · 1d ago`

**Data Source:**
This is the most complex part. Options:
1. **Query-based (recommended):** Don't create an activity table. Instead, derive the feed from existing data:
   - Recent picks (from `picks` table where `round_id` = current/last round, join user names)
   - Recent eliminations (from `pool_players` where `elimination_round_id` = current/last round)
   - Recent game results (from `games` where `status` = 'final' in last 24h)
   - New pool members (from `pool_players` created in last 48h)
2. Merge, sort by timestamp, show most recent 20

**Styling:**
- Each feed item: icon + text + timestamp, single line
- Timestamp in Space Mono, `#5F6B7A`
- Elimination items have red-subtle background
- Your own events have orange left border (like the standings `you` row)
- Compact: ~36px per item
- "Show More" button at bottom if >20 items

**Pre-Tournament:** Show "No activity yet — waiting for tip-off" with countdown

**Important:** Only show feed items relevant to the user's pools. Don't show activity from pools they're not in.

---

## Section 6: Create / Join (Pre-Tournament Only)

**Only visible before the tournament starts.** Once the first game tips off, this section disappears.

```
┌─────────────────────────────────────────────┐
│  + Create Pool        + Join Pool            │
└─────────────────────────────────────────────┘
```

Simple row with two ghost-style buttons linking to `/pools/create` and `/pools/join`. Same as what's currently at the top of the dashboard.

---

## Empty State (No Pools)

If user has no pools at all:

```
┌─────────────────────────────────────────────┐
│                                              │
│           SURVIVE THE DANCE                  │
│     2026 March Madness Survivor Pool        │
│                                              │
│     Create a pool and invite your friends,  │
│     or join an existing pool with a code.   │
│                                              │
│  ┌──────────────┐  ┌──────────────┐        │
│  │ Create Pool   │  │  Join Pool   │        │
│  └──────────────┘  └──────────────┘        │
│                                              │
│     Free to play · No money involved        │
│                                              │
└─────────────────────────────────────────────┘
```

---

## Data Fetching

The current dashboard loads data through `useActivePool` which calls `getMyPools()`. The redesigned dashboard needs additional data:

1. **Tournament state** — from `getTournamentState()` or derived from games
2. **All entries across all pools** — already available in `pools[].your_entries`
3. **Activity feed data** — NEW query needed:

```typescript
async function getActivityFeed(userId: string, poolIds: string[]): Promise<ActivityItem[]> {
  // 1. Recent game results (last 24h)
  const { data: games } = await supabase
    .from('games')
    .select('id, status, team1_score, team2_score, game_datetime, team1:teams!team1_id(name, seed), team2:teams!team2_id(name, seed), winner_id, rounds(name)')
    .eq('status', 'final')
    .gte('game_datetime', twentyFourHoursAgo)
    .order('game_datetime', { ascending: false })
    .limit(20);

  // 2. Recent eliminations in user's pools
  const { data: eliminations } = await supabase
    .from('pool_players')
    .select('display_name, entry_label, elimination_round_id, elimination_reason, is_eliminated, pools(name), rounds:elimination_round_id(name), user_id')
    .in('pool_id', poolIds)
    .eq('is_eliminated', true)
    .order('updated_at', { ascending: false })
    .limit(20);

  // 3. Recent picks (only after deadline passed — don't leak active picks)
  // Only show picks from completed rounds or after current round deadline
  const { data: picks } = await supabase
    .from('picks')
    .select('created_at, teams(name, seed), pool_players(entry_label, user_id, pools(name)), rounds(name)')
    .in('pool_player_id', userEntryIds)
    .order('created_at', { ascending: false })
    .limit(20);

  // 4. New players in user's pools (last 48h)
  const { data: newPlayers } = await supabase
    .from('pool_players')
    .select('display_name, entry_label, created_at, pools(name)')
    .in('pool_id', poolIds)
    .gte('created_at', fortyEightHoursAgo)
    .order('created_at', { ascending: false })
    .limit(10);

  // Merge and sort by timestamp
  return mergeAndSort([...gameItems, ...eliminationItems, ...pickItems, ...newPlayerItems]);
}
```

4. **Global stats for hero** — total players, total pools, games final today:

```typescript
const { count: totalPlayers } = await supabase.from('pool_players').select('*', { count: 'exact', head: true });
const { count: totalPools } = await supabase.from('pools').select('*', { count: 'exact', head: true });
```

---

## Responsive Design

**Mobile (< 768px):**
- All sections stack vertically, full width
- Hero banner: centered text
- Survival bars: pool name above bar (not inline)
- Pool cards: full width, single column
- Activity feed: full width

**Desktop (>= 768px):**
- Max-width container: `max-w-2xl` (672px) centered
- Hero banner can be wider with more horizontal space
- Survival summary: pool name + bar inline
- Pool cards: could do 2-column grid if 3+ pools, otherwise single column
- Activity feed: same width as content

---

## Loading State

Show a skeleton that matches the new layout:
- Hero banner skeleton (2 text lines)
- 3 survival bar skeletons
- 1 action card skeleton
- 2 pool card skeletons

---

## What to Keep From Current Dashboard

- `useActivePool` hook usage
- `useAuth` for user context  
- Pool activation logic (clicking a pool sets it as active)
- Copy/Share join code logic (reuse the existing clipboard + share API code)
- `formatDeadline` utility function
- `formatET` import

## What to Remove

- `EntryStatusLine` component (replaced by survival summary)
- `PoolCard` component (replaced by simplified pool cards)
- Add Entry inline form (moved to picks page)
- Make Pick / Change Pick / Standings CTA buttons (picks page handles this)
- The dense per-entry status lines within each pool card

---

## Files to Create

1. `src/app/dashboard/page.tsx` — complete rewrite of the dashboard
2. `src/lib/activity.ts` — `getActivityFeed()` function for the activity feed data

## Files to Modify

None — this is a full replacement of the dashboard page.

## What NOT to Do

- Don't duplicate the splash overlay content — the hero banner is simpler/smaller than the splash
- Don't show pick details or let users make picks from the dashboard — that's the picks page
- Don't show the add entry form — that's on the picks page now
- Don't create a new database table for activity — derive it from existing data
- Don't show activity from pools the user isn't in
- Don't show other users' picks before the deadline (privacy)
- Don't make the activity feed query too expensive — limit to last 24-48h of data, max 20 items

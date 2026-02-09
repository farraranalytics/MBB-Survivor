# Task 17: Elimination & Spectator Experience

**Purpose:** Right now, eliminated users hit a dead end — the Pick tab shows a generic error message "You have been eliminated from this pool" and that's it. This task creates a proper post-elimination experience across every tab so eliminated users stay engaged as spectators.

## Files to Read Before Writing Code

- `src/app/pools/[id]/pick/page.tsx` — current eliminated handling (line ~277, returns early with error)
- `src/app/dashboard/page.tsx` — EntryStatusLine component, pool card CTAs
- `src/app/pools/[id]/standings/page.tsx` — standings grid (already handles eliminated display)
- `src/app/pools/[id]/analyze/page.tsx` — has `isEliminated` state already (line ~619)
- `src/app/pools/[id]/bracket/page.tsx` — no elimination handling yet
- `src/lib/picks.ts` — `getPlayerPicks()` returns full pick history with team + round data
- `src/types/standings.ts` — `StandingsPlayer`, `RoundResult` types
- `src/types/picks.ts` — `Pick`, `PickableTeam` types

---

## Part 1: Pick Tab — Spectator View

**Current behavior:** If `poolPlayer.is_eliminated` is true, the page returns early with a yellow warning icon and the text "You have been eliminated from this pool." Dead end.

**New behavior:** Show a spectator view with today's games (read-only) and the user's pick history.

In `src/app/pools/[id]/pick/page.tsx`:

Instead of returning early when eliminated, continue loading the round data and games. Then render a spectator layout:

### Spectator Layout

```
┌─────────────────────────────────────────────┐
│  ☠️ YOU'RE OUT                               │
│  Eliminated in [Round Name]                  │
│  [reason: picked Norfolk State / no pick]    │
├─────────────────────────────────────────────┤
│                                              │
│  YOUR RUN                                    │
│  [R1 DUKE ✓] [R2 NOVA ✓] [R3 NORF ✗]       │
│  Survived 2 rounds                           │
│                                              │
├─────────────────────────────────────────────┤
│                                              │
│  TODAY'S GAMES · Round of 32                 │
│  (read-only, no pick UI, just scores/times)  │
│                                              │
│  ┌─ Game 1 ────────────────────────────┐    │
│  │ (1) Duke  72        2:00 PM ET      │    │
│  │ (8) Memphis 65      FINAL           │    │
│  └─────────────────────────────────────┘    │
│  ┌─ Game 2 ────────────────────────────┐    │
│  │ (2) Iowa  --        7:10 PM ET      │    │
│  │ (7) Clemson --      SCHEDULED       │    │
│  └─────────────────────────────────────┘    │
│                                              │
└─────────────────────────────────────────────┘
```

### Implementation Details

**Do NOT return early when eliminated.** Instead:

1. Still load the active round, games, and deadline data even when eliminated
2. Load the player's full pick history using `getPlayerPicks(poolPlayerId)`
3. Load elimination details: which round, which team they picked (or missed pick)
4. Set a flag like `isEliminated = true` that controls whether to render the spectator view vs the normal pick UI

**Spectator header section:**
- Skull icon or ☠️ emoji
- "YOU'RE OUT" in Oswald bold uppercase
- "Eliminated in [Round Name]" — get from `pool_player.elimination_round_id` joined to round name
- Reason line: If wrong pick, show "Picked [Team Name] — lost [score]". If missed pick, show "No pick submitted"

**Your Run section:**
- Horizontal row of pick chips (same style as the new Field page expanded view)
- Each chip: `[R1 DUKE ✓]` green for correct, `[R3 NORF ✗]` red for the fatal pick
- Below the chips: "Survived X rounds" summary

**Today's Games section:**
- Show the same games data but as read-only matchup cards
- No pick selection UI, no radio buttons, no confirm button
- Show scores if games are in progress or final
- Show scheduled time if not started yet
- Games with final scores show the winner highlighted

**Entry switcher:** If the user has multiple entries and some are still alive, the entry switcher should still work. Tapping an alive entry switches to the normal pick UI. Tapping an eliminated entry shows the spectator view for that entry. The eliminated entry pills should show ☠️ but still be tappable (not disabled).

### Key Change

Remove this early return (around line 277):
```typescript
if (poolPlayer.is_eliminated) { setError('You have been eliminated from this pool.'); setLoading(false); return; }
```

Replace with:
```typescript
if (poolPlayer.is_eliminated) {
  setIsEliminated(true);
  // Don't return — continue loading round/game data for spectator view
}
```

Add new state variables:
```typescript
const [isEliminated, setIsEliminated] = useState(false);
const [pickHistory, setPickHistory] = useState<Pick[]>([]);
const [eliminationInfo, setEliminationInfo] = useState<{
  roundName: string;
  teamName: string | null;
  reason: 'wrong_pick' | 'missed_pick' | 'manual' | null;
} | null>(null);
```

Fetch pick history when eliminated:
```typescript
if (poolPlayer.is_eliminated) {
  const history = await getPlayerPicks(poolPlayer.id);
  setPickHistory(history);
  // Get elimination round name from the history or pool_player data
}
```

---

## Part 2: Dashboard — Eliminated Entry Display

**Current behavior:** Eliminated entries show a red dot and "Eliminated" text. Minimal.

**New behavior:** Show more context about the elimination.

In `src/app/dashboard/page.tsx`, update the `EntryStatusLine` component:

When `entry.is_eliminated`:
```
🔴 [Entry Name] — Eliminated R2 · Picked Norfolk State
```

Or for missed pick:
```
🔴 [Entry Name] — Eliminated R2 · No pick
```

This requires the dashboard data to include the elimination round name and the team that caused elimination. Check if `MyPoolEntry` type already has this info — if not, update the data fetching in the dashboard to join the elimination round and the pick for that round.

**If the data isn't available in the current `MyPool` response:** Add a `elimination_round_name` and `elimination_team_name` to the `MyPoolEntry` type and update the query in `src/lib/standings.ts` (or wherever `getMyPools` is defined) to join this data.

**Pool card CTA when all entries eliminated:**
Currently the card shows "Make Pick" or "View Standings" buttons. When ALL of the user's entries are eliminated, change the CTA to:
```
[View The Field]  [View Bracket]
```
No "Make Pick" button since they can't pick.

---

## Part 3: Analyze Tab — Eliminated Adjustments

**Current behavior:** The analyze page already tracks `isEliminated` state (line ~619). Check what it currently does with it.

**Changes needed:**

1. **Pick Optimizer module (Module 5):** Hide or show a message "You've been eliminated — no pick needed" instead of recommendations. The optimizer is pointless for eliminated users.

2. **Today's Games module:** Keep visible — eliminated users still want to watch games.

3. **Team Inventory module:** Keep visible — eliminated users can see what teams they used and track what's left in the tournament.

4. **Opponent comparison:** Keep visible — eliminated users can still follow who's alive and what teams they have.

5. **Add a subtle banner at the top** when eliminated:
```
You're spectating · Eliminated in [Round Name]
```
Small, non-intrusive, just context. Don't block any content.

---

## Part 4: Bracket Tab — No Changes Needed

The bracket shows tournament-wide data regardless of player status. No elimination-specific changes needed. Eliminated users see the same bracket as everyone else.

---

## Part 5: The Field / Standings — No Changes Needed

The standings page already handles eliminated players well (dimmed rows, elimination badges, etc.). The recent changes (compact rows, pick chips) already give good context. No additional work needed here.

---

## Summary of Changes

| File | What Changes |
|------|-------------|
| `src/app/pools/[id]/pick/page.tsx` | Major — replace early return with full spectator view (header + pick history + read-only games) |
| `src/app/dashboard/page.tsx` | Medium — update `EntryStatusLine` for eliminated entries, update CTAs when all entries eliminated |
| `src/app/pools/[id]/analyze/page.tsx` | Small — add spectating banner, hide pick optimizer when eliminated |
| `src/types/standings.ts` | Small — add `elimination_round_name` and `elimination_team_name` to `MyPoolEntry` if not present |
| `src/lib/standings.ts` or data fetching | Small — join elimination data if needed |

## What NOT to Do
- Don't block eliminated users from viewing any tab — they should have full read access everywhere
- Don't disable the entry switcher for eliminated entries — make them tappable to view that entry's spectator view
- Don't show the pick confirmation UI (radio buttons, confirm button) for eliminated users
- Don't show the pick optimizer recommendations for eliminated users
- Don't add shadow picks yet (that's a future feature)
- Don't change the standings/field page — it already handles elimination display well
- Don't change the bracket page — it's player-status agnostic

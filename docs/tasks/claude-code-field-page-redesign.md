# The Field Page Redesign — Grid Layout

## Overview

Redesign the standings page (`/pools/[id]/standings`) from a compact abbreviation-based grid to a full team-name grid that's much easier to scan. The mockup shows every entry's picks laid out across all rounds in colored cells, making it immediately clear who picked what and who survived.

**Reference:** `NewPickPage1.png` (uploaded screenshot of the grid mockup)

---

## Current vs New

### Current Problems
- Grid cells are tiny circles with 3-letter abbreviations (e.g., "HOU") — hard to read
- Column headers are generic "R1", "R2" — don't show which day or date
- No pool switching on the standings page itself
- No prize pot display
- No sort options

### New Design
- Grid cells are rectangular, showing full team name + seed + result icon
- Column headers show round label + date (e.g., "R64.1 Mar 19")
- Pool tabs at top to switch between user's pools
- Summary bar: Alive count, Eliminated count, Prize Pot
- Filter tabs: ALL, ALIVE, OUT (with counts)
- Sort dropdown: STREAK, NAME, etc.

---

## Layout (Top to Bottom)

```
┌──────────────────────────────────────────────────────────────┐
│ [MARCH MADNESS MANIA 47/128] [OFFICE BRACKET BUSTERS 23/64] │  ← Pool tabs
├──────────────────────────────────────────────────────────────┤
│    10          8           $3200                              │
│   ALIVE    ELIMINATED      POT                               │  ← Summary stats
├──────────────────────────────────────────────────────────────┤
│ [ALL 18] [ALIVE 10] [OUT 8]              [STREAK ▾]         │  ← Filters + Sort
├──────────────────────────────────────────────────────────────┤
│ ENTRY         │ R64.1  │ R64.2  │ R32.1  │ R32.2  │ S16.1  │  ← Column headers
│               │ Mar 19 │ Mar 20 │ Mar 21 │ Mar 22 │ Mar 26 │  ← Dates
├───────────────┼────────┼────────┼────────┼────────┼────────┤
│ 🟢 PADRES TO  │HOUSTON │ DUKE   │ AUBURN │ALABAMA │  TBD   │
│    THE S...   │ (1) ✓  │ (1) ✓  │ (1) ✓  │ (2) ✓  │        │
│    Marcus·YOU │ green  │ green  │ green  │ green  │ gray   │
├───────────────┼────────┼────────┼────────┼────────┼────────┤
│ 🟢 CHALK CITY │AUBURN  │FLORIDA │HOUSTON │ DUKE   │  TBD   │
│    Jake       │ (1) ✓  │ (1) ✓  │ (1) ✓  │ (1) ✓  │        │
├───────────────┼────────┼────────┼────────┼────────┼────────┤
│ ...                                                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Pool Tabs

**New section at the top.** Horizontal row of the user's pools, each showing pool name + alive/total.

```
[MARCH MADNESS MANIA 47/128]  [OFFICE BRACKET BUSTERS 23/64]
```

- Active pool: filled/accent background with border
- Inactive pool: subtle border, muted text
- Tapping switches to that pool's standings (navigate to `/pools/[newPoolId]/standings`)
- Data source: use the existing `useActivePool()` hook or fetch user's pools from Supabase
- Style: `fontFamily: Oswald, uppercase`, alive/total count in a small badge next to the name

**Implementation:** Fetch user's pools:
```typescript
const { data: userPools } = await supabase
  .from('pool_players')
  .select('pool_id, pools(id, name, status)')
  .eq('user_id', user.id);
// Also need alive count per pool — can use a lightweight query
```

Or simpler: use the same pool data already available from the `useActivePool` context/hook. Check if it provides a list of all user pools.

### 2. Summary Stats Bar

Three-column stat bar showing:

| Stat | Color | Background |
|------|-------|------------|
| Alive count | `#4CAF50` (green) | `rgba(76,175,80,0.1)` |
| Eliminated count | `#EF5350` (red) | `rgba(239,83,80,0.1)` |
| Prize Pot | `#E8E6E1` (white) | `#1B2A3D` |

- Numbers in large font (Space Mono, bold)
- Labels below in small caps (label class)
- Prize pot: show `$X,XXX` from `pool.prize_pool` or `pool.entry_fee * total_players`
- Already have `leaderboard.alive_players`, `leaderboard.eliminated_players`, `leaderboard.total_players`

### 3. Filter Tabs + Sort Dropdown

**Filters (left):** Keep existing filter logic but match new styling:
- `ALL 18` / `ALIVE 10` / `OUT 8` — tab-style buttons
- Active tab: filled background
- Match mockup styling: rounded, slightly larger than current

**Sort (right):** New dropdown for sorting entries:
- Options: `STREAK` (default), `NAME`, `PICKS` (most picks made)
- Small dropdown with `▾` indicator
- Style: border, mono font, uppercase

**Sort implementation:**
```typescript
const sorted = [...filteredPlayers].sort((a, b) => {
  switch (sort) {
    case 'streak': return b.survival_streak - a.survival_streak;
    case 'name': return a.entry_label.localeCompare(b.entry_label);
    case 'picks': return b.picks_count - a.picks_count;
    default: return 0;
  }
});
```

### 4. Grid Table (Core Change)

This is the main change. Replace the current tiny-circle grid with a full-width scrollable table where each cell shows the team name prominently.

**Column Headers:**
```
ENTRY  |  R64.1   |  R64.2   |  R32.1   |  R32.2   |  S16.1  |  S16.2  | ...
       |  Mar 19  |  Mar 20  |  Mar 21  |  Mar 22  |  Mar 26 |  Mar 27 | ...
```

- Use abbreviated round labels: R64.1, R64.2, R32.1, R32.2, S16.1, S16.2, E8.1, E8.2, F4, CHIP
- Show date below each header in smaller text
- The current active round's column header should be highlighted (orange text or underline)
- ENTRY column is sticky on horizontal scroll (already implemented, keep it)

**Round label mapping** (from DB round names):
```typescript
const ROUND_LABELS: Record<string, string> = {
  'Round 1 Day 1': 'R64.1',
  'Round 1 Day 2': 'R64.2',
  'Round 2 Day 1': 'R32.1',
  'Round 2 Day 2': 'R32.2',
  'Sweet 16 Day 1': 'S16.1',
  'Sweet 16 Day 2': 'S16.2',
  'Elite 8 Day 1': 'E8.1',
  'Elite 8 Day 2': 'E8.2',
  'Final Four': 'F4',
  'Championship': 'CHIP',
};
```

**Entry Column (sticky left):**
Each row shows:
- Status dot (green = alive, red = eliminated)
- Entry name (Oswald, uppercase, bold, truncated with ellipsis)
- Owner name below in small text
- "YOU" badge if it's the current user's entry

```
🟢 PADRES TO THE S...
   Marcus · YOU
```

**Pick Cells:**
Each cell is a rectangular block showing:
- Team name (Oswald, uppercase, bold, ~0.7rem)
- Seed in parentheses + result checkmark below (mono, smaller)

Cell backgrounds by state:
| State | Background | Text Color | Icon |
|-------|-----------|------------|------|
| Survived (correct) | `rgba(76,175,80,0.15)` | `#4CAF50` | `✓` |
| Eliminated (wrong) | `rgba(239,83,80,0.15)` | `#EF5350` | `✗` |
| In Progress (live) | `rgba(255,179,0,0.12)` | `#FFB300` | pulse |
| Pending (scheduled) | `rgba(27,58,92,0.3)` | `#E8E6E1` | — |
| No Pick | transparent | `#5F6B7A` | `—` |
| Hidden (pre-deadline) | transparent | `#5F6B7A` | 🔒 |
| TBD (future round) | transparent | `#3D4654` | `TBD` |

**Cell component:**
```tsx
function PickCell({ result, round, isOwnEntry }: { ... }) {
  // If round hasn't started and no games exist yet → "TBD"
  // If deadline hasn't passed and not own entry → lock icon  
  // If no pick submitted → "—"
  // Otherwise → team name + seed + result indicator

  return (
    <td className="px-2 py-2 text-center min-w-[90px]">
      <div className={`rounded-md px-2 py-1.5 ${bgClass}`}>
        <div className="font-bold text-xs uppercase truncate" 
             style={{ fontFamily: "'Oswald', sans-serif" }}>
          {result.team_name}
        </div>
        <div className="text-[10px] mt-0.5" 
             style={{ fontFamily: "'Space Mono', monospace" }}>
          ({result.team_seed}) {icon}
        </div>
      </div>
    </td>
  );
}
```

**Minimum cell width:** `min-w-[90px]` to ensure team names are readable. The table is horizontally scrollable for later rounds.

### 5. Remove the List View Toggle

The current page has a Grid/List toggle. The new design is grid-only (the list view was a fallback for the old tiny-circle grid). Remove the toggle button and the entire list view section. The grid IS the view now.

### 6. Remove the Legend

The old legend explained the tiny circle colors. The new grid cells are self-explanatory (green with ✓ = survived, red with ✗ = out, TBD = future). Remove the legend section at the bottom.

---

## Files to Modify

1. **`src/app/pools/[id]/standings/page.tsx`** — Major rewrite:
   - Add pool tabs at top
   - Replace summary section with new 3-stat bar (add pot)
   - Replace GridCell component with new PickCell
   - Replace grid table with new column headers + cell layout
   - Add sort dropdown
   - Remove list view and legend
   
2. **`src/types/standings.ts`** — Add sort type if not already there (already has `StandingsSort`)

3. **`src/lib/standings.ts`** — May need to add prize pot calculation if not already returned

---

## Key Implementation Notes

### Horizontal Scroll
The grid must scroll horizontally on mobile since 10+ round columns won't fit. Keep the ENTRY column sticky on the left (already implemented). Make sure the sticky column has a solid background so it doesn't show content scrolling behind it.

### Prize Pot
The mockup shows "$3200 POT". Check if `PoolLeaderboard` already includes prize info. If not:
- Option A: Add `prize_pool` to the leaderboard query (from `pools.prize_pool` or `pools.entry_fee * total_players`)
- Option B: Fetch it separately from the pools table

### Pick Visibility
Keep the existing `isPickVisible()` logic — don't show other players' picks before the round deadline passes. Show a lock icon or "—" for hidden picks. Own picks are always visible.

### Performance
With 128 players × 10 rounds = 1280 cells, the grid could get heavy. Consider:
- Virtual scrolling for large pools (>50 players) — probably overkill for v1
- Paginate eliminated players (show top 20, "Show more" button)
- Keep the 30-second auto-refresh (already implemented)

### Responsive
- Desktop: full grid visible, maybe 5-6 columns without scrolling
- Mobile: ENTRY column sticky, everything else scrollable. Cells are compact but still show team name

---

## What NOT to Change
- `src/lib/standings.ts` — Keep the existing `getPoolLeaderboard()` data fetching logic
- `src/types/standings.ts` — Types are fine, just add prize_pool if needed
- The 30-second auto-refresh interval
- Pick visibility rules (own picks always visible, others hidden until deadline)

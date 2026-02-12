# Standardize Pool Selector & Entry Tabs Across All Pages

## Overview

The pick page redesign introduced a much better UX pattern for pool selection and entry switching. Extract these into shared reusable components and use them consistently on every pool sub-page (Pick, Field, Bracket, Dashboard). Simplify the global header to just the logo + settings gear.

**Reference:** Screenshots of the new pick page styling (pool selector bar + entry pill tabs).

---

## Current State

- Global header has a pool dropdown (`Pool 1 ▼`) — functional but cramped
- Entry switching only exists on the pick page
- Other pages (Field, Bracket) have no way to switch entries without going back
- No consistent page identity (section labels, headings)

## Target State

- Global header: minimal — logo + settings gear only
- Every pool sub-page has the same top section pattern:
  1. Section label + round info card
  2. Pool selector bar
  3. Entry tabs
- Pool selector and entry tabs are shared components imported everywhere

---

## Shared Components to Extract

### 1. `PoolSelectorBar`

Full-width bar showing the active pool with a dropdown to switch.

```
┌─────────────────────────────────────┐
│ POOL   POOL 1              2/2  ▼  │
└─────────────────────────────────────┘
```

**Props:**
```typescript
interface PoolSelectorBarProps {
  pools: UserPool[];           // All pools the user belongs to
  activePoolId: string;        // Currently selected pool
  onPoolChange: (poolId: string) => void;
}

interface UserPool {
  id: string;
  name: string;
  alive_count: number;
  total_count: number;
}
```

**Behavior:**
- Shows `POOL` label (mono, muted) + pool name (bold) + alive/total badge
- Tapping opens a dropdown listing all user pools
- Selecting a pool navigates to that pool's version of the current page
  - e.g., on Field page → navigates to `/pools/[newPoolId]/standings`
  - e.g., on Bracket page → navigates to `/pools/[newPoolId]/bracket`
- If user only has 1 pool, still show the bar but hide the dropdown arrow

**Styling (match pick page):**
- Background: `surface0` / `#111827`
- Border: `1px solid rgba(255,255,255,0.05)`
- Rounded: `rounded-xl`
- `POOL` label: `Space Mono`, muted color, uppercase
- Pool name: `Oswald`, white, uppercase
- Alive/total: `Space Mono`, small badge

### 2. `EntryTabs`

Horizontal scrollable row of pill buttons, one per entry the user has in the active pool.

```
┌──────────┐  ┌─────────────┐
│ ● TREATS │  │ ● TEST LOSS │
└──────────┘  └─────────────┘
```

**Props:**
```typescript
interface EntryTabsProps {
  entries: UserEntry[];
  activeEntryId: string;
  onEntryChange: (entryId: string) => void;
}

interface UserEntry {
  pool_player_id: string;
  entry_label: string;
  is_eliminated: boolean;
}
```

**Behavior:**
- Each tab shows a status dot (green = alive, red = eliminated) + entry label
- Active tab: filled background with accent border
- Inactive tab: outline/muted style
- Tapping switches the active entry — the parent page re-fetches data for that entry
- Horizontal scroll if many entries (rare, but handle gracefully)
- If user has only 1 entry, still show it (confirms which entry you're viewing)

**Styling (match pick page):**
- Active: `bg-[rgba(255,255,255,0.08)]` with subtle border, white text
- Inactive: transparent, muted text, border on hover
- Status dot: `w-2 h-2 rounded-full` — green `#4CAF50` if alive, red `#EF5350` if eliminated
- Font: `DM Sans`, 0.8rem, semibold
- Gap between pills: `gap-2`
- Container: horizontal scroll with `overflow-x-auto`, no scrollbar visible

### 3. `PageHeader`

Optional wrapper combining the section label + round info card pattern.

```
PICK TAB              ┌──────────────┐
MAKE YOUR PICK        │ Round 1 Day 1│
                      │ 16 GAMES     │
                      │ Mar 19       │
                      └──────────────┘
```

**Props:**
```typescript
interface PageHeaderProps {
  sectionLabel: string;    // "PICK TAB", "THE FIELD", "BRACKET", etc.
  heading: string;         // "MAKE YOUR PICK", "STANDINGS", etc.
  roundInfo?: {
    name: string;
    gameCount: number;
    date: string;
  };
}
```

**Styling:**
- Section label: `Space Mono`, orange `#FF5722`, uppercase, small
- Heading: `Oswald`, white, uppercase, bold, large
- Round info card: `surface1` background, rounded, with badges for game count and date

---

## Page-by-Page Implementation

### Pick Page (`/pools/[id]/pick`)
Already has this pattern — extract the components out of it.

```
PICK TAB              [Round 1 Day 1 | 16 GAMES | Mar 19]
MAKE YOUR PICK

POOL | March Madness Pool | 47/128 ▼
[● Entry 1] [● Entry 2]

[Status bar: ALIVE · DAY 1 OF 10 · LOCKS 21:28:24]
[Region sections with games...]
```

### Field / Standings Page (`/pools/[id]/standings`)
Add pool selector and page header. No entry tabs on this page — all of the user's entries are already visible in the grid with "YOU" badges.

```
THE FIELD             [Round 1 Day 1 | 16 GAMES | Mar 19]
STANDINGS

POOL | March Madness Pool | 47/128 ▼

[Summary stats: Alive | Eliminated | Pot]
[Filter tabs: ALL | ALIVE | OUT]
[Grid...]
```

### Bracket Page (`/pools/[id]/bracket`)
Add pool selector and page header. No entry tabs on this page.

```
BRACKET               [Round 1 Day 1 | 16 GAMES | Mar 19]
TOURNAMENT VIEW

POOL | March Madness Pool | 47/128 ▼

[Bracket visualization...]
```

### Dashboard / Home
**Leave untouched.** No changes to the home/dashboard page.

### Analyze Page (`/pools/[id]/analyze` or `/analyze`)
Add pool selector, entry tabs, and page header.

```
ANALYZE               [Round 1 Day 1 | 16 GAMES | Mar 19]
PICK ANALYZER

POOL | March Madness Pool | 47/128 ▼
[● Entry 1] [● Entry 2]

[Analysis content...]
```

**Entry tabs on Analyze page:** Switching entries changes the analysis context — shows used teams, available picks, and recommendations for that specific entry.

---

## Global Header Changes

**Before:**
```
┌──────────────────────────────────────┐
│ SURVIVE THE DANCE   [Pool 1 ▼] [⚙]  │
└──────────────────────────────────────┘
```

**After:**
```
┌──────────────────────────────────────┐
│ SURVIVE THE DANCE              [⚙]  │
└──────────────────────────────────────┘
```

- Remove the pool dropdown from the global header
- Keep it simple: logo on left, settings gear on right
- Every page now manages its own pool/entry context via the shared components

---

## Data Flow

The pool and entry state needs to be shared. Options:

**Option A: URL-based (recommended)**
- Pool ID is already in the URL: `/pools/[id]/pick`, `/pools/[id]/standings`
- Entry ID can be a query param: `/pools/[id]/pick?entry=xxx` or stored in local state
- Pool switching navigates to the new pool's URL
- Entry switching updates local state (no URL change needed)

**Option B: Context/store**
- Shared React context provides `activePoolId` and `activeEntryId`
- All pages read from context
- Pool selector and entry tabs update context

Option A is simpler since pool ID is already URL-driven. Entry state can live in a lightweight context or just be local to each page with a shared component handling the UI.

---

## Files to Create
1. **`src/components/pool/PoolSelectorBar.tsx`** — Pool selector bar component
2. **`src/components/pool/EntryTabs.tsx`** — Entry tab pills component
3. **`src/components/pool/PageHeader.tsx`** — Section label + heading + round info

## Files to Modify
1. **`src/components/layout/Header.tsx`** (or equivalent) — Remove pool dropdown, simplify to logo + gear
2. **`src/app/pools/[id]/pick/page.tsx`** — Extract pool selector + entry tabs into shared components, import them
3. **`src/app/pools/[id]/standings/page.tsx`** — Add `PageHeader`, `PoolSelectorBar` (no entry tabs)
4. **`src/app/pools/[id]/bracket/page.tsx`** — Add `PageHeader`, `PoolSelectorBar` (no entry tabs)
5. **`src/app/pools/[id]/analyze/page.tsx`** (or equivalent) — Add `PageHeader`, `PoolSelectorBar`, `EntryTabs`

**Do NOT modify** the home/dashboard page.

## Implementation Order
1. Extract `PoolSelectorBar` from pick page into shared component
2. Extract `EntryTabs` from pick page into shared component
3. Create `PageHeader` component
4. Simplify global header (remove pool dropdown)
5. Add `PageHeader` + `PoolSelectorBar` to Field/standings page (no entry tabs)
6. Add `PageHeader` + `PoolSelectorBar` to Bracket page (no entry tabs)
7. Add `PageHeader` + `PoolSelectorBar` + `EntryTabs` to Analyze page
8. Test: switching pools navigates correctly on all pages, entry tabs work on Pick and Analyze pages

**Note:** `EntryTabs` is only used on the Pick page and Analyze page — the two pages where the view is entry-specific. Field, Bracket, and Home do not get entry tabs.

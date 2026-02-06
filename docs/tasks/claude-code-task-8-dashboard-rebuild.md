# Task 8: Dashboard Rebuild — Pool Cards, Entry Management, Terminology Fix

This is the largest single task. The dashboard currently renders a flat `PoolDetailView` (full standings, join code, player list, quick actions) for the active pool. The audit says: "Home should be *cards*, not detail views." This task replaces the entire dashboard with a vertical stack of pool cards — one card per pool — with per-entry status lines, CTAs, and an "Add Entry" action.

This task also completes the "bracket → entry" terminology rename throughout the app.

## Files to Read Before Writing Code

Read ALL of these fully before writing any code:
- `src/app/dashboard/page.tsx` — the file being rewritten
- `src/components/pool/PoolDetailView.tsx` — being deprecated, reference for existing data display
- `src/types/standings.ts` — MyPool and MyPoolEntry types (will be modified)
- `src/lib/standings.ts` — getMyPools function (will be modified)
- `src/contexts/ActivePoolContext.tsx` — refreshPools, setActivePool
- `src/app/pools/join/page.tsx` — how entries are created (for Add Entry reference)
- `src/types/picks.ts` — PoolStandings, PlayerStatus types

---

## Part 1: Add Missing Fields to MyPool

### 1A. Update `src/types/standings.ts`

Add these fields to the `MyPool` interface:
```typescript
creator_id: string;              // who created this pool
max_entries_per_user: number;    // how many entries allowed per user
```

### 1B. Update `src/lib/standings.ts` — getMyPools function

In the Supabase query for pool data (the `pools:pool_id(...)` select), add `creator_id` and `max_entries_per_user`:
```
pools:pool_id(
  id,
  name,
  status,
  join_code,
  creator_id,
  max_entries_per_user
)
```

And in the pool type cast later in the function, add both new fields.

Then include them in the `myPools.push(...)` output:
```typescript
creator_id: pool.creator_id,
max_entries_per_user: pool.max_entries_per_user ?? 1,
```

---

## Part 2: Rewrite Dashboard Page

### Full rewrite of `src/app/dashboard/page.tsx`

Delete the entire file contents and replace. The new dashboard shows:
- **Zero pools:** EmptyState with Create/Join CTAs (keep existing, it's good)
- **One or more pools:** Vertical stack of PoolCards, one per pool. Plus Create/Join links at bottom.

**No more PoolSwitcher pills.** No more BracketSwitcher pills. No more PoolHome wrapper that renders the full PoolDetailView. Each pool gets its own card that shows summary info.

**Tapping a pool card sets it as active pool** (calls `setActivePool`). The active pool card gets a highlighted border.

### New imports needed:
```typescript
import { useAuth } from '@/components/auth/AuthProvider';
import { useActivePool } from '@/hooks/useActivePool';
import { MyPool, MyPoolEntry } from '@/types/standings';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
```

Remove these imports:
```typescript
// DELETE: import { usePoolDetail } from '@/hooks/usePoolDetail';
// DELETE: import PoolDetailView from '@/components/pool/PoolDetailView';
// DELETE: import ProtectedRoute from '@/components/auth/ProtectedRoute';
```

### EmptyState component

Keep the existing EmptyState mostly as-is. It's good. Just remove the `<ProtectedRoute>` wrapper from the parent.

### PoolCard component

This is the main new component. One card per pool. It does NOT fetch additional data — it uses only what `MyPool` from `getMyPools` already provides (plus the new fields from Part 1).

**Card layout:**
```
┌──────────────────────────────────────────────┐
│  POOL NAME                      ● ACTIVE     │  ← pool name + status badge
│  Round of 64                                 │  ← current round name (or "Pre-Tournament" / "Complete")
│                                              │
│  🟢 Entry 1: Alive · Picked ✓              │  ← per-entry status line
│  🔴 Entry 2: Eliminated (Day 3)             │  ← per-entry status line
│  [+ Add Entry]                               │  ← only if max_entries allows more
│                                              │
│  12/20 alive · Deadline in 2h 15m            │  ← pool stats + urgency
│                                              │
│  [Make Pick]  [Standings]  [⚙ Manage]       │  ← CTAs (Manage only for creator)
│                                              │
│  Join Code: MADNESS  [Copy] [Share]          │  ← join code row (always visible)
└──────────────────────────────────────────────┘
```

**Detailed specifications:**

**Row 1: Pool name + status badge**
- Pool name: Oswald, uppercase, white, truncate if long
- Status badge: pill to the right
  - `open`: orange text on orange bg "PRE-TOURNAMENT"
  - `active`: green text on green bg "ACTIVE"
  - `complete`: gray text on gray bg "COMPLETE"

**Row 2: Current round context**
- If `current_round_name` exists: show it (e.g., "Round of 64")
- If pool_status is `open`: show "Pre-Tournament · Starts Mar 19" (or just "Pre-Tournament" if no date available)
- If pool_status is `complete`: show "Tournament Complete"

**Row 3: Per-entry status lines**
- Loop over `pool.your_entries` array
- Each entry shows on its own line:
  - Status dot: 🟢 green if alive and picked, ⏳ amber if alive and NOT picked, 🔴 red if eliminated
  - Entry label (from `entry.entry_label`)
  - Status text:
    - Alive + picked today: "Alive · Picked ✓"
    - Alive + NOT picked today + has deadline: "Alive · Needs Pick"
    - Eliminated: "Eliminated"
  - This maps to the audit's badge system: 🟢 "Alive · Picked", ⏳ "Needs Pick", 🔴 "Eliminated"

**Row 4: "+ Add Entry" button (conditional)**
- Only show if ALL of these are true:
  - `pool.max_entries_per_user > 1`
  - `pool.your_entries.length < pool.max_entries_per_user`
  - `pool.pool_status !== 'complete'`
- Styled as a subtle text button, not a big CTA
- On tap: navigate to `/pools/join?code=${pool.join_code}` (reuses existing join flow to add entry)
- This addresses audit §2 Q2: "On the Home pool card, if max_entries_per_user > 1 and the user has fewer than max entries, show a subtle '+ Add Entry' link below their entry list."

**Row 5: Pool stats + deadline urgency**
- Left: "{alive_players}/{total_players} alive"
- Right: deadline display
  - If deadline exists and not expired: "Deadline in {formatted time}" with urgency color:
    - `> 2h`: green text
    - `1-2h`: amber text
    - `30min-1h`: orange text
    - `< 30min`: red text, bold
  - If deadline expired: "Picks locked" in red
  - If no deadline (pre-tournament or complete): omit deadline

**Row 6: CTA buttons**
- "Make Pick" button (orange, prominent): navigate to `/pools/${pool.pool_id}/pick`
  - Only show if: pool is active AND at least one entry is alive AND deadline not expired AND at least one entry hasn't picked
  - If all alive entries have picked: show "Change Pick" instead (amber/outline style)
- "Standings" button (outline): navigate to `/pools/${pool.pool_id}/standings`
  - Always show when pool is active or complete
- "⚙ Manage" button (outline, small): navigate to `/pools/${pool.pool_id}/admin`
  - ONLY show if `pool.creator_id === user.id`
  - This addresses audit §2 Q3: "Admin sees [⚙ Manage] button on their pool card"

**Row 7: Join Code + Share**
- Show join code in Space Mono, orange
- Copy button and Share button (reuse the JoinCodeCard pattern from PoolDetailView)
- This addresses audit §5: "Players see the join code on the Home pool card with a Copy + Share button"
- Always visible — not just for creators. Everyone can invite.

**Card border:**
- If this pool is the active pool (`pool.pool_id === activePoolId`): orange border `border-[rgba(255,87,34,0.4)]`
- Otherwise: standard border `border-[rgba(255,255,255,0.05)]`
- Tapping anywhere on the card (not on a CTA button) sets it as active pool

### Dashboard layout

```tsx
export default function Dashboard() {
  const { user } = useAuth();
  const { activePoolId, setActivePool, pools, loadingPools, refreshPools } = useActivePool();
  const router = useRouter();

  if (loadingPools) return <LoadingSkeleton />;
  if (pools.length === 0) return <EmptyState />;

  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-24">
      <div className="max-w-lg mx-auto px-5 py-4 space-y-4">
        {pools.map(pool => (
          <PoolCard
            key={pool.pool_id}
            pool={pool}
            isActive={pool.pool_id === activePoolId}
            isCreator={pool.creator_id === user?.id}
            onActivate={() => setActivePool(pool.pool_id, pool.pool_name)}
            userId={user?.id}
          />
        ))}

        {/* Create / Join links at bottom */}
        <div className="flex justify-center gap-4 pt-2">
          <Link href="/pools/create" className="text-sm text-[#8A8694] hover:text-[#FF5722] transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            + Create Pool
          </Link>
          <Link href="/pools/join" className="text-sm text-[#8A8694] hover:text-[#FF5722] transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            + Join Pool
          </Link>
        </div>
      </div>
    </div>
  );
}
```

### Loading skeleton

Replace the current loading spinner with 2 skeleton card outlines (pulse animation). Each skeleton card is a `bg-[#111118]` rounded rectangle with a few `bg-[#1A1A24]` bars inside. This addresses audit §6 State Matrix: "Skeleton pool cards" for loading state.

---

## Part 3: Terminology Rename — "Bracket" → "Entry"

The audit notes users create "entries" not "brackets." The current code uses "Bracket" in several user-facing places. Rename all user-facing instances:

### Files to search and replace (user-facing text only):

**`src/app/dashboard/page.tsx`** (new file):
- The BracketSwitcher component is being deleted (replaced by entry lines on card), so no change needed there.

**`src/app/pools/join/page.tsx`**:
- The form field label currently says "Entry Name" — this is already correct from Task 4.
- Check the default entry label generation: if it says "Bracket" anywhere, change to "Entry."
- Line ~101: `entry_label: entryLabel` — check the fallback: `${baseName}'s Entry${entryNumber > 1 ? ' ${entryNumber}' : ''}` — this is already correct.

**`src/components/pool/PoolDetailView.tsx`**:
- Line ~223: `entry_label || 'Bracket ${entry.entry_number}'` → change to `'Entry ${entry.entry_number}'`
- This file is being deprecated but still used by `/pools/[id]/page.tsx`, so fix it.

**`src/lib/standings.ts`**:
- Line ~354: the fallback entry label: `` `Bracket ${(entry as any).entry_number ?? 1}` `` → change to `` `Entry ${(entry as any).entry_number ?? 1}` ``

**`src/types/standings.ts`**:
- No changes needed (field names like `entry_label` are already correct)

**Do a global search** for the word "Bracket" (case-sensitive) in all .tsx and .ts files. For each match, determine if it's:
- **User-facing text** (labels, headings, default values shown to users) → rename to "Entry"
- **Code identifiers** (variable names, component names, type names, route names) → leave as-is (the Bracket tab is the tournament bracket, which is correct)
- **The Bracket nav tab** → keep as "Bracket" (it shows the tournament bracket, not entries)

---

## Part 4: Handle `/pools/[id]/page.tsx` Redirect

This page currently renders a full `PoolDetailView`. Since the dashboard now shows cards and PoolDetailView is deprecated, this page should redirect to the dashboard and set the pool as active:

Replace `src/app/pools/[id]/page.tsx` with:
```tsx
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useActivePool } from '@/hooks/useActivePool';

export default function PoolRedirect() {
  const params = useParams();
  const router = useRouter();
  const { setActivePool, pools, loadingPools } = useActivePool();
  const poolId = params.id as string;

  useEffect(() => {
    if (loadingPools) return;

    const pool = pools.find(p => p.pool_id === poolId);
    if (pool) {
      setActivePool(poolId, pool.pool_name);
    }
    router.replace('/dashboard');
  }, [poolId, pools, loadingPools, setActivePool, router]);

  return null;
}
```

This way, any link to `/pools/[id]` (like the "Back to Pool" buttons we removed) will redirect to dashboard with that pool active.

---

## Part 5: Deadline Formatting Utility

The pool card needs to format deadline time remaining. Create a small helper inside the dashboard file (or inline):

```typescript
function formatDeadline(deadlineDatetime: string): { text: string; color: string } {
  const diff = new Date(deadlineDatetime).getTime() - Date.now();
  if (diff <= 0) return { text: 'Picks locked', color: 'text-[#EF5350]' };

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  let text: string;
  if (hours > 0) text = `${hours}h ${minutes}m`;
  else text = `${minutes}m`;

  let color: string;
  if (diff < 1800000) color = 'text-[#EF5350]';        // < 30min: red
  else if (diff < 3600000) color = 'text-[#FF5722]';    // < 1hr: orange
  else if (diff < 7200000) color = 'text-[#FFB300]';    // < 2hr: amber
  else color = 'text-[#4CAF50]';                         // > 2hr: green

  return { text: `Deadline in ${text}`, color };
}
```

---

## Audit Cross-Reference Checklist

Every item below must be addressed in this task. Check each one:

| Audit Section | Requirement | Where Addressed |
|---|---|---|
| §2 Q1 | "/dashboard shows all pools as cards" | Part 2: PoolCard component |
| §2 Q1 | "Tapping a pool card sets it as active pool" | Part 2: onActivate handler |
| §2 Q1 | "Single-pool user: card takes full width, prominent CTAs" | Part 2: cards are always full width |
| §2 Q1 | "Zero-pool user: empty state with Create/Join CTAs" | Part 2: EmptyState preserved |
| §2 Q1 | Pool card wireframe: pool name, status, round context, entry lines, stats, deadline, CTAs | Part 2: PoolCard layout |
| §2 Q2 | "+ Add Entry link below entry list on Home card" | Part 2: Row 4 conditional button |
| §2 Q3 | "Admin sees ⚙ Manage button on their pool card" | Part 2: Row 6 Manage CTA |
| §2 Q4 | "Join code on Home pool card with Copy + Share" | Part 2: Row 7 |
| §4 Flow 4 | "Pre-tournament card: players joined, join code prominent" | Part 2: pool_status === 'open' state |
| §4 Flow 5 | "Home shows two pool cards, active highlighted" | Part 2: orange border on active |
| §4 Flow 5 | Badge system: 🟢⏳🔴☠️✓ | Part 2: Row 3 entry status dots |
| §5 Home | "Pool cards (1 per pool, with per-entry status lines)" | Part 2: PoolCard |
| §5 Home | "Create/Join CTAs" | Part 2: bottom links + EmptyState |
| §5 Home | "Active pool highlighted" | Part 2: active border |
| §5 Home | "Countdown to next deadline on active pool card" | Part 2: Row 5 deadline |
| §5 Home | "Quick stats: alive count, total players" | Part 2: Row 5 stats |
| §5 Home | "Replace PoolDetailView with PoolCardList" | Part 2: full rewrite |
| §5 Home | "Entry management (add entry)" | Part 2: Row 4 Add Entry |
| §5 Home | "Share/invite action" | Part 2: Row 7 Share |
| §6 State Matrix: Home empty | "No pools yet + Create/Join CTAs" | Part 2: EmptyState |
| §6 State Matrix: Home loading | "Skeleton pool cards" | Part 2: LoadingSkeleton |
| §6 State Matrix: Home pre-tournament | "Pool card: Starts Mar 19 · 8 players joined" | Part 2: pool_status open state |
| §6 State Matrix: Home active | "Pool card: round name, deadline, pick status" | Part 2: standard active card |
| §6 State Matrix: Home eliminated | "Pool card: Eliminated Day 3" | Part 2: entry status lines |
| §Appendix | "Replace PoolDetailView with PoolCardList" | Part 2 |
| §Appendix | "Deprecate PoolDetailView" | Part 4 + PoolDetailView still exists for now |
| Tracker | "bracket → entry rename" | Part 3 |
| Tracker | "Add Entry from within pool" | Part 2: Row 4 |
| Tracker | "Empty states for tabs 2-5 when no pool" | Not in this task (already falls back to /dashboard) |

---

## Files to Modify

1. `src/types/standings.ts` — add creator_id and max_entries_per_user to MyPool
2. `src/lib/standings.ts` — update getMyPools query and output to include new fields
3. `src/app/dashboard/page.tsx` — full rewrite
4. `src/app/pools/[id]/page.tsx` — replace with redirect
5. `src/components/pool/PoolDetailView.tsx` — "Bracket" → "Entry" fallback label only
6. Any other file where global search finds user-facing "Bracket" text that should say "Entry"

## What NOT to Do
- Don't delete `PoolDetailView.tsx` or `usePoolDetail.ts` (may be useful later)
- Don't change BottomNav, Header, Pick, Standings, Bracket, or Analyze pages
- Don't rename the Bracket tab in BottomNav (that refers to the tournament bracket, not entries)
- Don't rename code-level identifiers like `RegionBracket`, `BracketMatchupCard`, etc.
- Don't add notification preferences or push notification logic
- Don't change the join flow (it already works for adding entries)
- Don't fetch PoolStandings data on the dashboard — use only MyPool data from getMyPools

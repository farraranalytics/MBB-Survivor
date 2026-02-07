# Task 12: Pool-Scoped Settings — Unified Creator/Member Page

Replace the global `/settings` page and the separate `/pools/[id]/admin` page with a single pool-scoped settings page at `/pools/[id]/settings`. This page adapts based on whether the user is the pool creator or a regular member.

## Files to Read Before Writing Code

Read ALL of these fully:
- `src/app/settings/page.tsx` — current global settings (being replaced)
- `src/app/pools/[id]/admin/page.tsx` — current admin page (being merged in)
- `src/lib/admin.ts` — getPoolAdmin, updatePoolSettings, PoolAdminData types
- `src/components/Header.tsx` — gear icon link to update
- `src/app/dashboard/page.tsx` — ⚙ Manage button link to update
- `src/types/picks.ts` — PoolPlayer type (has entry_label, display_name)
- `src/lib/picks.ts` — getPoolPlayer function

---

## Part 1: New Route — `/pools/[id]/settings/page.tsx`

Create a new file at `src/app/pools/[id]/settings/page.tsx`.

### Data Loading

On mount, fetch:
1. Pool data: query `pools` table for this pool's settings + `creator_id`
2. Current user's pool_player entries: query `pool_players` where `pool_id` and `user_id` match
3. Determine role: `isCreator = pool.creator_id === user.id`
4. If creator: also fetch player list (all `pool_players` for this pool with user email/name)

```typescript
interface PoolSettings {
  id: string;
  name: string;
  is_private: boolean;
  max_players: number | null;
  entry_fee: number;
  max_entries_per_user: number;
  status: 'open' | 'active' | 'complete';
  creator_id: string;
  join_code: string;
  notes: string | null;  // may not exist in DB yet — handle gracefully
}

interface PoolMember {
  id: string;  // pool_player_id
  user_id: string;
  display_name: string;
  entry_label: string | null;
  entry_number: number;
  is_eliminated: boolean;
  joined_at: string;
}
```

### Page Layout

The page has sections. ALL users see the base sections. Creator-only sections appear below.

```
┌─────────────────────────────────────────┐
│ Pool Settings                           │
│ [Pool Name] · [Status Badge]            │
│                                         │
│ ── YOUR ENTRIES ────────────────────── │
│ Entry 1: "Dillon"          [Edit] [Save]│
│ Entry 2: "Dillon's Backup" [Edit] [Save]│
│                                         │
│ ── ACCOUNT ─────────────────────────── │
│ Display Name: Dillon         [Edit]     │
│ Email: dillon@example.com               │
│                                         │
│ ── POOL INFO ───────────────────────── │
│ Join Code: ABC123        [Copy] [Share] │
│ Players: 12                             │
│ Max Players: Unlimited                  │
│ Entries Per Player: 2                   │
│ Entry Fee: Free                         │
│ Pool Notes: "Welcome to the pool! ..."  │
│                                         │
│ ═══ CREATOR ONLY (if isCreator) ═════ │
│                                         │
│ ── POOL SETTINGS ───────────────────── │
│ Pool Name: [editable input]             │
│ Private Pool: [toggle]                  │
│ Max Players: [number input]             │
│ Entries Per Player: [number input]      │
│ Entry Fee: [$input]                     │
│ Pool Notes: [textarea]                  │
│   "Visible to all members"              │
│                                         │
│ ── MEMBERS (12) ────────────────────── │
│ Dillon — Entry 1          🟢 Alive     │
│ Dillon — Entry 2          🟢 Alive     │
│ Mike — Entry 1             🔴 Out  [✕] │
│ Sarah — Entry 1            🟢 Alive [✕]│
│ ...                                     │
│ (creator cannot remove self)            │
│                                         │
│ ── DANGER ZONE ─────────────────────── │
│ [Leave Pool] (members only)             │
│ [End Pool Early] (creator only)         │
│                                         │
│ ── ──────────────────────────────────── │
│ [Sign Out]                              │
│ v1.0.0 · © 2026 Survive the Dance      │
└─────────────────────────────────────────┘
```

---

## Part 2: Section Details

### Section 1: Your Entries (ALL users)

Show each of the user's entries in this pool. Each entry has:
- Entry label (editable inline — click Edit, shows input + Save/Cancel)
- Status badge: 🟢 Alive or 🔴 Eliminated

**Editing entry label:** Update `pool_players.entry_label` via Supabase:
```typescript
await supabase
  .from('pool_players')
  .update({ entry_label: newLabel.trim() })
  .eq('id', poolPlayerId);
```

### Section 2: Account (ALL users)

Same as current `/settings` page:
- Display name with inline edit (calls `supabase.auth.updateUser`)
- Email (read-only)

Copy the existing edit logic from the current `src/app/settings/page.tsx`.

### Section 3: Pool Info (ALL users, read-only)

Show pool details as read-only info:
- Join code with Copy + Share buttons (same pattern as dashboard pool cards)
- Player count
- Max players (or "Unlimited")
- Entries per player
- Entry fee (or "Free")
- Pool notes from creator (if any exist) — rendered as plain text, not editable for members

### Section 4: Pool Settings (CREATOR ONLY)

Only visible when `isCreator === true`. Shows editable form fields:
- Pool name (text input)
- Private pool toggle (checkbox)
- Max players (number input, "Leave blank for unlimited")
- Entries per player (number input, 1-10)
- Entry fee ($ number input)
- Pool notes (textarea, multiline, max 500 chars)
  - Helper text: "Visible to all pool members"

**Save button:** Calls `updatePoolSettings` from `lib/admin.ts`. Add `notes` to the update payload.

**Pool notes field:** The `pools` table may not have a `notes` column yet. The code should:
1. Try to read `notes` from the pool query
2. If the column doesn't exist, gracefully handle (show empty, don't crash)
3. Try to save notes in the update — if it fails because column doesn't exist, show a message or silently skip
4. Add `notes?: string` to `PoolAdminUpdate` interface in `lib/admin.ts`

### Section 5: Members (CREATOR ONLY)

Show a list of all pool members. For each:
- Display name + entry label
- Status badge (Alive/Eliminated)
- [✕] Remove button (except for the creator's own entries)

**Remove player:** Delete from `pool_players` table:
```typescript
await supabase
  .from('pool_players')
  .delete()
  .eq('id', poolPlayerId);
```

Show a confirmation dialog before removing: "Remove [Name] from the pool? This cannot be undone."

**Creator cannot remove themselves.** Hide the remove button for entries where `user_id === user.id`.

### Section 6: Danger Zone (ALL users, different actions)

**For regular members:**
- "Leave Pool" button — red outline style
- Confirmation: "Leave [Pool Name]? Your entries and pick history will be deleted. This cannot be undone."
- Action: Delete all of the user's `pool_players` rows for this pool, then redirect to `/dashboard`
```typescript
await supabase
  .from('pool_players')
  .delete()
  .eq('pool_id', poolId)
  .eq('user_id', user.id);
```

**For creators:**
- Don't show "Leave Pool" (creator can't leave their own pool)
- Optionally show "End Pool Early" — but this can be deferred. For now, just don't show anything in danger zone for creators, or show a disabled placeholder.

### Section 7: Sign Out + Version (ALL users)

Same as current settings:
- Sign Out button (red outline)
- Version footer: `v1.0.0 · © 2026 Survive the Dance`

---

## Part 3: Header Gear Icon Update

In `src/components/Header.tsx`, change the gear icon link:

```tsx
// Change:
href="/settings"
// To:
href={activePoolId ? `/pools/${activePoolId}/settings` : '/settings'}
```

This way the gear icon goes to pool-scoped settings when a pool is active, and falls back to the old `/settings` route (which we'll make a redirect) when no pool is selected.

---

## Part 4: Dashboard Manage Button Update

In `src/app/dashboard/page.tsx`, change the ⚙ Manage button:

```tsx
// Change:
router.push(`/pools/${pool.pool_id}/admin`)
// To:
router.push(`/pools/${pool.pool_id}/settings`)
```

---

## Part 5: Redirects

### `/settings` → redirect

Replace `src/app/settings/page.tsx` with a redirect:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useActivePool } from '@/hooks/useActivePool';

export default function SettingsRedirect() {
  const router = useRouter();
  const { activePoolId } = useActivePool();

  useEffect(() => {
    if (activePoolId) {
      router.replace(`/pools/${activePoolId}/settings`);
    } else {
      router.replace('/dashboard');
    }
  }, [activePoolId, router]);

  return null;
}
```

### `/pools/[id]/admin` → redirect

Replace `src/app/pools/[id]/admin/page.tsx` with a redirect:

```tsx
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function AdminRedirect() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    router.replace(`/pools/${params.id}/settings`);
  }, [params.id, router]);

  return null;
}
```

---

## Part 6: Update `lib/admin.ts`

### 6A. Update PoolAdminData interface

Add `notes`:
```typescript
export interface PoolAdminData {
  // ... existing fields
  notes: string | null;
}
```

### 6B. Update getPoolAdmin query

Add `notes` to the select (handle gracefully if column doesn't exist):
```typescript
.select('id, name, is_private, max_players, entry_fee, max_entries_per_user, status, creator_id, join_code, notes, pool_players(count)')
```

### 6C. Update PoolAdminUpdate interface

```typescript
export interface PoolAdminUpdate {
  name?: string;
  is_private?: boolean;
  max_players?: number | null;
  entry_fee?: number;
  max_entries_per_user?: number;
  notes?: string | null;
}
```

### 6D. Add new functions

```typescript
// Get pool info for any member (not just creator)
export async function getPoolInfo(poolId: string): Promise<PoolAdminData | null> {
  const { data: pool, error } = await supabase
    .from('pools')
    .select('id, name, is_private, max_players, entry_fee, max_entries_per_user, status, creator_id, join_code, notes, pool_players(count)')
    .eq('id', poolId)
    .single();

  if (error) return null;

  return {
    id: pool.id,
    name: pool.name,
    is_private: pool.is_private,
    max_players: pool.max_players,
    entry_fee: pool.entry_fee,
    max_entries_per_user: pool.max_entries_per_user ?? 1,
    status: pool.status,
    creator_id: pool.creator_id,
    join_code: pool.join_code,
    notes: (pool as any).notes || null,
    player_count: (pool as any).pool_players?.[0]?.count || 0,
  };
}

// Get all members of a pool (for creator's member list)
export async function getPoolMembers(poolId: string): Promise<PoolMember[]> {
  const { data, error } = await supabase
    .from('pool_players')
    .select('id, user_id, display_name, entry_label, entry_number, is_eliminated, joined_at')
    .eq('pool_id', poolId)
    .order('joined_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

// Remove a player from pool
export async function removePoolMember(poolPlayerId: string): Promise<void> {
  const { error } = await supabase
    .from('pool_players')
    .delete()
    .eq('id', poolPlayerId);

  if (error) throw new Error(error.message);
}

// Leave a pool (remove all of user's entries)
export async function leavePool(poolId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('pool_players')
    .delete()
    .eq('pool_id', poolId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

// Update entry label
export async function updateEntryLabel(poolPlayerId: string, newLabel: string): Promise<void> {
  const { error } = await supabase
    .from('pool_players')
    .update({ entry_label: newLabel.trim() })
    .eq('id', poolPlayerId);

  if (error) throw new Error(error.message);
}
```

---

## Styling Notes

- Use the same card/section pattern as other pages: `bg-[var(--surface-2)]` cards with subtle border
- Section headers: use `.text-label` class (gray, uppercase, Space Mono)
- Creator-only sections: separate them with a distinct visual break. Maybe an orange accent divider or a subtle "POOL ADMIN" label above them
- Danger zone: red-tinted card with red border for the Leave/End buttons
- Remove buttons on member list: small red ✕, appears on hover or always visible on mobile
- Confirmation dialogs: use a simple inline confirmation pattern (button changes to "Confirm? [Yes] [Cancel]") rather than a modal

---

## Audit Cross-Reference

| Audit Item | Where Addressed |
|---|---|
| §2 Q3: Admin settings in pool context | Part 1 (pool-scoped route) |
| §2 Q3: Pool notes | Part 2 Section 4 |
| §2 Q3: Player list with remove | Part 2 Section 5 |
| §2 Q4: Settings as gear icon | Part 3 (Header update) |
| §5 Admin Panel: Missing pool notes | Part 2 Section 4 |
| §5 Admin Panel: Missing player list | Part 2 Section 5 |
| User request: Entry name editing | Part 2 Section 1 |
| User request: Leave pool | Part 2 Section 6 |
| User request: Pool-scoped settings | Part 1 (entire design) |
| User request: Unified creator/member page | Part 2 (role-based sections) |

---

## Files to Create

1. `src/app/pools/[id]/settings/page.tsx` — new unified settings page

## Files to Modify

1. `src/components/Header.tsx` — gear icon link
2. `src/app/dashboard/page.tsx` — ⚙ Manage button link
3. `src/app/settings/page.tsx` — replace with redirect
4. `src/app/pools/[id]/admin/page.tsx` — replace with redirect
5. `src/lib/admin.ts` — add new functions, update types

## What NOT to Do
- Don't delete the `/settings` or `/admin` routes — redirect them
- Don't add a `notes` column migration (the code should handle it gracefully if it doesn't exist yet)
- Don't change BottomNav (settings is not a tab)
- Don't change any pick/standings/analyze logic
- Don't build "End Pool Early" functionality (defer)

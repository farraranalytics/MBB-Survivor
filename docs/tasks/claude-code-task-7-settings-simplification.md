# Task 7: Settings Page Simplification

## What to Build

The Settings page currently shows two sections: "My Created Pools" (with join codes, share buttons, admin links) and "Account" (display name, email, sign out). The pool management section needs to be removed — pool admin is now accessible from the Home pool card's Manage button, not from Settings.

Settings should be a simple account-only page.

## Requirements

### 1. Rewrite `src/app/settings/page.tsx`

Remove the entire "My Created Pools" section and all related code (pool fetching, copy/share handlers, pool cards). The page should only contain:

**Account section:**
- Display Name: show current value with an [Edit] button
- Tapping Edit → inline text input replaces the display text, with [Save] and [Cancel] buttons
- Saving calls `supabase.auth.updateUser({ data: { display_name: newName } })` to update the user metadata
- Email: display only (no edit for now)

**App section:**
- Sign Out button (keep current styling)
- App version text: "v1.0.0 · © 2026 Survive the Dance" at the bottom, small muted text

**Remove these imports and code:**
- Remove `import { getCreatedPools, CreatedPool } from '@/lib/settings'`
- Remove `import Link from 'next/link'`
- Remove the `pools` state, `loading` state, `copiedId` state
- Remove the `useEffect` that fetches created pools
- Remove `handleCopy` and `handleShare` functions
- Remove the entire "My Created Pools" `<section>` block

**Add display name editing:**
```typescript
const [editingName, setEditingName] = useState(false);
const [newDisplayName, setNewDisplayName] = useState('');
const [savingName, setSavingName] = useState(false);

const currentName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Player';

const handleSaveName = async () => {
  if (!newDisplayName.trim()) return;
  setSavingName(true);
  try {
    const { error } = await supabase.auth.updateUser({
      data: { display_name: newDisplayName.trim() }
    });
    if (error) throw error;
    setEditingName(false);
  } catch (err) {
    console.error('Failed to update display name:', err);
  } finally {
    setSavingName(false);
  }
};
```

You'll need to import `supabase` from `@/lib/supabase/client`.

**Page structure:**
```
SETTINGS (h1 — already exists from Task 3)

Account
┌─────────────────────────────────────┐
│ Display Name                        │
│ Dillon Farrar              [Edit]   │
│─────────────────────────────────────│
│ Email                               │
│ dillon@example.com                  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│          [Sign Out]                 │
└─────────────────────────────────────┘

v1.0.0 · © 2026 Survive the Dance
```

**When editing display name:**
```
┌─────────────────────────────────────┐
│ Display Name                        │
│ [_________________________]         │
│ [Cancel]  [Save]                    │
│─────────────────────────────────────│
│ Email                               │
│ dillon@example.com                  │
└─────────────────────────────────────┘
```

### 2. Keep existing styling approach

Use the same card style (`bg-[#111118]` with border and rounded corners), same font families, same color palette. Don't restyle — just restructure content.

### 3. Remove the ProtectedRoute wrapper

The page is already behind auth via the layout/context. Remove the `<ProtectedRoute>` wrapper and its import.

## Files to Read Before Writing Code
- `src/app/settings/page.tsx` — the file being rewritten
- `src/lib/supabase/client.ts` — import path for supabase

## Files to Modify
- `src/app/settings/page.tsx` — full rewrite

## What NOT to Do
- Don't create notification preferences UI yet (that's a later task)
- Don't add password change flow yet
- Don't change any other pages
- Don't delete `src/lib/settings.ts` — other code might reference it later

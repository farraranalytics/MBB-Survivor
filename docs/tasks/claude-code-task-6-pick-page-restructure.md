# Task 6: Pick Page Restructure

## What to Build

The pick page works but has UX problems. This task fixes three things:
1. Replace the full-screen success page with an inline confirmation (so the user stays on the pick page with nav visible)
2. Add an entry switcher for users with multiple entries in the same pool
3. Remove "Back to Pool" dead-end buttons — the nav handles navigation now

## Requirements

### 1. Replace `PickSuccess` with inline confirmation state

**Current behavior:** After submitting a pick, the entire page is replaced by a `PickSuccess` component — a full-screen "Pick Submitted!" page with a "Back to Pool" button. The bottom nav disappears because the success screen uses `min-h-screen` with centering.

**New behavior:** After submitting, stay on the same pick page. Show a confirmation banner at the top of the team list (below the countdown), and keep the selected team highlighted. The user can tap another team to change their pick, or use the nav to go elsewhere.

Replace the `PickSuccess` usage with an inline confirmation state:

- After successful submission, set `existingPick` to the new pick and clear `submittedPick` (don't set it at all)
- Remove the `if (submittedPick) return <PickSuccess ... />` early return entirely
- Instead, when `existingPick` is set, show the existing yellow banner that already exists: "Current: (seed) Team — tap another to change"
- Add a brief success toast/banner that auto-dismisses after 3 seconds: a green banner saying "✓ Pick locked in — (seed) Team"
- The `PickSuccess` component can be deleted entirely

**Updated `handleConfirm`:**
```typescript
const handleConfirm = async () => {
  if (!selectedTeam || !poolPlayerId || !round) return;
  setSubmitting(true);
  try {
    const pick = await submitPick({ pool_player_id: poolPlayerId, round_id: round.id, team_id: selectedTeam.id });
    setExistingPick(pick);
    setShowConfirm(false);
    setShowSuccess(true); // new state for the auto-dismiss toast
    setTimeout(() => setShowSuccess(false), 3000);
  } catch (err) {
    const message = err instanceof PickError ? err.message : 'Failed to submit pick. Please try again.';
    setError(message);
    setShowConfirm(false);
  } finally {
    setSubmitting(false);
  }
};
```

**Success toast** (show above the team list, below countdown):
```tsx
{showSuccess && (
  <div className="bg-[rgba(76,175,80,0.15)] border border-[rgba(76,175,80,0.3)] rounded-[8px] p-3 mb-4 animate-fade-in">
    <p className="text-sm text-[#4CAF50] text-center font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      ✓ Pick locked in — ({existingPick?.team?.seed}) {existingPick?.team?.name}
    </p>
  </div>
)}
```

### 2. Add entry switcher for multi-entry users

The pick page already reads `entryId` from `?entry=` search param and `getPoolPlayer` supports it. But there's no UI to switch between entries.

**Add an entry switcher** that appears below the round name / countdown when the user has 2+ entries in this pool.

**Fetch all entries on mount:**
```typescript
const [entries, setEntries] = useState<PoolPlayer[]>([]);
const [activeEntryId, setActiveEntryId] = useState<string | undefined>(entryId);
```

In `loadData`, before calling `getPoolPlayer`, fetch all user entries for this pool:
```typescript
const { data: allEntries } = await supabase
  .from('pool_players')
  .select('id, entry_number, entry_label, is_eliminated')
  .eq('pool_id', poolId)
  .eq('user_id', user.id)
  .order('entry_number', { ascending: true });

if (allEntries) setEntries(allEntries);
```

**Entry switcher UI** (only shown when `entries.length > 1`):
```tsx
{entries.length > 1 && (
  <div className="flex gap-2 px-5 py-2 overflow-x-auto scrollbar-hide">
    {entries.map(entry => (
      <button
        key={entry.id}
        onClick={() => {
          setActiveEntryId(entry.id);
          // Reload data for this entry
          loadedRef.current = false;
          setLoading(true);
          // Use router to update the URL param
          router.replace(`/pools/${poolId}/pick?entry=${entry.id}`);
        }}
        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
          (activeEntryId || poolPlayerId) === entry.id
            ? 'bg-[rgba(255,87,34,0.08)] border-[#FF5722] text-[#FF5722]'
            : entry.is_eliminated
            ? 'border-[rgba(255,255,255,0.05)] text-[#8A8694] opacity-50'
            : 'border-[rgba(255,255,255,0.05)] text-[#8A8694] hover:text-[#E8E6E1]'
        }`}
        disabled={entry.is_eliminated}
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {entry.entry_label || `Entry ${entry.entry_number}`}
        {entry.is_eliminated && ' ☠️'}
      </button>
    ))}
  </div>
)}
```

Place this inside the sticky sub-header area, below the countdown.

**Important:** When the user switches entries, the page needs to reload data for that entry. The simplest approach: when `activeEntryId` changes and the URL updates with the new `?entry=` param, the component will re-render. Reset `loadedRef.current = false` and call `loadData()` to refetch.

You'll also need to import `supabase` from `@/lib/supabase/client` for the entries query (it's not currently imported in the pick page — the page uses functions from `@/lib/picks`).

### 3. Remove dead-end "Back to Pool" buttons

The error state and deadline-passed state both have "Back to Pool" buttons that navigate to `/pools/${poolId}`. Now that the nav is always visible, these pages should still show the error/deadline message but don't need a back button — the user can tap any nav tab.

- In the error state: remove the "Back to Pool" `<button>` element
- In the deadline-passed state: remove the "Back to Pool" `<button>` element
- Keep everything else (the icon, title, message)

### 4. Delete the PickSuccess component

Remove the entire `PickSuccess` function component from the file since it's no longer used.

## Files to Read Before Writing Code
- `src/app/pools/[id]/pick/page.tsx` — the file being modified (read the whole thing)
- `src/lib/picks.ts` — understand `getPoolPlayer`, `submitPick`, `getPlayerPick`
- `src/lib/supabase/client.ts` — import path for direct supabase query

## Files to Modify
- `src/app/pools/[id]/pick/page.tsx` — all changes are in this one file

## What NOT to Do
- Don't change any other pages
- Don't modify `lib/picks.ts`
- Don't change the ConfirmModal component (keep the modal confirmation step)
- Don't change team cards or matchup rendering
- Don't change the countdown component
- Don't change any styling beyond what's specified

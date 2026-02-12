# Task 20: Toast Notification System & Error Handling

**Purpose:** Replace scattered inline error states and one-off success messages with a unified toast notification system. Currently every page manages its own `error`/`success` state with inconsistent styling. This creates a single `useToast()` hook and `<ToastProvider>` that any component can call to show consistent, beautiful notifications.

## Files to Read First

- `src/app/layout.tsx` — root layout where `<ToastProvider>` will be added
- `src/app/globals.css` — already has `toast-in` keyframe animation and `--z-toast: 60`
- Component library reference: Toast section (§16) — 4 toast types with gradient backgrounds

## What to Build

### 1. Toast Context & Provider

**Create `src/contexts/ToastContext.tsx`:**

```typescript
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // ms, default 4000
}

interface ToastContextValue {
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}
```

**Behavior:**
- Auto-dismiss after `duration` (default 4000ms)
- Stack up to 3 toasts max — if a 4th is added, remove the oldest
- Each toast has a unique ID (use `Date.now().toString()` or similar)
- Toasts render in a fixed container at the bottom of the screen, above the bottom nav
- Newest toast appears at the bottom of the stack

### 2. Toast UI Component

**Create `src/components/Toast.tsx`:**

Each toast type has a distinct style matching the component library:

**Success (survived):**
- Background: `linear-gradient(135deg, #1B3D20, #162E1A)`
- Border: `1px solid #4CAF50`
- Text color: `#4CAF50`
- Icon: `✓`

**Error (eliminated):**
- Background: `linear-gradient(135deg, #3D1B1B, #2E1616)`
- Border: `1px solid #EF5350`
- Text color: `#EF5350`
- Icon: `✗`

**Warning:**
- Background: `linear-gradient(135deg, #3D361B, #2E2A16)`
- Border: `1px solid #FFB300`
- Text color: `#FFB300`
- Icon: `⚠`

**Info:**
- Background: `linear-gradient(135deg, #1B2E3D, #16232E)`
- Border: `1px solid #42A5F5`
- Text color: `#42A5F5`
- Icon: `ℹ`

**Layout per toast:**
```
┌──────────────────────────────────┐
│ ✓  Pick locked in — (4) Duke    │
└──────────────────────────────────┘
```

- `display: flex; align-items: center; gap: 12px;`
- `padding: 16px 20px;`
- `border-radius: 10px;` (--radius-md)
- `font-family: 'DM Sans'; font-size: 0.9rem; font-weight: 500;`
- `box-shadow: 0 8px 30px rgba(0,0,0,0.5);` (--shadow-lg)
- `max-width: 400px; width: calc(100% - 40px);`
- Animation: use existing `toast-in` keyframe from globals.css
- Dismiss animation: `opacity: 0; transform: translateY(10px);` over 300ms before removal
- Tap/click to dismiss

**Toast container (fixed position):**
```css
position: fixed;
bottom: 80px; /* above bottom nav */
left: 0;
right: 0;
z-index: 60; /* --z-toast */
display: flex;
flex-direction: column;
align-items: center;
gap: 8px;
pointer-events: none; /* container is transparent, toasts themselves get pointer-events: auto */
```

### 3. Wire Into Root Layout

In `src/app/layout.tsx`, wrap with `<ToastProvider>` inside the existing providers:

```tsx
<AuthProvider>
  <ActivePoolProvider>
    <ToastProvider>
      <Header />
      {children}
      <BottomNav />
    </ToastProvider>
  </ActivePoolProvider>
</AuthProvider>
```

### 4. Export a `useToast` Hook

**Create `src/hooks/useToast.ts`** (or export from the context file):

```typescript
import { useContext } from 'react';
import { ToastContext } from '@/contexts/ToastContext';

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
```

Usage in any component:
```typescript
const { addToast } = useToast();
addToast('success', 'Pick locked in — (4) Duke');
addToast('error', 'Failed to submit pick. Please try again.');
addToast('warning', 'Tip-off in 30 minutes. You haven\'t picked yet.');
addToast('info', 'Pick for Day 8 is now open.');
```

---

## Pages to Update

### Pick Page (`src/app/pools/[id]/pick/page.tsx`)

**Replace the existing success snackbar** (lines ~894-903, the green `showSuccess` bar) with a toast call:

Before:
```typescript
setShowSuccess(true);
setTimeout(() => setShowSuccess(false), 4000);
```

After:
```typescript
addToast('success', `Pick locked in — (${selectedTeam.seed}) ${selectedTeam.name}`);
```

Remove the `showSuccess` state variable and the fixed-position success snackbar JSX.

**Replace pick submission error** (line ~513):

Before:
```typescript
setError(message);
```

After:
```typescript
addToast('error', message);
```

**Add auto-retry on pick failure:**
When a pick submission fails, auto-retry once after 2 seconds before showing the error toast. The user's selected team should NOT be cleared on error — preserve their selection.

```typescript
try {
  await submitPick(...);
  addToast('success', `Pick locked in — (${selectedTeam.seed}) ${selectedTeam.name}`);
} catch (err) {
  // Auto-retry once after 2s
  setTimeout(async () => {
    try {
      await submitPick(...);
      addToast('success', `Pick locked in — (${selectedTeam.seed}) ${selectedTeam.name}`);
    } catch (retryErr) {
      const message = retryErr instanceof PickError ? retryErr.message : 'Failed to submit pick. Please try again.';
      addToast('error', message);
    }
  }, 2000);
}
```

**Keep the full-page error state** (line ~560-570) for data loading failures — those are not toast-worthy, they need the full error page since there's nothing to show behind them.

### Settings Page (`src/app/pools/[id]/settings/page.tsx`)

**Replace the inline success banner** (lines ~597-603, the green `saveSuccess` div):

Before:
```typescript
setSaveSuccess(true);
setTimeout(() => setSaveSuccess(false), 3000);
```

After:
```typescript
addToast('success', 'Settings saved');
```

Remove the `saveSuccess` state variable and its JSX.

**Replace inline error messages** for specific actions:

| Action | Current | New Toast |
|--------|---------|-----------|
| Save settings fails | `setError(err.message)` | `addToast('error', 'Failed to save settings')` |
| Update display name fails | `setError(err.message)` | `addToast('error', 'Failed to update display name')` |
| Remove member fails | `setError(err.message)` | `addToast('error', 'Failed to remove member')` |
| Leave pool fails | `setError(err.message)` | `addToast('error', 'Failed to leave pool')` |
| Update display name succeeds | (no feedback) | `addToast('success', 'Display name updated')` |
| Remove member succeeds | (no feedback) | `addToast('success', 'Member removed')` |
| Copy join code | `setCopiedCode(true)` | `addToast('info', 'Join code copied!')` with duration 2000 |

**Keep the top-of-page `error` state** for initial data loading failures (line ~335).

### Create Pool Page (`src/app/pools/create/page.tsx`)

**Replace inline error for creation failure:**

Before:
```typescript
setError(err.message || 'Failed to create pool');
```

After:
```typescript
addToast('error', err.message || 'Failed to create pool');
```

Keep the inline error display for auth-related errors (not logged in, session expired) since the user needs to see those before the page renders.

### Join Pool Page (`src/app/pools/join/page.tsx`)

**Replace inline errors:**

| Action | New Toast |
|--------|-----------|
| Pool lookup fails | `addToast('error', 'Pool not found. Check the code and try again.')` |
| Join fails | `addToast('error', err.message \|\| 'Failed to join pool')` |
| Join succeeds | `addToast('success', 'Joined pool!')` |

### Dashboard (`src/app/dashboard/page.tsx`)

**Replace inline errors:**

| Action | New Toast |
|--------|-----------|
| Data load fails | Keep full-page error (nothing to show behind it) |
| Add entry fails | `addToast('error', err.message \|\| 'Failed to add entry')` |
| Add entry succeeds | `addToast('success', 'Entry added!')` |
| Copy join code | `addToast('info', 'Join code copied!')` with duration 2000 |

### Auth Pages — DO NOT CHANGE

Leave `src/components/auth/LoginForm.tsx` and `src/components/auth/SignUpForm.tsx` alone. Auth errors should stay inline on the form since toasts would be confusing during login/signup flows.

### Bracket, Standings, Analyze Pages — DO NOT CHANGE

These pages only have data loading errors which render as full-page error states. That's correct — there's nothing to show behind a toast if the data didn't load. Leave them as-is.

---

## Summary of State Variables to Remove

After migration, these local state variables are no longer needed:

| File | Remove |
|------|--------|
| `pick/page.tsx` | `showSuccess`, `setShowSuccess` + the success snackbar JSX |
| `settings/page.tsx` | `saveSuccess`, `setSaveSuccess` + the success banner JSX |

The `error`/`setError` variables should remain in pages where they're used for **full-page error states** (data loading failures). Only replace them with toasts where the error is for a **specific action** and the page is still usable (e.g., save failed, pick failed, remove member failed).

---

## Files to Create

1. `src/contexts/ToastContext.tsx` — ToastProvider + context
2. `src/components/Toast.tsx` — Toast UI component
3. `src/hooks/useToast.ts` — convenience hook (can also be exported from context file)

## Files to Modify

1. `src/app/layout.tsx` — wrap with `<ToastProvider>`
2. `src/app/pools/[id]/pick/page.tsx` — replace success snackbar + add retry logic
3. `src/app/pools/[id]/settings/page.tsx` — replace success banner + action errors
4. `src/app/pools/create/page.tsx` — replace creation error
5. `src/app/pools/join/page.tsx` — replace lookup/join errors
6. `src/app/dashboard/page.tsx` — replace add entry errors + copy code feedback

## What NOT to Do

- Don't change auth forms (login/signup) — keep inline errors there
- Don't replace full-page error states (bracket, standings, analyze loading failures) — those need the full error page
- Don't create a database table for toasts — this is purely client-side
- Don't add toasts for API routes / cron jobs — those run server-side
- Don't remove `console.error` calls in server-side code (api routes, lib files) — those are for logging
- Don't clear the user's pick selection when a submission fails — preserve it for retry

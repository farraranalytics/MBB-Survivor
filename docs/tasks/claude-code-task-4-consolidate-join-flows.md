# Task 4: Consolidate Join Flows

## What to Build

There are currently two separate join pages that do similar things but are disconnected:

- `/join/page.tsx` — a pre-auth join page that looks up a pool by `code` column, then links to signup/login with `?poolCode=` param. But the signup and login pages **don't actually read or use that param**, so the code is lost after auth.
- `/pools/join/page.tsx` — a post-auth join page that looks up a pool by `join_code` column, lets you set display name and bracket name, and creates the `pool_player` record.

These need to become one unified flow. Additionally, the join flow should support receiving a pool code via URL query parameter so that share links work (e.g., someone texts a friend a link like `yourapp.com/pools/join?code=TEST2026`).

## Requirements

### 1. Delete `src/app/join/page.tsx`

This page queries a different column (`code` vs `join_code`), doesn't handle auth'd users, and the `?poolCode=` param it passes to signup/login is never consumed. Remove it entirely.

### 2. Update `src/app/pools/join/page.tsx`

**Add query parameter support:**
- Read `?code=` from the URL on mount using `useSearchParams()`
- If a code is present, auto-populate the join code input and auto-trigger the pool lookup
- This enables share links: `/pools/join?code=TEST2026`

**Remove the inline header.** The shared Header component (from Task 3) now handles this. Remove the `<header>` element with "Join Pool" title and back button.

**After successful join:**
- Import and call `refreshPools()` from the ActivePoolContext (same pattern as pool creation)
- Call `setActivePool()` with the joined pool's ID and name
- Then redirect to `/dashboard`

**Rename "Bracket Name" to "Entry Name":**
- Change the label from "Bracket Name" to "Entry Name"
- Change `bracketName` state variable to `entryName`
- Change placeholder text from "e.g., Main Bracket" to "e.g., My Entry" and "e.g., Chaos Bracket" to "e.g., Second Entry"
- Change helper text from "Name your bracket (you can add more later if the pool allows)" to "Name your entry (you can add more later if the pool allows)"
- Change the "This is entry #X — give it a unique name" text to keep it (that one's fine)

### 3. Preserve the pool code through signup/login flow

When an unauthenticated user arrives at `/pools/join?code=TEST2026`, the current page redirects them to `/auth/login`. The code is lost.

**Fix this by preserving the code in sessionStorage:**

In `/pools/join/page.tsx`, when redirecting an unauthenticated user:
```typescript
// Before redirecting to login
sessionStorage.setItem('std_pending_join_code', joinCode || codeFromUrl);
router.push('/auth/login');
```

In `src/components/auth/LoginForm.tsx`, after successful login:
```typescript
// After successful sign-in
const pendingCode = sessionStorage.getItem('std_pending_join_code');
if (pendingCode) {
  sessionStorage.removeItem('std_pending_join_code');
  router.push(`/pools/join?code=${pendingCode}`);
} else {
  router.push('/dashboard');
}
```

In `src/components/auth/SignUpForm.tsx`, after successful signup (when redirecting to login):
```typescript
// Preserve the code through the signup → login redirect
// The code stays in sessionStorage, so no action needed here
// Just make sure the redirect to /auth/login doesn't clear sessionStorage
```

Also in `SignUpForm.tsx`: if the user arrived from a join link, show a message: "After verifying your email, log in to join the pool."

### 4. Update landing page links (if any)

Check `src/app/page.tsx` (landing page) — if it has any links to `/join`, update them to `/pools/join`.

## Files to Read Before Writing Code
- `src/app/join/page.tsx` — the file being deleted (understand what it does)
- `src/app/pools/join/page.tsx` — the file being updated
- `src/components/auth/LoginForm.tsx` — needs post-login redirect logic
- `src/components/auth/SignUpForm.tsx` — needs to preserve pending join code
- `src/app/page.tsx` — check for `/join` links
- The ActivePoolContext file (for `refreshPools` and `setActivePool`)

## Files to Delete
- `src/app/join/page.tsx`

## Files to Modify
- `src/app/pools/join/page.tsx` — query param support, remove header, rename bracket→entry, context integration
- `src/components/auth/LoginForm.tsx` — post-login redirect to pending join
- `src/components/auth/SignUpForm.tsx` — preserve pending join code context
- `src/app/page.tsx` — update any `/join` links to `/pools/join` (if they exist)

## What NOT to Do
- Don't change the pool creation flow
- Don't modify the database schema
- Don't change any styling beyond removing the inline header
- Don't touch BottomNav or the shared Header
- Don't build the "add entry from within a pool" feature (that's a later task)

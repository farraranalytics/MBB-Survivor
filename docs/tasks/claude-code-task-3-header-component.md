# Task 3: Create Header Component — Pool Pill + Settings Gear

## What to Build

A persistent header bar that appears on all authenticated pages. It shows the active pool name (as a tappable pill that navigates to Home) on the left, and a settings gear icon on the right.

Currently, each page has its own inline `<header>` with inconsistent content — the dashboard says "Survive the Dance," the pick page has a "← Pool" back button, the standings page also has "← Pool." We need a shared Header component that provides consistent context across all pages.

## Requirements

### 1. Create `src/components/Header.tsx`

**Layout:**
```
┌─────────────────────────────────────────┐
│  [Pool Name ▾]              [⚙]        │
│  (or "Survive the Dance" if no pool)    │
└─────────────────────────────────────────┘
```

**Left side — Pool Pill:**
- If `activePoolId` is set: show pool name as a tappable pill/badge. Tapping navigates to `/dashboard` (Home).
- Style: small rounded pill, subtle background (e.g. `bg-[#1A1A24]` with border), pool name in DM Sans, small text.
- If no active pool: show "Survive the Dance" as plain text in Oswald font (like current dashboard header).

**Right side — Settings Gear:**
- Gear icon (SVG, same stroke style as nav icons).
- Tapping navigates to `/settings`.
- Only shown when user is authenticated.

**General:**
- Fixed/sticky at top, `z-40`, same background as current headers: `bg-[#111118]` with bottom border `border-b border-[rgba(255,255,255,0.05)]`.
- Max width container: `max-w-lg mx-auto px-5`.
- Height: compact, roughly `py-3` (same as current page headers).
- Uses `useActivePool()` for pool name/id.
- Uses `useAuth()` to check if user is logged in.

**Visibility rules — same as BottomNav:**
- Hidden on landing page (`/`)
- Hidden on auth pages (`/auth/*`)
- Hidden on join flow (`/join/*`)
- Hidden on pool create (`/pools/create`)
- Visible everywhere else (dashboard, pick, standings, bracket, analyze, settings)

### 2. Add Header to `src/app/layout.tsx`

Place it above `{children}`, inside the providers:
```tsx
<AuthProvider>
  <ActivePoolProvider>
    <Header />
    {children}
    <BottomNav />
  </ActivePoolProvider>
</AuthProvider>
```

### 3. Remove per-page inline headers

Each of these pages has its own `<header>` element that should be removed or simplified since the shared Header now provides the top-level context:

**`src/app/dashboard/page.tsx`:**
- Remove the `<header>` elements that say "Survive the Dance" — the shared Header handles this now.
- Keep any dashboard-specific content below where the header was (pool cards, etc.).

**`src/app/pools/[id]/pick/page.tsx`:**
- Remove the "← Pool" back button from the sticky header — the pool pill in the shared Header serves this purpose.
- KEEP the round name display (e.g., "Round of 64") and the DeadlineCountdown component. These should remain in a sticky sub-header or at the top of the page content, just below the shared Header. Don't remove the deadline countdown.

**`src/app/pools/[id]/standings/page.tsx`:**
- Remove the "← Pool" back button and "Standings" title from the sticky header.
- KEEP the pool summary stats section below it.

**`src/app/settings/page.tsx`:**
- Remove its `<header>` that says "Settings" — the shared Header already shows the gear is active/selected.

**Important:** When removing inline headers, make sure the page content doesn't slide under the fixed Header. Pages may need `pt-14` or similar top padding to account for the Header's height, OR the Header can be sticky (not fixed) and push content down naturally. Choose whichever approach is cleaner — just make sure no content is hidden behind the Header.

### 4. Handle the Settings page title

Since Settings is no longer a nav tab, and the Header shows the gear icon, the Settings page should still have a visible "Settings" title — but as part of its page content (an `<h1>` at the top of the main content area), not as a separate header bar.

## Files to Read Before Writing Code
- `src/components/BottomNav.tsx` — reference for visibility rules, styling patterns, `useActivePool` import
- `src/app/layout.tsx` — where to add the Header
- `src/app/dashboard/page.tsx` — inline header to remove
- `src/app/pools/[id]/pick/page.tsx` — inline header to simplify (keep countdown!)
- `src/app/pools/[id]/standings/page.tsx` — inline header to remove
- `src/app/settings/page.tsx` — inline header to remove
- The ActivePoolContext file (created in Task 1)

## Files to Create
- `src/components/Header.tsx`

## Files to Modify
- `src/app/layout.tsx` — add Header
- `src/app/dashboard/page.tsx` — remove inline header
- `src/app/pools/[id]/pick/page.tsx` — remove back button, keep round name + countdown
- `src/app/pools/[id]/standings/page.tsx` — remove inline header
- `src/app/settings/page.tsx` — remove inline header, add h1 in content

## What NOT to Do
- Don't change BottomNav
- Don't change any page functionality or data fetching
- Don't restyle components beyond removing the old headers
- Don't add notification badges or urgency indicators (later task)
- Don't create new routes

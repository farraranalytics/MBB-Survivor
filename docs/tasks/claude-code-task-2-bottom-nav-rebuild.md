# Task 2: Rebuild BottomNav — 5 Pool-Scoped Tabs

## What to Build

The bottom nav currently has 3 tabs (Home, Bracket, Settings). It needs to become 5 tabs where tabs 2–5 are scoped to the active pool from `ActivePoolContext`:

```
Current:  Home | Bracket | Settings
Target:   Home | Pick | Standings | Bracket | Analyze
```

Settings moves out of the nav entirely (we'll handle that in a later task).

## Requirements

### 1. Rebuild `src/components/BottomNav.tsx`

**New tab configuration:**

| Tab | Label | Route | Active Match |
|-----|-------|-------|-------------|
| 1 | Home | `/dashboard` | `path === '/dashboard'` |
| 2 | Pick | `/pools/[activePoolId]/pick` | `/pools/*/pick` |
| 3 | Standings | `/pools/[activePoolId]/standings` | `/pools/*/standings` |
| 4 | Bracket | `/pools/[activePoolId]/bracket` | `/pools/*/bracket` OR `/tournament` |
| 5 | Analyze | `/pools/[activePoolId]/analyze` | `/pools/*/analyze` |

**Dynamic routing:**
- Import `useActivePool` from the ActivePoolContext (find it in the project — it was created in Task 1, likely in `src/contexts/` or `src/hooks/`)
- Tabs 2–5 use `activePoolId` to build their href: `/pools/${activePoolId}/pick`, etc.
- If `activePoolId` is null (no pool selected), tabs 2–5 href should be `/dashboard` (send user to Home to pick a pool)

**Icons — use simple, clean SVG icons (stroke-based, 24x24 viewBox, strokeWidth 1.8):**
- Home: house icon (keep current)
- Pick: crosshair/target icon
- Standings: trophy icon
- Bracket: bracket/tournament icon (keep current)  
- Analyze: bar chart icon

**Remove `shouldHideNav` for pick routes.** The pick page should NO LONGER hide the bottom nav. The updated `shouldHideNav` should only hide nav for:
```typescript
function shouldHideNav(pathname: string): boolean {
  if (pathname === '/') return true;           // Landing page
  if (pathname.startsWith('/auth')) return true; // Login/signup
  if (pathname.startsWith('/join')) return true;  // Join flow
  if (pathname === '/pools/create') return true;  // Create flow
  return false;
}
```

**Keep existing styling approach.** Don't change colors, fonts, spacing, or overall visual style — just the tab count, labels, icons, and routing logic. We'll restyle in a later visual pass.

### 2. Create placeholder pages for new routes

These routes don't have pages yet. Create minimal placeholder pages so the nav links don't 404:

**`src/app/pools/[id]/bracket/page.tsx`** — Simple placeholder:
```tsx
'use client';
export default function PoolBracketPage() {
  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center pb-24">
      <p className="text-[#8A8694]">Bracket — coming soon</p>
    </div>
  );
}
```

**`src/app/pools/[id]/analyze/page.tsx`** — Same pattern:
```tsx
'use client';
export default function PoolAnalyzePage() {
  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center pb-24">
      <p className="text-[#8A8694]">Analyze — coming soon</p>
    </div>
  );
}
```

Note: `/pools/[id]/pick` and `/pools/[id]/standings` already exist as pages — no placeholders needed.

### 3. Handle "no active pool" state on pool-scoped tabs

When a user taps Pick/Standings/Bracket/Analyze but has no active pool selected, they go to `/dashboard`. But if they somehow land on a pool-scoped route without a valid pool, the existing pages handle that (they show "Pool Not Found" or redirect).

No extra handling needed beyond the href fallback to `/dashboard`.

## Files to Read Before Writing Code
- `src/components/BottomNav.tsx` — the file you're rebuilding
- The ActivePoolContext file created in Task 1 (find it — likely `src/contexts/ActivePoolContext.tsx`)
- The useActivePool hook created in Task 1 (find it — likely `src/hooks/useActivePool.ts`)
- `src/app/pools/[id]/pick/page.tsx` — confirm this route exists (it does)
- `src/app/pools/[id]/standings/page.tsx` — confirm this route exists (it does)

## Files to Create
- `src/app/pools/[id]/bracket/page.tsx` — placeholder
- `src/app/pools/[id]/analyze/page.tsx` — placeholder

## Files to Modify
- `src/components/BottomNav.tsx` — full rebuild

## What NOT to Do
- Don't touch any page styling
- Don't modify the pick page, standings page, or dashboard
- Don't create a Header component yet (later task)
- Don't move or modify `/settings` page (later task)
- Don't add urgency badges to the Pick tab icon (later task)

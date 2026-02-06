# Task 5 (Retry): Move Bracket to Pool-Scoped Route

## What to Build

The bracket page currently lives at `src/app/tournament/page.tsx` as a global page. It needs to move to `src/app/pools/[id]/bracket/page.tsx` so it matches the Bracket tab in the bottom nav. The bracket placeholder currently at that path just says "Bracket — coming soon" and needs to be replaced with the real bracket content.

## Exact Files and Changes

### 1. REPLACE `src/app/pools/[id]/bracket/page.tsx`

This file currently contains:
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

**Delete all of that** and replace it with the full bracket page. Copy everything from `src/app/tournament/page.tsx` but make these changes:

- Add `import { useParams } from 'next/navigation';` and `const params = useParams(); const poolId = params.id as string;` inside the component (same pattern as `src/app/pools/[id]/pick/page.tsx` lines 2 and 261)
- Remove the `import ProtectedRoute from '@/components/auth/ProtectedRoute';` import
- Remove all `<ProtectedRoute>` wrapper tags (there are 3 — around loading state, error state, and main content)
- Remove the entire `<header>` block (lines ~86–139 of tournament/page.tsx, the one with "NCAA Tournament" title, back button, Schedule/Bracket toggle, and refresh button). Keep the Schedule/Bracket toggle and refresh button but move them into the content area — put them at the top of the `<div className="max-w-7xl mx-auto px-5 py-6">` content section instead
- Keep ALL sub-components exactly as they are: `ScheduleView`, `ScheduleGameCard`, `BracketView`, `FinalFourBracket`
- Keep all imports from `@/lib/bracket` and `@/components/bracket/*`
- Keep `pb-24` on the outer div

### 2. REPLACE `src/app/tournament/page.tsx`

Replace the entire file content with this redirect:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useActivePool } from '@/hooks/useActivePool';

export default function TournamentRedirect() {
  const router = useRouter();
  const { activePoolId } = useActivePool();

  useEffect(() => {
    if (activePoolId) {
      router.replace(`/pools/${activePoolId}/bracket`);
    } else {
      router.replace('/dashboard');
    }
  }, [activePoolId, router]);

  return null;
}
```

### 3. FIX the link in `src/components/pool/PoolDetailView.tsx`

Line 358 currently says:
```tsx
onClick={() => router.push('/tournament')}
```

Change it to:
```tsx
onClick={() => router.push(`/pools/${poolId}/bracket`)}
```

The `poolId` variable is already available in this component (check the component props — it receives `poolId` as a prop).

## Verification

After making all changes, read back each file to confirm the changes actually saved:
1. Read `src/app/pools/[id]/bracket/page.tsx` — should NOT contain "coming soon"
2. Read `src/app/tournament/page.tsx` — should be a short redirect, NOT the full bracket page
3. Read `src/components/pool/PoolDetailView.tsx` line ~358 — should reference `/pools/${poolId}/bracket`

## Files to Read Before Writing Code
- `src/app/tournament/page.tsx` — the content to copy from
- `src/app/pools/[id]/bracket/page.tsx` — the file to replace
- `src/app/pools/[id]/pick/page.tsx` — reference for useParams() pattern (lines 1-5, 261)
- `src/components/pool/PoolDetailView.tsx` — line 358, the tournament link to update
- `src/hooks/useActivePool.ts` — import path for the redirect

## What NOT to Do
- Don't change BottomNav.tsx
- Don't change bracket sub-components (RegionBracket.tsx, BracketMatchupCard.tsx)
- Don't change lib/bracket.ts
- Don't change any styling

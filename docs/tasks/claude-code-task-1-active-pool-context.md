# Task 1: Create ActivePoolContext + useActivePool Hook

## What to Build

The entire app needs a concept of an "active pool" — the pool that tabs 2–5 (Pick, Standings, Bracket, Analyze) are scoped to. Right now this doesn't exist. The dashboard has a `SELECTED_POOL_KEY` localStorage key but it's local to that one page component. We need a proper React context that wraps the app.

## Requirements

### 1. Create `src/contexts/ActivePoolContext.tsx`

A context provider that manages which pool is currently "active" across the app.

**Interface:**
```typescript
interface ActivePoolContextValue {
  activePoolId: string | null;
  activePoolName: string | null;
  setActivePool: (poolId: string, poolName: string) => void;
  clearActivePool: () => void;
}
```

**Behavior:**
- Persists the active pool to `localStorage` key `std_active_pool` (as JSON: `{ id, name }`)
- On mount, reads from localStorage and validates it still exists in the user's pool list
- If the user has exactly 1 pool, auto-sets it as active
- If the user has 0 pools, active pool is null
- If the stored pool ID is no longer in the user's pool list (they left or got removed), clear it
- On auth sign-out, clear the active pool
- Needs access to the auth user (via `useAuth()`) to validate pool membership

**Validation on mount** — the context should call `getMyPools(userId)` once on mount to check that the stored activePoolId is still valid. This is lightweight (the dashboard already calls this). Cache the result or share it.

**Follow the same pattern as `AuthProvider`** — createContext, provider component, consumer hook, throw if used outside provider.

### 2. Create `src/hooks/useActivePool.ts`

A simple consumer hook:
```typescript
export function useActivePool() {
  const context = useContext(ActivePoolContext);
  if (context === undefined) {
    throw new Error('useActivePool must be used within an ActivePoolProvider');
  }
  return context;
}
```

This can live inside the context file or as a separate hook file — either is fine, but a separate file is cleaner for imports.

### 3. Update `src/app/layout.tsx`

Wrap the app in `ActivePoolProvider`, nested inside `AuthProvider` (since it depends on auth):

```tsx
<AuthProvider>
  <ActivePoolProvider>
    {children}
    <BottomNav />
  </ActivePoolProvider>
</AuthProvider>
```

### 4. Update `src/app/dashboard/page.tsx`

The dashboard currently has its own `SELECTED_POOL_KEY` localStorage logic and a `PoolSwitcher` component. Replace this with the shared context:

- Remove `SELECTED_POOL_KEY` constant and all direct localStorage reads/writes for pool selection
- When the user taps a pool card/pill, call `setActivePool(poolId, poolName)` from context
- Read `activePoolId` from `useActivePool()` instead of local state
- When the user has exactly 1 pool, the context auto-sets it — no need for dashboard-specific logic

**Don't restructure the dashboard UI yet** — that's a later task. Just swap the state management from local to context.

## Files to Read
- `src/components/auth/AuthProvider.tsx` — follow this pattern exactly
- `src/app/layout.tsx` — where to add the provider
- `src/app/dashboard/page.tsx` — where to consume and replace local pool selection state
- `src/lib/standings.ts` — has `getMyPools()` function you'll call for validation
- `src/types/standings.ts` — has `MyPool` type

## Files to Create
- `src/contexts/ActivePoolContext.tsx`
- `src/hooks/useActivePool.ts` (optional — can export from context file)

## Files to Modify
- `src/app/layout.tsx` — add ActivePoolProvider
- `src/app/dashboard/page.tsx` — replace local pool state with context

## What NOT to Do
- Don't touch BottomNav yet (that's task 2)
- Don't change any styling
- Don't restructure the dashboard UI/layout
- Don't create new routes
- Don't modify the pool detail view

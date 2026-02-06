'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { getMyPools } from '@/lib/standings';
import { MyPool } from '@/types/standings';

const ACTIVE_POOL_KEY = 'std_active_pool';

interface ActivePoolContextValue {
  activePoolId: string | null;
  activePoolName: string | null;
  setActivePool: (poolId: string, poolName: string) => void;
  clearActivePool: () => void;
  refreshPools: () => Promise<void>;
  pools: MyPool[];
  loadingPools: boolean;
}

const ActivePoolContext = createContext<ActivePoolContextValue | undefined>(undefined);

export function ActivePoolProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [activePoolId, setActivePoolId] = useState<string | null>(null);
  const [activePoolName, setActivePoolName] = useState<string | null>(null);
  const [pools, setPools] = useState<MyPool[]>([]);
  const [loadingPools, setLoadingPools] = useState(true);

  const setActivePool = useCallback((poolId: string, poolName: string) => {
    setActivePoolId(poolId);
    setActivePoolName(poolName);
    localStorage.setItem(ACTIVE_POOL_KEY, JSON.stringify({ id: poolId, name: poolName }));
  }, []);

  const clearActivePool = useCallback(() => {
    setActivePoolId(null);
    setActivePoolName(null);
    localStorage.removeItem(ACTIVE_POOL_KEY);
  }, []);

  const refreshPools = useCallback(async () => {
    if (!user) return;
    try {
      const myPools = await getMyPools(user.id);
      setPools(myPools);
    } catch (err) {
      console.error('Failed to refresh pools:', err);
    }
  }, [user]);

  // Validate and set active pool on mount / when user changes
  useEffect(() => {
    // Wait for auth to resolve before acting
    if (authLoading) return;

    if (!user) {
      setPools([]);
      setLoadingPools(false);
      clearActivePool();
      return;
    }

    const init = async () => {
      setLoadingPools(true);
      try {
        const myPools = await getMyPools(user.id);
        setPools(myPools);

        if (myPools.length === 0) {
          clearActivePool();
          return;
        }

        // Try to restore from localStorage
        const stored = localStorage.getItem(ACTIVE_POOL_KEY);
        if (stored) {
          try {
            const { id, name } = JSON.parse(stored);
            const stillValid = myPools.some(p => p.pool_id === id);
            if (stillValid) {
              setActivePoolId(id);
              setActivePoolName(name);
              return;
            }
          } catch {
            // Invalid JSON, fall through
          }
        }

        // Auto-set if exactly 1 pool, or default to first
        if (myPools.length >= 1) {
          setActivePool(myPools[0].pool_id, myPools[0].pool_name);
        }
      } catch (err) {
        console.error('Failed to fetch pools:', err);
      } finally {
        setLoadingPools(false);
      }
    };

    init();
  }, [user, authLoading, setActivePool, clearActivePool]);

  return (
    <ActivePoolContext.Provider value={{
      activePoolId,
      activePoolName,
      setActivePool,
      clearActivePool,
      refreshPools,
      pools,
      loadingPools,
    }}>
      {children}
    </ActivePoolContext.Provider>
  );
}

export { ActivePoolContext };

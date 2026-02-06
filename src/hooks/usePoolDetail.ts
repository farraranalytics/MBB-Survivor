'use client';

import { useEffect, useState } from 'react';
import { getPoolStandings, getPickDeadline } from '@/lib/picks';
import { PoolStandings, PickDeadline } from '@/types/picks';

interface UsePoolDetailResult {
  standings: PoolStandings | null;
  deadline: PickDeadline | null;
  loading: boolean;
  error: string | null;
}

export function usePoolDetail(poolId: string | null, userId: string | null): UsePoolDetailResult {
  const [standings, setStandings] = useState<PoolStandings | null>(null);
  const [deadline, setDeadline] = useState<PickDeadline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !poolId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      try {
        if (!cancelled) setLoading(true);
        const poolStandings = await getPoolStandings(poolId, userId);
        if (cancelled) return;
        setStandings(poolStandings);

        if (poolStandings.current_round) {
          const roundDeadline = await getPickDeadline(poolStandings.current_round.id);
          if (cancelled) return;
          setDeadline(roundDeadline);
        } else {
          setDeadline(null);
        }
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch pool data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load pool');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId, poolId]);

  return { standings, deadline, loading, error };
}

'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useActivePool } from '@/hooks/useActivePool';

export default function PoolRedirect() {
  const params = useParams();
  const router = useRouter();
  const { setActivePool, pools, loadingPools } = useActivePool();
  const poolId = params.id as string;

  useEffect(() => {
    if (loadingPools) return;

    const pool = pools.find(p => p.pool_id === poolId);
    if (pool) {
      setActivePool(poolId, pool.pool_name);
    }
    router.replace('/dashboard');
  }, [poolId, pools, loadingPools, setActivePool, router]);

  return null;
}

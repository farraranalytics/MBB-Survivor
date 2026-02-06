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

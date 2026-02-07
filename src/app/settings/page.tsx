'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useActivePool } from '@/hooks/useActivePool';

export default function SettingsRedirect() {
  const router = useRouter();
  const { activePoolId } = useActivePool();

  useEffect(() => {
    if (activePoolId) {
      router.replace(`/pools/${activePoolId}/settings`);
    } else {
      router.replace('/dashboard');
    }
  }, [activePoolId, router]);

  return null;
}

'use client';

import { useEffect, useState } from 'react';
import { getClockOffset } from '@/lib/clock';

/**
 * React hook that provides the clock offset for simulated time.
 * offset = simulated_time - real_time (in milliseconds)
 * Usage: const simulatedNow = Date.now() + offset
 *
 * Fetches the offset once on mount. Returns 0 when not in test mode.
 */
export function useClockOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getClockOffset().then(o => {
      if (!cancelled) setOffset(o);
    });

    return () => { cancelled = true; };
  }, []);

  return offset;
}

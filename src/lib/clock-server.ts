// src/lib/clock-server.ts
// Server-side clock utility using supabaseAdmin (bypasses RLS).
// Used in API routes and admin test endpoints.

import { supabaseAdmin } from '@/lib/supabase/admin';

let _testState: { is_test_mode: boolean; simulated_datetime: string | null } | null = null;
let _lastFetch = 0;
const CACHE_TTL = 10_000; // 10 seconds (shorter TTL for server-side)

/**
 * Server-side: Get the effective "now" — simulated time in test mode, real time otherwise.
 */
export async function getEffectiveNowServer(): Promise<Date> {
  if (!_testState || Date.now() - _lastFetch > CACHE_TTL) {
    const { data } = await supabaseAdmin
      .from('admin_test_state')
      .select('is_test_mode, simulated_datetime')
      .single();
    _testState = data || { is_test_mode: false, simulated_datetime: null };
    _lastFetch = Date.now();
  }

  if (_testState.is_test_mode && _testState.simulated_datetime) {
    return new Date(_testState.simulated_datetime);
  }
  return new Date();
}

/**
 * Clear the cached test state. Call after admin changes the clock.
 */
export function clearServerClockCache(): void {
  _testState = null;
  _lastFetch = 0;
}

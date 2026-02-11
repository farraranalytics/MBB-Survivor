// src/lib/clock.ts
// Centralized clock utility for the simulated time system.
// In test mode, returns simulated_datetime from admin_test_state.
// In production, returns real time.

import { supabase } from '@/lib/supabase/client';

// ─── Cache for Test State ────────────────────────────────────────

let _testState: { is_test_mode: boolean; simulated_datetime: string | null } | null = null;
let _lastFetch = 0;
const CACHE_TTL = 30_000; // 30 seconds

/**
 * Get the effective "now" — simulated time in test mode, real time otherwise.
 * Caches the test state for 30s to avoid hammering the DB.
 */
export async function getEffectiveNow(): Promise<Date> {
  if (!_testState || Date.now() - _lastFetch > CACHE_TTL) {
    const { data } = await supabase
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
 * Clear the cached test state. Call when admin changes the clock.
 */
export function clearClockCache(): void {
  _testState = null;
  _lastFetch = 0;
}

/**
 * Get the clock offset in milliseconds.
 * offset = simulated_time - real_time
 * When added to Date.now(), gives the simulated time.
 * Returns 0 if not in test mode.
 */
export async function getClockOffset(): Promise<number> {
  const effectiveNow = await getEffectiveNow();
  const realNow = Date.now();
  // If not in test mode, effectiveNow ≈ realNow, offset ≈ 0
  // If in test mode, offset = simulated - real
  if (!_testState?.is_test_mode || !_testState?.simulated_datetime) {
    return 0;
  }
  return effectiveNow.getTime() - realNow;
}

/**
 * Check if test mode is currently active.
 */
export async function isTestMode(): Promise<boolean> {
  await getEffectiveNow(); // ensures cache is populated
  return _testState?.is_test_mode ?? false;
}

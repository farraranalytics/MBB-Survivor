'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useActivePool } from '@/hooks/useActivePool';
import { MyPool } from '@/types/standings';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SplashOverlay } from '@/components/SplashOverlay';
import { useClockOffset } from '@/hooks/useClockOffset';
import { getTournamentState, canJoinOrCreate, TournamentState } from '@/lib/status';
import PickAlertBanner from '@/components/dashboard/PickAlertBanner';
import MostPickedToday from '@/components/dashboard/MostPickedToday';
import RoundProgress from '@/components/dashboard/RoundProgress';
import QuickStats from '@/components/dashboard/QuickStats';
import PoolCard from '@/components/dashboard/PoolCard';

// ─── Loading Skeleton ────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-24">
      <div className="max-w-lg mx-auto px-4 sm:px-5 py-2.5 sm:py-4 space-y-3 sm:space-y-5">
        {/* Welcome skeleton */}
        <div className="animate-pulse pt-2">
          <div className="h-3 w-24 bg-[#1B2A3D] rounded mb-2" />
          <div className="h-6 w-36 bg-[#1B2A3D] rounded" />
        </div>
        {/* Pick alert skeleton */}
        <div className="h-16 bg-[#1B2A3D] rounded-[14px] animate-pulse" />
        {/* Stats skeleton */}
        <div className="flex gap-2.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-1 h-20 bg-[#1B2A3D] rounded-[10px] animate-pulse" />
          ))}
        </div>
        {/* Pool cards skeleton */}
        {[1, 2].map(i => (
          <div key={i} className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[14px] p-4 animate-pulse">
            <div className="h-5 w-32 bg-[#1B2A3D] rounded mb-3" />
            <div className="h-3 w-48 bg-[#1B2A3D] rounded mb-4" />
            <div className="h-5 w-full bg-[#1B2A3D] rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-24">
      <main className="max-w-lg mx-auto px-5 py-6">
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[14px] p-8 text-center">
          <div className="mb-4 inline-flex flex-col items-center" style={{ gap: 0 }}>
            <span className="text-[0.7rem] tracking-[0.5em]" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: 'rgba(232, 230, 225, 0.4)', lineHeight: 1 }}>
              SURVIVE
            </span>
            <span className="text-[1.4rem] tracking-[0.15em] text-[#FF5722]" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, lineHeight: 1.1 }}>
              THE
            </span>
            <span className="text-[2.5rem] tracking-[-0.02em] text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, lineHeight: 0.85 }}>
              DANCE
            </span>
          </div>
          <p className="text-sm text-[#9BA3AE] mb-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            2026 March Madness Survivor Pool
          </p>
          <p className="text-xs text-[#5F6B7A] mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Create a pool and invite your friends, or join an existing pool with a code.
          </p>
          <div className="flex justify-center gap-3 mb-4">
            <Link href="/pools/create" className="btn-orange px-5 py-2.5 text-sm font-semibold rounded-[10px]">
              Create Pool
            </Link>
            <Link href="/pools/join" className="px-5 py-2.5 border border-[rgba(255,255,255,0.08)] text-[#9BA3AE] text-sm font-semibold rounded-[10px] hover:border-[rgba(255,87,34,0.3)] hover:text-[#E8E6E1] transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Join Pool
            </Link>
          </div>
          <p className="text-xs text-[#5F6B7A]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Free to play &middot; No money involved
          </p>
        </div>
      </main>
    </div>
  );
}

// ─── Welcome Section ─────────────────────────────────────────────

function WelcomeHeader({ displayName }: { displayName: string }) {
  const initial = (displayName[0] || 'U').toUpperCase();

  return (
    <div className="flex items-center justify-between pt-1">
      <div>
        <p
          className="text-xs text-[#5F6B7A] mb-0.5"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Welcome back,
        </p>
        <h1
          className="text-xl font-bold text-[#E8E6E1] tracking-[0.02em]"
          style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
        >
          {displayName}
        </h1>
      </div>
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: 'linear-gradient(135deg, #FF5722, #FFB300)',
          fontFamily: "'Oswald', sans-serif",
          fontWeight: 700,
          fontSize: '0.9rem',
          color: '#0D1B2A',
        }}
      >
        {initial}
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const { activePoolId, setActivePool, pools, loadingPools } = useActivePool();
  const router = useRouter();
  const clockOffset = useClockOffset();
  const [tournamentState, setTournamentState] = useState<TournamentState | null>(null);

  // Load tournament state when pools are ready
  useEffect(() => {
    if (loadingPools || !user) return;

    async function loadDashboardData() {
      try {
        const state = await getTournamentState();
        setTournamentState(state);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      }
    }

    loadDashboardData();
  }, [loadingPools, user, pools]);

  const preTournament = !tournamentState || canJoinOrCreate(tournamentState);

  // Pre-round (picks open) → click pool goes to Pick; otherwise → Standings (The Field)
  const poolClickTarget =
    tournamentState?.currentRound?.status === 'pre_round' && !tournamentState?.currentRound?.isDeadlinePassed
      ? 'pick'
      : 'standings';

  // User display name
  const displayName = user?.user_metadata?.display_name
    || user?.email?.split('@')[0]
    || 'Player';

  return (
    <>
      <SplashOverlay userId={user?.id} />
      {loadingPools ? (
        <LoadingSkeleton />
      ) : pools.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="min-h-screen bg-[#0D1B2A] pb-24">
          <div className="max-w-lg mx-auto px-4 sm:px-5 py-2.5 sm:py-4 space-y-4">

            {/* Section 1: Welcome + Avatar */}
            <WelcomeHeader displayName={displayName} />

            {/* Create / Join Buttons */}
            {preTournament && (
              <div className="flex gap-2.5">
                <Link
                  href="/pools/create"
                  className="flex-1 py-2 text-center text-sm font-semibold rounded-[10px] border border-[rgba(255,87,34,0.3)] text-[#FF5722] hover:bg-[rgba(255,87,34,0.05)] transition-colors"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  + Create Pool
                </Link>
                <Link
                  href="/pools/join"
                  className="flex-1 py-2 text-center text-sm font-semibold rounded-[10px] border border-[rgba(255,87,34,0.3)] text-[#FF5722] hover:bg-[rgba(255,87,34,0.05)] transition-colors"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  + Join Pool
                </Link>
              </div>
            )}

            {/* Section 2: Pick Alert Banner */}
            <PickAlertBanner pools={pools} activePoolId={activePoolId} clockOffset={clockOffset} />

            {/* Section 3: Most Picked Today */}
            {tournamentState && tournamentState.status !== 'pre_tournament' && (
              <MostPickedToday pools={pools} activePoolId={activePoolId} />
            )}

            {/* Section 4: Round Progress */}
            {tournamentState && tournamentState.rounds.length > 0 && (
              <RoundProgress rounds={tournamentState.rounds} />
            )}

            {/* Section 5: Quick Stats */}
            <QuickStats pools={pools} />

            {/* Section 6: Pool Cards */}
            <div>
              <p className="label mb-2 sm:mb-2.5">Your Pools</p>
              <div className="space-y-3">
                {pools.map(pool => (
                  <PoolCard
                    key={pool.pool_id}
                    pool={pool}
                    isActive={pool.pool_id === activePoolId}
                    onActivate={() => setActivePool(pool.pool_id, pool.pool_name)}
                    clickTarget={poolClickTarget}
                    clockOffset={clockOffset}
                    preTournament={preTournament}
                  />
                ))}
              </div>
            </div>

            {/* Footer */}
            <footer className="pt-4 pb-2 text-center text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p className="text-[#9BA3AE] opacity-50">
                &copy; 2026 Farrar Analytics LLC
                {' '}&middot;{' '}
                <Link href="/about" className="text-[#9BA3AE] hover:text-[#E8E6E1] transition-colors">About</Link>
                {' '}&middot;{' '}
                <Link href="/terms" className="text-[#9BA3AE] hover:text-[#E8E6E1] transition-colors">Terms</Link>
                {' '}&middot;{' '}
                <Link href="/privacy" className="text-[#9BA3AE] hover:text-[#E8E6E1] transition-colors">Privacy</Link>
              </p>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

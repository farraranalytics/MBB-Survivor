'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/auth/AuthProvider';
import { getMyPools } from '@/lib/standings';
import { MyPool } from '@/types/standings';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

function PoolCard({ pool }: { pool: MyPool }) {
  const router = useRouter();

  const deadlinePassed = pool.deadline_datetime
    ? new Date(pool.deadline_datetime) < new Date()
    : true;

  const needsPick = !pool.has_picked_today && !deadlinePassed && pool.your_status === 'active';

  return (
    <button
      onClick={() => router.push(`/pools/${pool.pool_id}`)}
      className="w-full text-left bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-5 hover:border-[rgba(255,87,34,0.3)] transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="font-bold text-[#E8E6E1] truncate text-base" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>{pool.pool_name}</h3>
          <p className="text-xs text-[#8A8694] mt-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {pool.alive_players} alive / {pool.total_players} total
          </p>
        </div>
        <span
          className={`flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
            pool.your_status === 'eliminated'
              ? 'bg-[rgba(239,83,80,0.15)] text-[#EF5350]'
              : 'bg-[rgba(76,175,80,0.15)] text-[#4CAF50]'
          }`}
          style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em' }}
        >
          {pool.your_status === 'eliminated' ? 'OUT' : 'ALIVE'}
        </span>
      </div>

      <div className="flex items-center space-x-4 text-xs text-[#8A8694] mb-3" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <span>{pool.your_picks_count} picks</span>
        {pool.your_streak > 0 && (
          <span className="text-[#FF5722] font-medium">{pool.your_streak} streak</span>
        )}
        {pool.current_round_name && (
          <span className="truncate opacity-60">{pool.current_round_name}</span>
        )}
      </div>

      {needsPick && (
        <div className="bg-[rgba(255,87,34,0.1)] border border-[rgba(255,87,34,0.25)] rounded-[8px] px-3 py-2.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-[#FF5722]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Pick needed today!</span>
          <svg className="w-4 h-4 text-[#FF5722]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
        </div>
      )}
      {pool.has_picked_today && pool.your_status === 'active' && (
        <div className="bg-[rgba(76,175,80,0.1)] border border-[rgba(76,175,80,0.25)] rounded-[8px] px-3 py-2.5">
          <span className="text-sm font-medium text-[#4CAF50]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Pick locked in</span>
        </div>
      )}
      {pool.your_status === 'eliminated' && (
        <div className="bg-[#1A1A24] border border-[rgba(255,255,255,0.05)] rounded-[8px] px-3 py-2.5">
          <span className="text-sm text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>View standings</span>
        </div>
      )}
    </button>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [pools, setPools] = useState<MyPool[]>([]);
  const [loadingPools, setLoadingPools] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchPools = async () => {
      try {
        const myPools = await getMyPools(user.id);
        setPools(myPools);
      } catch (err) {
        console.error('Failed to fetch pools:', err);
      } finally {
        setLoadingPools(false);
      }
    };

    fetchPools();
  }, [user]);

  const activePools = pools.filter(p => p.your_status === 'active');
  const eliminatedPools = pools.filter(p => p.your_status === 'eliminated');
  const needsAction = activePools.filter(p => {
    const deadlinePassed = p.deadline_datetime
      ? new Date(p.deadline_datetime) < new Date()
      : true;
    return !p.has_picked_today && !deadlinePassed;
  });

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0D1B2A] pb-24">
        {/* Header */}
        <header className="bg-[#111118] border-b border-[rgba(255,255,255,0.05)]">
          <div className="max-w-lg mx-auto px-5">
            <div className="flex justify-between items-center py-4">
              <div>
                <h1 className="text-xl font-bold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Survive the Dance</h1>
                <p className="text-[#8A8694] text-xs mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>{user?.email}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-5 py-6">
          {/* Action alert */}
          {needsAction.length > 0 && (
            <div className="bg-[#FF5722] text-[#E8E6E1] rounded-[12px] p-4 mb-6 shadow-lg animate-glow-pulse" style={{ boxShadow: '0 4px 20px rgba(255, 87, 34, 0.3)' }}>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[rgba(255,255,255,0.2)] rounded-[8px] flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {needsAction.length === 1
                      ? "Clock's ticking. You haven't picked yet."
                      : `Picks needed in ${needsAction.length} pools!`}
                  </p>
                  <p className="text-[rgba(255,255,255,0.7)] text-xs mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {needsAction.map(p => p.pool_name).join(', ')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <Link
              href="/pools/create"
              className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-4 hover:border-[rgba(255,87,34,0.3)] transition-all text-center"
            >
              <div className="w-10 h-10 bg-[rgba(27,58,92,0.3)] rounded-[8px] flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-[#1B3A5C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span className="text-xs font-medium text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Create</span>
            </Link>

            <Link
              href="/pools/join"
              className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-4 hover:border-[rgba(255,87,34,0.3)] transition-all text-center"
            >
              <div className="w-10 h-10 bg-[rgba(76,175,80,0.1)] rounded-[8px] flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-[#4CAF50]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Join</span>
            </Link>

            <Link
              href="/tournament"
              className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-4 hover:border-[rgba(255,87,34,0.3)] transition-all text-center"
            >
              <div className="w-10 h-10 bg-[rgba(255,87,34,0.08)] rounded-[8px] flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-[#FF5722]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <span className="text-xs font-medium text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Bracket</span>
            </Link>
          </div>

          {/* My Pools */}
          <h2 className="text-lg font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: '0.02em' }}>My Pools</h2>

          {loadingPools ? (
            <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[rgba(255,255,255,0.08)] border-t-[#FF5722] mx-auto mb-3" />
              <p className="text-[#8A8694] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>Loading your pools...</p>
            </div>
          ) : pools.length === 0 ? (
            <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-8 text-center">
              <div className="w-16 h-16 bg-[rgba(255,87,34,0.08)] rounded-[16px] flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#FF5722]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <p className="text-[#E8E6E1] font-semibold text-lg mb-1" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>No Pools Yet</p>
              <p className="text-[#8A8694] text-sm mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>Create or join a pool to start playing.</p>
              <div className="flex justify-center gap-3">
                <Link href="/pools/create" className="btn-orange px-5 py-2.5 text-sm font-semibold rounded-[12px]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Create Pool
                </Link>
                <Link href="/pools/join" className="px-5 py-2.5 bg-[#1A1A24] border border-[rgba(255,255,255,0.05)] text-[#8A8694] text-sm font-semibold rounded-[12px] hover:border-[rgba(255,87,34,0.3)] transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Join Pool
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {activePools.length > 0 && (
                <div>
                  <p className="label mb-3">Active ({activePools.length})</p>
                  <div className="space-y-3">
                    {activePools.map((pool) => (
                      <PoolCard key={pool.pool_id} pool={pool} />
                    ))}
                  </div>
                </div>
              )}

              {eliminatedPools.length > 0 && (
                <div>
                  <p className="label mb-3">Eliminated ({eliminatedPools.length})</p>
                  <div className="space-y-3">
                    {eliminatedPools.map((pool) => (
                      <PoolCard key={pool.pool_id} pool={pool} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}

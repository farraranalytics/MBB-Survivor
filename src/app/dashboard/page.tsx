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
      className="w-full text-left bg-dark-card border border-dark-border rounded-2xl p-5 hover:border-dark-elevated transition-all card-glow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="font-bold text-white truncate text-base">{pool.pool_name}</h3>
          <p className="text-xs text-text-muted mt-1">
            {pool.alive_players} alive / {pool.total_players} total
          </p>
        </div>
        <span
          className={`flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
            pool.your_status === 'eliminated'
              ? 'bg-eliminated/15 text-eliminated'
              : 'bg-alive/15 text-alive'
          }`}
        >
          {pool.your_status === 'eliminated' ? 'OUT' : 'ALIVE'}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center space-x-4 text-xs text-text-muted mb-3">
        <span>{pool.your_picks_count} picks</span>
        {pool.your_streak > 0 && (
          <span className="text-accent font-medium">{pool.your_streak} streak</span>
        )}
        {pool.current_round_name && (
          <span className="truncate text-text-faint">{pool.current_round_name}</span>
        )}
      </div>

      {/* Action prompt */}
      {needsPick && (
        <div className="bg-accent/10 border border-accent/25 rounded-xl px-3 py-2.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-accent">Pick needed today!</span>
          <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
        </div>
      )}
      {pool.has_picked_today && pool.your_status === 'active' && (
        <div className="bg-alive/10 border border-alive/25 rounded-xl px-3 py-2.5">
          <span className="text-sm font-medium text-alive">Pick locked in</span>
        </div>
      )}
      {pool.your_status === 'eliminated' && (
        <div className="bg-dark-surface border border-dark-border-subtle rounded-xl px-3 py-2.5">
          <span className="text-sm text-text-muted">View standings</span>
        </div>
      )}
    </button>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
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
      <div className="min-h-screen bg-dark-base">
        {/* Header */}
        <header className="bg-dark-surface border-b border-dark-border">
          <div className="max-w-lg mx-auto px-5">
            <div className="flex justify-between items-center py-4">
              <div>
                <h1 className="text-xl font-bold text-white">MBB Survivor</h1>
                <p className="text-text-muted text-xs mt-0.5">{user?.email}</p>
              </div>
              <button
                onClick={signOut}
                className="text-text-muted hover:text-text-secondary px-3 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-5 py-6">
          {/* Action alert banner */}
          {needsAction.length > 0 && (
            <div className="bg-gradient-to-r from-accent to-accent-hover text-white rounded-2xl p-4 mb-6 shadow-lg shadow-accent-dim animate-glow-pulse">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <p className="font-bold text-sm">
                    {needsAction.length === 1
                      ? 'Pick needed in 1 pool!'
                      : `Picks needed in ${needsAction.length} pools!`}
                  </p>
                  <p className="text-white/70 text-xs mt-0.5">
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
              className="bg-dark-card border border-dark-border rounded-2xl p-4 hover:border-accent/30 transition-all text-center"
            >
              <div className="w-10 h-10 bg-electric/10 rounded-xl flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-electric" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span className="text-xs font-medium text-text-secondary">Create</span>
            </Link>

            <Link
              href="/pools/join"
              className="bg-dark-card border border-dark-border rounded-2xl p-4 hover:border-accent/30 transition-all text-center"
            >
              <div className="w-10 h-10 bg-alive/10 rounded-xl flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-alive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-text-secondary">Join</span>
            </Link>

            <Link
              href="/tournament"
              className="bg-dark-card border border-dark-border rounded-2xl p-4 hover:border-accent/30 transition-all text-center"
            >
              <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <span className="text-xs font-medium text-text-secondary">Bracket</span>
            </Link>
          </div>

          {/* My Pools */}
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wide">My Pools</h2>

          {loadingPools ? (
            <div className="bg-dark-card border border-dark-border rounded-2xl p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-dark-border border-t-accent mx-auto mb-3" />
              <p className="text-text-muted text-sm">Loading your pools...</p>
            </div>
          ) : pools.length === 0 ? (
            <div className="bg-dark-card border border-dark-border rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <p className="text-white font-semibold text-lg mb-1">No pools yet</p>
              <p className="text-text-muted text-sm mb-6">Create or join a pool to get started!</p>
              <div className="flex justify-center gap-3">
                <Link
                  href="/pools/create"
                  className="btn-accent px-5 py-2.5 text-white text-sm font-semibold rounded-xl"
                >
                  Create Pool
                </Link>
                <Link
                  href="/pools/join"
                  className="px-5 py-2.5 bg-dark-surface border border-dark-border text-text-secondary text-sm font-semibold rounded-xl hover:border-accent/30 transition-colors"
                >
                  Join Pool
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {activePools.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
                    Active ({activePools.length})
                  </h3>
                  <div className="space-y-3">
                    {activePools.map((pool) => (
                      <PoolCard key={pool.pool_id} pool={pool} />
                    ))}
                  </div>
                </div>
              )}

              {eliminatedPools.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
                    Eliminated ({eliminatedPools.length})
                  </h3>
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

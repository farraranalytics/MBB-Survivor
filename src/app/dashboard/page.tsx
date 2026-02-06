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
      className="w-full text-left bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-4 border border-gray-100"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 truncate">{pool.pool_name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {pool.alive_players} alive · {pool.total_players} total
          </p>
        </div>
        <span
          className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
            pool.your_status === 'eliminated'
              ? 'bg-red-100 text-red-700'
              : 'bg-green-100 text-green-700'
          }`}
        >
          {pool.your_status === 'eliminated' ? 'OUT' : 'ALIVE'}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center space-x-4 text-xs text-gray-500 mb-3">
        <span>{pool.your_picks_count} picks</span>
        {pool.your_streak > 0 && (
          <span className="text-orange-600 font-medium">🔥 {pool.your_streak} streak</span>
        )}
        {pool.current_round_name && (
          <span className="truncate">{pool.current_round_name}</span>
        )}
      </div>

      {/* Action prompt */}
      {needsPick && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-700">Pick needed today!</span>
          <span className="text-blue-500 text-xs">→</span>
        </div>
      )}
      {pool.has_picked_today && pool.your_status === 'active' && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <span className="text-sm font-medium text-green-700">✓ Pick locked in</span>
        </div>
      )}
      {pool.your_status === 'eliminated' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <span className="text-sm text-gray-500">View standings</span>
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

  // Separate pools by status
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
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">MBB Survivor Pool</h1>
                <p className="text-gray-600 text-sm">Welcome back, {user?.email}</p>
              </div>
              <button
                onClick={signOut}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Action alert banner */}
          {needsAction.length > 0 && (
            <div className="bg-blue-600 text-white rounded-xl p-4 mb-6 shadow-md">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">⏰</span>
                <div>
                  <p className="font-bold">
                    {needsAction.length === 1
                      ? 'Pick needed in 1 pool!'
                      : `Picks needed in ${needsAction.length} pools!`}
                  </p>
                  <p className="text-blue-100 text-sm">
                    {needsAction.map(p => p.pool_name).join(', ')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            <Link
              href="/pools/create"
              className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow border border-gray-100 text-center"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-900">Create Pool</span>
            </Link>

            <Link
              href="/pools/join"
              className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow border border-gray-100 text-center"
            >
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-900">Join Pool</span>
            </Link>

            <Link
              href="/tournament"
              className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow border border-gray-100 text-center col-span-2 sm:col-span-1"
            >
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <span className="text-lg">🏀</span>
              </div>
              <span className="text-sm font-medium text-gray-900">Tournament</span>
            </Link>
          </div>

          {/* My Pools */}
          <h2 className="text-xl font-bold text-gray-900 mb-4">My Pools</h2>

          {loadingPools ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Loading your pools...</p>
            </div>
          ) : pools.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <div className="text-4xl mb-3">🏀</div>
              <p className="text-gray-900 font-medium text-lg mb-1">No pools yet</p>
              <p className="text-gray-500 text-sm mb-4">Create or join a pool to get started!</p>
              <div className="flex justify-center space-x-3">
                <Link
                  href="/pools/create"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  Create Pool
                </Link>
                <Link
                  href="/pools/join"
                  className="inline-flex items-center px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  Join Pool
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active pools */}
              {activePools.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Active ({activePools.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {activePools.map((pool) => (
                      <PoolCard key={pool.pool_id} pool={pool} />
                    ))}
                  </div>
                </div>
              )}

              {/* Eliminated pools */}
              {eliminatedPools.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Eliminated ({eliminatedPools.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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

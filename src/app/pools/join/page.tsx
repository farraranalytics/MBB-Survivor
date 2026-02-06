'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase/client';

export default function JoinPool() {
  const { user } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [poolInfo, setPoolInfo] = useState<any>(null);
  const router = useRouter();

  // Set default display name when user loads
  useState(() => {
    if (user) {
      setDisplayName(user.user_metadata?.display_name || user.email?.split('@')[0] || '');
    }
  });

  const handleLookupPool = async () => {
    if (!joinCode.trim()) return;

    setLoading(true);
    setError('');
    setPoolInfo(null);

    try {
      const { data: pool, error: poolError } = await supabase
        .from('pools')
        .select(`
          *,
          creator:creator_id(display_name),
          pool_players(count)
        `)
        .eq('join_code', joinCode.trim().toUpperCase())
        .single();

      if (poolError) {
        if (poolError.code === 'PGRST116') {
          throw new Error('Pool not found. Please check your join code.');
        }
        throw poolError;
      }

      if (pool.status === 'complete') {
        throw new Error('This pool has already finished.');
      }

      // Check if user is already in this pool
      const { data: existingPlayer } = await supabase
        .from('pool_players')
        .select('id')
        .eq('pool_id', pool.id)
        .eq('user_id', user?.id)
        .single();

      if (existingPlayer) {
        throw new Error('You are already a member of this pool.');
      }

      // Check if pool is full
      if (pool.max_players && pool.pool_players.length >= pool.max_players) {
        throw new Error('This pool is full.');
      }

      setPoolInfo(pool);
    } catch (err: any) {
      setError(err.message || 'Failed to find pool');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinPool = async () => {
    if (!user || !poolInfo) return;

    setLoading(true);
    setError('');

    try {
      const { error: joinError } = await supabase
        .from('pool_players')
        .insert({
          pool_id: poolInfo.id,
          user_id: user.id,
          display_name: displayName.trim() || user.email?.split('@')[0] || 'Player',
        });

      if (joinError) throw joinError;

      // Redirect to the pool
      router.push(`/pools/${poolInfo.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join pool');
      setLoading(false);
    }
  };

  // Redirect to login if not authenticated
  if (!user) {
    router.push('/auth/login');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <h1 className="text-2xl font-bold text-gray-900">Join Pool</h1>
            <Link
              href="/dashboard"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label htmlFor="joinCode" className="block text-sm font-medium text-gray-700 mb-2">
                Pool Join Code *
              </label>
              <div className="flex space-x-3">
                <input
                  id="joinCode"
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  placeholder="Enter join code"
                />
                <button
                  onClick={handleLookupPool}
                  disabled={loading || !joinCode.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors"
                >
                  {loading ? 'Looking...' : 'Find Pool'}
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Ask the pool creator for the join code
              </p>
            </div>

            {poolInfo && (
              <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                <h3 className="font-medium text-green-900 mb-3">Pool Found!</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-green-800">Name:</span>{' '}
                    <span className="text-green-700">{poolInfo.name}</span>
                  </div>
                  <div>
                    <span className="font-medium text-green-800">Created by:</span>{' '}
                    <span className="text-green-700">{poolInfo.creator?.display_name || 'Pool Creator'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-green-800">Players:</span>{' '}
                    <span className="text-green-700">
                      {poolInfo.pool_players?.length || 0}
                      {poolInfo.max_players ? ` / ${poolInfo.max_players}` : ''}
                    </span>
                  </div>
                  {poolInfo.entry_fee > 0 && (
                    <div>
                      <span className="font-medium text-green-800">Entry Fee:</span>{' '}
                      <span className="text-green-700">${poolInfo.entry_fee}</span>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-green-800">Tournament:</span>{' '}
                    <span className="text-green-700">{poolInfo.tournament_year} March Madness</span>
                  </div>
                </div>
              </div>
            )}

            {poolInfo && (
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Display Name *
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  maxLength={50}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="How you'll appear in the pool"
                />
                <p className="text-sm text-gray-500 mt-1">
                  This is how other players will see you in the pool
                </p>
              </div>
            )}

            {poolInfo && (
              <button
                onClick={handleJoinPool}
                disabled={loading || !displayName.trim()}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-3 px-4 rounded-md transition-colors"
              >
                {loading ? 'Joining Pool...' : 'Join Pool'}
              </button>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">How to Join:</h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Get the join code from the pool creator</li>
                <li>Enter the code above and click "Find Pool"</li>
                <li>Confirm your display name</li>
                <li>Click "Join Pool" to become a player</li>
              </ol>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
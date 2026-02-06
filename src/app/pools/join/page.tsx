'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase/client';

const inputClass = "w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-xl text-white placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-colors";

export default function JoinPool() {
  const { user } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [poolInfo, setPoolInfo] = useState<any>(null);
  const router = useRouter();

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
        .select(`*, pool_players(count)`)
        .eq('join_code', joinCode.trim().toUpperCase())
        .single();

      if (poolError) {
        if (poolError.code === 'PGRST116') throw new Error('Pool not found. Check your join code.');
        throw poolError;
      }
      if (pool.status === 'complete') throw new Error('This pool has already finished.');

      const { data: existingPlayer } = await supabase
        .from('pool_players')
        .select('id')
        .eq('pool_id', pool.id)
        .eq('user_id', user?.id)
        .single();

      if (existingPlayer) throw new Error('You are already a member of this pool.');
      if (pool.max_players && pool.pool_players.length >= pool.max_players) throw new Error('This pool is full.');

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
      router.push(`/pools/${poolInfo.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join pool');
      setLoading(false);
    }
  };

  if (!user) {
    router.push('/auth/login');
    return (
      <div className="min-h-screen bg-dark-base flex items-center justify-center">
        <p className="text-text-muted">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-base">
      <header className="bg-dark-surface border-b border-dark-border">
        <div className="max-w-lg mx-auto px-5">
          <div className="flex items-center justify-between py-4">
            <h1 className="text-xl font-bold text-white">Join Pool</h1>
            <Link href="/dashboard" className="text-text-muted hover:text-text-secondary text-sm font-medium transition-colors">
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              Back
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6">
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6">
          {error && (
            <div className="bg-eliminated/10 border border-eliminated/30 text-eliminated px-4 py-3 rounded-xl text-sm mb-6">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label htmlFor="joinCode" className="block text-sm font-medium text-text-secondary mb-2">
                Pool Join Code *
              </label>
              <div className="flex gap-3">
                <input
                  id="joinCode"
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={10}
                  className={`${inputClass} flex-1 font-mono text-center text-lg tracking-widest`}
                  placeholder="ABC123"
                />
                <button
                  onClick={handleLookupPool}
                  disabled={loading || !joinCode.trim()}
                  className="px-5 py-3 btn-accent text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {loading && !poolInfo ? 'Finding...' : 'Find'}
                </button>
              </div>
              <p className="text-xs text-text-muted mt-1.5">
                Ask the pool creator for the join code
              </p>
            </div>

            {poolInfo && (
              <div className="bg-alive/10 border border-alive/25 rounded-xl p-4 animate-fade-in">
                <h3 className="font-semibold text-alive text-sm mb-3 uppercase tracking-wide">Pool Found</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Name</span>
                    <span className="text-white font-medium">{poolInfo.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Players</span>
                    <span className="text-white font-medium">
                      {poolInfo.pool_players?.length || 0}
                      {poolInfo.max_players ? ` / ${poolInfo.max_players}` : ''}
                    </span>
                  </div>
                  {poolInfo.entry_fee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Entry Fee</span>
                      <span className="text-accent font-bold">${poolInfo.entry_fee}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-text-muted">Tournament</span>
                    <span className="text-white font-medium">{poolInfo.tournament_year} March Madness</span>
                  </div>
                </div>
              </div>
            )}

            {poolInfo && (
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-text-secondary mb-2">
                  Your Display Name *
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  maxLength={50}
                  className={inputClass}
                  placeholder="How you'll appear in the pool"
                />
                <p className="text-xs text-text-muted mt-1.5">
                  This is how other players will see you
                </p>
              </div>
            )}

            {poolInfo && (
              <button
                onClick={handleJoinPool}
                disabled={loading || !displayName.trim()}
                className="w-full btn-accent text-white font-bold py-4 px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed text-base"
              >
                {loading ? 'Joining Pool...' : 'Join Pool'}
              </button>
            )}

            <div className="bg-dark-surface border border-dark-border-subtle rounded-xl p-4">
              <h3 className="font-semibold text-accent text-sm mb-2 uppercase tracking-wide">How to Join</h3>
              <ol className="text-xs text-text-secondary space-y-1.5 list-decimal list-inside">
                <li>Get the join code from the pool creator</li>
                <li>Enter the code above and tap &ldquo;Find&rdquo;</li>
                <li>Confirm your display name</li>
                <li>Tap &ldquo;Join Pool&rdquo; to start playing</li>
              </ol>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

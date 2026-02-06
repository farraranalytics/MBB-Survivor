'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase/client';

const inputClass = "w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-xl text-white placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-colors";

export default function CreatePool() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [entryFee, setEntryFee] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!user) {
      setError('You must be logged in to create a pool');
      setLoading(false);
      return;
    }

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setError('Session expired. Please log in again.');
        setLoading(false);
        router.push('/auth/login');
        return;
      }

      const { data: pool, error: poolError } = await supabase
        .from('pools')
        .insert({
          name,
          creator_id: authUser.id,
          entry_fee: entryFee ? parseFloat(entryFee) : 0,
          max_players: maxPlayers ? parseInt(maxPlayers) : null,
          is_private: isPrivate,
          tournament_year: 2025,
          status: 'open'
        })
        .select()
        .single();

      if (poolError) throw poolError;

      const { error: playerError } = await supabase
        .from('pool_players')
        .insert({
          pool_id: pool.id,
          user_id: authUser.id,
          display_name: authUser.user_metadata?.display_name || authUser.email?.split('@')[0] || 'Player',
        });

      if (playerError) throw playerError;

      router.push(`/pools/${pool.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create pool');
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
            <h1 className="text-xl font-bold text-white">Create Pool</h1>
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-2">
                Pool Name *
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
                className={inputClass}
                placeholder="e.g., Office March Madness 2025"
              />
            </div>

            <div>
              <label htmlFor="entryFee" className="block text-sm font-medium text-text-secondary mb-2">
                Entry Fee (optional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-text-muted text-sm">$</span>
                </div>
                <input
                  id="entryFee"
                  type="number"
                  step="0.01"
                  min="0"
                  max="999.99"
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value)}
                  className={`${inputClass} pl-8`}
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-text-muted mt-1.5">Leave blank for free pools</p>
            </div>

            <div>
              <label htmlFor="maxPlayers" className="block text-sm font-medium text-text-secondary mb-2">
                Max Players (optional)
              </label>
              <input
                id="maxPlayers"
                type="number"
                min="2"
                max="1000"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
                className={inputClass}
                placeholder="No limit"
              />
              <p className="text-xs text-text-muted mt-1.5">Leave blank for unlimited</p>
            </div>

            <div>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-5 h-5 rounded bg-dark-surface border-dark-border text-accent focus:ring-accent focus:ring-offset-0 focus:ring-offset-dark-card"
                />
                <span className="text-sm font-medium text-text-secondary">
                  Private Pool
                </span>
              </label>
              <p className="text-xs text-text-muted mt-1.5 ml-8">
                Private pools require a join code to enter.
              </p>
            </div>

            <div className="bg-dark-surface border border-dark-border-subtle rounded-xl p-4">
              <h3 className="font-semibold text-accent text-sm mb-2 uppercase tracking-wide">Survivor Rules</h3>
              <ul className="text-xs text-text-secondary space-y-1.5">
                <li className="flex items-start gap-2"><span className="text-accent mt-0.5">&#x2022;</span> Pick one team per tournament day to win their game</li>
                <li className="flex items-start gap-2"><span className="text-accent mt-0.5">&#x2022;</span> Each team can only be picked once throughout the tournament</li>
                <li className="flex items-start gap-2"><span className="text-accent mt-0.5">&#x2022;</span> Wrong pick or missed deadline = elimination</li>
                <li className="flex items-start gap-2"><span className="text-accent mt-0.5">&#x2022;</span> Picks due 30 min before first tip-off each day</li>
                <li className="flex items-start gap-2"><span className="text-accent mt-0.5">&#x2022;</span> Last player standing wins the pool</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full btn-accent text-white font-bold py-4 px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed text-base"
            >
              {loading ? 'Creating Pool...' : 'Create Pool'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

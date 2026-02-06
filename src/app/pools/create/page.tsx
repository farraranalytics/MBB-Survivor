'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase/client';

const inputClass = "w-full px-4 py-3 bg-[#1A1A24] border border-[rgba(255,255,255,0.05)] rounded-[12px] text-[#E8E6E1] placeholder-[#8A8694] focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-transparent transition-colors";

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
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <p className="text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A]">
      <header className="bg-[#111118] border-b border-[rgba(255,255,255,0.05)]">
        <div className="max-w-lg mx-auto px-5">
          <div className="flex items-center justify-between py-4">
            <h1 className="text-xl font-bold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Create Pool</h1>
            <Link href="/dashboard" className="text-[#8A8694] hover:text-[#E8E6E1] text-sm font-medium transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              Back
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6">
        <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-6">
          {error && (
            <div className="bg-[rgba(239,83,80,0.1)] border border-[rgba(239,83,80,0.3)] text-[#EF5350] px-4 py-3 rounded-[8px] text-sm mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-[#8A8694] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Pool Name *</label>
              <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} className={inputClass} placeholder="e.g., Office March Madness 2025" style={{ fontFamily: "'DM Sans', sans-serif" }} />
            </div>

            <div>
              <label htmlFor="entryFee" className="block text-sm font-medium text-[#8A8694] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Entry Fee (optional)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-[#8A8694] text-sm">$</span>
                </div>
                <input id="entryFee" type="number" step="0.01" min="0" max="999.99" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} className={`${inputClass} pl-8`} placeholder="0.00" style={{ fontFamily: "'DM Sans', sans-serif" }} />
              </div>
              <p className="text-xs text-[#8A8694] mt-1.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>Leave blank for free pools</p>
            </div>

            <div>
              <label htmlFor="maxPlayers" className="block text-sm font-medium text-[#8A8694] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Max Players (optional)</label>
              <input id="maxPlayers" type="number" min="2" max="1000" value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} className={inputClass} placeholder="No limit" style={{ fontFamily: "'DM Sans', sans-serif" }} />
              <p className="text-xs text-[#8A8694] mt-1.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>Leave blank for unlimited</p>
            </div>

            <div>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="w-5 h-5 rounded bg-[#1A1A24] border-[rgba(255,255,255,0.08)] text-[#FF5722] focus:ring-[#FF5722] focus:ring-offset-0" />
                <span className="text-sm font-medium text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Private Pool</span>
              </label>
              <p className="text-xs text-[#8A8694] mt-1.5 ml-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>Private pools require a join code to enter.</p>
            </div>

            <div className="bg-[#1A1A24] border border-[rgba(255,255,255,0.05)] rounded-[8px] p-4">
              <h3 className="label mb-2">Survivor Rules</h3>
              <ul className="text-xs text-[#8A8694] space-y-1.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                <li className="flex items-start gap-2"><span className="text-[#FF5722] mt-0.5">&#x2022;</span> Pick one team per tournament day to win their game</li>
                <li className="flex items-start gap-2"><span className="text-[#FF5722] mt-0.5">&#x2022;</span> Each team can only be picked once throughout the tournament</li>
                <li className="flex items-start gap-2"><span className="text-[#FF5722] mt-0.5">&#x2022;</span> Wrong pick or missed deadline = elimination</li>
                <li className="flex items-start gap-2"><span className="text-[#FF5722] mt-0.5">&#x2022;</span> Picks due 30 min before first tip-off each day</li>
                <li className="flex items-start gap-2"><span className="text-[#FF5722] mt-0.5">&#x2022;</span> Last player standing wins the pool</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full btn-orange font-bold py-4 px-4 rounded-[12px] disabled:opacity-50 disabled:cursor-not-allowed text-base"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {loading ? 'Creating Pool...' : 'Create Pool'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

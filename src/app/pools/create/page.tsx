'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { useActivePool } from '@/hooks/useActivePool';
import { supabase } from '@/lib/supabase/client';

const inputClass = "w-full px-4 py-3 bg-[#1A1A24] border border-[rgba(255,255,255,0.05)] rounded-[12px] text-[#E8E6E1] placeholder-[#8A8694] focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-transparent transition-colors";

interface CreatedPoolResult {
  id: string;
  name: string;
  join_code: string;
}

function PoolCreatedSuccess({ pool, onCopy, copied }: { pool: CreatedPoolResult; onCopy: () => void; copied: boolean }) {
  const router = useRouter();

  const handleShare = async () => {
    const shareData = {
      title: `Join ${pool.name} on Survive the Dance`,
      text: `Join my March Madness Survivor pool! Use code: ${pool.join_code}`,
      url: `${window.location.origin}/join`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled
      }
    }
    onCopy();
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-5 pb-24">
      <div className="max-w-sm w-full text-center animate-bounce-in">
        {/* Checkmark */}
        <div className="w-16 h-16 bg-[rgba(76,175,80,0.15)] rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-[#4CAF50]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-[#E8E6E1] mb-2" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
          Pool Created!
        </h1>
        <p className="text-[#8A8694] text-sm mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Share this code with your friends so they can join.
        </p>

        {/* Join Code Display */}
        <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-6 mb-6">
          <p className="label mb-3">Join Code</p>
          <p
            className="text-3xl font-bold text-[#FF5722] tracking-[0.25em] mb-4"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            {pool.join_code}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onCopy}
              className={`px-4 py-2.5 rounded-[8px] text-sm font-semibold transition-all ${
                copied
                  ? 'bg-[rgba(76,175,80,0.15)] text-[#4CAF50]'
                  : 'bg-[#1A1A24] border border-[rgba(255,255,255,0.05)] text-[#8A8694] hover:text-[#E8E6E1] hover:border-[rgba(255,87,34,0.3)]'
              }`}
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {copied ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                  Copied!
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  Copy Code
                </span>
              )}
            </button>
            <button
              onClick={handleShare}
              className="px-4 py-2.5 rounded-[8px] text-sm font-semibold btn-orange"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                Share
              </span>
            </button>
          </div>
        </div>

        <button
          onClick={() => router.push(`/pools/${pool.id}`)}
          className="w-full py-3 rounded-[12px] text-sm font-semibold text-[#8A8694] bg-[#1A1A24] border border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,87,34,0.3)] hover:text-[#E8E6E1] transition-colors"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Go to Pool
        </button>
      </div>
    </div>
  );
}

export default function CreatePool() {
  const { user } = useAuth();
  const { setActivePool, refreshPools } = useActivePool();
  const [name, setName] = useState('');
  const [entryFee, setEntryFee] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('');
  const [maxEntries, setMaxEntries] = useState('1');
  const [bracketName, setBracketName] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdPool, setCreatedPool] = useState<CreatedPoolResult | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const handleCopy = async () => {
    if (!createdPool) return;
    try {
      await navigator.clipboard.writeText(createdPool.join_code);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = createdPool.join_code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          max_entries_per_user: maxEntries ? parseInt(maxEntries) : 1,
          is_private: isPrivate,
          tournament_year: 2025,
          status: 'open'
        })
        .select()
        .single();

      if (poolError) throw poolError;

      const creatorName = authUser.user_metadata?.display_name || authUser.email?.split('@')[0] || 'Player';
      const { error: playerError } = await supabase
        .from('pool_players')
        .insert({
          pool_id: pool.id,
          user_id: authUser.id,
          display_name: creatorName,
          entry_number: 1,
          entry_label: bracketName.trim() || `${creatorName}'s Bracket`,
        });

      if (playerError) throw playerError;

      await refreshPools();
      setActivePool(pool.id, pool.name);
      setCreatedPool({ id: pool.id, name: pool.name, join_code: pool.join_code });
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create pool');
      setLoading(false);
    }
  };

  if (createdPool) {
    return <PoolCreatedSuccess pool={createdPool} onCopy={handleCopy} copied={copied} />;
  }

  if (!user) {
    router.push('/auth/login');
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <p className="text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-24">
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
              <label htmlFor="bracketName" className="block text-sm font-medium text-[#8A8694] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Your Bracket Name</label>
              <input id="bracketName" type="text" value={bracketName} onChange={(e) => setBracketName(e.target.value)} maxLength={60} className={inputClass} placeholder="e.g., Main Bracket" style={{ fontFamily: "'DM Sans', sans-serif" }} />
              <p className="text-xs text-[#8A8694] mt-1.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>Name for your first bracket in this pool</p>
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

            <div>
              <label htmlFor="maxEntries" className="block text-sm font-medium text-[#8A8694] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Brackets Per Player</label>
              <input id="maxEntries" type="number" min="1" max="10" value={maxEntries} onChange={(e) => setMaxEntries(e.target.value)} className={inputClass} placeholder="1" style={{ fontFamily: "'DM Sans', sans-serif" }} />
              <p className="text-xs text-[#8A8694] mt-1.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>Allow players to run multiple brackets in this pool</p>
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

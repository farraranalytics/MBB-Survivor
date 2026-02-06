'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase/client';

const inputClass = "w-full px-4 py-3 bg-[#1A1A24] border border-[rgba(255,255,255,0.05)] rounded-[12px] text-[#E8E6E1] placeholder-[#8A8694] focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-transparent transition-colors";

export default function JoinPool() {
  const { user } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bracketName, setBracketName] = useState('');
  const [poolInfo, setPoolInfo] = useState<any>(null);
  const [existingEntryCount, setExistingEntryCount] = useState(0);
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

      const { data: existingEntries } = await supabase
        .from('pool_players')
        .select('id')
        .eq('pool_id', pool.id)
        .eq('user_id', user?.id);

      const entryCount = existingEntries?.length || 0;
      const maxEntries = pool.max_entries_per_user ?? 1;

      if (entryCount >= maxEntries) {
        throw new Error(entryCount > 0
          ? `You've reached the max entries (${maxEntries}) for this pool.`
          : 'You are already a member of this pool.');
      }
      if (pool.max_players && pool.pool_players?.[0]?.count >= pool.max_players) throw new Error('This pool is full.');

      setExistingEntryCount(entryCount);
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
      const entryNumber = existingEntryCount + 1;
      const baseName = displayName.trim() || user.email?.split('@')[0] || 'Player';
      const entryLabel = bracketName.trim() || `${baseName}'s Bracket${entryNumber > 1 ? ` ${entryNumber}` : ''}`;
      const { error: joinError } = await supabase
        .from('pool_players')
        .insert({
          pool_id: poolInfo.id,
          user_id: user.id,
          display_name: baseName,
          entry_number: entryNumber,
          entry_label: entryLabel,
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
            <h1 className="text-xl font-bold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Join Pool</h1>
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

          <div className="space-y-5">
            <div>
              <label htmlFor="joinCode" className="block text-sm font-medium text-[#8A8694] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Pool Join Code *</label>
              <div className="flex gap-3">
                <input
                  id="joinCode"
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={10}
                  className={`${inputClass} flex-1 text-center text-lg tracking-widest`}
                  placeholder="ABC123"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                />
                <button
                  onClick={handleLookupPool}
                  disabled={loading || !joinCode.trim()}
                  className="px-5 py-3 btn-orange font-semibold rounded-[12px] disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {loading && !poolInfo ? 'Finding...' : 'Find'}
                </button>
              </div>
              <p className="text-xs text-[#8A8694] mt-1.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>Ask the pool creator for the join code</p>
            </div>

            {poolInfo && (
              <div className="bg-[rgba(76,175,80,0.1)] border border-[rgba(76,175,80,0.25)] rounded-[8px] p-4 animate-fade-in">
                <p className="label mb-3">Pool Found</p>
                <div className="space-y-2 text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  <div className="flex justify-between">
                    <span className="text-[#8A8694]">Name</span>
                    <span className="text-[#E8E6E1] font-medium">{poolInfo.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8A8694]">Players</span>
                    <span className="text-[#E8E6E1] font-medium">
                      {poolInfo.pool_players?.length || 0}
                      {poolInfo.max_players ? ` / ${poolInfo.max_players}` : ''}
                    </span>
                  </div>
                  {poolInfo.entry_fee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#8A8694]">Entry Fee</span>
                      <span className="text-[#FF5722] font-bold">${poolInfo.entry_fee}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#8A8694]">Tournament</span>
                    <span className="text-[#E8E6E1] font-medium">{poolInfo.tournament_year} March Madness</span>
                  </div>
                </div>
              </div>
            )}

            {poolInfo && (
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-[#8A8694] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Your Display Name *</label>
                <input id="displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={50} className={inputClass} placeholder="How you'll appear in the pool" style={{ fontFamily: "'DM Sans', sans-serif" }} />
                <p className="text-xs text-[#8A8694] mt-1.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>This is how other players will see you</p>
              </div>
            )}

            {poolInfo && (
              <div>
                <label htmlFor="bracketName" className="block text-sm font-medium text-[#8A8694] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Bracket Name {existingEntryCount > 0 ? '*' : ''}
                </label>
                <input
                  id="bracketName"
                  type="text"
                  value={bracketName}
                  onChange={(e) => setBracketName(e.target.value)}
                  maxLength={60}
                  className={inputClass}
                  placeholder={existingEntryCount > 0 ? 'e.g., Chaos Bracket' : "e.g., Main Bracket"}
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                />
                <p className="text-xs text-[#8A8694] mt-1.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {existingEntryCount > 0
                    ? `This is entry #${existingEntryCount + 1} — give it a unique name`
                    : 'Name your bracket (you can add more later if the pool allows)'}
                </p>
              </div>
            )}

            {poolInfo && (
              <button
                onClick={handleJoinPool}
                disabled={loading || !displayName.trim()}
                className="w-full btn-orange font-bold py-4 px-4 rounded-[12px] disabled:opacity-50 disabled:cursor-not-allowed text-base"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {loading ? 'Joining Pool...' : 'Join Pool'}
              </button>
            )}

            <div className="bg-[#1A1A24] border border-[rgba(255,255,255,0.05)] rounded-[8px] p-4">
              <h3 className="label mb-2">How to Join</h3>
              <ol className="text-xs text-[#8A8694] space-y-1.5 list-decimal list-inside" style={{ fontFamily: "'DM Sans', sans-serif" }}>
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

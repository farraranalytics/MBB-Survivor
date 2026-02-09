'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useActivePool } from '@/hooks/useActivePool';
import { supabase } from '@/lib/supabase/client';
import { getTournamentState, canJoinOrCreate } from '@/lib/status';
import TournamentInProgress from '@/components/TournamentInProgress';

const inputClass = "w-full px-4 py-3 bg-[#1B2A3D] border border-[rgba(255,255,255,0.05)] rounded-[12px] text-[#E8E6E1] placeholder-[#9BA3AE] focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-transparent transition-colors";

function JoinPoolContent() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get('code');
  const { user } = useAuth();
  const { refreshPools, setActivePool } = useActivePool();
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [entryName, setEntryName] = useState('');
  const [poolInfo, setPoolInfo] = useState<any>(null);
  const [existingEntryCount, setExistingEntryCount] = useState(0);
  const [tournamentStarted, setTournamentStarted] = useState(false);
  const [checkingTournament, setCheckingTournament] = useState(true);
  const router = useRouter();
  const autoLookedUp = useRef(false);

  // Check if tournament has started
  useEffect(() => {
    async function checkTournament() {
      const state = await getTournamentState();
      setTournamentStarted(!canJoinOrCreate(state));
      setCheckingTournament(false);
    }
    checkTournament();
  }, []);

  // Auto-populate join code from URL param
  useEffect(() => {
    if (codeFromUrl) {
      setJoinCode(codeFromUrl.toUpperCase());
    }
  }, [codeFromUrl]);

  const handleLookupPool = useCallback(async (codeOverride?: string) => {
    const code = codeOverride || joinCode;
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setPoolInfo(null);

    try {
      const { data: pool, error: poolError } = await supabase
        .from('pools')
        .select(`*, pool_players(count)`)
        .eq('join_code', code.trim().toUpperCase())
        .single();

      if (poolError) {
        if (poolError.code === 'PGRST116') throw new Error('Pool not found. Check your join code.');
        throw poolError;
      }
      const tournamentState = await getTournamentState();
      if (!canJoinOrCreate(tournamentState)) {
        throw new Error('The tournament has already started. You can no longer join pools.');
      }

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
  }, [joinCode, user]);

  // Auto-trigger lookup when code comes from URL and user is authenticated
  useEffect(() => {
    if (codeFromUrl && user && !autoLookedUp.current) {
      autoLookedUp.current = true;
      handleLookupPool(codeFromUrl.toUpperCase());
    }
  }, [codeFromUrl, user, handleLookupPool]);

  const handleJoinPool = async () => {
    if (!user || !poolInfo) return;
    setLoading(true);
    setError('');

    try {
      const entryNumber = existingEntryCount + 1;
      const baseName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Player';
      const entryLabel = entryName.trim() || `${baseName}'s Entry${entryNumber > 1 ? ` ${entryNumber}` : ''}`;
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

      await refreshPools();
      setActivePool(poolInfo.id, poolInfo.name);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to join pool');
      setLoading(false);
    }
  };

  if (checkingTournament) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[rgba(255,255,255,0.08)] border-t-[#FF5722]" />
      </div>
    );
  }

  if (tournamentStarted) {
    return <TournamentInProgress />;
  }

  // Redirect unauthenticated users, preserving join code in sessionStorage
  if (!user) {
    const pendingCode = codeFromUrl;
    if (pendingCode) {
      sessionStorage.setItem('std_pending_join_code', pendingCode);
    }
    router.push('/auth/login');
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <p className="text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-24">
      <main className="max-w-lg mx-auto px-5 py-6">
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-6">
          {error && (
            <div className="bg-[rgba(239,83,80,0.1)] border border-[rgba(239,83,80,0.3)] text-[#EF5350] px-4 py-3 rounded-[8px] text-sm mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label htmlFor="joinCode" className="block text-sm font-medium text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Pool Join Code *</label>
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
                  onClick={() => handleLookupPool()}
                  disabled={loading || !joinCode.trim()}
                  className="px-5 py-3 btn-orange font-semibold rounded-[12px] disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {loading && !poolInfo ? 'Finding...' : 'Find'}
                </button>
              </div>
              <p className="text-xs text-[#9BA3AE] mt-1.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>Ask the pool creator for the join code</p>
            </div>

            {poolInfo && (
              <div className="bg-[rgba(76,175,80,0.1)] border border-[rgba(76,175,80,0.25)] rounded-[8px] p-4 animate-fade-in">
                <p className="label mb-3">Pool Found</p>
                <div className="space-y-2 text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  <div className="flex justify-between">
                    <span className="text-[#9BA3AE]">Name</span>
                    <span className="text-[#E8E6E1] font-medium">{poolInfo.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9BA3AE]">Players</span>
                    <span className="text-[#E8E6E1] font-medium">
                      {poolInfo.pool_players?.length || 0}
                      {poolInfo.max_players ? ` / ${poolInfo.max_players}` : ''}
                    </span>
                  </div>
                  {poolInfo.entry_fee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#9BA3AE]">Entry Fee</span>
                      <span className="text-[#FF5722] font-bold">${poolInfo.entry_fee}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#9BA3AE]">Tournament</span>
                    <span className="text-[#E8E6E1] font-medium">{poolInfo.tournament_year} March Madness</span>
                  </div>
                </div>
              </div>
            )}

            {poolInfo && (
              <div>
                <label htmlFor="entryName" className="block text-sm font-medium text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Entry Name {existingEntryCount > 0 ? '*' : ''}
                </label>
                <input
                  id="entryName"
                  type="text"
                  value={entryName}
                  onChange={(e) => setEntryName(e.target.value)}
                  maxLength={60}
                  className={inputClass}
                  placeholder={existingEntryCount > 0 ? 'e.g., Second Entry' : "e.g., My Entry"}
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                />
                <p className="text-xs text-[#9BA3AE] mt-1.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {existingEntryCount > 0
                    ? `This is entry #${existingEntryCount + 1} — give it a unique name`
                    : 'Name your entry (you can add more later if the pool allows)'}
                </p>
              </div>
            )}

            {poolInfo && (
              <button
                onClick={handleJoinPool}
                disabled={loading}
                className="w-full btn-orange font-bold py-4 px-4 rounded-[12px] disabled:opacity-50 disabled:cursor-not-allowed text-base"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {loading ? 'Joining Pool...' : 'Join Pool'}
              </button>
            )}

            <div className="bg-[#1B2A3D] border border-[rgba(255,255,255,0.05)] rounded-[8px] p-4">
              <h3 className="label mb-2">How to Join</h3>
              <ol className="text-xs text-[#9BA3AE] space-y-1.5 list-decimal list-inside" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                <li>Get the join code from the pool creator</li>
                <li>Enter the code above and tap &ldquo;Find&rdquo;</li>
                <li>Name your entry (optional)</li>
                <li>Tap &ldquo;Join Pool&rdquo; to start playing</li>
              </ol>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function JoinPool() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[rgba(255,255,255,0.08)] border-t-[#FF5722]" />
      </div>
    }>
      <JoinPoolContent />
    </Suspense>
  );
}

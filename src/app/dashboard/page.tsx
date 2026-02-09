'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useActivePool } from '@/hooks/useActivePool';
import { supabase } from '@/lib/supabase/client';
import { MyPool, MyPoolEntry } from '@/types/standings';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatET } from '@/lib/timezone';
import { SplashOverlay } from '@/components/SplashOverlay';

// ─── Deadline Formatter ──────────────────────────────────────────

function formatDeadline(deadlineDatetime: string): { text: string; color: string } {
  const diff = new Date(deadlineDatetime).getTime() - Date.now();
  if (diff <= 0) return { text: 'Picks locked', color: 'text-[#EF5350]' };

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  let countdown: string;
  if (hours > 0) countdown = `${hours}h ${minutes}m`;
  else countdown = `${minutes}m`;

  const lockTime = formatET(deadlineDatetime);

  let color: string;
  if (diff < 1800000) color = 'text-[#EF5350]';
  else if (diff < 3600000) color = 'text-[#FF5722]';
  else if (diff < 7200000) color = 'text-[#FFB300]';
  else color = 'text-[#4CAF50]';

  return { text: `Locks in ${countdown} · ${lockTime}`, color };
}

// ─── Loading Skeleton ────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-24">
      <div className="max-w-lg mx-auto px-5 py-4 space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-5 animate-pulse">
            <div className="flex items-center justify-between mb-3">
              <div className="h-5 w-32 bg-[#1B2A3D] rounded" />
              <div className="h-5 w-16 bg-[#1B2A3D] rounded-full" />
            </div>
            <div className="h-4 w-24 bg-[#1B2A3D] rounded mb-4" />
            <div className="space-y-2 mb-4">
              <div className="h-4 w-48 bg-[#1B2A3D] rounded" />
              <div className="h-4 w-40 bg-[#1B2A3D] rounded" />
            </div>
            <div className="h-4 w-36 bg-[#1B2A3D] rounded mb-4" />
            <div className="flex gap-2">
              <div className="h-10 flex-1 bg-[#1B2A3D] rounded-[12px]" />
              <div className="h-10 flex-1 bg-[#1B2A3D] rounded-[12px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-24">
      <main className="max-w-lg mx-auto px-5 py-6">
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-8 text-center">
          <div className="w-16 h-16 bg-[rgba(255,87,34,0.08)] rounded-[16px] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#FF5722]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <p className="text-[#E8E6E1] font-semibold text-lg mb-1" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>No Pools Yet</p>
          <p className="text-[#9BA3AE] text-sm mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>Create or join a pool to start playing.</p>
          <div className="flex justify-center gap-3">
            <Link href="/pools/create" className="btn-orange px-5 py-2.5 text-sm font-semibold rounded-[12px]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Create Pool
            </Link>
            <Link href="/pools/join" className="px-5 py-2.5 bg-[#1B2A3D] border border-[rgba(255,255,255,0.05)] text-[#9BA3AE] text-sm font-semibold rounded-[12px] hover:border-[rgba(255,87,34,0.3)] transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Join Pool
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Entry Status Line ───────────────────────────────────────────

function EntryStatusLine({ entry, picksOpen }: { entry: MyPoolEntry; picksOpen: boolean }) {
  let dotColor: string;
  let statusText: string;

  if (entry.is_eliminated) {
    dotColor = 'bg-[#EF5350]';
    const roundPart = entry.elimination_round_name
      ? `Eliminated ${entry.elimination_round_name}`
      : 'Eliminated';
    const teamPart = entry.elimination_reason === 'missed_pick'
      ? 'No pick'
      : entry.elimination_team_name
      ? `Picked ${entry.elimination_team_name}`
      : '';
    statusText = teamPart ? `${roundPart} \u00b7 ${teamPart}` : roundPart;
  } else if (entry.has_picked_today) {
    dotColor = 'bg-[#4CAF50]';
    statusText = 'Alive · Picked ✓';
  } else if (picksOpen) {
    dotColor = 'bg-[#FFB300]';
    statusText = '⚠️ Needs Pick';
  } else {
    dotColor = 'bg-[#4CAF50]';
    statusText = 'Alive';
  }

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
      <span className="text-sm text-[#E8E6E1] font-medium truncate" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        {entry.entry_label}
      </span>
      <span className="text-xs text-[#9BA3AE] flex-shrink-0" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        {statusText}
      </span>
    </div>
  );
}

// ─── Pool Card ───────────────────────────────────────────────────

function PoolCard({
  pool,
  isActive,
  isCreator,
  onActivate,
  userId,
  onEntryAdded,
}: {
  pool: MyPool;
  isActive: boolean;
  isCreator: boolean;
  onActivate: () => void;
  userId: string | undefined;
  onEntryAdded: () => Promise<void>;
}) {
  const router = useRouter();
  const [copiedCode, setCopiedCode] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [addEntryName, setAddEntryName] = useState('');
  const [addEntryLoading, setAddEntryLoading] = useState(false);
  const [addEntryError, setAddEntryError] = useState('');

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(pool.join_code);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = pool.join_code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareData = {
      title: `Join ${pool.pool_name} on Survive the Dance`,
      text: `Join my March Madness Survivor pool! Use code: ${pool.join_code}`,
      url: `${typeof window !== 'undefined' ? window.location.origin : ''}/pools/join?code=${pool.join_code}`,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); return; } catch { /* cancelled */ }
    }
    handleCopy(e);
  };

  // Status badge
  const statusConfig = {
    open: { label: 'PRE-TOURNAMENT', cls: 'bg-[rgba(255,87,34,0.15)] text-[#FF5722]' },
    active: { label: 'ACTIVE', cls: 'bg-[rgba(76,175,80,0.12)] text-[#4CAF50]' },
    complete: { label: 'COMPLETE', cls: 'bg-[rgba(138,134,148,0.15)] text-[#9BA3AE]' },
  };
  const status = statusConfig[pool.pool_status];

  // Round context
  let roundContext: string;
  if (pool.pool_status === 'open') roundContext = 'Pre-Tournament';
  else if (pool.pool_status === 'complete') roundContext = 'Tournament Complete';
  else roundContext = pool.current_round_name || 'Waiting for next round';

  // Deadline
  const deadline = pool.deadline_datetime ? formatDeadline(pool.deadline_datetime) : null;
  const deadlineExpired = deadline?.text === 'Picks locked';

  // CTA logic
  const aliveEntries = pool.your_entries.filter(e => !e.is_eliminated);
  const unpickedAliveEntries = aliveEntries.filter(e => !e.has_picked_today);
  const hasActiveRound = pool.current_round_name !== null;
  const picksOpen = (pool.pool_status === 'open' || pool.pool_status === 'active')
    && hasActiveRound && !deadlineExpired;
  const allEliminated = pool.pool_status === 'active' && aliveEntries.length === 0;
  const showMakePick = picksOpen && aliveEntries.length > 0 && unpickedAliveEntries.length > 0;
  const showChangePick = picksOpen && aliveEntries.length > 0 && unpickedAliveEntries.length === 0;
  const showStandings = (pool.pool_status === 'active' || pool.pool_status === 'complete') && !allEliminated;

  // Add Entry logic — only allowed pre-tournament (pool status 'open')
  const canAddEntry = pool.max_entries_per_user > 1
    && pool.your_entries.length < pool.max_entries_per_user
    && pool.pool_status === 'open';

  return (
    <div
      onClick={onActivate}
      className={`border rounded-[12px] p-5 cursor-pointer transition-colors ${
        isActive
          ? 'bg-[rgba(255,87,34,0.04)] border-2 border-[#FF5722] border-l-[4px]'
          : 'bg-[#111827] border-[rgba(255,255,255,0.05)]'
      }`}
    >
      {/* Row 1: Pool name + status badge + gear */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0 mr-2">
          <h2 className={`font-bold text-base truncate ${isActive ? 'text-[#FF5722]' : 'text-[#E8E6E1]'}`} style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
            {pool.pool_name}
          </h2>
          {isActive && (
            <span
              className="inline-flex items-center px-1.5 py-px rounded-full font-bold bg-[rgba(255,87,34,0.15)] text-[#FF5722] flex-shrink-0"
              style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.45rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}
            >
              VIEWING
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold ${status.cls}`}
            style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}
          >
            {status.label}
          </span>
          {isCreator && (
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/pools/${pool.pool_id}/settings`); }}
              className="text-[#9BA3AE] hover:text-[#E8E6E1] transition-colors p-0.5"
              title="Pool Settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Round context */}
      <p className="text-xs text-[#9BA3AE] mb-3" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        {roundContext}
      </p>

      {/* Row 3: Per-entry status lines */}
      <div className="mb-3">
        {pool.your_entries.map(entry => (
          <EntryStatusLine key={entry.pool_player_id} entry={entry} picksOpen={picksOpen} />
        ))}

        {/* Row 4: + Add Entry */}
        {canAddEntry && !showAddEntry && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowAddEntry(true); setAddEntryError(''); }}
            className="text-xs text-[#FF5722] font-semibold mt-1 hover:text-[#E64A19] transition-colors"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            + Add Entry
          </button>
        )}
        {showAddEntry && (
          <div onClick={(e) => e.stopPropagation()} className="mt-2 bg-[#1B2A3D] border border-[rgba(255,255,255,0.05)] rounded-[10px] p-3 space-y-2">
            {addEntryError && (
              <p className="text-xs text-[#EF5350]" style={{ fontFamily: "'DM Sans', sans-serif" }}>{addEntryError}</p>
            )}
            <input
              type="text"
              value={addEntryName}
              onChange={(e) => setAddEntryName(e.target.value)}
              maxLength={60}
              className="w-full px-3 py-2 bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[8px] text-sm text-[#E8E6E1] placeholder-[#9BA3AE] focus:outline-none focus:ring-1 focus:ring-[#FF5722]"
              placeholder={`Entry ${pool.your_entries.length + 1} name (optional)`}
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            />
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!userId) return;
                  setAddEntryLoading(true);
                  setAddEntryError('');
                  try {
                    const { data: { user: authUser } } = await supabase.auth.getUser();
                    const baseName = authUser?.user_metadata?.display_name || authUser?.email?.split('@')[0] || 'Player';
                    const entryNumber = pool.your_entries.length + 1;
                    const entryLabel = addEntryName.trim() || `${baseName}'s Entry ${entryNumber}`;
                    const { error } = await supabase.from('pool_players').insert({
                      pool_id: pool.pool_id,
                      user_id: userId,
                      display_name: baseName,
                      entry_number: entryNumber,
                      entry_label: entryLabel,
                    });
                    if (error) throw error;
                    setShowAddEntry(false);
                    setAddEntryName('');
                    await onEntryAdded();
                  } catch (err: any) {
                    setAddEntryError(err.message || 'Failed to add entry');
                  } finally {
                    setAddEntryLoading(false);
                  }
                }}
                disabled={addEntryLoading}
                className="flex-1 py-2 rounded-[8px] text-xs font-semibold btn-orange disabled:opacity-50"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {addEntryLoading ? 'Adding...' : 'Add Entry'}
              </button>
              <button
                onClick={() => { setShowAddEntry(false); setAddEntryName(''); setAddEntryError(''); }}
                className="px-3 py-2 rounded-[8px] text-xs font-semibold text-[#9BA3AE] bg-[#111827] border border-[rgba(255,255,255,0.05)] hover:text-[#E8E6E1] transition-colors"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Row 5: Pool stats + deadline */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <span className="font-bold text-[#E8E6E1]" style={{ fontFamily: "'Space Mono', monospace" }}>{pool.alive_players}</span>/{pool.total_players} alive
        </p>
        {deadline && (
          <p className={`text-xs font-semibold ${deadline.color}`} style={{ fontFamily: "'Space Mono', monospace" }}>
            {deadline.text}
          </p>
        )}
      </div>

      {/* Row 6: CTA buttons */}
      <div className="flex gap-2 mb-4">
        {showMakePick && (
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/pools/${pool.pool_id}/pick`); }}
            className="flex-1 py-2.5 rounded-[12px] btn-orange text-sm font-bold"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Make Pick
          </button>
        )}
        {showChangePick && (
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/pools/${pool.pool_id}/pick`); }}
            className="flex-1 py-2.5 rounded-[12px] border border-[rgba(255,179,0,0.3)] text-[#FFB300] text-sm font-bold hover:bg-[rgba(255,179,0,0.05)] transition-colors"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Change Pick
          </button>
        )}
        {showStandings && (
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/pools/${pool.pool_id}/standings`); }}
            className="flex-1 py-2.5 rounded-[12px] border border-[rgba(255,255,255,0.05)] text-[#9BA3AE] text-sm font-semibold hover:text-[#E8E6E1] hover:border-[rgba(255,87,34,0.3)] transition-colors"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Standings
          </button>
        )}
        {allEliminated && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/pools/${pool.pool_id}/standings`); }}
              className="flex-1 py-2.5 rounded-[12px] border border-[rgba(255,255,255,0.05)] text-[#9BA3AE] text-sm font-semibold hover:text-[#E8E6E1] hover:border-[rgba(255,87,34,0.3)] transition-colors"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              View The Field
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/pools/${pool.pool_id}/bracket`); }}
              className="flex-1 py-2.5 rounded-[12px] border border-[rgba(255,255,255,0.05)] text-[#9BA3AE] text-sm font-semibold hover:text-[#E8E6E1] hover:border-[rgba(255,87,34,0.3)] transition-colors"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              View Bracket
            </button>
          </>
        )}
      </div>

      {/* Row 7: Join Code + Share (hidden for complete pools) */}
      {pool.pool_status !== 'complete' && <div className="flex items-center justify-between bg-[#1B2A3D] border border-[rgba(255,255,255,0.05)] rounded-[8px] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-[#9BA3AE]" style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.15em' }}>Code</span>
          <span className="text-sm font-bold text-[#FF5722] tracking-[0.12em]" style={{ fontFamily: "'Space Mono', monospace" }}>
            {pool.join_code}
          </span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={handleCopy}
            className={`px-2.5 py-1 rounded-[6px] text-[11px] font-semibold transition-all ${
              copiedCode
                ? 'bg-[rgba(76,175,80,0.12)] text-[#4CAF50]'
                : 'bg-[#111827] border border-[rgba(255,255,255,0.05)] text-[#9BA3AE] hover:text-[#E8E6E1]'
            }`}
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {copiedCode ? '✓' : 'Copy'}
          </button>
          <button
            onClick={handleShare}
            className="px-2.5 py-1 rounded-[6px] text-[11px] font-semibold bg-[#111827] border border-[rgba(255,255,255,0.05)] text-[#9BA3AE] hover:text-[#E8E6E1] transition-all"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Share
          </button>
        </div>
      </div>}
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const { activePoolId, setActivePool, pools, loadingPools, refreshPools } = useActivePool();

  // Hide create/join links once any pool is active or complete (tournament started)
  const tournamentStarted = !loadingPools && pools.some(p => p.pool_status === 'active' || p.pool_status === 'complete');

  return (
    <>
      <SplashOverlay userId={user?.id} />
      {loadingPools ? (
        <LoadingSkeleton />
      ) : pools.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="min-h-screen bg-[#0D1B2A] pb-24">
          <div className="max-w-lg mx-auto px-5 py-4 space-y-4">
            {/* Create / Join links at top — hidden once tournament starts */}
            {!tournamentStarted && (
              <div className="flex justify-center gap-4">
                <Link href="/pools/create" className="text-sm text-[#9BA3AE] hover:text-[#FF5722] transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  + Create Pool
                </Link>
                <Link href="/pools/join" className="text-sm text-[#9BA3AE] hover:text-[#FF5722] transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  + Join Pool
                </Link>
              </div>
            )}

            {pools.map(pool => (
              <PoolCard
                key={pool.pool_id}
                pool={pool}
                isActive={pool.pool_id === activePoolId}
                isCreator={pool.creator_id === user?.id}
                onActivate={() => setActivePool(pool.pool_id, pool.pool_name)}
                userId={user?.id}
                onEntryAdded={refreshPools}
              />
            ))}

            {/* Footer */}
            <footer className="pt-4 pb-2 text-center text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p className="text-[#9BA3AE] opacity-50">
                &copy; 2026 Farrar Analytics LLC
                {' '}&middot;{' '}
                <Link href="/about" className="text-[#9BA3AE] hover:text-[#E8E6E1] transition-colors">About</Link>
                {' '}&middot;{' '}
                <Link href="/terms" className="text-[#9BA3AE] hover:text-[#E8E6E1] transition-colors">Terms</Link>
                {' '}&middot;{' '}
                <Link href="/privacy" className="text-[#9BA3AE] hover:text-[#E8E6E1] transition-colors">Privacy</Link>
              </p>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

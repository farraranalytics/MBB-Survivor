'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useActivePool } from '@/hooks/useActivePool';
import { supabase } from '@/lib/supabase/client';
import { MyPool } from '@/types/standings';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatET } from '@/lib/timezone';
import { SplashOverlay } from '@/components/SplashOverlay';
import { useToast } from '@/hooks/useToast';
import { getTournamentState, canJoinOrCreate, TournamentState, RoundInfo } from '@/lib/status';
import { getActivityFeed, ActivityItem, timeAgo } from '@/lib/activity';

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
      <div className="max-w-lg mx-auto px-5 py-4 space-y-5">
        {/* Hero skeleton */}
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[14px] p-5 animate-pulse">
          <div className="h-4 w-48 bg-[#1B2A3D] rounded mb-3" />
          <div className="h-3 w-32 bg-[#1B2A3D] rounded mb-2" />
          <div className="h-3 w-40 bg-[#1B2A3D] rounded" />
        </div>
        {/* Buttons skeleton */}
        <div className="flex gap-3">
          <div className="h-10 flex-1 bg-[#1B2A3D] rounded-[10px] animate-pulse" />
          <div className="h-10 flex-1 bg-[#1B2A3D] rounded-[10px] animate-pulse" />
        </div>
        {/* Survival bars skeleton */}
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[10px] p-3 animate-pulse">
              <div className="h-3 w-32 bg-[#1B2A3D] rounded mb-2" />
              <div className="h-1.5 w-full bg-[#1B2A3D] rounded-full" />
            </div>
          ))}
        </div>
        {/* Pool card skeleton */}
        {[1, 2].map(i => (
          <div key={i} className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[14px] p-4 animate-pulse">
            <div className="h-5 w-32 bg-[#1B2A3D] rounded mb-3" />
            <div className="h-3 w-48 bg-[#1B2A3D] rounded mb-4" />
            <div className="h-8 w-full bg-[#1B2A3D] rounded-[8px]" />
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
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[14px] p-8 text-center">
          <div className="mb-4 inline-flex flex-col items-center" style={{ gap: 0 }}>
            <span className="text-[0.7rem] tracking-[0.5em]" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: 'rgba(232, 230, 225, 0.4)', lineHeight: 1 }}>
              SURVIVE
            </span>
            <span className="text-[1.4rem] tracking-[0.15em] text-[#FF5722]" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, lineHeight: 1.1 }}>
              THE
            </span>
            <span className="text-[2.5rem] tracking-[-0.02em] text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, lineHeight: 0.85 }}>
              DANCE
            </span>
          </div>
          <p className="text-sm text-[#9BA3AE] mb-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            2026 March Madness Survivor Pool
          </p>
          <p className="text-xs text-[#5F6B7A] mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Create a pool and invite your friends, or join an existing pool with a code.
          </p>
          <div className="flex justify-center gap-3 mb-4">
            <Link href="/pools/create" className="btn-orange px-5 py-2.5 text-sm font-semibold rounded-[10px]">
              Create Pool
            </Link>
            <Link href="/pools/join" className="px-5 py-2.5 border border-[rgba(255,255,255,0.08)] text-[#9BA3AE] text-sm font-semibold rounded-[10px] hover:border-[rgba(255,87,34,0.3)] hover:text-[#E8E6E1] transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Join Pool
            </Link>
          </div>
          <p className="text-xs text-[#5F6B7A]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Free to play &middot; No money involved
          </p>
        </div>
      </main>
    </div>
  );
}

// ─── Section 1: Hero Banner ──────────────────────────────────────

function HeroBanner({ state, totalPlayers, totalPools }: {
  state: TournamentState | null;
  totalPlayers: number;
  totalPools: number;
}) {
  if (!state) return null;

  const current = state.currentRound;

  return (
    <div
      className="rounded-[14px] border border-[rgba(255,255,255,0.05)] overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at center, rgba(255,87,34,0.03) 0%, transparent 70%), #111827' }}
    >
      <div className="px-5 py-4">
        {state.status === 'pre_tournament' && (
          <>
            <p className="text-[10px] text-[#FF5722] tracking-[0.2em] uppercase mb-1" style={{ fontFamily: "'Space Mono', monospace" }}>
              2026 NCAA Tournament
            </p>
            <h2 className="text-lg font-bold text-[#E8E6E1] mb-2" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              Survive the Dance
            </h2>
            <p className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <span className="font-bold text-[#E8E6E1]" style={{ fontFamily: "'Space Mono', monospace" }}>{totalPlayers}</span> players &middot;{' '}
              <span className="font-bold text-[#E8E6E1]" style={{ fontFamily: "'Space Mono', monospace" }}>{totalPools}</span> pools ready
            </p>
          </>
        )}

        {state.status === 'tournament_live' && current?.status === 'pre_round' && (
          <>
            <p className="label mb-1">{current.name}</p>
            <h2 className="text-lg font-bold text-[#E8E6E1] mb-2" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              {current.gamesTotal} Games Today
            </h2>
            {!current.isDeadlinePassed && current.deadline && (
              <p className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Picks lock at{' '}
                <span className="text-[#FFB300] font-semibold" style={{ fontFamily: "'Space Mono', monospace" }}>
                  {formatET(current.deadline)}
                </span>
              </p>
            )}
          </>
        )}

        {state.status === 'tournament_live' && current?.status === 'round_live' && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#EF5350]" style={{ animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
              <p className="text-[10px] text-[#EF5350] font-bold tracking-[0.1em] uppercase" style={{ fontFamily: "'Space Mono', monospace" }}>
                LIVE
              </p>
              <span className="text-[#5F6B7A] text-xs">&middot;</span>
              <p className="label" style={{ marginBottom: 0 }}>{current.name}</p>
            </div>
            <p className="text-sm text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <span className="font-bold text-[#E8E6E1]" style={{ fontFamily: "'Space Mono', monospace" }}>{current.gamesFinal}</span> of {current.gamesTotal} games final
            </p>
            <div className="w-full h-1.5 bg-[#1B2A3D] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#4CAF50] rounded-full transition-all"
                style={{ width: `${current.gamesTotal > 0 ? (current.gamesFinal / current.gamesTotal) * 100 : 0}%` }}
              />
            </div>
          </>
        )}

        {state.status === 'tournament_live' && current?.status === 'round_complete' && (() => {
          const nextRound = state.rounds.find(r => r.status === 'pre_round');
          return (
            <>
              <p className="label mb-1">{current.name}</p>
              <h2 className="text-lg font-bold text-[#E8E6E1] mb-2" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                Round Complete
              </h2>
              {nextRound && (
                <p className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Next: <span className="text-[#E8E6E1]">{nextRound.name}</span>
                </p>
              )}
            </>
          );
        })()}

        {state.status === 'tournament_complete' && (
          <>
            <p className="text-2xl mb-1">🏆</p>
            <h2 className="text-lg font-bold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              Tournament Complete
            </h2>
            <p className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              2026 NCAA Tournament
            </p>
          </>
        )}
      </div>
      {/* Orange accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-[rgba(255,87,34,0.3)] to-transparent" />
    </div>
  );
}

// ─── Section 2: Survival Summary ─────────────────────────────────

function SurvivalBar({ survived, eliminatedAt, total, currentIdx }: {
  survived: number;
  eliminatedAt: number | null;
  total: number;
  currentIdx: number | null;
}) {
  if (total === 0) return null;
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: total }, (_, i) => {
        let cls: string;
        if (i < survived) {
          cls = 'bg-[#FF5722]';
        } else if (eliminatedAt !== null && i === eliminatedAt) {
          cls = 'bg-[#EF5350]';
        } else if (currentIdx !== null && i === currentIdx && eliminatedAt === null) {
          cls = 'bg-[#FFB300]';
        } else {
          cls = 'bg-[#243447]';
        }
        const isPulsing = currentIdx !== null && i === currentIdx && eliminatedAt === null;
        return (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${cls}`}
            style={isPulsing ? { animation: 'segment-pulse 2s ease-in-out infinite' } : undefined}
          />
        );
      })}
    </div>
  );
}

function SurvivalSummary({ pools, rounds, onEntryClick }: { pools: MyPool[]; rounds: RoundInfo[]; onEntryClick: (poolId: string, poolName: string, entryId: string) => void }) {
  const allEntries = pools.flatMap(pool =>
    pool.your_entries.map(entry => ({
      ...entry,
      poolName: pool.pool_name,
      poolId: pool.pool_id,
    }))
  );

  if (allEntries.length === 0) return null;

  const roundIndexMap = new Map<string, number>();
  rounds.forEach((r, i) => roundIndexMap.set(r.name, i));

  const totalRounds = rounds.length;
  const completedRounds = rounds.filter(r => r.status === 'round_complete').length;
  const currentRoundIdx = rounds.findIndex(r => r.status === 'pre_round' || r.status === 'round_live');

  const aliveCount = allEntries.filter(e => !e.is_eliminated).length;
  const elimCount = allEntries.filter(e => e.is_eliminated).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <p className="label">Your Entries</p>
        <p className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <span className="text-[#4CAF50]">{aliveCount} alive</span>
          {elimCount > 0 && <> &middot; <span className="text-[#EF5350]">{elimCount} out</span></>}
        </p>
      </div>
      <div className="space-y-2">
        {allEntries.map(entry => {
          const elimRoundIdx = entry.elimination_round_name
            ? roundIndexMap.get(entry.elimination_round_name) ?? null
            : null;
          const survived = entry.is_eliminated
            ? (elimRoundIdx !== null ? elimRoundIdx : 0)
            : completedRounds;

          return (
            <div
              key={entry.pool_player_id}
              onClick={() => onEntryClick(entry.poolId, entry.poolName, entry.pool_player_id)}
              className={`bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[10px] px-3 py-2.5 cursor-pointer hover:border-[rgba(255,255,255,0.12)] transition-colors ${entry.is_eliminated ? 'opacity-45' : ''}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-[#E8E6E1] font-medium truncate" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  <span className="text-[#9BA3AE]">{entry.poolName}</span>
                  <span className="text-[#5F6B7A] mx-1">&mdash;</span>
                  {entry.entry_label}
                </p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] flex-shrink-0 ml-2 ${
                  entry.is_eliminated
                    ? 'bg-[rgba(239,83,80,0.1)] text-[#EF5350]'
                    : 'bg-[rgba(76,175,80,0.1)] text-[#4CAF50]'
                }`} style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.05em' }}>
                  {entry.is_eliminated ? 'OUT' : 'ALIVE'}
                </span>
              </div>
              {totalRounds > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <SurvivalBar
                      survived={survived}
                      eliminatedAt={entry.is_eliminated ? elimRoundIdx : null}
                      total={totalRounds}
                      currentIdx={currentRoundIdx >= 0 ? currentRoundIdx : null}
                    />
                  </div>
                  <span className="text-[10px] text-[#5F6B7A] flex-shrink-0" style={{ fontFamily: "'Space Mono', monospace" }}>
                    {survived}/{totalRounds}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section 3: Pick CTA ─────────────────────────────────────────

function PickCTA({ pools, activePoolId }: { pools: MyPool[]; activePoolId: string | null }) {
  const entriesNeedingPicks = pools.flatMap(pool => {
    if (!pool.deadline_datetime || !pool.current_round_name) return [];
    if (new Date(pool.deadline_datetime).getTime() <= Date.now()) return [];
    if (pool.pool_status !== 'active' && pool.pool_status !== 'open') return [];
    return pool.your_entries
      .filter(e => !e.is_eliminated && !e.has_picked_today)
      .map(e => ({ ...e, poolId: pool.pool_id, deadline: pool.deadline_datetime }));
  });

  if (entriesNeedingPicks.length === 0) return null;

  const firstPoolId = entriesNeedingPicks[0].poolId;
  const deadline = entriesNeedingPicks[0].deadline;
  const roundName = pools.find(p => p.pool_id === firstPoolId)?.current_round_name;

  return (
    <div className="bg-[rgba(255,87,34,0.04)] border border-[rgba(255,87,34,0.2)] rounded-[14px] p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[#FF5722] text-sm">⚠</span>
        <p className="text-sm font-bold text-[#FF5722]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
          {entriesNeedingPicks.length} {entriesNeedingPicks.length === 1 ? 'Entry Needs' : 'Entries Need'} a Pick
        </p>
      </div>
      {deadline && roundName && (
        <p className="text-xs text-[#9BA3AE] mb-3" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          {formatDeadline(deadline).text} &middot; {roundName}
        </p>
      )}
      <Link
        href={`/pools/${activePoolId || firstPoolId}/pick`}
        className="block w-full py-3 rounded-[10px] btn-orange font-bold text-sm text-center"
      >
        Make Your Picks
      </Link>
    </div>
  );
}

// ─── Section 4: Pool Cards ───────────────────────────────────────

function SimplePoolCard({ pool, isActive, isCreator, onActivate }: {
  pool: MyPool;
  isActive: boolean;
  isCreator: boolean;
  onActivate: () => void;
}) {
  const [copiedCode, setCopiedCode] = useState(false);
  const { addToast } = useToast();
  const router = useRouter();

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
    addToast('info', 'Join code copied!', 2000);
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

  const deadline = pool.deadline_datetime ? formatDeadline(pool.deadline_datetime) : null;
  const roundContext = pool.pool_status === 'open'
    ? 'Pre-Tournament'
    : pool.pool_status === 'complete'
    ? 'Tournament Complete'
    : pool.current_round_name || 'Waiting for next round';

  return (
    <div
      onClick={() => {
        onActivate();
        router.push(`/pools/${pool.pool_id}/standings`);
      }}
      className={`border rounded-[14px] p-4 cursor-pointer transition-colors ${
        isActive
          ? 'bg-[rgba(255,87,34,0.04)] border-[#FF5722]'
          : 'bg-[#111827] border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,87,34,0.2)]'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className={`font-bold text-base truncate ${isActive ? 'text-[#FF5722]' : 'text-[#E8E6E1]'}`} style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
            {pool.pool_name}
          </h3>
          {isCreator && (
            <svg className="w-3.5 h-3.5 text-[#9BA3AE] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </div>
        <p className="text-xs text-[#9BA3AE] flex-shrink-0" style={{ fontFamily: "'Space Mono', monospace" }}>
          <span className="text-[#E8E6E1] font-bold">{pool.alive_players}</span>/{pool.total_players} alive
        </p>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          {roundContext}
        </p>
        {deadline && pool.pool_status !== 'complete' && pool.pool_status !== 'open' && (
          <p className={`text-[10px] font-semibold ${deadline.color}`} style={{ fontFamily: "'Space Mono', monospace" }}>
            {deadline.text}
          </p>
        )}
      </div>

      {/* Join code row — hidden for complete pools */}
      {pool.pool_status !== 'complete' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-between bg-[#1B2A3D] border border-[rgba(255,255,255,0.05)] rounded-[8px] px-3 py-2"
        >
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
        </div>
      )}
    </div>
  );
}

// ─── Section 5: Activity Feed ────────────────────────────────────

function ActivityFeed({ items, loading }: { items: ActivityItem[]; loading: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? items : items.slice(0, 8);

  if (loading) {
    return (
      <div>
        <p className="label mb-2.5">Activity</p>
        <div className="space-y-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-9 bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[8px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div>
        <p className="label mb-2.5">Activity</p>
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[10px] px-4 py-6 text-center">
          <p className="text-xs text-[#5F6B7A]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            No activity yet &mdash; waiting for tip-off
          </p>
        </div>
      </div>
    );
  }

  const iconMap: Record<string, string> = {
    game_final: '🏀',
    upset: '🚨',
    elimination: '☠️',
    player_joined: '👋',
  };

  return (
    <div>
      <p className="label mb-2.5">Activity</p>
      <div className="space-y-1">
        {displayed.map(item => (
          <div
            key={item.id}
            className={`flex items-start gap-2.5 px-3 py-2 rounded-[8px] ${
              item.type === 'elimination'
                ? 'bg-[rgba(239,83,80,0.04)]'
                : 'bg-[#111827]'
            } ${item.isOwnEvent ? 'border-l-2 border-l-[#FF5722]' : ''}`}
          >
            <span className="text-xs flex-shrink-0 mt-0.5">{iconMap[item.type] || '·'}</span>
            <p className="text-xs text-[#9BA3AE] flex-1 min-w-0" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {item.text}
            </p>
            <span className="text-[10px] text-[#5F6B7A] flex-shrink-0 whitespace-nowrap" style={{ fontFamily: "'Space Mono', monospace" }}>
              {timeAgo(item.timestamp)}
            </span>
          </div>
        ))}
      </div>
      {items.length > 8 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full mt-2 py-2 text-xs text-[#9BA3AE] hover:text-[#E8E6E1] transition-colors"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Show more ({items.length - 8} more)
        </button>
      )}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const { activePoolId, setActivePool, pools, loadingPools } = useActivePool();
  const router = useRouter();
  const [tournamentState, setTournamentState] = useState<TournamentState | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [totalPools, setTotalPools] = useState(0);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // Load tournament state + stats + activity when pools are ready
  useEffect(() => {
    if (loadingPools || !user) return;

    async function loadDashboardData() {
      try {
        const [state, playersRes, poolsRes] = await Promise.all([
          getTournamentState(),
          supabase.from('pool_players').select('id', { count: 'exact', head: true }),
          supabase.from('pools').select('id', { count: 'exact', head: true }),
        ]);

        setTournamentState(state);
        setTotalPlayers(playersRes.count || 0);
        setTotalPools(poolsRes.count || 0);

        // Load activity feed
        if (pools.length > 0) {
          const poolIds = pools.map(p => p.pool_id);
          const recentRoundIds = state.rounds
            .filter(r => r.status === 'round_live' || r.status === 'round_complete')
            .slice(-2)
            .map(r => r.id);

          const items = await getActivityFeed(user!.id, poolIds, recentRoundIds);
          setActivityItems(items);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setActivityLoading(false);
      }
    }

    loadDashboardData();
  }, [loadingPools, user, pools]);

  const preTournament = !tournamentState || canJoinOrCreate(tournamentState);

  return (
    <>
      <SplashOverlay userId={user?.id} />
      {loadingPools ? (
        <LoadingSkeleton />
      ) : pools.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="min-h-screen bg-[#0D1B2A] pb-24">
          <div className="max-w-lg mx-auto px-5 py-4 space-y-5">
            {/* Section 1: Hero Banner */}
            <HeroBanner state={tournamentState} totalPlayers={totalPlayers} totalPools={totalPools} />

            {/* Create / Join Buttons — always visible */}
            <div className="flex gap-3">
              <Link
                href="/pools/create"
                className={`flex-1 py-2.5 text-center text-sm font-semibold rounded-[10px] border transition-colors ${
                  preTournament
                    ? 'border-[rgba(255,87,34,0.3)] text-[#FF5722] hover:bg-[rgba(255,87,34,0.05)]'
                    : 'border-[rgba(255,255,255,0.05)] text-[#5F6B7A] hover:text-[#9BA3AE]'
                }`}
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                + Create Pool
              </Link>
              <Link
                href="/pools/join"
                className={`flex-1 py-2.5 text-center text-sm font-semibold rounded-[10px] border transition-colors ${
                  preTournament
                    ? 'border-[rgba(255,87,34,0.3)] text-[#FF5722] hover:bg-[rgba(255,87,34,0.05)]'
                    : 'border-[rgba(255,255,255,0.05)] text-[#5F6B7A] hover:text-[#9BA3AE]'
                }`}
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                + Join Pool
              </Link>
            </div>

            {/* Section 2: Survival Summary */}
            {tournamentState && (
              <SurvivalSummary pools={pools} rounds={tournamentState.rounds} onEntryClick={(poolId, poolName, entryId) => {
                setActivePool(poolId, poolName);
                router.push(`/pools/${poolId}/pick?entry=${entryId}`);
              }} />
            )}

            {/* Section 3: Pick CTA */}
            <PickCTA pools={pools} activePoolId={activePoolId} />

            {/* Section 4: Pool Cards */}
            <div>
              <p className="label mb-2.5">Your Pools</p>
              <div className="space-y-3">
                {pools.map(pool => (
                  <SimplePoolCard
                    key={pool.pool_id}
                    pool={pool}
                    isActive={pool.pool_id === activePoolId}
                    isCreator={pool.creator_id === user?.id}
                    onActivate={() => setActivePool(pool.pool_id, pool.pool_name)}
                  />
                ))}
              </div>
            </div>

            {/* Section 5: Activity Feed */}
            <ActivityFeed items={activityItems} loading={activityLoading} />

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

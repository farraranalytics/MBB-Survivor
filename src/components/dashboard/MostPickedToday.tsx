'use client';

import { useState, useEffect, useCallback } from 'react';
import { MyPool } from '@/types/standings';
import { formatET } from '@/lib/timezone';
import type { MostPickedResponse, MostPickedTeam } from '@/app/api/pools/[id]/most-picked/route';
import PoolSelectorBar from '@/components/pool/PoolSelectorBar';

interface MostPickedTodayProps {
  pools: MyPool[];
  activePoolId: string | null;
}

export default function MostPickedToday({ pools, activePoolId }: MostPickedTodayProps) {
  const [data, setData] = useState<MostPickedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPoolId, setSelectedPoolId] = useState(activePoolId || pools[0]?.pool_id || '');

  // Update selectedPoolId if activePoolId changes
  useEffect(() => {
    if (activePoolId) setSelectedPoolId(activePoolId);
  }, [activePoolId]);

  const fetchData = useCallback(async (poolId: string) => {
    if (!poolId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pools/${poolId}/most-picked`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch most-picked:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(selectedPoolId);
  }, [selectedPoolId, fetchData]);

  if (pools.length === 0) return null;

  return (
    <div>
      {/* Section header */}
      <p
        className="label mb-2"
        style={{ fontFamily: "'Space Mono', monospace" }}
      >
        Most Picked Today
      </p>

      {/* Pool selector */}
      <PoolSelectorBar currentPoolId={selectedPoolId} />

      {/* Content */}
      <div
        className="rounded-[14px] border border-[rgba(255,255,255,0.05)] overflow-hidden"
        style={{ background: '#111827' }}
      >
        {loading ? (
          <LoadingState />
        ) : !data || !data.round_name ? (
          <EmptyState />
        ) : !data.is_locked ? (
          <LockedState deadline={data.deadline} roundName={data.round_name} />
        ) : data.teams.length === 0 ? (
          <NoPicksState roundName={data.round_name} />
        ) : (
          <RevealedState teams={data.teams} totalPicks={data.total_picks} roundName={data.round_name} />
        )}
      </div>
    </div>
  );
}

// ─── Loading State ──────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="p-4 space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="animate-pulse">
          <div className="h-3 w-24 bg-[#1B2A3D] rounded mb-2" />
          <div className="h-5 w-full bg-[#1B2A3D] rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-xs text-[#5F6B7A]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        No active round
      </p>
    </div>
  );
}

// ─── No Picks State ─────────────────────────────────────────────

function NoPicksState({ roundName }: { roundName: string }) {
  return (
    <div className="px-4 py-8 text-center">
      <p
        className="text-xs text-[#9BA3AE] mb-1"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {roundName}
      </p>
      <p className="text-xs text-[#5F6B7A]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        No picks submitted yet
      </p>
    </div>
  );
}

// ─── Locked State (pre-tipoff) ──────────────────────────────────

function LockedState({ deadline, roundName }: { deadline: string | null; roundName: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!deadline) return;
    const update = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Revealing...');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  // Fake blurred bars for visual effect
  const fakeBars = [65, 45, 30, 20, 12];

  return (
    <div className="relative">
      {/* Blurred content */}
      <div className="p-4 space-y-3" style={{ filter: 'blur(6px)', opacity: 0.3, pointerEvents: 'none' }}>
        {fakeBars.map((pct, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'Oswald', sans-serif" }}>
                Team {i + 1}
              </span>
              <span className="text-[10px] text-[#5F6B7A]" style={{ fontFamily: "'Space Mono', monospace" }}>
                {pct}%
              </span>
            </div>
            <div className="h-4 bg-[#1B2A3D] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: '#FF5722' }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
          style={{ background: 'rgba(255,87,34,0.12)', border: '1.5px solid rgba(255,87,34,0.3)' }}
        >
          <svg className="w-5 h-5 text-[#FF5722]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p
          className="text-sm font-bold text-[#E8E6E1] mb-1"
          style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
        >
          Locked Until Tipoff
        </p>
        <p
          className="text-xs text-[#9BA3AE] mb-2"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {roundName}
        </p>
        {timeLeft && (
          <p
            className="text-sm text-[#FF5722] font-bold tracking-[0.05em]"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            {timeLeft}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Revealed State (post-tipoff) ───────────────────────────────

function RevealedState({ teams, totalPicks, roundName }: { teams: MostPickedTeam[]; totalPicks: number; roundName: string }) {
  return (
    <div>
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <p
          className="text-xs text-[#9BA3AE]"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {roundName}
        </p>
        <p
          className="text-[10px] text-[#5F6B7A] tracking-[0.08em]"
          style={{ fontFamily: "'Space Mono', monospace" }}
        >
          {totalPicks} PICKS
        </p>
      </div>

      {/* Team bars */}
      <div className="px-4 pb-4 space-y-3">
        {teams.map((team) => (
          <TeamBar key={team.team_id} team={team} />
        ))}
      </div>
    </div>
  );
}

function TeamBar({ team }: { team: MostPickedTeam }) {
  // Determine the status line
  let statusText = '';
  let statusColor = '#5F6B7A';

  if (team.game_status === 'final') {
    if (team.team_score !== null && team.opponent_score !== null) {
      const won = team.team_score > team.opponent_score;
      statusText = won
        ? `W ${team.team_score}-${team.opponent_score} - ${team.count} entries safe`
        : `L ${team.team_score}-${team.opponent_score} - ${team.count} entries eliminated`;
      statusColor = won ? '#4CAF50' : '#EF5350';
    }
  } else if (team.game_status === 'in_progress') {
    if (team.team_score !== null && team.opponent_score !== null) {
      const leading = team.team_score > team.opponent_score;
      statusText = leading
        ? `${team.team_abbreviation} leads ${team.team_score}-${team.opponent_score}`
        : `${team.opponent_abbreviation || 'OPP'} leads ${team.opponent_score}-${team.team_score}`;
      statusColor = '#FFB300';
    } else {
      statusText = 'In Progress';
      statusColor = '#FFB300';
    }
  } else {
    // Scheduled
    if (team.game_datetime) {
      statusText = `Tipoff ${formatET(team.game_datetime)}`;
    }
    if (team.count > 0) {
      statusText += ` - ${team.count} entries at risk`;
    }
  }

  // Bar color based on game status
  let barColor = '#FF5722';
  if (team.game_status === 'final') {
    barColor = (team.team_score !== null && team.opponent_score !== null && team.team_score > team.opponent_score)
      ? '#4CAF50' : '#EF5350';
  }

  return (
    <div>
      {/* Team info row */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold text-[#E8E6E1]"
            style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
          >
            {team.team_name}
          </span>
          <span
            className="text-[10px] text-[#5F6B7A]"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            ({team.team_seed})
          </span>
          {team.opponent_name && (
            <span
              className="text-[10px] text-[#5F6B7A]"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              vs ({team.opponent_seed}) {team.opponent_abbreviation}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold text-[#E8E6E1]"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            {team.pct}%
          </span>
          <span
            className="text-[10px] text-[#5F6B7A]"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            ({team.count})
          </span>
        </div>
      </div>

      {/* Bar */}
      <div className="h-5 bg-[#1B2A3D] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(team.pct, 3)}%`, background: barColor }}
        />
      </div>

      {/* Status line */}
      {statusText && (
        <p
          className="text-[10px] mt-1"
          style={{ fontFamily: "'Space Mono', monospace", color: statusColor, letterSpacing: '0.02em' }}
        >
          {statusText}
        </p>
      )}
    </div>
  );
}

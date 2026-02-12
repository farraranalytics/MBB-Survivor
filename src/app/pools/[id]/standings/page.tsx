'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { TeamLogo } from '@/components/TeamLogo';
import { PageHeader, PoolSelectorBar } from '@/components/pool';
import { useClockOffset } from '@/hooks/useClockOffset';
import { mapRoundNameToCode, inferHalf } from '@/lib/bracket';
import { formatDateET } from '@/lib/timezone';
import {
  PoolLeaderboard,
  StandingsPlayer,
  StandingsFilter,
  RoundResult,
} from '@/types/standings';

// ─── Types ──────────────────────────────────────────────────────

type StandingsSort = 'streak' | 'name' | 'picks';

// ─── Round label builder ────────────────────────────────────────

function buildRoundLabel(roundName: string): string {
  const code = mapRoundNameToCode(roundName);
  const half = inferHalf(roundName);
  if (half) return `${code}.${half === 'A' ? '1' : '2'}`;
  return code;
}

// ─── Helper: should picks be visible for a round? ───────────────

function isPickVisible(
  round: { deadline_datetime: string; is_complete: boolean },
  isOwnEntry: boolean,
  clockOffset: number = 0,
): boolean {
  const effectiveNow = new Date(Date.now() + clockOffset);
  return isOwnEntry || new Date(round.deadline_datetime) < effectiveNow || round.is_complete;
}

// ─── Pick Cell — Logo-based grid cell ───────────────────────────

function PickCell({
  result,
  deadlinePassed,
}: {
  result: RoundResult | undefined;
  deadlinePassed: boolean;
}) {
  // Hidden (pre-deadline)
  if (!deadlinePassed) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md px-1 py-2 bg-[rgba(255,255,255,0.04)] min-h-[52px]">
        <svg className="w-4 h-4 text-[#5F6B7A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
    );
  }

  // No pick
  if (!result) {
    return (
      <div className="flex items-center justify-center rounded-md min-h-[52px] text-[#5F6B7A] text-xs">
        —
      </div>
    );
  }

  // Determine styling by state
  let bgClass = 'bg-[rgba(255,255,255,0.14)]'; // pending/scheduled
  let textColor = '#E8E6E1';
  let icon = '';
  let pulseClass = '';

  if (result.is_correct === true) {
    bgClass = 'bg-[rgba(76,175,80,0.5)]';
    textColor = '#4CAF50';
    icon = '✓';
  } else if (result.is_correct === false) {
    bgClass = 'bg-[rgba(239,83,80,0.5)]';
    textColor = '#EF5350';
    icon = '✗';
  } else if (result.game_status === 'in_progress') {
    bgClass = 'bg-[rgba(255,179,0,0.44)]';
    textColor = '#FFB300';
    pulseClass = 'animate-pulse';
    icon = result.game_score || '•••';
  }

  return (
    <div className={`flex flex-col items-center justify-center rounded-md px-1 py-2 min-h-[52px] ${bgClass} ${pulseClass}`}>
      <TeamLogo
        espnTeamId={result.team_espn_id}
        teamName={result.team_name}
        size="md"
      />
      {icon && (
        <span
          className="text-[10px] mt-1 font-bold"
          style={{ fontFamily: "'Space Mono', monospace", color: textColor }}
        >
          {icon}
        </span>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

export default function StandingsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const poolId = params.id as string;

  const [leaderboard, setLeaderboard] = useState<PoolLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StandingsFilter>('all');
  const [sort, setSort] = useState<StandingsSort>('streak');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const loadedRef = useRef(false);
  const clockOffset = useClockOffset();

  useEffect(() => {
    if (!user || !poolId) return;

    const fetchLeaderboard = async (showSpinner: boolean) => {
      try {
        if (showSpinner) setLoading(true);
        const res = await fetch(`/api/pools/${poolId}/standings`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to load standings');
        }
        const data: PoolLeaderboard = await res.json();
        setLeaderboard(data);
      } catch (err) {
        console.error('Failed to fetch standings:', err);
        if (showSpinner) setError(err instanceof Error ? err.message : 'Failed to load standings');
      } finally {
        if (showSpinner) setLoading(false);
      }
    };

    if (!loadedRef.current) {
      loadedRef.current = true;
      fetchLeaderboard(true);
    }
    const interval = setInterval(() => fetchLeaderboard(false), 30000);
    return () => clearInterval(interval);
  }, [user, poolId]);

  // Filtered + sorted players
  const sortedPlayers = useMemo(() => {
    if (!leaderboard) return [];

    const filtered = leaderboard.players.filter((p) => {
      if (filter === 'alive') return !p.is_eliminated;
      if (filter === 'eliminated') return p.is_eliminated;
      return true;
    });

    return [...filtered].sort((a, b) => {
      // Alive always before eliminated
      if (a.is_eliminated !== b.is_eliminated) return a.is_eliminated ? 1 : -1;
      switch (sort) {
        case 'streak':
          return b.survival_streak - a.survival_streak;
        case 'name':
          return (a.entry_label || '').localeCompare(b.entry_label || '');
        case 'picks':
          return b.picks_count - a.picks_count;
        default:
          return 0;
      }
    });
  }, [leaderboard, filter, sort]);

  // Detect multi-entry users
  const multiEntryUsers = useMemo(() => {
    if (!leaderboard) return new Set<string>();
    const counts = new Map<string, number>();
    for (const p of leaderboard.players) {
      counts.set(p.user_id, (counts.get(p.user_id) || 0) + 1);
    }
    const multi = new Set<string>();
    for (const [uid, count] of counts) {
      if (count > 1) multi.add(uid);
    }
    return multi;
  }, [leaderboard]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-[rgba(255,255,255,0.05)] border-t-[#FF5722] mx-auto mb-4" />
          <p className="text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Loading the field...</p>
        </div>
      </div>
    );
  }

  if (error || !leaderboard) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold text-[#E8E6E1] mb-2" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Error</h1>
          <p className="text-[#9BA3AE] mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>{error || 'Failed to load standings'}</p>
          <button
            onClick={() => router.push(`/pools/${poolId}`)}
            className="btn-orange px-6 py-3 rounded-[12px] font-semibold"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Back to Pool
          </button>
        </div>
      </div>
    );
  }

  const alivePlayers = sortedPlayers.filter((p) => !p.is_eliminated);
  const eliminatedPlayers = sortedPlayers.filter((p) => p.is_eliminated);
  const hasRounds = leaderboard.rounds_played.length > 0;

  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-24">
      {/* ─── Page Header ──────────────────────────────────────── */}
      <div className="bg-[#080810] border-b border-[rgba(255,255,255,0.08)]">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2 sm:py-4">
          <PageHeader
            tabLabel="THE FIELD"
            heading="Standings"
            roundInfo={leaderboard.current_round ? {
              roundName: leaderboard.current_round.name,
            } : undefined}
          />
          <PoolSelectorBar currentPoolId={poolId} />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2.5 sm:py-6">
        {/* ─── Summary Stats Bar ─────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="bg-[rgba(76,175,80,0.1)] rounded-[10px] p-2.5 sm:p-3 text-center">
            <p className="text-lg sm:text-xl font-bold text-[#4CAF50]" style={{ fontFamily: "'Space Mono', monospace" }}>{leaderboard.alive_players}</p>
            <p className="label" style={{ color: 'rgba(76,175,80,0.7)' }}>Alive</p>
          </div>
          <div className="bg-[rgba(239,83,80,0.1)] rounded-[10px] p-2.5 sm:p-3 text-center">
            <p className="text-lg sm:text-xl font-bold text-[#EF5350]" style={{ fontFamily: "'Space Mono', monospace" }}>{leaderboard.eliminated_players}</p>
            <p className="label" style={{ color: 'rgba(239,83,80,0.7)' }}>Out</p>
          </div>
          <div className="bg-[#1B2A3D] rounded-[10px] p-2.5 sm:p-3 text-center">
            <p className="text-lg sm:text-xl font-bold text-[#E8E6E1]" style={{ fontFamily: "'Space Mono', monospace" }}>
              {leaderboard.prize_pool > 0 ? `$${leaderboard.prize_pool.toLocaleString()}` : leaderboard.total_players}
            </p>
            <p className="label" style={{ color: '#9BA3AE' }}>
              {leaderboard.prize_pool > 0 ? 'Pot' : 'Total'}
            </p>
          </div>
        </div>

        {/* ─── Filter Tabs + Sort Dropdown ────────────────────── */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex space-x-1 bg-[#111827] rounded-[10px] p-1">
            {(['all', 'alive', 'eliminated'] as StandingsFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 sm:py-1.5 rounded-[8px] text-xs font-semibold transition-colors ${
                  filter === f
                    ? 'bg-[#1B2A3D] text-[#E8E6E1] shadow-sm'
                    : 'text-[#9BA3AE] hover:text-[#E8E6E1]'
                }`}
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {f === 'all' && `All ${leaderboard.total_players}`}
                {f === 'alive' && `Alive ${leaderboard.alive_players}`}
                {f === 'eliminated' && `Out ${leaderboard.eliminated_players}`}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] border border-[rgba(255,255,255,0.05)] bg-[#111827] text-[#9BA3AE] text-xs font-bold hover:text-[#E8E6E1] transition-colors"
              style={{ fontFamily: "'Space Mono', monospace", textTransform: 'uppercase' }}
            >
              {sort === 'streak' ? 'Streak' : sort === 'name' ? 'Name' : 'Picks'}
              <svg className={`w-3 h-3 transition-transform ${sortDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {sortDropdownOpen && (
              <>
                <div className="fixed inset-0 z-[99]" onClick={() => setSortDropdownOpen(false)} />
                <div className="absolute right-0 mt-1 z-[100] bg-[#1B2A3D] border border-[rgba(255,255,255,0.1)] rounded-[8px] shadow-xl overflow-hidden min-w-[100px]">
                  {(['streak', 'name', 'picks'] as StandingsSort[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSort(s); setSortDropdownOpen(false); }}
                      className={`block w-full text-left px-3 py-2 text-xs font-bold transition-colors ${
                        sort === s ? 'text-[#FF5722] bg-[rgba(255,87,34,0.08)]' : 'text-[#9BA3AE] hover:text-[#E8E6E1] hover:bg-[rgba(255,255,255,0.05)]'
                      }`}
                      style={{ fontFamily: "'Space Mono', monospace", textTransform: 'uppercase' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ─── Grid Table ─────────────────────────────────────── */}
        {hasRounds && (
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" style={{ tableLayout: 'auto' }}>
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.05)]">
                    <th className="sticky left-0 bg-[#111827] z-10 text-left px-3 py-2.5 label whitespace-nowrap min-w-[140px]">
                      Entry
                    </th>
                    {leaderboard.rounds_played.map((round) => {
                      const label = buildRoundLabel(round.name);
                      const isCurrentRound = leaderboard.current_round?.id === round.id;
                      return (
                        <th
                          key={round.id}
                          className={`px-1.5 py-2 text-center whitespace-nowrap min-w-[56px] ${isCurrentRound ? 'border-b-2 border-[#FF5722]' : ''}`}
                        >
                          <div
                            className={`text-[10px] font-bold ${isCurrentRound ? 'text-[#FF5722]' : 'text-[#5F6B7A]'}`}
                            style={{ fontFamily: "'Space Mono', monospace" }}
                          >
                            {label}
                          </div>
                          <div className="text-[9px] text-[#5F6B7A] mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                            {formatDateET(round.date)}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* Alive section header */}
                  {filter === 'all' && alivePlayers.length > 0 && (
                    <tr>
                      <td colSpan={leaderboard.rounds_played.length + 1} className="px-3 py-2 bg-[#0D1B2A] border-b border-[rgba(255,255,255,0.05)]">
                        <span className="label">
                          ALIVE <span className="text-[#9BA3AE] font-normal" style={{ fontFamily: "'DM Sans', sans-serif", textTransform: 'none' }}>&middot; {alivePlayers.length} remaining</span>
                        </span>
                      </td>
                    </tr>
                  )}
                  {alivePlayers.map((player, index) => {
                    const isYou = user?.id === player.user_id;
                    return (
                      <tr
                        key={player.pool_player_id}
                        className={`border-b border-[rgba(255,255,255,0.05)] ${
                          isYou ? 'bg-[rgba(255,87,34,0.05)]' : index % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0D1B2A]'
                        }`}
                      >
                        <td className="sticky left-0 bg-inherit z-10 px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[#4CAF50]" />
                            <div style={{ maxWidth: '120px' }}>
                              <p className="text-xs font-bold text-[#E8E6E1] leading-tight truncate" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                                {player.entry_label}
                                {isYou && <span className="text-[#FF5722] text-[9px] ml-1" style={{ fontFamily: "'Space Mono', monospace" }}>YOU</span>}
                              </p>
                              <p className="text-[10px] text-[#5F6B7A] leading-tight truncate" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                {player.display_name}
                              </p>
                            </div>
                          </div>
                        </td>
                        {leaderboard.rounds_played.map((round) => {
                          const result = player.round_results.find((r) => r.round_id === round.id);
                          const deadlinePassed = isPickVisible(round, isYou, clockOffset);
                          return (
                            <td key={round.id} className="px-1 py-1.5 text-center">
                              <PickCell result={result} deadlinePassed={deadlinePassed} />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {/* Eliminated section header */}
                  {filter === 'all' && eliminatedPlayers.length > 0 && (
                    <tr>
                      <td colSpan={leaderboard.rounds_played.length + 1} className="px-3 py-2 bg-[#0D1B2A] border-b border-[rgba(255,255,255,0.05)]">
                        <span className="label">
                          ELIMINATED <span className="text-[#9BA3AE] font-normal" style={{ fontFamily: "'DM Sans', sans-serif", textTransform: 'none' }}>&middot; {eliminatedPlayers.length}</span>
                        </span>
                      </td>
                    </tr>
                  )}
                  {eliminatedPlayers.map((player, index) => {
                    const isYou = user?.id === player.user_id;
                    return (
                      <tr
                        key={player.pool_player_id}
                        className={`border-b border-[rgba(255,255,255,0.05)] opacity-[0.45] ${
                          isYou ? 'bg-[rgba(255,87,34,0.05)]' : index % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0D1B2A]'
                        }`}
                      >
                        <td className="sticky left-0 bg-inherit z-10 px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[#EF5350]" />
                            <div style={{ maxWidth: '120px' }}>
                              <p className="text-xs font-bold text-[#9BA3AE] leading-tight truncate" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                                {player.entry_label}
                                {isYou && <span className="text-[#FF5722] text-[9px] ml-1" style={{ fontFamily: "'Space Mono', monospace" }}>YOU</span>}
                              </p>
                              <p className="text-[10px] text-[#5F6B7A] leading-tight truncate" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                {player.display_name}
                              </p>
                            </div>
                          </div>
                        </td>
                        {leaderboard.rounds_played.map((round) => {
                          const result = player.round_results.find((r) => r.round_id === round.id);
                          const deadlinePassed = isPickVisible(round, isYou, clockOffset);
                          return (
                            <td key={round.id} className="px-1 py-1.5 text-center">
                              <PickCell result={result} deadlinePassed={deadlinePassed} />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No rounds yet */}
        {!hasRounds && (
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-8 text-center">
            <p className="text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              No rounds have been played yet. The grid will populate once picks are made.
            </p>
          </div>
        )}

        {/* Current round info */}
        {leaderboard.current_round && (
          <div className="mt-4 text-center">
            <p className="text-xs text-[#5F6B7A]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Current: <span className="text-[#9BA3AE] font-semibold">{leaderboard.current_round.name}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

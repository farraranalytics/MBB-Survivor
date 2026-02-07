'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { getPoolLeaderboard } from '@/lib/standings';
import {
  PoolLeaderboard,
  StandingsPlayer,
  StandingsFilter,
  RoundResult,
} from '@/types/standings';
import { formatDateET } from '@/lib/timezone';

// ─── Helper: has deadline passed? ────────────────────────────────

function isDeadlinePassed(deadlineDatetime: string): boolean {
  return new Date(deadlineDatetime) < new Date();
}

// ─── Grid Cell — Team Abbreviation with Result Background ────────

function GridCell({
  result,
  deadlinePassed,
}: {
  result: RoundResult | undefined;
  deadlinePassed: boolean;
}) {
  // Deadline hasn't passed — hide the pick
  if (!deadlinePassed) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[rgba(255,255,255,0.05)] text-[#5F6B7A]">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </span>
    );
  }

  // No pick for this round
  if (!result) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[rgba(255,255,255,0.03)] text-[#5F6B7A] text-[10px]">
        —
      </span>
    );
  }

  // Determine background color based on result
  let bgClass = 'bg-[rgba(27,58,92,0.3)] text-[#E8E6E1]'; // default: scheduled/pending
  if (result.is_correct === true) {
    bgClass = 'bg-[rgba(76,175,80,0.2)] text-[#4CAF50]';
  } else if (result.is_correct === false) {
    bgClass = 'bg-[rgba(239,83,80,0.2)] text-[#EF5350] opacity-60';
  } else if (result.is_correct === null && result.game_status === 'in_progress') {
    bgClass = 'bg-[rgba(255,179,0,0.15)] text-[#FFB300] animate-pulse';
  }

  return (
    <span
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold ${bgClass}`}
      title={`(${result.team_seed}) ${result.team_name}`}
      style={{ fontFamily: "'Space Mono', monospace", fontSize: '9px', letterSpacing: '-0.02em' }}
    >
      {result.team_abbreviation}
    </span>
  );
}

// ─── Expanded Player Row ─────────────────────────────────────────

function PlayerPickHistory({
  player,
  roundsPlayed,
}: {
  player: StandingsPlayer;
  roundsPlayed: PoolLeaderboard['rounds_played'];
}) {
  if (player.round_results.length === 0) {
    return (
      <div className="px-4 py-3 bg-[#0D1B2A] text-sm text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        No picks yet
      </div>
    );
  }

  // Only show picks for rounds where deadline has passed
  const visibleResults = player.round_results.filter((result) => {
    const round = roundsPlayed.find((r) => r.id === result.round_id);
    return round ? isDeadlinePassed(round.deadline_datetime) : false;
  });

  if (visibleResults.length === 0) {
    return (
      <div className="px-4 py-3 bg-[#0D1B2A] text-sm text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        Picks hidden until deadline passes
      </div>
    );
  }

  return (
    <div className="bg-[#0D1B2A] border-t border-[rgba(255,255,255,0.05)]">
      <div className="px-4 py-3 space-y-2">
        <p className="label">Pick History</p>
        {visibleResults.map((result) => (
          <div
            key={result.round_id}
            className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.05)] last:border-0"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <GridCell result={result} deadlinePassed={true} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#E8E6E1] truncate" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                  ({result.team_seed}) {result.team_name}
                </p>
                <p className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {result.round_name}
                  {result.opponent_name && (
                    <> vs ({result.opponent_seed}) {result.opponent_name}</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 ml-2 text-right">
              {result.game_score && (
                <p className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'Space Mono', monospace" }}>{result.game_score}</p>
              )}
              {result.is_correct === null && result.game_status === 'scheduled' && (
                <p className="text-xs text-[#1B3A5C]" style={{ fontFamily: "'Space Mono', monospace" }}>Pending</p>
              )}
              {result.game_status === 'in_progress' && (
                <p className="text-xs text-[#FFB300] font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>LIVE</p>
              )}
            </div>
          </div>
        ))}

        {player.teams_used.length > 0 && (
          <div className="pt-2">
            <p className="text-[10px] text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Teams used: {player.teams_used.join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section Header ──────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="px-4 py-2 bg-[#0D1B2A] border-b border-[rgba(255,255,255,0.05)]">
      <span className="label">
        {label} <span className="text-[#9BA3AE] font-normal" style={{ fontFamily: "'DM Sans', sans-serif", textTransform: 'none' }}>&middot; {count} {label === 'ALIVE' ? 'remaining' : ''}</span>
      </span>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function StandingsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const poolId = params.id as string;

  const [leaderboard, setLeaderboard] = useState<PoolLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StandingsFilter>('all');
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [showRoundGrid, setShowRoundGrid] = useState(false);

  useEffect(() => {
    if (!user || !poolId) return;

    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const data = await getPoolLeaderboard(poolId);
        setLeaderboard(data);
      } catch (err) {
        console.error('Failed to fetch standings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load standings');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, [user, poolId]);

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

  const filteredPlayers = leaderboard.players.filter((p) => {
    if (filter === 'alive') return !p.is_eliminated;
    if (filter === 'eliminated') return p.is_eliminated;
    return true;
  });

  const alivePlayers = filteredPlayers.filter((p) => !p.is_eliminated);
  const eliminatedPlayers = filteredPlayers.filter((p) => p.is_eliminated);
  const hasRounds = leaderboard.rounds_played.length > 0;

  // Detect which user_ids have multiple entries (for showing entry_label)
  const multiEntryUsers = new Set<string>();
  const userIdCounts = new Map<string, number>();
  for (const p of leaderboard.players) {
    userIdCounts.set(p.user_id, (userIdCounts.get(p.user_id) || 0) + 1);
  }
  for (const [uid, count] of userIdCounts) {
    if (count > 1) multiEntryUsers.add(uid);
  }

  // Format round date for tooltip: "Round of 64 · Mar 20"
  function roundTooltip(round: PoolLeaderboard['rounds_played'][number]) {
    return `${round.name} · ${formatDateET(round.date)}`;
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-24">
      <div className="max-w-4xl mx-auto px-5 py-4 sm:py-6">
        {/* Pool Summary */}
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-5 mb-4">
          <h2 className="text-base font-bold text-[#E8E6E1] mb-3" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>The Field &mdash; {leaderboard.pool_name}</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-[rgba(76,175,80,0.1)] rounded-[8px] p-2.5">
              <p className="text-xl font-bold text-[#4CAF50]" style={{ fontFamily: "'Space Mono', monospace" }}>{leaderboard.alive_players}</p>
              <p className="label" style={{ color: 'rgba(76,175,80,0.7)' }}>Alive</p>
            </div>
            <div className="bg-[rgba(239,83,80,0.1)] rounded-[8px] p-2.5">
              <p className="text-xl font-bold text-[#EF5350]" style={{ fontFamily: "'Space Mono', monospace" }}>{leaderboard.eliminated_players}</p>
              <p className="label" style={{ color: 'rgba(239,83,80,0.7)' }}>Out</p>
            </div>
            <div className="bg-[#1B2A3D] rounded-[8px] p-2.5">
              <p className="text-xl font-bold text-[#E8E6E1]" style={{ fontFamily: "'Space Mono', monospace" }}>{leaderboard.total_players}</p>
              <p className="label" style={{ color: '#9BA3AE' }}>Total</p>
            </div>
          </div>
          {leaderboard.current_round && (
            <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.05)]">
              <p className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Current: <span className="font-semibold text-[#E8E6E1]">{leaderboard.current_round.name}</span>
              </p>
            </div>
          )}
        </div>

        {/* Filter & View Toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex space-x-1 bg-[#111827] rounded-[12px] p-1">
            {(['all', 'alive', 'eliminated'] as StandingsFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors ${
                  filter === f
                    ? 'bg-[#1B2A3D] text-[#E8E6E1] shadow-sm'
                    : 'text-[#9BA3AE] hover:text-[#E8E6E1]'
                }`}
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {f === 'all' && `All (${leaderboard.total_players})`}
                {f === 'alive' && `Alive (${leaderboard.alive_players})`}
                {f === 'eliminated' && `Out (${leaderboard.eliminated_players})`}
              </button>
            ))}
          </div>

          {hasRounds && (
            <button
              onClick={() => setShowRoundGrid(!showRoundGrid)}
              className={`text-xs px-3 py-1.5 rounded-[8px] border transition-colors ${
                showRoundGrid
                  ? 'bg-[rgba(255,87,34,0.1)] border-[rgba(255,87,34,0.3)] text-[#FF5722]'
                  : 'bg-[#111827] border-[rgba(255,255,255,0.05)] text-[#9BA3AE]'
              }`}
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {showRoundGrid ? 'List' : 'Grid'}
            </button>
          )}
        </div>

        {/* Grid View */}
        {showRoundGrid && hasRounds && (
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px] mb-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table style={{ tableLayout: 'auto' }}>
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.05)]">
                    <th className="sticky left-0 bg-[#111827] z-10 text-left px-3 py-2.5 label whitespace-nowrap">
                      Player
                    </th>
                    {leaderboard.rounds_played.map((round, i) => (
                      <th
                        key={round.id}
                        className="px-1.5 py-2.5 text-center whitespace-nowrap label"
                        title={roundTooltip(round)}
                      >
                        R{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Alive section header in grid */}
                  {filter === 'all' && alivePlayers.length > 0 && (
                    <tr>
                      <td colSpan={leaderboard.rounds_played.length + 1} className="px-4 py-2 bg-[#0D1B2A] border-b border-[rgba(255,255,255,0.05)]">
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
                            <div style={{ maxWidth: '140px' }}>
                              <p className="text-xs font-bold text-[#E8E6E1] leading-tight" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                {player.entry_label}
                                {isYou && <span className="text-[#FF5722] text-[9px] ml-1" style={{ fontFamily: "'Space Mono', monospace" }}>YOU</span>}
                              </p>
                              <p className="text-[10px] text-[#5F6B7A] leading-tight" style={{ fontFamily: "'DM Sans', sans-serif", whiteSpace: 'normal' }}>
                                {player.display_name}
                              </p>
                            </div>
                          </div>
                        </td>
                        {leaderboard.rounds_played.map((round) => {
                          const result = player.round_results.find((r) => r.round_id === round.id);
                          const deadlinePassed = isDeadlinePassed(round.deadline_datetime);
                          return (
                            <td key={round.id} className="px-1.5 py-2 text-center">
                              <GridCell result={result} deadlinePassed={deadlinePassed} />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {/* Eliminated section header in grid */}
                  {filter === 'all' && eliminatedPlayers.length > 0 && (
                    <tr>
                      <td colSpan={leaderboard.rounds_played.length + 1} className="px-4 py-2 bg-[#0D1B2A] border-b border-[rgba(255,255,255,0.05)]">
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
                            <div style={{ maxWidth: '140px' }}>
                              <p className="text-xs font-bold strikethrough text-[#9BA3AE] leading-tight" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                {player.entry_label}
                                {isYou && <span className="text-[#FF5722] text-[9px] ml-1" style={{ fontFamily: "'Space Mono', monospace" }}>YOU</span>}
                              </p>
                              <p className="text-[10px] text-[#5F6B7A] leading-tight" style={{ fontFamily: "'DM Sans', sans-serif", whiteSpace: 'normal' }}>
                                {player.display_name}
                              </p>
                            </div>
                          </div>
                        </td>
                        {leaderboard.rounds_played.map((round) => {
                          const result = player.round_results.find((r) => r.round_id === round.id);
                          const deadlinePassed = isDeadlinePassed(round.deadline_datetime);
                          return (
                            <td key={round.id} className="px-1.5 py-2 text-center">
                              <GridCell result={result} deadlinePassed={deadlinePassed} />
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

        {/* List View */}
        {!showRoundGrid && (
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[14px] overflow-hidden">
            {filteredPlayers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>No players match this filter.</p>
              </div>
            ) : (
              <div>
                {/* Alive section */}
                {alivePlayers.length > 0 && (filter === 'all' || filter === 'alive') && (
                  <>
                    {filter === 'all' && <SectionHeader label="ALIVE" count={alivePlayers.length} />}
                    {alivePlayers.map((player, index) => {
                      const isYou = user?.id === player.user_id;
                      const isExpanded = expandedPlayer === player.pool_player_id;

                      // Only show current round pick if deadline passed
                      const currentRoundDeadlinePassed = leaderboard.current_round
                        ? isDeadlinePassed(leaderboard.current_round.deadline_datetime)
                        : false;

                      return (
                        <div key={player.pool_player_id}>
                          <button
                            onClick={() => setExpandedPlayer(isExpanded ? null : player.pool_player_id)}
                            className={`w-full text-left px-4 py-3.5 flex items-center gap-4 transition-colors hover:bg-[#1B2A3D] ${
                              isYou ? 'bg-[rgba(255,87,34,0.05)] border-l-[3px] border-l-[#FF5722]' : ''
                            } ${index > 0 || filter === 'all' ? 'border-t border-[rgba(255,255,255,0.05)]' : ''}`}
                          >
                            {/* Avatar circle */}
                            <span
                              className="flex-shrink-0 w-9 h-9 rounded-full bg-[#243447] flex items-center justify-center text-[#E8E6E1]"
                              style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: '0.85rem' }}
                            >
                              {player.display_name.charAt(0).toUpperCase()}
                            </span>

                            {/* Player info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold truncate text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                                  {player.display_name} <span className="text-[#9BA3AE] font-normal text-xs" style={{ fontFamily: "'DM Sans', sans-serif", textTransform: 'none' }}>&mdash; {player.entry_label}</span>
                                </p>
                                {isYou && (
                                  <span className="flex-shrink-0 text-[#FF5722] font-bold" style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                                    YOU
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full font-bold bg-[rgba(76,175,80,0.12)] text-[#4CAF50]"
                                  style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}
                                >
                                  ALIVE
                                </span>
                                <span className="text-[11px] text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                  Survived {player.correct_picks} round{player.correct_picks !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>

                            {/* Right side — today's pick (only if deadline passed) + chevron */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {currentRoundDeadlinePassed && player.current_round_pick && (
                                <div className="text-right hidden sm:block">
                                  <p className="text-xs font-semibold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                                    {player.current_round_pick.team_name}
                                  </p>
                                  <p className="text-[#5F6B7A]" style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>TODAY</p>
                                </div>
                              )}

                              <svg
                                className={`w-4 h-4 text-[#5F6B7A] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </button>

                          {isExpanded && <PlayerPickHistory player={player} roundsPlayed={leaderboard.rounds_played} />}
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Eliminated section */}
                {eliminatedPlayers.length > 0 && (filter === 'all' || filter === 'eliminated') && (
                  <>
                    {filter === 'all' && <SectionHeader label="ELIMINATED" count={eliminatedPlayers.length} />}
                    {eliminatedPlayers.map((player, index) => {
                      const isYou = user?.id === player.user_id;
                      const isExpanded = expandedPlayer === player.pool_player_id;

                      const eliminationText = player.elimination_round_name
                        ? `Eliminated in ${player.elimination_round_name}`
                        : 'Eliminated';

                      return (
                        <div key={player.pool_player_id} className="opacity-[0.45]">
                          <button
                            onClick={() => setExpandedPlayer(isExpanded ? null : player.pool_player_id)}
                            className={`w-full text-left px-4 py-3.5 flex items-center gap-4 transition-colors hover:bg-[#1B2A3D] ${
                              isYou ? 'bg-[rgba(255,87,34,0.05)] border-l-[3px] border-l-[#FF5722]' : ''
                            } ${index > 0 || filter === 'all' ? 'border-t border-[rgba(255,255,255,0.05)]' : ''}`}
                          >
                            {/* Avatar circle */}
                            <span
                              className="flex-shrink-0 w-9 h-9 rounded-full bg-[#243447] flex items-center justify-center text-[#9BA3AE]"
                              style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: '0.85rem' }}
                            >
                              {player.display_name.charAt(0).toUpperCase()}
                            </span>

                            {/* Player info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold truncate strikethrough text-[#9BA3AE]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                                  {player.display_name} <span className="font-normal text-xs" style={{ fontFamily: "'DM Sans', sans-serif", textTransform: 'none' }}>&mdash; {player.entry_label}</span>
                                </p>
                                {isYou && (
                                  <span className="flex-shrink-0 text-[#FF5722] font-bold" style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                                    YOU
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full font-bold bg-[rgba(239,83,80,0.12)] text-[#EF5350]"
                                  style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}
                                >
                                  OUT
                                </span>
                                <span className="text-[11px] text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                  {eliminationText}
                                </span>
                              </div>
                            </div>

                            {/* Right side — chevron only */}
                            <div className="flex items-center flex-shrink-0">
                              <svg
                                className={`w-4 h-4 text-[#5F6B7A] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </button>

                          {isExpanded && <PlayerPickHistory player={player} roundsPlayed={leaderboard.rounds_played} />}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-4">
          <p className="label mb-3">Legend</p>
          <div className="flex flex-wrap gap-4 text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[rgba(76,175,80,0.2)] text-[#4CAF50]">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
              </span>
              <span>Win</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[rgba(239,83,80,0.2)] text-[#EF5350] opacity-60">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </span>
              <span>Loss</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[rgba(255,179,0,0.15)] text-[#FFB300]" />
              <span>Live</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[rgba(27,58,92,0.3)]" />
              <span>Pending</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[rgba(255,255,255,0.05)] text-[#5F6B7A]">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </span>
              <span>Hidden</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[rgba(255,255,255,0.03)] text-[#5F6B7A] text-[10px]">—</span>
              <span>No Pick</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

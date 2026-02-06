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

// ─── Result Badge ─────────────────────────────────────────────────

function ResultBadge({ result }: { result: RoundResult | undefined }) {
  if (!result) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.05)] text-[#8A8694] text-xs">
        —
      </span>
    );
  }

  if (result.is_correct === null) {
    if (result.game_status === 'in_progress') {
      return (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[rgba(255,179,0,0.15)] text-[#FFB300] text-xs font-bold animate-pulse" style={{ fontFamily: "'Space Mono', monospace" }}>
          LIVE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[rgba(27,58,92,0.3)] text-[#E8E6E1] text-xs font-bold" title={result.team_name} style={{ fontFamily: "'Space Mono', monospace" }}>
        {result.team_seed}
      </span>
    );
  }

  if (result.is_correct) {
    return (
      <span
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[rgba(76,175,80,0.15)] text-[#4CAF50]"
        title={`${result.team_name} W`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[rgba(239,83,80,0.15)] text-[#EF5350]"
      title={`${result.team_name} L`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
    </span>
  );
}

// ─── Expanded Player Row ──────────────────────────────────────────

function PlayerPickHistory({ player }: { player: StandingsPlayer }) {
  if (player.round_results.length === 0) {
    return (
      <div className="px-4 py-3 bg-[#0D1B2A] text-sm text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        No picks yet
      </div>
    );
  }

  return (
    <div className="bg-[#0D1B2A] border-t border-[rgba(255,255,255,0.05)]">
      <div className="px-4 py-3 space-y-2">
        <p className="label">Pick History</p>
        {player.round_results.map((result) => (
          <div
            key={result.round_id}
            className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.05)] last:border-0"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <ResultBadge result={result} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#E8E6E1] truncate" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                  ({result.team_seed}) {result.team_name}
                </p>
                <p className="text-xs text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {result.round_name}
                  {result.opponent_name && (
                    <> vs ({result.opponent_seed}) {result.opponent_name}</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 ml-2 text-right">
              {result.game_score && (
                <p className="text-xs text-[#8A8694]" style={{ fontFamily: "'Space Mono', monospace" }}>{result.game_score}</p>
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
            <p className="text-[10px] text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Teams used: {player.teams_used.join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Standings Page ──────────────────────────────────────────

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
          <p className="text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Loading standings...</p>
        </div>
      </div>
    );
  }

  if (error || !leaderboard) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold text-[#E8E6E1] mb-2" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Error</h1>
          <p className="text-[#8A8694] mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>{error || 'Failed to load standings'}</p>
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

  const hasRounds = leaderboard.rounds_played.length > 0;

  return (
    <div className="min-h-screen bg-[#0D1B2A]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-[#111118] border-b border-[rgba(255,255,255,0.05)]">
        <div className="max-w-4xl mx-auto px-5 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push(`/pools/${poolId}`)}
              className="text-[#8A8694] hover:text-[#E8E6E1] text-sm font-medium transition-colors"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              Pool
            </button>
            <h1 className="text-lg font-bold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Standings</h1>
            <div className="w-12" />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-4 sm:py-6">
        {/* Pool Summary */}
        <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-5 mb-4">
          <h2 className="text-base font-bold text-[#E8E6E1] mb-3" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>{leaderboard.pool_name}</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-[rgba(76,175,80,0.1)] rounded-[8px] p-2.5">
              <p className="text-xl font-bold text-[#4CAF50]" style={{ fontFamily: "'Space Mono', monospace" }}>{leaderboard.alive_players}</p>
              <p className="label" style={{ color: 'rgba(76,175,80,0.7)' }}>Alive</p>
            </div>
            <div className="bg-[rgba(239,83,80,0.1)] rounded-[8px] p-2.5">
              <p className="text-xl font-bold text-[#EF5350]" style={{ fontFamily: "'Space Mono', monospace" }}>{leaderboard.eliminated_players}</p>
              <p className="label" style={{ color: 'rgba(239,83,80,0.7)' }}>Out</p>
            </div>
            <div className="bg-[#1A1A24] rounded-[8px] p-2.5">
              <p className="text-xl font-bold text-[#E8E6E1]" style={{ fontFamily: "'Space Mono', monospace" }}>{leaderboard.total_players}</p>
              <p className="label" style={{ color: '#8A8694' }}>Total</p>
            </div>
          </div>
          {leaderboard.current_round && (
            <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.05)]">
              <p className="text-xs text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Current: <span className="font-semibold text-[#E8E6E1]">{leaderboard.current_round.name}</span>
              </p>
            </div>
          )}
        </div>

        {/* Filter & View Toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex space-x-1 bg-[#111118] rounded-[12px] p-1">
            {(['all', 'alive', 'eliminated'] as StandingsFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors ${
                  filter === f
                    ? 'bg-[#1A1A24] text-[#E8E6E1] shadow-sm'
                    : 'text-[#8A8694] hover:text-[#E8E6E1]'
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
                  : 'bg-[#111118] border-[rgba(255,255,255,0.05)] text-[#8A8694]'
              }`}
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {showRoundGrid ? 'List' : 'Grid'}
            </button>
          )}
        </div>

        {/* Grid View */}
        {showRoundGrid && hasRounds && (
          <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] mb-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.05)]">
                    <th className="sticky left-0 bg-[#111118] z-10 text-left px-4 py-3 label">
                      Player
                    </th>
                    {leaderboard.rounds_played.map((round) => (
                      <th
                        key={round.id}
                        className="px-2 py-3 text-center whitespace-nowrap label"
                        title={round.name}
                      >
                        {round.name.length > 8
                          ? round.name.replace('Round', 'Rd').replace('First', '1st').replace('Second', '2nd')
                          : round.name}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center label" style={{ color: '#FF5722' }}>
                      Streak
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map((player, index) => {
                    const isYou = user?.id === player.user_id;
                    return (
                      <tr
                        key={player.pool_player_id}
                        className={`border-b border-[rgba(255,255,255,0.05)] ${
                          isYou ? 'bg-[rgba(255,87,34,0.05)]' : index % 2 === 0 ? 'bg-[#111118]' : 'bg-[#0D1B2A]'
                        }`}
                      >
                        <td className="sticky left-0 bg-inherit z-10 px-4 py-2.5">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-[#8A8694] w-5 font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className={`text-xs font-semibold truncate max-w-[120px] ${player.is_eliminated ? 'strikethrough text-[#8A8694]' : 'text-[#E8E6E1]'}`} style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                                {player.display_name}
                                {isYou && <span className="text-[#FF5722] text-[10px] ml-1" style={{ fontFamily: "'Space Mono', monospace" }}>YOU</span>}
                              </p>
                              <span
                                className={`inline-block w-2 h-2 rounded-full ${
                                  player.is_eliminated ? 'bg-[#EF5350]' : 'bg-[#4CAF50]'
                                }`}
                              />
                            </div>
                          </div>
                        </td>
                        {leaderboard.rounds_played.map((round) => {
                          const result = player.round_results.find(
                            (r) => r.round_id === round.id
                          );
                          return (
                            <td key={round.id} className="px-2 py-2.5 text-center">
                              <ResultBadge result={result} />
                            </td>
                          );
                        })}
                        <td className="px-3 py-2.5 text-center">
                          {player.survival_streak > 0 && (
                            <span className="text-sm font-bold text-[#FF5722]" style={{ fontFamily: "'Space Mono', monospace" }}>
                              {player.survival_streak}
                            </span>
                          )}
                        </td>
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
          <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] overflow-hidden">
            {filteredPlayers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>No players match this filter.</p>
              </div>
            ) : (
              <div>
                {filteredPlayers.map((player, index) => {
                  const isYou = user?.id === player.user_id;
                  const isExpanded = expandedPlayer === player.pool_player_id;

                  return (
                    <div key={player.pool_player_id}>
                      <button
                        onClick={() =>
                          setExpandedPlayer(isExpanded ? null : player.pool_player_id)
                        }
                        className={`w-full text-left px-4 py-3.5 flex items-center justify-between transition-colors hover:bg-[#1A1A24] ${
                          isYou ? 'bg-[rgba(255,87,34,0.05)]' : ''
                        } ${index > 0 ? 'border-t border-[rgba(255,255,255,0.05)]' : ''}`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <span className="text-xs font-bold text-[#8A8694] w-6 text-right flex-shrink-0" style={{ fontFamily: "'Space Mono', monospace" }}>
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <p className={`text-sm font-semibold truncate ${player.is_eliminated ? 'strikethrough text-[#8A8694]' : 'text-[#E8E6E1]'}`} style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                                {player.display_name}
                              </p>
                              {isYou && (
                                <span className="flex-shrink-0 text-[#FF5722] font-bold" style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold ${
                                  player.is_eliminated
                                    ? 'bg-[rgba(239,83,80,0.15)] text-[#EF5350]'
                                    : 'bg-[rgba(76,175,80,0.15)] text-[#4CAF50]'
                                }`}
                                style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}
                              >
                                {player.is_eliminated ? 'OUT' : 'ALIVE'}
                              </span>
                              <span className="text-[11px] text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                {player.picks_count} pick{player.picks_count !== 1 ? 's' : ''}
                              </span>
                              {player.correct_picks > 0 && (
                                <span className="text-[11px] text-[#4CAF50]" style={{ fontFamily: "'Space Mono', monospace" }}>
                                  {player.correct_picks} W
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 flex-shrink-0">
                          {player.survival_streak > 0 && (
                            <div className="text-right">
                              <p className="text-sm font-bold text-[#FF5722]" style={{ fontFamily: "'Space Mono', monospace" }}>
                                {player.survival_streak}
                              </p>
                              <p className="text-[#8A8694]" style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>STREAK</p>
                            </div>
                          )}

                          {player.current_round_pick && (
                            <div className="text-right hidden sm:block">
                              <p className="text-xs font-semibold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                                {player.current_round_pick.team_name}
                              </p>
                              <p className="text-[#8A8694]" style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>TODAY</p>
                            </div>
                          )}

                          <svg
                            className={`w-4 h-4 text-[#8A8694] transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {isExpanded && <PlayerPickHistory player={player} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-4">
          <p className="label mb-3">Legend</p>
          <div className="flex flex-wrap gap-4 text-xs text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[rgba(76,175,80,0.15)] text-[#4CAF50] text-[10px]">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
              </span>
              <span>Correct</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[rgba(239,83,80,0.15)] text-[#EF5350] text-[10px]">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </span>
              <span>Wrong</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[rgba(27,58,92,0.3)] text-[#E8E6E1] text-[10px] font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>
                4
              </span>
              <span>Pending</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[rgba(255,179,0,0.15)] text-[#FFB300] text-[10px] font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>
                LIVE
              </span>
              <span>In Progress</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[rgba(255,255,255,0.05)] text-[#8A8694] text-[10px]">
                —
              </span>
              <span>No Pick</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[#FF5722] font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>3</span>
              <span>Streak</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

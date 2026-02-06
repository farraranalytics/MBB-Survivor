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
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-gray-400 text-xs">
        —
      </span>
    );
  }

  if (result.is_correct === null) {
    // Pending
    if (result.game_status === 'in_progress') {
      return (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-yellow-100 text-yellow-700 text-xs font-bold animate-pulse">
          🏀
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold" title={result.team_name}>
        {result.team_seed}
      </span>
    );
  }

  if (result.is_correct) {
    return (
      <span
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-100 text-green-700 text-xs font-bold"
        title={`${result.team_name} ✓`}
      >
        ✅
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 text-red-700 text-xs font-bold"
      title={`${result.team_name} ✗`}
    >
      ❌
    </span>
  );
}

// ─── Expanded Player Row ──────────────────────────────────────────

function PlayerPickHistory({ player }: { player: StandingsPlayer }) {
  if (player.round_results.length === 0) {
    return (
      <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500">
        No picks yet
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border-t border-gray-100">
      <div className="px-4 py-3 space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Pick History
        </p>
        {player.round_results.map((result) => (
          <div
            key={result.round_id}
            className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <ResultBadge result={result} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  ({result.team_seed}) {result.team_name}
                </p>
                <p className="text-xs text-gray-500">
                  {result.round_name}
                  {result.opponent_name && (
                    <> vs ({result.opponent_seed}) {result.opponent_name}</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 ml-2 text-right">
              {result.game_score && (
                <p className="text-xs text-gray-500">{result.game_score}</p>
              )}
              {result.is_correct === null && result.game_status === 'scheduled' && (
                <p className="text-xs text-blue-500">Pending</p>
              )}
              {result.game_status === 'in_progress' && (
                <p className="text-xs text-yellow-600 font-medium">Live</p>
              )}
            </div>
          </div>
        ))}

        {/* Teams used summary */}
        {player.teams_used.length > 0 && (
          <div className="pt-2">
            <p className="text-xs text-gray-400">
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
    // Refresh every 30 seconds for live updates
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, [user, poolId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading standings...</p>
        </div>
      </div>
    );
  }

  if (error || !leaderboard) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-4">{error || 'Failed to load standings'}</p>
          <button
            onClick={() => router.push(`/pools/${poolId}`)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Pool
          </button>
        </div>
      </div>
    );
  }

  // Apply filter
  const filteredPlayers = leaderboard.players.filter((p) => {
    if (filter === 'alive') return !p.is_eliminated;
    if (filter === 'eliminated') return p.is_eliminated;
    return true;
  });

  const hasRounds = leaderboard.rounds_played.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push(`/pools/${poolId}`)}
              className="text-gray-500 hover:text-gray-800 text-sm font-medium"
            >
              ← Pool
            </button>
            <h1 className="text-lg font-bold text-gray-900">Standings</h1>
            <div className="w-12" />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6">
        {/* Pool Summary Bar */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-3">{leaderboard.pool_name}</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-green-50 rounded-lg p-2">
              <p className="text-xl font-bold text-green-700">{leaderboard.alive_players}</p>
              <p className="text-xs text-green-600 font-medium">Alive</p>
            </div>
            <div className="bg-red-50 rounded-lg p-2">
              <p className="text-xl font-bold text-red-700">{leaderboard.eliminated_players}</p>
              <p className="text-xs text-red-600 font-medium">Eliminated</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xl font-bold text-gray-700">{leaderboard.total_players}</p>
              <p className="text-xs text-gray-500 font-medium">Total</p>
            </div>
          </div>
          {leaderboard.current_round && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-600">
                Current: <span className="font-medium text-gray-900">{leaderboard.current_round.name}</span>
              </p>
            </div>
          )}
        </div>

        {/* Filter & View Toggle */}
        <div className="flex items-center justify-between mb-4">
          {/* Filter pills */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {(['all', 'alive', 'eliminated'] as StandingsFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f === 'all' && `All (${leaderboard.total_players})`}
                {f === 'alive' && `Alive (${leaderboard.alive_players})`}
                {f === 'eliminated' && `Out (${leaderboard.eliminated_players})`}
              </button>
            ))}
          </div>

          {/* Grid toggle */}
          {hasRounds && (
            <button
              onClick={() => setShowRoundGrid(!showRoundGrid)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                showRoundGrid
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              {showRoundGrid ? 'List View' : 'Grid View'}
            </button>
          )}
        </div>

        {/* Round-by-Round Grid View */}
        {showRoundGrid && hasRounds && (
          <div className="bg-white rounded-xl shadow-sm mb-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="sticky left-0 bg-white z-10 text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Player
                    </th>
                    {leaderboard.rounds_played.map((round) => (
                      <th
                        key={round.id}
                        className="px-2 py-3 text-xs font-medium text-gray-500 text-center whitespace-nowrap"
                        title={round.name}
                      >
                        {round.name.length > 8
                          ? round.name.replace('Round', 'Rd').replace('First', '1st').replace('Second', '2nd')
                          : round.name}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-xs font-medium text-gray-500 text-center">
                      🔥
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map((player, index) => {
                    const isYou = user?.id === player.user_id;
                    return (
                      <tr
                        key={player.pool_player_id}
                        className={`border-b border-gray-50 ${
                          isYou ? 'bg-blue-50/50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                        }`}
                      >
                        <td className="sticky left-0 bg-inherit z-10 px-4 py-2.5">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-400 w-5">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                                {player.display_name}
                                {isYou && <span className="text-blue-600 text-xs ml-1">(You)</span>}
                              </p>
                              <span
                                className={`inline-block w-2 h-2 rounded-full ${
                                  player.is_eliminated ? 'bg-red-400' : 'bg-green-400'
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
                            <span className="text-sm font-medium text-orange-600">
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

        {/* List View (default) */}
        {!showRoundGrid && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {filteredPlayers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No players match this filter.</p>
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
                        className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors hover:bg-gray-50 ${
                          isYou ? 'bg-blue-50/60' : ''
                        } ${index > 0 ? 'border-t border-gray-100' : ''}`}
                      >
                        {/* Left: rank + name + status */}
                        <div className="flex items-center space-x-3 min-w-0">
                          <span className="text-sm font-medium text-gray-400 w-6 text-right flex-shrink-0">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {player.display_name}
                              </p>
                              {isYou && (
                                <span className="flex-shrink-0 text-xs text-blue-600 font-medium">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  player.is_eliminated
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-green-100 text-green-700'
                                }`}
                              >
                                {player.is_eliminated ? 'OUT' : 'ALIVE'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {player.picks_count} pick{player.picks_count !== 1 ? 's' : ''}
                              </span>
                              {player.correct_picks > 0 && (
                                <span className="text-xs text-green-600">
                                  {player.correct_picks} correct
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: streak + expand arrow */}
                        <div className="flex items-center space-x-3 flex-shrink-0">
                          {player.survival_streak > 0 && (
                            <div className="text-right">
                              <p className="text-sm font-bold text-orange-500">
                                🔥 {player.survival_streak}
                              </p>
                              <p className="text-[10px] text-gray-400">streak</p>
                            </div>
                          )}

                          {/* Current pick badge */}
                          {player.current_round_pick && (
                            <div className="text-right hidden sm:block">
                              <p className="text-xs font-medium text-gray-700">
                                {player.current_round_pick.team_name}
                              </p>
                              <p className="text-[10px] text-gray-400">today</p>
                            </div>
                          )}

                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </button>

                      {/* Expanded pick history */}
                      {isExpanded && <PlayerPickHistory player={player} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Legend
          </p>
          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-green-100 text-green-700 text-[10px]">
                ✅
              </span>
              <span>Correct</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-red-100 text-red-700 text-[10px]">
                ❌
              </span>
              <span>Wrong</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-50 text-blue-600 text-[10px] font-bold">
                4
              </span>
              <span>Pending (seed)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-yellow-100 text-yellow-700 text-[10px]">
                🏀
              </span>
              <span>In Progress</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-100 text-gray-400 text-[10px]">
                —
              </span>
              <span>No Pick</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-orange-500">🔥</span>
              <span>Survival Streak</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

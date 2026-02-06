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
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-dark-border/50 text-text-muted text-xs">
        —
      </span>
    );
  }

  if (result.is_correct === null) {
    if (result.game_status === 'in_progress') {
      return (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-warning/15 text-warning text-xs font-bold animate-pulse">
          LIVE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-electric/10 text-electric text-xs font-bold" title={result.team_name}>
        {result.team_seed}
      </span>
    );
  }

  if (result.is_correct) {
    return (
      <span
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-alive/15 text-alive text-xs font-bold"
        title={`${result.team_name} W`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-eliminated/15 text-eliminated text-xs font-bold"
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
      <div className="px-4 py-3 bg-dark-base text-sm text-text-muted">
        No picks yet
      </div>
    );
  }

  return (
    <div className="bg-dark-base border-t border-dark-border-subtle">
      <div className="px-4 py-3 space-y-2">
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
          Pick History
        </p>
        {player.round_results.map((result) => (
          <div
            key={result.round_id}
            className="flex items-center justify-between py-2 border-b border-dark-border-subtle last:border-0"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <ResultBadge result={result} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  ({result.team_seed}) {result.team_name}
                </p>
                <p className="text-xs text-text-muted">
                  {result.round_name}
                  {result.opponent_name && (
                    <> vs ({result.opponent_seed}) {result.opponent_name}</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 ml-2 text-right">
              {result.game_score && (
                <p className="text-xs text-text-muted font-mono">{result.game_score}</p>
              )}
              {result.is_correct === null && result.game_status === 'scheduled' && (
                <p className="text-xs text-electric">Pending</p>
              )}
              {result.game_status === 'in_progress' && (
                <p className="text-xs text-warning font-bold">LIVE</p>
              )}
            </div>
          </div>
        ))}

        {player.teams_used.length > 0 && (
          <div className="pt-2">
            <p className="text-[10px] text-text-faint">
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
      <div className="min-h-screen bg-dark-base flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-dark-border border-t-accent mx-auto mb-4" />
          <p className="text-text-muted">Loading standings...</p>
        </div>
      </div>
    );
  }

  if (error || !leaderboard) {
    return (
      <div className="min-h-screen bg-dark-base flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold text-white mb-2">Error</h1>
          <p className="text-text-secondary mb-4">{error || 'Failed to load standings'}</p>
          <button
            onClick={() => router.push(`/pools/${poolId}`)}
            className="btn-accent text-white px-6 py-3 rounded-xl font-semibold"
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
    <div className="min-h-screen bg-dark-base">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-dark-surface border-b border-dark-border">
        <div className="max-w-4xl mx-auto px-5 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push(`/pools/${poolId}`)}
              className="text-text-muted hover:text-text-secondary text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              Pool
            </button>
            <h1 className="text-lg font-bold text-white">Standings</h1>
            <div className="w-12" />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-4 sm:py-6">
        {/* Pool Summary */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 mb-4">
          <h2 className="text-base font-bold text-white mb-3">{leaderboard.pool_name}</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-alive/10 rounded-xl p-2.5">
              <p className="text-xl font-bold text-alive">{leaderboard.alive_players}</p>
              <p className="text-[10px] text-alive/70 font-bold uppercase tracking-wide">Alive</p>
            </div>
            <div className="bg-eliminated/10 rounded-xl p-2.5">
              <p className="text-xl font-bold text-eliminated">{leaderboard.eliminated_players}</p>
              <p className="text-[10px] text-eliminated/70 font-bold uppercase tracking-wide">Out</p>
            </div>
            <div className="bg-dark-surface rounded-xl p-2.5">
              <p className="text-xl font-bold text-white">{leaderboard.total_players}</p>
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-wide">Total</p>
            </div>
          </div>
          {leaderboard.current_round && (
            <div className="mt-3 pt-3 border-t border-dark-border-subtle">
              <p className="text-xs text-text-muted">
                Current: <span className="font-semibold text-white">{leaderboard.current_round.name}</span>
              </p>
            </div>
          )}
        </div>

        {/* Filter & View Toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex space-x-1 bg-dark-surface rounded-xl p-1">
            {(['all', 'alive', 'eliminated'] as StandingsFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filter === f
                    ? 'bg-dark-card text-white shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
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
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                showRoundGrid
                  ? 'bg-accent/10 border-accent/30 text-accent'
                  : 'bg-dark-card border-dark-border text-text-muted'
              }`}
            >
              {showRoundGrid ? 'List' : 'Grid'}
            </button>
          )}
        </div>

        {/* Grid View */}
        {showRoundGrid && hasRounds && (
          <div className="bg-dark-card border border-dark-border rounded-2xl mb-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-border">
                    <th className="sticky left-0 bg-dark-card z-10 text-left px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">
                      Player
                    </th>
                    {leaderboard.rounds_played.map((round) => (
                      <th
                        key={round.id}
                        className="px-2 py-3 text-[10px] font-bold text-text-muted text-center whitespace-nowrap uppercase tracking-wide"
                        title={round.name}
                      >
                        {round.name.length > 8
                          ? round.name.replace('Round', 'Rd').replace('First', '1st').replace('Second', '2nd')
                          : round.name}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-[10px] font-bold text-accent text-center uppercase tracking-wide">
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
                        className={`border-b border-dark-border-subtle ${
                          isYou ? 'bg-accent/5' : index % 2 === 0 ? 'bg-dark-card' : 'bg-dark-card-alt'
                        }`}
                      >
                        <td className="sticky left-0 bg-inherit z-10 px-4 py-2.5">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-text-muted w-5 font-bold">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate max-w-[120px]">
                                {player.display_name}
                                {isYou && <span className="text-accent text-[10px] ml-1">You</span>}
                              </p>
                              <span
                                className={`inline-block w-2 h-2 rounded-full ${
                                  player.is_eliminated ? 'bg-eliminated' : 'bg-alive'
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
                            <span className="text-sm font-bold text-accent">
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
          <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden">
            {filteredPlayers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-muted">No players match this filter.</p>
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
                        className={`w-full text-left px-4 py-3.5 flex items-center justify-between transition-colors hover:bg-dark-elevated ${
                          isYou ? 'bg-accent/5' : ''
                        } ${index > 0 ? 'border-t border-dark-border-subtle' : ''}`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <span className="text-xs font-bold text-text-muted w-6 text-right flex-shrink-0">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-semibold text-white truncate">
                                {player.display_name}
                              </p>
                              {isYou && (
                                <span className="flex-shrink-0 text-[10px] text-accent font-bold uppercase">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                  player.is_eliminated
                                    ? 'bg-eliminated/15 text-eliminated'
                                    : 'bg-alive/15 text-alive'
                                }`}
                              >
                                {player.is_eliminated ? 'OUT' : 'ALIVE'}
                              </span>
                              <span className="text-[11px] text-text-muted">
                                {player.picks_count} pick{player.picks_count !== 1 ? 's' : ''}
                              </span>
                              {player.correct_picks > 0 && (
                                <span className="text-[11px] text-alive">
                                  {player.correct_picks} W
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 flex-shrink-0">
                          {player.survival_streak > 0 && (
                            <div className="text-right">
                              <p className="text-sm font-bold text-accent">
                                {player.survival_streak}
                              </p>
                              <p className="text-[9px] text-text-muted uppercase">streak</p>
                            </div>
                          )}

                          {player.current_round_pick && (
                            <div className="text-right hidden sm:block">
                              <p className="text-xs font-semibold text-white">
                                {player.current_round_pick.team_name}
                              </p>
                              <p className="text-[9px] text-text-muted uppercase">today</p>
                            </div>
                          )}

                          <svg
                            className={`w-4 h-4 text-text-muted transition-transform ${
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
        <div className="mt-4 bg-dark-card border border-dark-border rounded-2xl p-4">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">
            Legend
          </p>
          <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-alive/15 text-alive text-[10px]">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
              </span>
              <span>Correct</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-eliminated/15 text-eliminated text-[10px]">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </span>
              <span>Wrong</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-electric/10 text-electric text-[10px] font-bold">
                4
              </span>
              <span>Pending</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-warning/15 text-warning text-[10px] font-bold">
                LIVE
              </span>
              <span>In Progress</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-dark-border/50 text-text-muted text-[10px]">
                —
              </span>
              <span>No Pick</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-accent font-bold">3</span>
              <span>Streak</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { getPoolStandings, getPickDeadline } from '@/lib/picks';
import { PoolStandings, PickDeadline } from '@/types/picks';

export default function PoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const poolId = params.id as string;

  const [standings, setStandings] = useState<PoolStandings | null>(null);
  const [deadline, setDeadline] = useState<PickDeadline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !poolId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const poolStandings = await getPoolStandings(poolId, user.id);
        setStandings(poolStandings);

        if (poolStandings.current_round) {
          const roundDeadline = await getPickDeadline(poolStandings.current_round.id);
          setDeadline(roundDeadline);
        }
      } catch (err) {
        console.error('Failed to fetch pool data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load pool');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [user, poolId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-base flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-dark-border border-t-accent" />
      </div>
    );
  }

  if (error || !standings) {
    return (
      <div className="min-h-screen bg-dark-base flex items-center justify-center">
        <div className="text-center px-5">
          <h1 className="text-2xl font-bold text-white mb-2">Pool Not Found</h1>
          <p className="text-text-secondary mb-6">
            {error || 'This pool does not exist or you don\u2019t have access.'}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="btn-accent text-white px-6 py-3 rounded-xl font-semibold"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { your_status: yourStatus } = standings;
  const canMakePick =
    yourStatus && !yourStatus.is_eliminated && standings.current_round && !deadline?.is_expired;
  const hasMadePick = yourStatus?.current_pick != null;

  const formatTimeRemaining = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const topPlayers = standings.players.slice(0, 5);

  // Deadline urgency color
  const getDeadlineColor = () => {
    if (!deadline || deadline.is_expired) return 'text-eliminated';
    if (deadline.minutes_remaining < 30) return 'text-eliminated';
    if (deadline.minutes_remaining < 120) return 'text-warning';
    return 'text-alive';
  };

  return (
    <div className="min-h-screen bg-dark-base">
      <div className="max-w-lg mx-auto px-5 py-6">
        {/* Header */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-white truncate mr-3">{standings.pool_name}</h1>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-text-muted hover:text-text-secondary text-sm flex-shrink-0 transition-colors"
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-alive/10 rounded-xl p-3">
              <p className="text-2xl font-bold text-alive">{standings.alive_players}</p>
              <p className="text-[11px] text-alive/70 font-medium uppercase tracking-wide">Alive</p>
            </div>
            <div className="bg-eliminated/10 rounded-xl p-3">
              <p className="text-2xl font-bold text-eliminated">{standings.eliminated_players}</p>
              <p className="text-[11px] text-eliminated/70 font-medium uppercase tracking-wide">Out</p>
            </div>
            <div className="bg-dark-surface rounded-xl p-3">
              <p className="text-2xl font-bold text-white">{standings.total_players}</p>
              <p className="text-[11px] text-text-muted font-medium uppercase tracking-wide">Total</p>
            </div>
          </div>
        </div>

        {/* Your Status & Pick Action */}
        {yourStatus && (
          <div className="bg-dark-card border border-dark-border rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide">Your Status</h2>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                  yourStatus.is_eliminated
                    ? 'bg-eliminated/15 text-eliminated'
                    : 'bg-alive/15 text-alive'
                }`}
              >
                {yourStatus.is_eliminated ? 'ELIMINATED' : 'ALIVE'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm text-text-secondary">
                    {yourStatus.picks_count} pick{yourStatus.picks_count !== 1 ? 's' : ''}
                  </span>
                  {yourStatus.survival_streak > 1 && (
                    <span className="text-sm text-accent font-bold">
                      {yourStatus.survival_streak} streak
                    </span>
                  )}
                </div>

                {yourStatus.is_eliminated && yourStatus.elimination_reason && (
                  <p className="text-sm text-eliminated">
                    {yourStatus.elimination_reason.replace('_', ' ')}
                  </p>
                )}

                {yourStatus.current_pick?.team && (
                  <p className="text-sm text-text-secondary">
                    Pick:{' '}
                    <span className="font-semibold text-white">
                      ({yourStatus.current_pick.team.seed}) {yourStatus.current_pick.team.name}
                    </span>
                  </p>
                )}
              </div>

              <div className="flex-shrink-0 ml-3">
                {canMakePick && !hasMadePick && (
                  <button
                    onClick={() => router.push(`/pools/${poolId}/pick`)}
                    className="btn-accent text-white px-5 py-3 rounded-xl font-bold text-sm shadow-lg shadow-accent-dim"
                  >
                    Make Pick
                  </button>
                )}

                {hasMadePick && !deadline?.is_expired && (
                  <button
                    onClick={() => router.push(`/pools/${poolId}/pick`)}
                    className="bg-warning/15 text-warning border border-warning/30 px-5 py-3 rounded-xl font-bold text-sm hover:bg-warning/25 transition-colors"
                  >
                    Change
                  </button>
                )}

                {hasMadePick && deadline?.is_expired && (
                  <span className="text-alive font-semibold text-sm">Locked</span>
                )}
              </div>
            </div>

            {/* Deadline */}
            {standings.current_round && deadline && (
              <div className="mt-4 p-4 bg-dark-surface border border-dark-border-subtle rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {standings.current_round.name}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {hasMadePick
                        ? deadline?.is_expired
                          ? 'Pick locked'
                          : 'Change before deadline'
                        : 'Pick needed'}
                    </p>
                  </div>
                  <div className="text-right">
                    {deadline.is_expired ? (
                      <p className="text-sm font-bold text-eliminated">Passed</p>
                    ) : (
                      <>
                        <p className={`text-lg font-mono font-bold ${getDeadlineColor()}`}>
                          {formatTimeRemaining(deadline.minutes_remaining)}
                        </p>
                        <p className="text-[10px] text-text-muted">
                          {new Date(deadline.deadline_datetime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Compact Standings */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide">Standings</h2>
            <button
              onClick={() => router.push(`/pools/${poolId}/standings`)}
              className="text-accent hover:text-accent-hover text-xs font-semibold transition-colors"
            >
              View All
            </button>
          </div>

          <div className="space-y-2">
            {topPlayers.map((player, index) => {
              const isYou = player.pool_player_id === yourStatus?.pool_player_id;
              return (
                <div
                  key={player.pool_player_id}
                  className={`flex items-center justify-between p-3 rounded-xl ${
                    isYou ? 'bg-accent/8 border border-accent/20' : 'bg-dark-surface'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-bold text-text-muted w-5 text-right">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-white text-sm">
                        {player.display_name}
                        {isYou && (
                          <span className="text-accent text-xs ml-1.5">You</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`inline-flex items-center w-2 h-2 rounded-full ${
                            player.is_eliminated ? 'bg-eliminated' : 'bg-alive'
                          }`}
                        />
                        <span className="text-[11px] text-text-muted">
                          {player.picks_count} pick{player.picks_count !== 1 ? 's' : ''}
                        </span>
                        {player.survival_streak > 1 && (
                          <span className="text-[11px] text-accent font-medium">
                            {player.survival_streak}x
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {player.current_pick?.team && (
                    <div className="text-right">
                      <p className="text-xs font-semibold text-white">
                        {player.current_pick.team.name}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        {player.current_pick.team.seed} seed
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {standings.players.length === 0 && (
            <p className="text-center text-text-muted py-8">No players in this pool yet.</p>
          )}

          {standings.players.length > 5 && (
            <button
              onClick={() => router.push(`/pools/${poolId}/standings`)}
              className="w-full mt-3 py-3 text-center text-sm font-semibold text-accent bg-accent/8 rounded-xl hover:bg-accent/15 transition-colors"
            >
              See all {standings.players.length} players
            </button>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push(`/pools/${poolId}/standings`)}
            className="bg-dark-card border border-dark-border rounded-2xl p-4 text-center hover:border-accent/30 transition-colors"
          >
            <div className="w-10 h-10 bg-electric/10 rounded-xl flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-electric" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <span className="text-xs font-semibold text-white block">Full Standings</span>
            <span className="text-[10px] text-text-muted block mt-0.5">Grid & history</span>
          </button>
          <button
            onClick={() => router.push('/tournament')}
            className="bg-dark-card border border-dark-border rounded-2xl p-4 text-center hover:border-accent/30 transition-colors"
          >
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <span className="text-xs font-semibold text-white block">Tournament</span>
            <span className="text-[10px] text-text-muted block mt-0.5">Bracket & scores</span>
          </button>
        </div>
      </div>
    </div>
  );
}

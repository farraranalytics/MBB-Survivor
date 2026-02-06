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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !standings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pool Not Found</h1>
          <p className="text-gray-600 mb-4">
            {error || 'This pool does not exist or you don\u2019t have access.'}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
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

  // Top 5 players for compact standings
  const topPlayers = standings.players.slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">{standings.pool_name}</h1>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-500 hover:text-gray-800 text-sm"
            >
              ← Dashboard
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">{standings.alive_players}</p>
              <p className="text-sm text-gray-500">Alive</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{standings.eliminated_players}</p>
              <p className="text-sm text-gray-500">Eliminated</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{standings.total_players}</p>
              <p className="text-sm text-gray-500">Total</p>
            </div>
          </div>
        </div>

        {/* Your Status & Pick Action */}
        {yourStatus && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Status</h2>

            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      yourStatus.is_eliminated
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {yourStatus.is_eliminated ? '💀 Eliminated' : '✅ Alive'}
                  </span>
                  <span className="text-sm text-gray-600">
                    {yourStatus.picks_count} pick{yourStatus.picks_count !== 1 ? 's' : ''} made
                  </span>
                  {yourStatus.survival_streak > 1 && (
                    <span className="text-sm text-orange-600 font-medium">
                      🔥 {yourStatus.survival_streak}
                    </span>
                  )}
                </div>

                {yourStatus.is_eliminated && yourStatus.elimination_reason && (
                  <p className="text-sm text-red-600">
                    Eliminated: {yourStatus.elimination_reason.replace('_', ' ')}
                  </p>
                )}

                {yourStatus.current_pick?.team && (
                  <p className="text-sm text-gray-600">
                    Today&apos;s pick:{' '}
                    <span className="font-medium">
                      ({yourStatus.current_pick.team.seed}) {yourStatus.current_pick.team.name}
                    </span>
                  </p>
                )}
              </div>

              {canMakePick && !hasMadePick && (
                <button
                  onClick={() => router.push(`/pools/${poolId}/pick`)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Make Pick
                </button>
              )}

              {hasMadePick && !deadline?.is_expired && (
                <button
                  onClick={() => router.push(`/pools/${poolId}/pick`)}
                  className="bg-amber-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-amber-600 transition-colors shadow-sm"
                >
                  Change Pick
                </button>
              )}

              {hasMadePick && deadline?.is_expired && (
                <span className="text-green-600 font-medium text-sm">Pick locked ✓</span>
              )}
            </div>

            {/* Deadline */}
            {standings.current_round && deadline && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {standings.current_round.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {hasMadePick
                        ? deadline?.is_expired
                          ? 'Pick locked ✓'
                          : 'Pick submitted — change before deadline'
                        : 'Pick needed'}
                    </p>
                  </div>
                  <div className="text-right">
                    {deadline.is_expired ? (
                      <p className="text-sm font-medium text-red-600">Deadline passed</p>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-900">
                          {formatTimeRemaining(deadline.minutes_remaining)} left
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(deadline.deadline_datetime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}{' '}
                          deadline
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Compact Standings (top 5) + link to full standings */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Standings</h2>
            <button
              onClick={() => router.push(`/pools/${poolId}/standings`)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              View Full Standings →
            </button>
          </div>

          <div className="space-y-2">
            {topPlayers.map((player, index) => {
              const isYou = player.pool_player_id === yourStatus?.pool_player_id;
              return (
                <div
                  key={player.pool_player_id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    isYou ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-400 w-6">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">
                        {player.display_name}
                        {isYou && (
                          <span className="text-blue-600 text-sm ml-1">(You)</span>
                        )}
                      </p>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            player.is_eliminated
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {player.is_eliminated ? 'Eliminated' : 'Alive'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {player.picks_count} pick{player.picks_count !== 1 ? 's' : ''}
                        </span>
                        {player.survival_streak > 1 && (
                          <span className="text-xs text-orange-600">
                            🔥 {player.survival_streak}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {player.current_pick?.team && (
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {player.current_pick.team.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {player.current_pick.team.seed} seed
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {standings.players.length === 0 && (
            <p className="text-center text-gray-500 py-8">No players in this pool yet.</p>
          )}

          {standings.players.length > 5 && (
            <button
              onClick={() => router.push(`/pools/${poolId}/standings`)}
              className="w-full mt-3 py-2.5 text-center text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              See all {standings.players.length} players →
            </button>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push(`/pools/${poolId}/standings`)}
            className="bg-white rounded-lg shadow-sm p-4 text-center hover:shadow-md transition-shadow"
          >
            <span className="text-2xl mb-1 block">📊</span>
            <span className="text-sm font-medium text-gray-900">Full Standings</span>
            <span className="text-xs text-gray-500 block">Round grid & history</span>
          </button>
          <button
            onClick={() => router.push('/tournament')}
            className="bg-white rounded-lg shadow-sm p-4 text-center hover:shadow-md transition-shadow"
          >
            <span className="text-2xl mb-1 block">🏀</span>
            <span className="text-sm font-medium text-gray-900">Tournament</span>
            <span className="text-xs text-gray-500 block">Bracket & scores</span>
          </button>
        </div>
      </div>
    </div>
  );
}

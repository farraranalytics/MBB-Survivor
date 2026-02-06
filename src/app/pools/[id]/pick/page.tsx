'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  getPoolPlayer,
  getActiveRound,
  getPickDeadline,
  getPickableTeams,
  getPlayerPick,
  submitPick,
  PickError
} from '@/lib/picks';
import { PickableTeam, PickDeadline, Round, Pick } from '@/types/picks';

// ─── Countdown Timer ──────────────────────────────────────────────

function DeadlineCountdown({ deadline }: { deadline: PickDeadline }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const deadlineMs = new Date(deadline.deadline_datetime).getTime();
  const diff = Math.max(0, deadlineMs - now);
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const expired = diff === 0;

  const urgency = expired
    ? 'bg-red-600'
    : diff < 300000    // < 5 min
    ? 'bg-red-500 animate-pulse'
    : diff < 1800000   // < 30 min
    ? 'bg-orange-500'
    : 'bg-blue-600';

  return (
    <div className={`${urgency} text-white rounded-xl px-4 py-3 text-center`}>
      {expired ? (
        <p className="font-bold text-lg">⏰ Deadline Passed</p>
      ) : (
        <>
          <p className="text-xs uppercase tracking-wide opacity-90">Pick locks in</p>
          <p className="font-mono text-2xl font-bold">
            {hours > 0 && `${hours}:`}
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </p>
        </>
      )}
    </div>
  );
}

// ─── Confirmation Modal ───────────────────────────────────────────

function ConfirmModal({
  team,
  onConfirm,
  onCancel,
  submitting
}: {
  team: PickableTeam;
  onConfirm: () => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6 pb-8 sm:pb-6 shadow-xl animate-in slide-in-from-bottom">
        <h3 className="text-lg font-bold text-gray-900 text-center mb-1">
          Confirm Your Pick
        </h3>
        <p className="text-sm text-gray-500 text-center mb-6">
          This cannot be changed after submitting
        </p>

        {/* Selected team */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
          <div className="text-center">
            <p className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-1">
              Your pick
            </p>
            <p className="text-xl font-bold text-gray-900">
              ({team.seed}) {team.name}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              vs ({team.opponent.seed}) {team.opponent.name}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {new Date(team.game_datetime).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>

        {/* Warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
          <p className="text-sm text-amber-800 text-center">
            ⚠️ You won&apos;t be able to pick <strong>{team.name}</strong> again this tournament
          </p>
        </div>

        {/* Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Go Back
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            {submitting ? (
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Lock It In 🔒'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Success Screen ───────────────────────────────────────────────

function PickSuccess({
  pick,
  poolId
}: {
  pick: Pick;
  poolId: string;
}) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm w-full">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pick Submitted!</h1>
        {pick.team && (
          <p className="text-lg text-gray-700 mb-1">
            ({pick.team.seed}) {pick.team.name}
          </p>
        )}
        <p className="text-sm text-gray-500 mb-8">
          Submitted {new Date(pick.submitted_at).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit'
          })}
        </p>
        <button
          onClick={() => router.push(`/pools/${poolId}`)}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
        >
          Back to Pool
        </button>
      </div>
    </div>
  );
}

// ─── Team Card (the tap target) ───────────────────────────────────

function TeamCard({
  team,
  isSelected,
  disabled,
  onSelect
}: {
  team: PickableTeam;
  isSelected: boolean;
  disabled: boolean;
  onSelect: (team: PickableTeam) => void;
}) {
  const riskColors: Record<string, string> = {
    low: 'text-green-600 bg-green-50',
    medium: 'text-yellow-700 bg-yellow-50',
    high: 'text-red-600 bg-red-50'
  };
  const riskLabels: Record<string, string> = {
    low: 'Safe',
    medium: 'Toss-up',
    high: 'Risky'
  };

  const isUsed = team.already_used;

  return (
    <button
      onClick={() => !disabled && !isUsed && onSelect(team)}
      disabled={disabled || isUsed}
      className={`
        w-full text-left p-4 transition-all
        ${isSelected
          ? 'bg-blue-50 ring-2 ring-inset ring-blue-400'
          : isUsed
          ? 'bg-gray-100 opacity-60 cursor-not-allowed'
          : 'bg-white hover:bg-blue-50 active:bg-blue-100'
        }
      `}
    >
      <div className="flex items-center justify-between">
        {/* Team info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <span className="inline-flex items-center justify-center w-7 h-7 bg-gray-900 text-white text-xs font-bold rounded-full">
              {team.seed}
            </span>
            <span className="font-bold text-gray-900 text-base truncate">
              {team.name}
            </span>
          </div>
          <p className="text-sm text-gray-500 ml-9">
            {team.mascot}
          </p>
        </div>

        {/* Right side: risk badge or used label */}
        <div className="flex-shrink-0 ml-3">
          {isUsed ? (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-500">
              Used ✕
            </span>
          ) : (
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                riskColors[team.risk_level]
              }`}
            >
              {riskLabels[team.risk_level]}
            </span>
          )}
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="mt-2 ml-9">
          <span className="text-blue-600 text-sm font-medium">✓ Selected</span>
        </div>
      )}
    </button>
  );
}

// ─── Main Pick Page ───────────────────────────────────────────────

export default function PickPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const poolId = params.id as string;

  // Data state
  const [poolPlayerId, setPoolPlayerId] = useState<string | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [deadline, setDeadline] = useState<PickDeadline | null>(null);
  const [teams, setTeams] = useState<PickableTeam[]>([]);
  const [existingPick, setExistingPick] = useState<Pick | null>(null);
  const [usedCount, setUsedCount] = useState(0);

  // UI state
  const [selectedTeam, setSelectedTeam] = useState<PickableTeam | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedPick, setSubmittedPick] = useState<Pick | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterUsed, setFilterUsed] = useState(false);

  const loadedRef = useRef(false);

  // ─── Load Data ────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      // 1. Get pool player record
      const poolPlayer = await getPoolPlayer(poolId, user.id);
      if (!poolPlayer) {
        setError('You are not a member of this pool.');
        setLoading(false);
        return;
      }
      setPoolPlayerId(poolPlayer.id);

      if (poolPlayer.is_eliminated) {
        setError('You have been eliminated from this pool.');
        setLoading(false);
        return;
      }

      // 2. Get active round
      const activeRound = await getActiveRound();
      if (!activeRound) {
        setError('No active round. Check back when the tournament is underway.');
        setLoading(false);
        return;
      }
      setRound(activeRound);

      // 3. Check deadline
      const dl = await getPickDeadline(activeRound.id);
      setDeadline(dl);

      // 4. Check existing pick — if deadline hasn't passed, allow changing
      const existing = await getPlayerPick(poolPlayer.id, activeRound.id);
      if (existing) {
        setExistingPick(existing);
        if (dl.is_expired) {
          // Deadline passed, show as locked in
          setSubmittedPick(existing);
          setLoading(false);
          return;
        }
        // Deadline still open — pre-select current pick but allow changing
      }

      // 5. Get pickable teams
      const pickable = await getPickableTeams(poolPlayer.id, activeRound.id);
      setTeams(pickable);
      setUsedCount(pickable.filter(t => t.already_used).length);

      // Pre-select existing pick if changing
      if (existing) {
        const currentTeam = pickable.find(t => t.id === existing.team_id);
        if (currentTeam) setSelectedTeam(currentTeam);
      }
    } catch (err) {
      console.error('Failed to load pick data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user, poolId]);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadData();
    }
  }, [loadData]);

  // ─── Submit Handler ───────────────────────────────────────────

  const handleConfirm = async () => {
    if (!selectedTeam || !poolPlayerId || !round) return;

    setSubmitting(true);
    try {
      const pick = await submitPick({
        pool_player_id: poolPlayerId,
        round_id: round.id,
        team_id: selectedTeam.id
      });
      setSubmittedPick(pick);
      setShowConfirm(false);
    } catch (err) {
      const message =
        err instanceof PickError ? err.message : 'Failed to submit pick. Please try again.';
      setError(message);
      setShowConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render States ────────────────────────────────────────────

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
        <p className="text-gray-500">Loading today&apos;s games...</p>
      </div>
    );
  }

  // Already submitted
  if (submittedPick) {
    return <PickSuccess pick={submittedPick} poolId={poolId} />;
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-3">😕</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Can&apos;t Make Pick</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push(`/pools/${poolId}`)}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Back to Pool
          </button>
        </div>
      </div>
    );
  }

  // Deadline expired
  if (deadline?.is_expired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-3">⏰</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Deadline Passed</h1>
          <p className="text-gray-600 mb-6">
            The pick deadline for {round?.name || 'this round'} has passed.
          </p>
          <button
            onClick={() => router.push(`/pools/${poolId}`)}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Back to Pool
          </button>
        </div>
      </div>
    );
  }

  // Filter teams
  const displayTeams = filterUsed ? teams.filter(t => !t.already_used) : teams;
  const availableCount = teams.filter(t => !t.already_used).length;

  // Group by game (matchup pairs), then order by game time
  const gameMatchups = new Map<string, { teams: PickableTeam[]; time: string }>();
  for (const team of displayTeams) {
    if (!gameMatchups.has(team.game_id)) {
      gameMatchups.set(team.game_id, {
        teams: [],
        time: new Date(team.game_datetime).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit'
        })
      });
    }
    gameMatchups.get(team.game_id)!.teams.push(team);
  }
  // Sort matchups by game time, then by lower seed (favorites first)
  const sortedMatchups = Array.from(gameMatchups.entries()).sort((a, b) => {
    const timeA = new Date(a[1].teams[0].game_datetime).getTime();
    const timeB = new Date(b[1].teams[0].game_datetime).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return Math.min(...a[1].teams.map(t => t.seed)) - Math.min(...b[1].teams.map(t => t.seed));
  });
  // Group matchups by time slot for section headers
  const timeSlots = new Map<string, { gameId: string; teams: PickableTeam[] }[]>();
  for (const [gameId, matchup] of sortedMatchups) {
    if (!timeSlots.has(matchup.time)) timeSlots.set(matchup.time, []);
    // Sort teams within matchup: lower seed (favorite) on top
    matchup.teams.sort((a, b) => a.seed - b.seed);
    timeSlots.get(matchup.time)!.push({ gameId, teams: matchup.teams });
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3">
          {/* Top row: back button + round name */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => router.push(`/pools/${poolId}`)}
              className="text-gray-500 hover:text-gray-800 text-sm font-medium"
            >
              ← Pool
            </button>
            <span className="text-sm font-medium text-gray-700">
              {round?.name || 'Make Your Pick'}
            </span>
            <div className="w-12" /> {/* Spacer */}
          </div>

          {/* Countdown */}
          {deadline && <DeadlineCountdown deadline={deadline} />}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Existing pick banner */}
        {existingPick && existingPick.team && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <p className="text-sm text-amber-800 text-center">
              Current pick: <strong>({existingPick.team.seed}) {existingPick.team.name}</strong> — select a different team to change
            </p>
          </div>
        )}

        {/* Stats bar */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            <span className="font-medium">{availableCount}</span> teams available
            {usedCount > 0 && (
              <span className="text-gray-400"> · {usedCount} used</span>
            )}
          </p>
          {usedCount > 0 && (
            <button
              onClick={() => setFilterUsed(!filterUsed)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filterUsed
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              {filterUsed ? 'Show all' : 'Hide used'}
            </button>
          )}
        </div>

        {/* Team list grouped by matchup */}
        {displayTeams.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No games available for today.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(timeSlots.entries()).map(([time, matchups]) => (
              <div key={time}>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 px-1">
                  {time}
                </p>
                <div className="space-y-3">
                  {matchups.map(({ gameId, teams: matchupTeams }) => (
                    <div key={gameId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      {matchupTeams.map((team, idx) => (
                        <div key={team.id}>
                          {idx > 0 && (
                            <div className="relative px-4">
                              <div className="border-t border-gray-100" />
                              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-100 text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                VS
                              </span>
                            </div>
                          )}
                          <TeamCard
                            team={team}
                            isSelected={selectedTeam?.id === team.id}
                            disabled={deadline?.is_expired ?? false}
                            onSelect={setSelectedTeam}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed Bottom Bar — Submit Button */}
      {selectedTeam && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t shadow-lg safe-area-bottom">
          <div className="max-w-lg mx-auto px-4 py-4">
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full py-4 rounded-xl bg-blue-600 text-white text-lg font-bold hover:bg-blue-700 active:scale-[0.98] transition-all shadow-md"
            >
              {existingPick ? 'Change to' : 'Pick'} ({selectedTeam.seed}) {selectedTeam.name}
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && selectedTeam && (
        <ConfirmModal
          team={selectedTeam}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
          submitting={submitting}
        />
      )}
    </div>
  );
}

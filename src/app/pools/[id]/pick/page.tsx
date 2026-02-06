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

  const urgencyBg = expired
    ? 'bg-eliminated'
    : diff < 300000
    ? 'bg-eliminated countdown-urgent'
    : diff < 1800000
    ? 'bg-warning'
    : diff < 7200000
    ? 'bg-warning/80'
    : 'bg-alive';

  return (
    <div className={`${urgencyBg} text-white rounded-xl px-4 py-3 text-center`}>
      {expired ? (
        <p className="font-bold text-lg">Deadline Passed</p>
      ) : (
        <>
          <p className="text-[10px] uppercase tracking-widest opacity-80 mb-0.5">Pick locks in</p>
          <p className="font-mono text-2xl font-extrabold tracking-wider">
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative bg-dark-card border border-dark-border rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6 pb-8 sm:pb-6 shadow-2xl animate-slide-up">
        <h3 className="text-lg font-bold text-white text-center mb-1">
          Confirm Your Pick
        </h3>
        <p className="text-sm text-text-muted text-center mb-6">
          This team will be burned for the rest of the tournament
        </p>

        <div className="bg-accent/10 border-2 border-accent/30 rounded-xl p-5 mb-5">
          <div className="text-center">
            <p className="text-[10px] text-accent font-bold uppercase tracking-widest mb-2">
              Your pick
            </p>
            <p className="text-2xl font-extrabold text-white">
              ({team.seed}) {team.name}
            </p>
            <p className="text-sm text-text-secondary mt-1">
              vs ({team.opponent.seed}) {team.opponent.name}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {new Date(team.game_datetime).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>

        <div className="bg-warning/10 border border-warning/25 rounded-xl p-3 mb-6">
          <p className="text-sm text-warning text-center">
            You won&apos;t be able to pick <strong>{team.name}</strong> again this tournament
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 py-3.5 rounded-xl border border-dark-border text-text-secondary font-semibold hover:bg-dark-surface transition-colors disabled:opacity-50"
          >
            Go Back
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 py-3.5 rounded-xl btn-accent text-white font-bold disabled:opacity-50 flex items-center justify-center"
          >
            {submitting ? (
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Lock It In'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Success Screen ───────────────────────────────────────────────

function PickSuccess({ pick, poolId }: { pick: Pick; poolId: string }) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-dark-base flex items-center justify-center px-5">
      <div className="text-center max-w-sm w-full animate-bounce-in">
        <div className="w-20 h-20 bg-alive/15 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-10 h-10 text-alive" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Pick Submitted!</h1>
        {pick.team && (
          <p className="text-lg text-accent font-bold mb-1">
            ({pick.team.seed}) {pick.team.name}
          </p>
        )}
        <p className="text-sm text-text-muted mb-8">
          Submitted {new Date(pick.submitted_at).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit'
          })}
        </p>
        <button
          onClick={() => router.push(`/pools/${poolId}`)}
          className="w-full py-3.5 rounded-xl bg-dark-card border border-dark-border text-white font-semibold hover:bg-dark-elevated transition-colors"
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
    low: 'text-alive bg-alive/10',
    medium: 'text-warning bg-warning/10',
    high: 'text-eliminated bg-eliminated/10'
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
        w-full text-left px-4 py-4 transition-all min-h-[64px]
        ${isSelected
          ? 'bg-accent/10 ring-2 ring-inset ring-accent'
          : isUsed
          ? 'bg-dark-base/50 opacity-40 cursor-not-allowed'
          : 'hover:bg-dark-elevated active:bg-dark-elevated'
        }
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3">
            <span className={`inline-flex items-center justify-center w-8 h-8 text-xs font-bold rounded-full flex-shrink-0 ${
              isSelected ? 'bg-accent text-white' : 'bg-dark-border text-white'
            }`}>
              {team.seed}
            </span>
            <div className="min-w-0">
              <span className="font-bold text-white text-base block truncate">
                {team.name}
              </span>
              <span className="text-xs text-text-muted">{team.mascot}</span>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 ml-3 flex items-center gap-2">
          {isUsed ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-dark-border text-text-muted uppercase">
              Used
            </span>
          ) : (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                riskColors[team.risk_level]
              }`}
            >
              {riskLabels[team.risk_level]}
            </span>
          )}
          {isSelected && (
            <span className="w-5 h-5 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Main Pick Page ───────────────────────────────────────────────

export default function PickPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const poolId = params.id as string;

  const [poolPlayerId, setPoolPlayerId] = useState<string | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [deadline, setDeadline] = useState<PickDeadline | null>(null);
  const [teams, setTeams] = useState<PickableTeam[]>([]);
  const [existingPick, setExistingPick] = useState<Pick | null>(null);
  const [usedCount, setUsedCount] = useState(0);

  const [selectedTeam, setSelectedTeam] = useState<PickableTeam | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedPick, setSubmittedPick] = useState<Pick | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterUsed, setFilterUsed] = useState(false);

  const loadedRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      const poolPlayer = await getPoolPlayer(poolId, user.id);
      if (!poolPlayer) { setError('You are not a member of this pool.'); setLoading(false); return; }
      setPoolPlayerId(poolPlayer.id);
      if (poolPlayer.is_eliminated) { setError('You have been eliminated from this pool.'); setLoading(false); return; }

      const activeRound = await getActiveRound();
      if (!activeRound) { setError('No active round. Check back when the tournament is underway.'); setLoading(false); return; }
      setRound(activeRound);

      const dl = await getPickDeadline(activeRound.id);
      setDeadline(dl);

      const existing = await getPlayerPick(poolPlayer.id, activeRound.id);
      if (existing) {
        setExistingPick(existing);
        if (dl.is_expired) { setSubmittedPick(existing); setLoading(false); return; }
      }

      const pickable = await getPickableTeams(poolPlayer.id, activeRound.id);
      setTeams(pickable);
      setUsedCount(pickable.filter(t => t.already_used).length);

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
    if (!loadedRef.current) { loadedRef.current = true; loadData(); }
  }, [loadData]);

  const handleConfirm = async () => {
    if (!selectedTeam || !poolPlayerId || !round) return;
    setSubmitting(true);
    try {
      const pick = await submitPick({ pool_player_id: poolPlayerId, round_id: round.id, team_id: selectedTeam.id });
      setSubmittedPick(pick);
      setShowConfirm(false);
    } catch (err) {
      const message = err instanceof PickError ? err.message : 'Failed to submit pick. Please try again.';
      setError(message);
      setShowConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render States ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-base flex flex-col items-center justify-center px-5">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-dark-border border-t-accent mb-4" />
        <p className="text-text-muted">Loading today&apos;s games...</p>
      </div>
    );
  }

  if (submittedPick) return <PickSuccess pick={submittedPick} poolId={poolId} />;

  if (error) {
    return (
      <div className="min-h-screen bg-dark-base flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Can&apos;t Make Pick</h1>
          <p className="text-text-secondary mb-6 text-sm">{error}</p>
          <button
            onClick={() => router.push(`/pools/${poolId}`)}
            className="w-full py-3.5 rounded-xl bg-dark-card border border-dark-border text-white font-semibold hover:bg-dark-elevated transition-colors"
          >
            Back to Pool
          </button>
        </div>
      </div>
    );
  }

  if (deadline?.is_expired) {
    return (
      <div className="min-h-screen bg-dark-base flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-eliminated/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-eliminated" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Deadline Passed</h1>
          <p className="text-text-secondary mb-6 text-sm">
            The pick deadline for {round?.name || 'this round'} has passed.
          </p>
          <button
            onClick={() => router.push(`/pools/${poolId}`)}
            className="w-full py-3.5 rounded-xl bg-dark-card border border-dark-border text-white font-semibold hover:bg-dark-elevated transition-colors"
          >
            Back to Pool
          </button>
        </div>
      </div>
    );
  }

  const displayTeams = filterUsed ? teams.filter(t => !t.already_used) : teams;
  const availableCount = teams.filter(t => !t.already_used).length;

  const gameMatchups = new Map<string, { teams: PickableTeam[]; time: string }>();
  for (const team of displayTeams) {
    if (!gameMatchups.has(team.game_id)) {
      gameMatchups.set(team.game_id, {
        teams: [],
        time: new Date(team.game_datetime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      });
    }
    gameMatchups.get(team.game_id)!.teams.push(team);
  }
  const sortedMatchups = Array.from(gameMatchups.entries()).sort((a, b) => {
    const timeA = new Date(a[1].teams[0].game_datetime).getTime();
    const timeB = new Date(b[1].teams[0].game_datetime).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return Math.min(...a[1].teams.map(t => t.seed)) - Math.min(...b[1].teams.map(t => t.seed));
  });
  const timeSlots = new Map<string, { gameId: string; teams: PickableTeam[] }[]>();
  for (const [gameId, matchup] of sortedMatchups) {
    if (!timeSlots.has(matchup.time)) timeSlots.set(matchup.time, []);
    matchup.teams.sort((a, b) => a.seed - b.seed);
    timeSlots.get(matchup.time)!.push({ gameId, teams: matchup.teams });
  }

  return (
    <div className="min-h-screen bg-dark-base pb-32">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-dark-surface border-b border-dark-border">
        <div className="max-w-lg mx-auto px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => router.push(`/pools/${poolId}`)}
              className="text-text-muted hover:text-text-secondary text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              Pool
            </button>
            <span className="text-sm font-semibold text-white">
              {round?.name || 'Make Your Pick'}
            </span>
            <div className="w-12" />
          </div>
          {deadline && <DeadlineCountdown deadline={deadline} />}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-5 py-4">
        {existingPick && existingPick.team && (
          <div className="bg-warning/10 border border-warning/25 rounded-xl p-3 mb-4">
            <p className="text-sm text-warning text-center">
              Current: <strong className="text-white">({existingPick.team.seed}) {existingPick.team.name}</strong> — tap another to change
            </p>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-text-secondary">
            <span className="font-bold text-white">{availableCount}</span> teams available
            {usedCount > 0 && (
              <span className="text-text-muted"> / {usedCount} used</span>
            )}
          </p>
          {usedCount > 0 && (
            <button
              onClick={() => setFilterUsed(!filterUsed)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filterUsed
                  ? 'bg-accent/10 border-accent/30 text-accent'
                  : 'bg-dark-card border-dark-border text-text-muted'
              }`}
            >
              {filterUsed ? 'Show all' : 'Hide used'}
            </button>
          )}
        </div>

        {displayTeams.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted">No games available for today.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(timeSlots.entries()).map(([time, matchups]) => (
              <div key={time}>
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-3 px-1">
                  {time}
                </p>
                <div className="space-y-3">
                  {matchups.map(({ gameId, teams: matchupTeams }) => (
                    <div key={gameId} className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden">
                      {matchupTeams.map((team, idx) => (
                        <div key={team.id}>
                          {idx > 0 && (
                            <div className="relative px-4">
                              <div className="border-t border-dark-border-subtle" />
                              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-dark-border text-text-muted text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                                vs
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

      {/* Fixed Bottom Bar */}
      {selectedTeam && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-dark-surface border-t border-dark-border tab-bar-shadow safe-area-bottom">
          <div className="max-w-lg mx-auto px-5 py-4">
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full py-4 rounded-xl btn-accent text-white text-lg font-extrabold active:scale-[0.98] transition-all shadow-lg shadow-accent-dim"
            >
              {existingPick ? 'Change to' : 'Pick'} ({selectedTeam.seed}) {selectedTeam.name}
            </button>
          </div>
        </div>
      )}

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

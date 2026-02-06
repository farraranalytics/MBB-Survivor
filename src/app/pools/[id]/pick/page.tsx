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
    ? 'bg-[#EF5350]'
    : diff < 300000
    ? 'bg-[#EF5350] countdown-urgent'
    : diff < 1800000
    ? 'bg-[#FFB300]'
    : diff < 7200000
    ? 'bg-[rgba(255,179,0,0.8)]'
    : 'bg-[#4CAF50]';

  return (
    <div className={`${urgencyBg} text-[#E8E6E1] rounded-[8px] px-4 py-3 text-center`}>
      {expired ? (
        <p className="font-bold text-lg" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Deadline Passed</p>
      ) : (
        <>
          <p className="text-[10px] uppercase tracking-widest opacity-80 mb-0.5" style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.2em' }}>Pick locks in</p>
          <p className="text-2xl font-extrabold tracking-wider" style={{ fontFamily: "'Space Mono', monospace" }}>
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

      <div className="relative bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-t-[16px] sm:rounded-[16px] w-full max-w-md mx-auto p-6 pb-8 sm:pb-6 shadow-2xl animate-slide-up">
        <h3 className="text-lg font-bold text-[#E8E6E1] text-center mb-1" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
          Confirm Your Pick
        </h3>
        <p className="text-sm text-[#8A8694] text-center mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          This team will be burned for the rest of the tournament
        </p>

        <div className="bg-[rgba(255,87,34,0.08)] border-2 border-[rgba(255,87,34,0.3)] rounded-[12px] p-5 mb-5">
          <div className="text-center">
            <p className="label mb-2">Your pick</p>
            <p className="text-2xl font-extrabold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              ({team.seed}) {team.name}
            </p>
            <p className="text-sm text-[#8A8694] mt-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              vs ({team.opponent.seed}) {team.opponent.name}
            </p>
            <p className="text-xs text-[#8A8694] mt-1" style={{ fontFamily: "'Space Mono', monospace" }}>
              {new Date(team.game_datetime).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>

        <div className="bg-[rgba(255,179,0,0.1)] border border-[rgba(255,179,0,0.25)] rounded-[8px] p-3 mb-6">
          <p className="text-sm text-[#FFB300] text-center" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            You won&apos;t be able to pick <strong>{team.name}</strong> again this tournament
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 py-3.5 rounded-[12px] border border-[rgba(255,255,255,0.05)] text-[#8A8694] font-semibold hover:bg-[#1A1A24] transition-colors disabled:opacity-50"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Go Back
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 py-3.5 rounded-[12px] btn-orange font-bold disabled:opacity-50 flex items-center justify-center"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {submitting ? (
              <div className="h-5 w-5 border-2 border-[rgba(255,255,255,0.3)] border-t-white rounded-full animate-spin" />
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
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-5">
      <div className="text-center max-w-sm w-full animate-bounce-in">
        <div className="w-20 h-20 bg-[rgba(76,175,80,0.15)] rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-10 h-10 text-[#4CAF50]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h1 className="text-2xl font-bold text-[#E8E6E1] mb-2" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Pick Submitted!</h1>
        {pick.team && (
          <p className="text-lg text-[#FF5722] font-bold mb-1" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
            ({pick.team.seed}) {pick.team.name}
          </p>
        )}
        <p className="text-sm text-[#8A8694] mb-8" style={{ fontFamily: "'Space Mono', monospace" }}>
          Submitted {new Date(pick.submitted_at).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit'
          })}
        </p>
        <button
          onClick={() => router.push(`/pools/${poolId}`)}
          className="w-full py-3.5 rounded-[12px] bg-[#111118] border border-[rgba(255,255,255,0.05)] text-[#E8E6E1] font-semibold hover:border-[rgba(255,87,34,0.3)] transition-colors"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Back to Pool
        </button>
      </div>
    </div>
  );
}

// ─── Team Card ───────────────────────────────────────────────────

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
    low: 'text-[#4CAF50] bg-[rgba(76,175,80,0.1)]',
    medium: 'text-[#FFB300] bg-[rgba(255,179,0,0.1)]',
    high: 'text-[#EF5350] bg-[rgba(239,83,80,0.1)]'
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
          ? 'bg-[rgba(255,87,34,0.08)] ring-2 ring-inset ring-[#FF5722]'
          : isUsed
          ? 'bg-[rgba(13,27,42,0.5)] opacity-40 cursor-not-allowed strikethrough'
          : 'hover:bg-[#1A1A24] active:bg-[#1A1A24]'
        }
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3">
            <span className={`inline-flex items-center justify-center w-8 h-8 text-xs font-bold rounded-full flex-shrink-0 ${
              isSelected ? 'bg-[#FF5722] text-[#E8E6E1]' : 'bg-[rgba(255,255,255,0.08)] text-[#E8E6E1]'
            }`} style={{ fontFamily: "'Oswald', sans-serif" }}>
              {team.seed}
            </span>
            <div className="min-w-0">
              <span className="font-bold text-[#E8E6E1] text-base block truncate" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                {team.name}
              </span>
              <span className="text-xs text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>{team.mascot}</span>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 ml-3 flex items-center gap-2">
          {isUsed ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-[rgba(255,255,255,0.08)] text-[#8A8694] uppercase" style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em' }}>
              Used
            </span>
          ) : (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${riskColors[team.risk_level]}`}
              style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em' }}
            >
              {riskLabels[team.risk_level]}
            </span>
          )}
          {isSelected && (
            <span className="w-5 h-5 bg-[#FF5722] rounded-full flex items-center justify-center flex-shrink-0">
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex flex-col items-center justify-center px-5">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[rgba(255,255,255,0.08)] border-t-[#FF5722] mb-4" />
        <p className="text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Loading today&apos;s games...</p>
      </div>
    );
  }

  if (submittedPick) return <PickSuccess pick={submittedPick} poolId={poolId} />;

  if (error) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-[rgba(255,179,0,0.1)] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#FFB300]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          </div>
          <h1 className="text-xl font-bold text-[#E8E6E1] mb-2" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Can&apos;t Make Pick</h1>
          <p className="text-[#8A8694] mb-6 text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>{error}</p>
          <button onClick={() => router.push(`/pools/${poolId}`)} className="w-full py-3.5 rounded-[12px] bg-[#111118] border border-[rgba(255,255,255,0.05)] text-[#E8E6E1] font-semibold hover:border-[rgba(255,87,34,0.3)] transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Back to Pool
          </button>
        </div>
      </div>
    );
  }

  if (deadline?.is_expired) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-[rgba(239,83,80,0.1)] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#EF5350]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h1 className="text-xl font-bold text-[#E8E6E1] mb-2" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Deadline Passed</h1>
          <p className="text-[#8A8694] mb-6 text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            The pick deadline for {round?.name || 'this round'} has passed.
          </p>
          <button onClick={() => router.push(`/pools/${poolId}`)} className="w-full py-3.5 rounded-[12px] bg-[#111118] border border-[rgba(255,255,255,0.05)] text-[#E8E6E1] font-semibold hover:border-[rgba(255,87,34,0.3)] transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
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
    <div className="min-h-screen bg-[#0D1B2A] pb-32">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-[#111118] border-b border-[rgba(255,255,255,0.05)]">
        <div className="max-w-lg mx-auto px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => router.push(`/pools/${poolId}`)} className="text-[#8A8694] hover:text-[#E8E6E1] text-sm font-medium transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              Pool
            </button>
            <span className="text-sm font-semibold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
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
          <div className="bg-[rgba(255,179,0,0.1)] border border-[rgba(255,179,0,0.25)] rounded-[8px] p-3 mb-4">
            <p className="text-sm text-[#FFB300] text-center" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Current: <strong className="text-[#E8E6E1]">({existingPick.team.seed}) {existingPick.team.name}</strong> — tap another to change
            </p>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <span className="font-bold text-[#E8E6E1]" style={{ fontFamily: "'Space Mono', monospace" }}>{availableCount}</span> teams available
            {usedCount > 0 && (
              <span className="text-[#8A8694]"> / <span style={{ fontFamily: "'Space Mono', monospace" }}>{usedCount}</span> used</span>
            )}
          </p>
          {usedCount > 0 && (
            <button
              onClick={() => setFilterUsed(!filterUsed)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filterUsed
                  ? 'bg-[rgba(255,87,34,0.08)] border-[rgba(255,87,34,0.3)] text-[#FF5722]'
                  : 'bg-[#111118] border-[rgba(255,255,255,0.05)] text-[#8A8694]'
              }`}
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {filterUsed ? 'Show all' : 'Hide used'}
            </button>
          )}
        </div>

        {displayTeams.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>No games available for today.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(timeSlots.entries()).map(([time, matchups]) => (
              <div key={time}>
                <p className="label mb-3 px-1">{time}</p>
                <div className="space-y-3">
                  {matchups.map(({ gameId, teams: matchupTeams }) => (
                    <div key={gameId} className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] overflow-hidden">
                      {matchupTeams.map((team, idx) => (
                        <div key={team.id}>
                          {idx > 0 && (
                            <div className="relative px-4">
                              <div className="border-t border-[rgba(255,255,255,0.05)]" />
                              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[rgba(255,255,255,0.08)] text-[#8A8694] text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase" style={{ fontFamily: "'Space Mono', monospace" }}>
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
        <div className="fixed bottom-0 inset-x-0 z-40 bg-[#111118] border-t border-[rgba(255,255,255,0.05)] tab-bar-shadow safe-area-bottom">
          <div className="max-w-lg mx-auto px-5 py-4">
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full py-4 rounded-[12px] btn-orange text-lg font-extrabold active:scale-[0.98] transition-all"
              style={{ fontFamily: "'DM Sans', sans-serif", boxShadow: '0 4px 20px rgba(255, 87, 34, 0.3)' }}
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

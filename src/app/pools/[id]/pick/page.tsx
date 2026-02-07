'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
import { supabase } from '@/lib/supabase/client';
import { getSeedWinProbability } from '@/lib/analyze';
import { PickableTeam, PickDeadline, Round, Pick } from '@/types/picks';
import { formatET, formatETShort, formatDeadlineTime } from '@/lib/timezone';

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
    <div className="flex items-center gap-2">
      <span className={`${urgencyBg} text-[#E8E6E1] rounded-[6px] px-2.5 py-1 inline-flex items-center gap-1.5`}>
        {expired ? (
          <span className="font-bold text-xs" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Locked</span>
        ) : (
          <>
            <span className="text-[9px] uppercase opacity-70" style={{ fontFamily: "'Space Mono', monospace" }}>in</span>
            <span className="text-sm font-extrabold tracking-wide" style={{ fontFamily: "'Space Mono', monospace" }}>
              {hours > 0 && `${hours}:`}{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </>
        )}
      </span>
      {!expired && (
        <span className="text-[10px] text-[#9BA3AE]" style={{ fontFamily: "'Space Mono', monospace" }}>
          {formatDeadlineTime(deadline.deadline_datetime)}
        </span>
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

      <div className="relative bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-t-[16px] sm:rounded-[16px] w-full max-w-md mx-auto p-6 pb-8 sm:pb-6 shadow-2xl animate-slide-up">
        <h3 className="text-lg font-bold text-[#E8E6E1] text-center mb-1" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
          Confirm Your Pick
        </h3>
        <p className="text-sm text-[#9BA3AE] text-center mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          This team will be burned for the rest of the tournament
        </p>

        <div className="bg-[rgba(255,87,34,0.08)] border-2 border-[rgba(255,87,34,0.3)] rounded-[12px] p-5 mb-5">
          <div className="text-center">
            <p className="text-label-accent mb-2">Your pick</p>
            <p className="text-2xl font-extrabold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              ({team.seed}) {team.name}
            </p>
            <p className="text-sm text-[#9BA3AE] mt-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              vs ({team.opponent.seed}) {team.opponent.name}
            </p>
            <p className="text-xs text-[#9BA3AE] mt-1" style={{ fontFamily: "'Space Mono', monospace" }}>
              {formatET(team.game_datetime)}
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
            className="flex-1 py-3.5 rounded-[12px] border border-[rgba(255,255,255,0.05)] text-[#9BA3AE] font-semibold hover:bg-[#1B2A3D] transition-colors disabled:opacity-50"
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
  const isUsed = team.already_used;
  const prob = getSeedWinProbability(team.seed, team.opponent.seed);
  const pct = Math.round(prob * 100);
  const gameTime = formatET(team.game_datetime);

  return (
    <button
      onClick={() => !disabled && !isUsed && onSelect(team)}
      disabled={disabled || isUsed}
      className={`
        w-full text-left flex items-center gap-3 px-3 py-2.5 pr-4 transition-all border-[1.5px] rounded-[10px]
        ${isSelected
          ? 'bg-[rgba(255,87,34,0.08)] border-[#FF5722]'
          : isUsed
          ? 'bg-[rgba(13,27,42,0.5)] opacity-40 cursor-not-allowed strikethrough border-transparent'
          : 'border-[rgba(255,255,255,0.05)] hover:bg-[#1B2A3D] active:bg-[#1B2A3D]'
        }
      `}
    >
      {/* Seed number */}
      <span
        className={`text-center flex-shrink-0 min-w-[2rem] ${isSelected ? 'text-[#FF5722]' : 'text-[#5F6B7A]'}`}
        style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: '1.1rem' }}
      >
        {team.seed}
      </span>

      {/* Team name + meta */}
      <div className="flex-1 min-w-0">
        <span className="font-bold text-[#E8E6E1] text-sm block truncate leading-tight" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
          {team.name}
        </span>
        <span className="text-[11px] text-[#9BA3AE] leading-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          vs ({team.opponent.seed}) {team.opponent.abbreviation} · {gameTime}
        </span>
      </div>

      {/* Win probability or Used badge */}
      <div className="flex-shrink-0 flex items-center gap-3">
        {isUsed ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-[rgba(255,255,255,0.08)] text-[#9BA3AE] uppercase" style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em' }}>
            Used
          </span>
        ) : (
          <span
            className={`text-xs font-bold min-w-[3rem] text-right ${
              prob >= 0.8 ? 'text-[#4CAF50]' :
              prob >= 0.6 ? 'text-[#FFB300]' :
              'text-[#EF5350]'
            }`}
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            {pct}%
          </span>
        )}

        {/* Radio circle */}
        <span className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          isSelected
            ? 'border-[#FF5722] bg-[#FF5722]'
            : 'border-[rgba(255,255,255,0.12)] bg-transparent'
        }`}>
          {isSelected && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
      </div>
    </button>
  );
}

// ─── Main Pick Page ───────────────────────────────────────────────

export default function PickPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const poolId = params.id as string;
  const entryId = searchParams.get('entry') || undefined;

  const [poolPlayerId, setPoolPlayerId] = useState<string | null>(null);
  const [entries, setEntries] = useState<{ id: string; entry_number: number; entry_label: string | null; is_eliminated: boolean }[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | undefined>(entryId);
  const [round, setRound] = useState<Round | null>(null);
  const [deadline, setDeadline] = useState<PickDeadline | null>(null);
  const [teams, setTeams] = useState<PickableTeam[]>([]);
  const [existingPick, setExistingPick] = useState<Pick | null>(null);
  const [usedCount, setUsedCount] = useState(0);

  const [selectedTeam, setSelectedTeam] = useState<PickableTeam | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterUsed, setFilterUsed] = useState(false);

  const loadedRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch all user entries for entry switcher
      const { data: allEntries } = await supabase
        .from('pool_players')
        .select('id, entry_number, entry_label, is_eliminated')
        .eq('pool_id', poolId)
        .eq('user_id', user.id)
        .order('entry_number', { ascending: true });

      if (allEntries) setEntries(allEntries);

      const poolPlayer = await getPoolPlayer(poolId, user.id, activeEntryId);
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
  }, [user, poolId, activeEntryId]);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadData();
    }
  }, [loadData]);


  const handleConfirm = async () => {
    if (!selectedTeam || !poolPlayerId || !round) return;
    setSubmitting(true);
    try {
      const pick = await submitPick({ pool_player_id: poolPlayerId, round_id: round.id, team_id: selectedTeam.id });
      setExistingPick(pick);
      setShowConfirm(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
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
        <p className="text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Loading today&apos;s games...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-[rgba(255,179,0,0.1)] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#FFB300]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          </div>
          <h1 className="text-xl font-bold text-[#E8E6E1] mb-2" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Can&apos;t Make Pick</h1>
          <p className="text-[#9BA3AE] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>{error}</p>
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
          <p className="text-[#9BA3AE] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            The pick deadline for {round?.name || 'this round'} has passed.
          </p>
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
        time: formatETShort(team.game_datetime)
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
    <div className="min-h-screen bg-[#0D1B2A] pb-48">
      {/* Sticky sub-header: round name + countdown + current pick */}
      <div className="sticky top-12 z-30 bg-[#111827] border-b border-[rgba(255,255,255,0.05)]">
        <div className="max-w-lg mx-auto px-5 py-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              {round?.name || 'Make Your Pick'}
            </p>
            {deadline && <DeadlineCountdown deadline={deadline} />}
          </div>
          {existingPick && existingPick.team && (
            <div className="mt-1.5 bg-[rgba(255,179,0,0.08)] border border-[rgba(255,179,0,0.2)] rounded-full py-1 px-3 flex items-center justify-center">
              <p className="text-xs text-[#FFB300] truncate" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Current: <strong className="text-[#E8E6E1]">({existingPick.team.seed}) {existingPick.team.name}</strong>
              </p>
            </div>
          )}
        </div>
        {entries.length > 1 && (
          <div className="flex gap-2 px-5 py-1.5 overflow-x-auto scrollbar-hide border-t border-[rgba(255,255,255,0.03)]">
            {entries.map(entry => (
              <button
                key={entry.id}
                onClick={() => {
                  setActiveEntryId(entry.id);
                  loadedRef.current = false;
                  setLoading(true);
                  setExistingPick(null);
                  setSelectedTeam(null);
                  setShowSuccess(false);
                  router.replace(`/pools/${poolId}/pick?entry=${entry.id}`);
                }}
                className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                  (activeEntryId || poolPlayerId) === entry.id
                    ? 'bg-[rgba(255,87,34,0.08)] border-[#FF5722] text-[#FF5722]'
                    : entry.is_eliminated
                    ? 'border-[rgba(255,255,255,0.05)] text-[#9BA3AE] opacity-50'
                    : 'border-[rgba(255,255,255,0.05)] text-[#9BA3AE] hover:text-[#E8E6E1]'
                }`}
                disabled={entry.is_eliminated}
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {entry.entry_label || `Entry ${entry.entry_number}`}
                {entry.is_eliminated && ' ☠️'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-5 py-3">

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <span className="font-bold text-[#E8E6E1]" style={{ fontFamily: "'Space Mono', monospace" }}>{availableCount}</span> teams available
            {usedCount > 0 && (
              <span className="text-[#9BA3AE]"> / <span style={{ fontFamily: "'Space Mono', monospace" }}>{usedCount}</span> used</span>
            )}
          </p>
          {usedCount > 0 && (
            <button
              onClick={() => setFilterUsed(!filterUsed)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filterUsed
                  ? 'bg-[rgba(255,87,34,0.08)] border-[rgba(255,87,34,0.3)] text-[#FF5722]'
                  : 'bg-[#111827] border-[rgba(255,255,255,0.05)] text-[#9BA3AE]'
              }`}
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {filterUsed ? 'Show all' : 'Hide used'}
            </button>
          )}
        </div>

        {displayTeams.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>No games available for today.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(timeSlots.entries()).map(([time, matchups]) => (
              <div key={time}>
                <p className="label mb-3 px-1">{time}</p>
                <div className="space-y-3">
                  {matchups.map(({ gameId, teams: matchupTeams }) => (
                    <div key={gameId} className="space-y-2">
                      {matchupTeams.map((team, idx) => (
                        <div key={team.id}>
                          {idx > 0 && (
                            <div className="flex items-center justify-center py-0.5">
                              <span className="text-[#5F6B7A] text-[9px] font-extrabold uppercase" style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em' }}>
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

      {/* Fixed Bottom Bar — sits above the bottom nav */}
      {selectedTeam && (() => {
        const isSameAsExisting = selectedTeam.id === existingPick?.team_id;
        return (
          <div className="fixed bottom-16 inset-x-0 z-20 bg-[#111827] border-t border-[rgba(255,255,255,0.05)] tab-bar-shadow">
            <div className="max-w-lg mx-auto px-5 py-3">
              <button
                onClick={() => !isSameAsExisting && setShowConfirm(true)}
                disabled={isSameAsExisting}
                className={`w-full py-2.5 rounded-[10px] text-sm font-bold transition-all ${
                  isSameAsExisting
                    ? 'bg-[#1B2A3D] text-[#9BA3AE] cursor-default'
                    : 'btn-orange active:scale-[0.98]'
                }`}
                style={{ fontFamily: "'DM Sans', sans-serif", boxShadow: isSameAsExisting ? 'none' : '0 4px 20px rgba(255, 87, 34, 0.3)' }}
              >
                {isSameAsExisting
                  ? `Current Pick — (${selectedTeam.seed}) ${selectedTeam.name}`
                  : `${existingPick ? 'Change to' : 'Pick'} (${selectedTeam.seed}) ${selectedTeam.name}`
                }
              </button>
            </div>
          </div>
        );
      })()}

      {showConfirm && selectedTeam && (
        <ConfirmModal
          team={selectedTeam}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
          submitting={submitting}
        />
      )}

      {/* Success snackbar — fixed above bottom nav */}
      {showSuccess && existingPick?.team && (
        <div className="fixed bottom-20 left-0 right-0 z-30 max-w-lg mx-auto px-5 animate-slide-up">
          <div className="bg-[#4CAF50] rounded-full px-4 py-2.5 shadow-lg" style={{ boxShadow: '0 4px 20px rgba(76,175,80,0.4)' }}>
            <p className="text-sm text-white text-center font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              ✓ Pick locked in — ({existingPick.team.seed}) {existingPick.team.name}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

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
  getPlayerPicks,
  getTodaysGames,
  submitPick,
  PickError
} from '@/lib/picks';
import { useActivePool } from '@/hooks/useActivePool';
import { supabase } from '@/lib/supabase/client';
import { getSeedWinProbability } from '@/lib/analyze';
import { PickableTeam, PickDeadline, Round, Pick, Game } from '@/types/picks';
import { formatET, formatETShort } from '@/lib/timezone';
import { CountdownTimer } from '@/components/CountdownTimer';

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
  onSelect,
  position,
}: {
  team: PickableTeam;
  isSelected: boolean;
  disabled: boolean;
  onSelect: (team: PickableTeam) => void;
  position: 'top' | 'bottom';
}) {
  const isUsed = team.already_used;
  const prob = getSeedWinProbability(team.seed, team.opponent.seed);
  const pct = Math.round(prob * 100);

  const roundedClass = position === 'top' ? 'rounded-t-[12px]' : 'rounded-b-[12px]';

  return (
    <button
      onClick={() => !disabled && !isUsed && onSelect(team)}
      disabled={disabled || isUsed}
      className={`
        w-full text-left flex items-center gap-2.5 px-3 py-2 pr-3 transition-all ${roundedClass}
        ${isSelected
          ? 'bg-[rgba(255,87,34,0.1)]'
          : isUsed
          ? 'bg-[rgba(13,27,42,0.5)] opacity-40 cursor-not-allowed strikethrough'
          : 'hover:bg-[#1B2A3D] active:bg-[#1B2A3D]'
        }
      `}
    >
      {/* Seed number */}
      <span
        className={`text-center flex-shrink-0 min-w-[1.5rem] ${isSelected ? 'text-[#FF5722]' : 'text-[#5F6B7A]'}`}
        style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: '0.95rem' }}
      >
        {team.seed}
      </span>

      {/* Team name */}
      <div className="flex-1 min-w-0">
        <span className="font-bold text-[#E8E6E1] text-[13px] block truncate leading-tight" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
          {team.name}
        </span>
      </div>

      {/* Win probability or Used badge */}
      <div className="flex-shrink-0 flex items-center gap-2.5">
        {isUsed ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-[rgba(255,255,255,0.08)] text-[#9BA3AE] uppercase" style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em' }}>
            Used
          </span>
        ) : (
          <span
            className={`text-[11px] font-bold min-w-[2.5rem] text-right ${
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
        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          isSelected
            ? 'border-[#FF5722] bg-[#FF5722]'
            : 'border-[rgba(255,255,255,0.12)] bg-transparent'
        }`}>
          {isSelected && (
            <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
      </div>
    </button>
  );
}

// ─── Spectator Header (eliminated users) ─────────────────────────

function SpectatorHeader({
  eliminationInfo,
  pickHistory,
}: {
  eliminationInfo: { roundName: string; teamName: string | null; reason: 'wrong_pick' | 'missed_pick' | 'manual' | null };
  pickHistory: Pick[];
}) {
  const survivedRounds = pickHistory.filter(p => p.is_correct === true).length;

  let reasonText = '';
  if (eliminationInfo.reason === 'wrong_pick' && eliminationInfo.teamName) {
    reasonText = `Picked ${eliminationInfo.teamName}`;
  } else if (eliminationInfo.reason === 'missed_pick') {
    reasonText = 'No pick submitted';
  } else if (eliminationInfo.reason === 'manual') {
    reasonText = 'Manually removed';
  }

  return (
    <div className="bg-[rgba(239,83,80,0.06)] border border-[rgba(239,83,80,0.15)] rounded-[12px] p-5 mb-4">
      <div className="text-center mb-4">
        <span className="text-2xl mb-1 block">☠️</span>
        <h2 className="text-lg font-bold text-[#EF5350]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
          You&apos;re Out
        </h2>
        <p className="text-sm text-[#9BA3AE] mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Eliminated in {eliminationInfo.roundName}
        </p>
        {reasonText && (
          <p className="text-xs text-[#5F6B7A] mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {reasonText}
          </p>
        )}
      </div>

      {pickHistory.length > 0 && (
        <div>
          <p className="label mb-2 text-center">Your Run</p>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {pickHistory.map((pick, i) => {
              let chipClass = 'bg-[rgba(27,58,92,0.3)] text-[#9BA3AE]';
              let icon = '';
              if (pick.is_correct === true) {
                chipClass = 'bg-[rgba(76,175,80,0.15)] text-[#4CAF50]';
                icon = ' ✓';
              } else if (pick.is_correct === false) {
                chipClass = 'bg-[rgba(239,83,80,0.15)] text-[#EF5350]';
                icon = ' ✗';
              }
              return (
                <span
                  key={pick.id}
                  className={`inline-flex items-center px-2 py-1 rounded-[6px] font-bold ${chipClass}`}
                  style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '-0.02em' }}
                >
                  R{i + 1} {pick.team?.abbreviation || '???'}{icon}
                </span>
              );
            })}
          </div>
          <p className="text-xs text-[#9BA3AE] text-center mt-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Survived {survivedRounds} round{survivedRounds !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Spectator Game Card (read-only) ─────────────────────────────

function SpectatorGameCard({ game }: { game: Game }) {
  const team1 = game.team1;
  const team2 = game.team2;
  if (!team1 || !team2) return null;

  const isLive = game.status === 'in_progress';
  const isFinal = game.status === 'final';

  const team1Won = isFinal && game.winner_id === team1.id;
  const team2Won = isFinal && game.winner_id === team2.id;

  return (
    <div className={`border rounded-[12px] overflow-hidden ${
      isLive ? 'border-[rgba(255,179,0,0.3)]' : 'border-[rgba(255,255,255,0.05)]'
    } bg-[#111827]`}>
      {/* Team 1 */}
      <div className={`flex items-center justify-between px-3 py-3 ${team1Won ? 'bg-[rgba(76,175,80,0.05)]' : ''}`}>
        <div className="flex items-center gap-3">
          <span className="text-[#5F6B7A] min-w-[2rem] text-center"
            style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: '1.1rem' }}>
            {team1.seed}
          </span>
          <span className={`font-bold text-sm ${team1Won ? 'text-[#E8E6E1]' : isFinal && team2Won ? 'text-[#5F6B7A]' : 'text-[#E8E6E1]'}`}
            style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
            {team1.name}
          </span>
        </div>
        {(isLive || isFinal) && game.team1_score != null && (
          <span className={`font-bold text-sm ${team1Won ? 'text-[#E8E6E1]' : 'text-[#9BA3AE]'}`}
            style={{ fontFamily: "'Space Mono', monospace" }}>
            {game.team1_score}
          </span>
        )}
      </div>

      {/* VS divider */}
      <div className="flex items-center gap-3 px-4">
        <div className="flex-1 h-px bg-[rgba(255,255,255,0.05)]" />
        <span className="text-[#5F6B7A] text-[9px] font-extrabold uppercase"
          style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em' }}>
          vs
        </span>
        <div className="flex-1 h-px bg-[rgba(255,255,255,0.05)]" />
      </div>

      {/* Team 2 */}
      <div className={`flex items-center justify-between px-3 py-3 ${team2Won ? 'bg-[rgba(76,175,80,0.05)]' : ''}`}>
        <div className="flex items-center gap-3">
          <span className="text-[#5F6B7A] min-w-[2rem] text-center"
            style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: '1.1rem' }}>
            {team2.seed}
          </span>
          <span className={`font-bold text-sm ${team2Won ? 'text-[#E8E6E1]' : isFinal && team1Won ? 'text-[#5F6B7A]' : 'text-[#E8E6E1]'}`}
            style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
            {team2.name}
          </span>
        </div>
        {(isLive || isFinal) && game.team2_score != null && (
          <span className={`font-bold text-sm ${team2Won ? 'text-[#E8E6E1]' : 'text-[#9BA3AE]'}`}
            style={{ fontFamily: "'Space Mono', monospace" }}>
            {game.team2_score}
          </span>
        )}
      </div>

      {/* Game status bar */}
      <div className={`px-3 py-1.5 text-center border-t border-[rgba(255,255,255,0.05)] ${
        isLive ? 'bg-[rgba(255,179,0,0.08)]' : ''
      }`}>
        <span className={`text-[10px] font-bold uppercase ${
          isLive ? 'text-[#FFB300]' : isFinal ? 'text-[#9BA3AE]' : 'text-[#E8E6E1]'
        }`} style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em' }}>
          {isLive ? 'LIVE' : isFinal ? 'FINAL' : formatET(game.game_datetime)}
        </span>
      </div>
    </div>
  );
}

// ─── Main Pick Page ───────────────────────────────────────────────

export default function PickPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { refreshPools } = useActivePool();
  const poolId = params.id as string;
  const entryId = searchParams.get('entry') || undefined;

  const [poolPlayerId, setPoolPlayerId] = useState<string | null>(null);
  const [entries, setEntries] = useState<{ id: string; entry_number: number; entry_label: string | null; is_eliminated: boolean; has_picked: boolean }[]>([]);
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
  const [isEliminated, setIsEliminated] = useState(false);
  const [pickHistory, setPickHistory] = useState<Pick[]>([]);
  const [eliminationInfo, setEliminationInfo] = useState<{
    roundName: string;
    teamName: string | null;
    reason: 'wrong_pick' | 'missed_pick' | 'manual' | null;
  } | null>(null);
  const [spectatorGames, setSpectatorGames] = useState<Game[]>([]);
  const [poolMaxEntries, setPoolMaxEntries] = useState(1);
  const [poolStatus, setPoolStatus] = useState<string>('open');
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [addEntryName, setAddEntryName] = useState('');
  const [addEntryLoading, setAddEntryLoading] = useState(false);
  const [addEntryError, setAddEntryError] = useState('');

  const loadedRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch all user entries for entry switcher
      const { data: allEntries } = await supabase
        .from('pool_players')
        .select('id, entry_number, entry_label, is_eliminated')
        .eq('pool_id', poolId)
        .eq('user_id', user.id)
        .order('entry_number', { ascending: true });

      if (allEntries) setEntries(allEntries.map(e => ({ ...e, has_picked: false })));

      // Fetch pool info for entry limits
      const { data: poolData } = await supabase
        .from('pools')
        .select('max_entries_per_user, status')
        .eq('id', poolId)
        .single();
      if (poolData) {
        setPoolMaxEntries(poolData.max_entries_per_user ?? 1);
        setPoolStatus(poolData.status);
      }

      const poolPlayer = await getPoolPlayer(poolId, user.id, activeEntryId);
      if (!poolPlayer) { setError('You are not a member of this pool.'); setLoading(false); return; }
      setPoolPlayerId(poolPlayer.id);

      if (poolPlayer.is_eliminated) {
        setIsEliminated(true);

        // Load pick history for "Your Run" section
        const history = await getPlayerPicks(poolPlayer.id);
        setPickHistory(history);

        // Build elimination info
        let roundName = 'Unknown Round';
        if (poolPlayer.elimination_round_id) {
          const { data: elimRound } = await supabase
            .from('rounds')
            .select('name')
            .eq('id', poolPlayer.elimination_round_id)
            .single();
          if (elimRound) roundName = elimRound.name;
        }

        let teamName: string | null = null;
        if (poolPlayer.elimination_reason === 'wrong_pick') {
          const fatalPick = history.find(p => p.is_correct === false);
          teamName = fatalPick?.team?.name || null;
        }

        setEliminationInfo({
          roundName,
          teamName,
          reason: poolPlayer.elimination_reason,
        });
      }

      const activeRound = await getActiveRound();
      if (!activeRound) {
        if (poolPlayer.is_eliminated) { setLoading(false); return; }
        setError('No active round. Check back when the tournament is underway.'); setLoading(false); return;
      }
      setRound(activeRound);

      // Fetch pick status for all entries to color-code tabs
      if (allEntries && allEntries.length > 0) {
        const entryIds = allEntries.map(e => e.id);
        const { data: entryPicks } = await supabase
          .from('picks')
          .select('pool_player_id')
          .in('pool_player_id', entryIds)
          .eq('round_id', activeRound.id);
        const pickedIds = new Set(entryPicks?.map(p => p.pool_player_id) || []);
        setEntries(allEntries.map(e => ({ ...e, has_picked: pickedIds.has(e.id) })));
      }

      const dl = await getPickDeadline(activeRound.id);
      setDeadline(dl);

      if (poolPlayer.is_eliminated) {
        // Spectator: load read-only game data
        const gamesData = await getTodaysGames(activeRound.id);
        setSpectatorGames(gamesData);
      } else {
        // Normal pick flow
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
      }
    } catch (err) {
      console.error('Failed to load pick data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user, poolId, activeEntryId]);

  useEffect(() => {
    // Don't attempt loading until auth resolves
    if (!user) return;
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadData();
    }
  }, [loadData, user]);


  const handleConfirm = async () => {
    if (!selectedTeam || !poolPlayerId || !round) return;
    setSubmitting(true);
    try {
      const pick = await submitPick({ pool_player_id: poolPlayerId, round_id: round.id, team_id: selectedTeam.id });
      setExistingPick(pick);
      setShowConfirm(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
      refreshPools();
    } catch (err) {
      const message = err instanceof PickError ? err.message : 'Failed to submit pick. Please try again.';
      setError(message);
      setShowConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddEntry = async () => {
    if (!user) return;
    setAddEntryLoading(true);
    setAddEntryError('');
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const baseName = authUser?.user_metadata?.display_name || authUser?.email?.split('@')[0] || 'Player';
      const entryNumber = entries.length + 1;
      const entryLabel = addEntryName.trim() || `${baseName}'s Entry ${entryNumber}`;
      const { error: insertError } = await supabase.from('pool_players').insert({
        pool_id: poolId,
        user_id: user.id,
        display_name: baseName,
        entry_number: entryNumber,
        entry_label: entryLabel,
      });
      if (insertError) throw insertError;
      setShowAddEntry(false);
      setAddEntryName('');
      loadedRef.current = false;
      loadData();
    } catch (err: any) {
      setAddEntryError(err.message || 'Failed to add entry');
    } finally {
      setAddEntryLoading(false);
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
          <p className="text-[#9BA3AE] text-sm mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { loadedRef.current = false; loadData(); }}
              className="px-5 py-2.5 rounded-[10px] border border-[rgba(255,255,255,0.05)] text-[#9BA3AE] text-sm font-semibold hover:text-[#E8E6E1] hover:border-[rgba(255,87,34,0.3)] transition-colors"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Retry
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-5 py-2.5 rounded-[10px] btn-orange text-sm font-semibold"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (deadline?.is_expired && !isEliminated) {
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

  const canAddEntry = poolMaxEntries > 1
    && entries.length < poolMaxEntries
    && poolStatus === 'open';

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
        <div className="max-w-lg mx-auto px-5 py-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              {round?.name || 'Make Your Pick'}
            </p>
            {isEliminated && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-[4px] bg-[rgba(239,83,80,0.1)] text-[#EF5350]"
                style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em' }}>
                SPECTATING
              </span>
            )}
            {!isEliminated && deadline?.is_expired && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-[4px] bg-[#EF5350] text-[#E8E6E1]"
                style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                LOCKED
              </span>
            )}
          </div>
          {!isEliminated && deadline && !deadline.is_expired && (
            <div className="mt-1">
              <CountdownTimer
                target={deadline.deadline_datetime}
                label="PICKS LOCK IN"
                urgentLabel="⚠ DEADLINE APPROACHING"
                urgentThresholdMs={1800000}
                size="sm"
              />
            </div>
          )}
          {!isEliminated && existingPick && existingPick.team && (
            <div className="mt-1 bg-[rgba(255,179,0,0.08)] border border-[rgba(255,179,0,0.2)] rounded-full py-0.5 px-3 flex items-center justify-center">
              <p className="text-[10px] text-[#FFB300] truncate" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Current: <strong className="text-[#E8E6E1]">({existingPick.team.seed}) {existingPick.team.name}</strong>
              </p>
            </div>
          )}
        </div>
        {(entries.length > 1 || canAddEntry) && (
          <div className="border-t border-[rgba(255,255,255,0.03)]">
            <div className="flex md:justify-center gap-1.5 px-5 py-1 overflow-x-auto scrollbar-hide">
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
                    setIsEliminated(false);
                    setPickHistory([]);
                    setEliminationInfo(null);
                    setSpectatorGames([]);
                    setShowAddEntry(false);
                    router.replace(`/pools/${poolId}/pick?entry=${entry.id}`);
                  }}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                    (activeEntryId || poolPlayerId) === entry.id
                      ? entry.is_eliminated
                        ? 'bg-[rgba(239,83,80,0.08)] border-[#EF5350] text-[#EF5350]'
                        : 'bg-[rgba(255,87,34,0.08)] border-[#FF5722] text-[#FF5722]'
                      : entry.is_eliminated
                      ? 'bg-[rgba(239,83,80,0.04)] border-[rgba(239,83,80,0.2)] text-[#EF5350] opacity-60'
                      : entry.has_picked
                      ? 'bg-[rgba(76,175,80,0.06)] border-[rgba(76,175,80,0.25)] text-[#4CAF50]'
                      : 'bg-[rgba(255,179,0,0.06)] border-[rgba(255,179,0,0.25)] text-[#FFB300]'
                  }`}
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {entry.entry_label || `Entry ${entry.entry_number}`}
                  {entry.is_eliminated && ' ☠️'}
                </button>
              ))}
              {canAddEntry && (
                <button
                  onClick={() => { setShowAddEntry(!showAddEntry); setAddEntryError(''); }}
                  className="flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold text-[#FF5722] transition-colors hover:bg-[rgba(255,87,34,0.05)]"
                  style={{ fontFamily: "'DM Sans', sans-serif", border: '1px dashed rgba(255,87,34,0.3)' }}
                >
                  + Entry
                </button>
              )}
            </div>
            {showAddEntry && (
              <div className="px-5 py-2 border-t border-[rgba(255,255,255,0.03)]">
                {addEntryError && (
                  <p className="text-xs text-[#EF5350] mb-1.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>{addEntryError}</p>
                )}
                <div className="flex gap-2 max-w-sm mx-auto">
                  <input
                    type="text"
                    value={addEntryName}
                    onChange={(e) => setAddEntryName(e.target.value)}
                    maxLength={60}
                    className="flex-1 min-w-0 px-3 py-1.5 bg-[#1B2A3D] border border-[rgba(255,255,255,0.05)] rounded-[8px] text-xs text-[#E8E6E1] placeholder-[#9BA3AE] focus:outline-none focus:ring-1 focus:ring-[#FF5722]"
                    placeholder={`Entry ${entries.length + 1} name (optional)`}
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  />
                  <button
                    onClick={handleAddEntry}
                    disabled={addEntryLoading}
                    className="px-3 py-1.5 rounded-[8px] text-xs font-semibold btn-orange disabled:opacity-50"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {addEntryLoading ? '...' : 'Add'}
                  </button>
                  <button
                    onClick={() => { setShowAddEntry(false); setAddEntryName(''); setAddEntryError(''); }}
                    className="px-2.5 py-1.5 rounded-[8px] text-xs font-semibold text-[#9BA3AE] hover:text-[#E8E6E1] transition-colors"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-5 py-3">
        {isEliminated && eliminationInfo ? (
          <>
            <SpectatorHeader eliminationInfo={eliminationInfo} pickHistory={pickHistory} />

            {round && spectatorGames.length > 0 ? (
              <>
                <p className="label mb-3">{round.name} Games</p>
                <div className="space-y-3">
                  {spectatorGames.map(game => (
                    <SpectatorGameCard key={game.id} game={game} />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  No games scheduled right now. Check back on game day.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
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
              <div className="space-y-5">
                {Array.from(timeSlots.entries()).map(([time, matchups]) => (
                  <div key={time}>
                    <p className="label mb-2 px-1">{time}</p>
                    <div className="space-y-2.5">
                      {matchups.map(({ gameId, teams: matchupTeams }) => {
                        const hasSelection = matchupTeams.some(t => selectedTeam?.id === t.id);
                        return (
                          <div
                            key={gameId}
                            className={`border rounded-[10px] overflow-hidden transition-colors ${
                              hasSelection
                                ? 'border-[#FF5722] bg-[#111827]'
                                : 'border-[rgba(255,255,255,0.05)] bg-[#111827]'
                            }`}
                          >
                            {matchupTeams.map((team, idx) => (
                              <div key={team.id}>
                                {idx > 0 && (
                                  <div className="flex items-center gap-3 px-3">
                                    <div className="flex-1 h-px bg-[rgba(255,255,255,0.05)]" />
                                    <span className="text-[#5F6B7A] text-[8px] font-extrabold uppercase" style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em' }}>
                                      vs
                                    </span>
                                    <div className="flex-1 h-px bg-[rgba(255,255,255,0.05)]" />
                                  </div>
                                )}
                                <TeamCard
                                  team={team}
                                  isSelected={selectedTeam?.id === team.id}
                                  disabled={deadline?.is_expired ?? false}
                                  onSelect={setSelectedTeam}
                                  position={idx === 0 ? 'top' : 'bottom'}
                                />
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Fixed Bottom Bar — sits above the bottom nav */}
      {!isEliminated && selectedTeam && (() => {
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

      {!isEliminated && showConfirm && selectedTeam && (
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

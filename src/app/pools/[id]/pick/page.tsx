'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/lib/supabase/client';
import { PickableTeam, PickDeadline, Round, Pick, Game } from '@/types/picks';
import { formatET, formatDateET } from '@/lib/timezone';
import { mapRoundNameToCode, ROUND_COLORS } from '@/lib/bracket';
import { TeamLogo, getESPNStatsUrl } from '@/components/TeamLogo';

const REGION_ORDER = ['South', 'East', 'West', 'Midwest'];

function formatCompactTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).replace(' AM', 'A').replace(' PM', 'P') + ' ET';
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
            <p className="text-label-accent mb-3">Your pick</p>
            <div className="flex justify-center mb-2">
              <TeamLogo espnTeamId={team.espn_team_id} teamName={team.name} size="lg" />
            </div>
            <p className="text-2xl font-extrabold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              ({team.seed}) {team.name}
            </p>
            <p className="text-sm text-[#9BA3AE] mt-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              vs ({team.opponent.seed}) {team.opponent.name}
            </p>
            <p className="text-xs text-[#9BA3AE] mt-1" style={{ fontFamily: "'Space Mono', monospace" }}>
              {formatET(team.game_datetime)}
            </p>
            {team.espn_team_id && (
              <a
                href={getESPNStatsUrl(team.espn_team_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-xs text-[#FF5722] hover:text-[#FF7043] transition-colors"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                View team stats &rarr;
              </a>
            )}
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

// ─── Compact Game Card ────────────────────────────────────────────

function CompactGameCard({
  teams,
  selectedTeam,
  onSelect,
  disabled,
}: {
  teams: PickableTeam[];
  selectedTeam: PickableTeam | null;
  onSelect: (team: PickableTeam) => void;
  disabled: boolean;
}) {
  const time = formatCompactTime(teams[0].game_datetime);
  const hasSelection = teams.some(t => selectedTeam?.id === t.id);

  return (
    <div className={`rounded-[6px] overflow-hidden transition-all ${
      hasSelection
        ? 'border border-[rgba(255,87,34,0.3)] shadow-[0_0_12px_rgba(255,87,34,0.08)]'
        : 'border border-[rgba(255,255,255,0.05)]'
    } bg-[#111827]`}>
      {/* Time strip */}
      <div className="flex items-center px-2.5 py-[3px] bg-[#1B2A3D]">
        <span className="text-[10px] font-bold text-[#5F6B7A] tracking-[0.08em]"
          style={{ fontFamily: "'Space Mono', monospace" }}>
          {time}
        </span>
      </div>
      {/* Team rows */}
      {teams.map((team, idx) => {
        const isSelected = selectedTeam?.id === team.id;
        const isUsed = team.already_used;
        return (
          <button
            key={team.id}
            onClick={() => !disabled && !isUsed && onSelect(team)}
            disabled={disabled || isUsed}
            className={`w-full flex items-center gap-1.5 px-2.5 py-[7px] sm:py-[9px] text-left transition-all ${
              idx === 0 ? 'border-b border-[rgba(255,255,255,0.05)]' : ''
            } ${
              isSelected
                ? 'bg-[rgba(255,87,34,0.08)] border-l-[2.5px] border-l-[#FF5722]'
                : 'border-l-[2.5px] border-l-transparent'
            } ${isUsed ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span className={`text-[11px] font-bold min-w-[16px] text-center flex-shrink-0 ${
              isSelected ? 'text-[#FF5722]' : 'text-[#5F6B7A]'
            }`} style={{ fontFamily: "'Oswald', sans-serif" }}>
              {team.seed}
            </span>
            <span className={`text-[13px] flex-1 truncate ${
              isSelected ? 'text-[#FF5722] font-bold' : 'text-[#E8E6E1] font-semibold'
            } ${isUsed ? 'line-through' : ''}`}
              style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              {team.name}
            </span>
            {isUsed && (
              <span className="text-[9px] font-bold text-[#EF5350] tracking-[0.1em] flex-shrink-0"
                style={{ fontFamily: "'Space Mono', monospace" }}>
                USED
              </span>
            )}
            {isSelected && (
              <span className="text-[11px] font-bold text-[#FF5722] flex-shrink-0"
                style={{ fontFamily: "'Space Mono', monospace" }}>
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Pick Timeline ────────────────────────────────────────────────

function PickTimeline({
  rounds,
  picks,
  currentRoundId,
}: {
  rounds: Round[];
  picks: Pick[];
  currentRoundId: string | null;
}) {
  const currentIdx = rounds.findIndex(r => r.id === currentRoundId);

  return (
    <div className="flex flex-col">
      {rounds.map((round, idx) => {
        const pick = picks.find(p => p.round_id === round.id);
        const isCurrent = round.id === currentRoundId;
        const isPast = currentIdx >= 0 && idx < currentIdx;
        const isFuture = currentIdx >= 0 && idx > currentIdx;
        const survived = pick?.is_correct === true;
        const eliminated = pick?.is_correct === false;
        const roundCode = mapRoundNameToCode(round.name);
        const roundColor = ROUND_COLORS[roundCode] || '#5F6B7A';

        return (
          <div key={round.id} className="flex items-stretch gap-2 sm:gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center w-5 flex-shrink-0">
              {idx > 0 && (
                <div className={`w-[2px] flex-1 ${
                  isPast && survived ? 'bg-[#4CAF50]' : 'bg-[rgba(255,255,255,0.05)]'
                }`} />
              )}
              <div className={`rounded-full flex-shrink-0 ${
                isCurrent ? 'w-3 h-3 border-2 border-[#FF5722]' : 'w-2 h-2'
              }`} style={{
                background: survived ? '#4CAF50' : eliminated ? '#EF5350' : isCurrent ? '#FF5722' : '#243447',
                boxShadow: isCurrent ? '0 0 8px rgba(255,87,34,0.27)' : 'none',
              }} />
              {idx < rounds.length - 1 && (
                <div className="w-[2px] flex-1 bg-[rgba(255,255,255,0.05)]" />
              )}
            </div>
            {/* Content */}
            <div className={`flex-1 pb-1 ${idx > 0 ? 'pt-0.5' : ''} ${isFuture ? 'opacity-30' : ''}`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-bold tracking-[0.1em]"
                  style={{ fontFamily: "'Space Mono', monospace", color: isCurrent ? '#FF5722' : roundColor }}>
                  {round.name}
                </span>
                <span className="text-[9px] text-[#3D4654] tracking-[0.06em]"
                  style={{ fontFamily: "'Space Mono', monospace" }}>
                  {formatDateET(round.date)}
                </span>
                {isCurrent && (
                  <span className="text-[9px] font-bold text-[#FF5722] bg-[rgba(255,87,34,0.08)] px-1.5 py-px rounded-full tracking-[0.1em] border border-[rgba(255,87,34,0.3)]"
                    style={{ fontFamily: "'Space Mono', monospace" }}>
                    NOW
                  </span>
                )}
              </div>
              {pick && pick.team ? (
                <div className={`inline-flex items-center gap-1.5 px-2 py-[3px] rounded-[4px] border ${
                  survived
                    ? 'bg-[rgba(76,175,80,0.12)] border-[rgba(76,175,80,0.15)]'
                    : eliminated
                    ? 'bg-[rgba(239,83,80,0.12)] border-[rgba(239,83,80,0.15)]'
                    : 'bg-[#1B2A3D] border-[rgba(255,255,255,0.08)]'
                }`}>
                  <span className="text-[10px] font-bold text-[#5F6B7A]"
                    style={{ fontFamily: "'Oswald', sans-serif" }}>
                    {pick.team.seed}
                  </span>
                  <span className={`text-[12px] font-bold uppercase ${
                    survived ? 'text-[#4CAF50]' : eliminated ? 'text-[#EF5350]' : 'text-[#E8E6E1]'
                  }`} style={{ fontFamily: "'Oswald', sans-serif" }}>
                    {pick.team.name}
                  </span>
                </div>
              ) : isCurrent ? (
                <span className="text-[11px] font-semibold text-[#FF5722] tracking-[0.1em]"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  ↑ PICKING NOW
                </span>
              ) : (
                <span className="text-[11px] text-[#3D4654] tracking-[0.1em]"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  —
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
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

      {/* Divider */}
      <div className="border-t border-[rgba(255,255,255,0.05)]" />

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
  const { refreshPools, pools, setActivePool } = useActivePool();
  const poolId = params.id as string;
  const entryId = searchParams.get('entry') || undefined;

  // Existing state
  const [poolPlayerId, setPoolPlayerId] = useState<string | null>(null);
  const [entries, setEntries] = useState<{ id: string; entry_number: number; entry_label: string | null; is_eliminated: boolean; has_picked: boolean }[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | undefined>(entryId);
  const [round, setRound] = useState<Round | null>(null);
  const [deadline, setDeadline] = useState<PickDeadline | null>(null);
  const [teams, setTeams] = useState<PickableTeam[]>([]);
  const [existingPick, setExistingPick] = useState<Pick | null>(null);

  const [selectedTeam, setSelectedTeam] = useState<PickableTeam | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  // New state
  const [allRounds, setAllRounds] = useState<Round[]>([]);
  const [poolDropdownOpen, setPoolDropdownOpen] = useState(false);
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [now, setNow] = useState(Date.now());

  const { addToast } = useToast();
  const loadedRef = useRef(false);

  // Mobile detection
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);
      if (!mobile) setExpandedRegion(null);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Ticking clock for status bar countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Set default expanded region on mobile after teams load
  useEffect(() => {
    if (isMobile && teams.length > 0 && expandedRegion === null) {
      const firstRegion = REGION_ORDER.find(r => teams.some(t => t.region === r));
      if (firstRegion) setExpandedRegion(firstRegion);
    }
  }, [isMobile, teams, expandedRegion]);

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

      // Fetch all rounds for timeline + day counting
      const { data: allRoundsData } = await supabase
        .from('rounds')
        .select('*')
        .order('date', { ascending: true });
      if (allRoundsData) setAllRounds(allRoundsData);

      const poolPlayer = await getPoolPlayer(poolId, user.id, activeEntryId);
      if (!poolPlayer) { setError('You are not a member of this pool.'); setLoading(false); return; }
      setPoolPlayerId(poolPlayer.id);

      // Always fetch pick history for timeline (not just eliminated users)
      const history = await getPlayerPicks(poolPlayer.id);
      setPickHistory(history);

      if (poolPlayer.is_eliminated) {
        setIsEliminated(true);

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
        const gamesData = await getTodaysGames(activeRound.id);
        setSpectatorGames(gamesData);
      } else {
        const existing = await getPlayerPick(poolPlayer.id, activeRound.id);
        if (existing) {
          setExistingPick(existing);
        }

        const pickable = await getPickableTeams(poolPlayer.id, activeRound.id);
        setTeams(pickable);

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
    if (!user) return;
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadData();
    }
  }, [loadData, user]);

  const handleConfirm = async () => {
    if (!selectedTeam || !poolPlayerId || !round) return;
    setSubmitting(true);
    const teamForRetry = selectedTeam;
    try {
      const pick = await submitPick({ pool_player_id: poolPlayerId, round_id: round.id, team_id: selectedTeam.id });
      setExistingPick(pick);
      setShowConfirm(false);
      addToast('success', `Pick locked in — (${selectedTeam.seed}) ${selectedTeam.name}`);
      refreshPools();
    } catch (err) {
      setShowConfirm(false);
      setTimeout(async () => {
        try {
          const pick = await submitPick({ pool_player_id: poolPlayerId, round_id: round.id, team_id: teamForRetry.id });
          setExistingPick(pick);
          addToast('success', `Pick locked in — (${teamForRetry.seed}) ${teamForRetry.name}`);
          refreshPools();
        } catch (retryErr) {
          const message = retryErr instanceof PickError ? retryErr.message : 'Failed to submit pick. Please try again.';
          addToast('error', message);
        }
      }, 2000);
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

  // Region grouping (computed before conditional returns so hooks are stable)
  const regionGroups = useMemo(() => {
    if (teams.length === 0) return [];

    const gameMap = new Map<string, PickableTeam[]>();
    for (const team of teams) {
      if (!gameMap.has(team.game_id)) gameMap.set(team.game_id, []);
      gameMap.get(team.game_id)!.push(team);
    }

    const groups = new Map<string, { gameId: string; teams: PickableTeam[] }[]>();
    for (const [gameId, matchupTeams] of gameMap) {
      const region = matchupTeams[0]?.region || 'Unknown';
      if (!groups.has(region)) groups.set(region, []);
      matchupTeams.sort((a, b) => a.seed - b.seed);
      groups.get(region)!.push({ gameId, teams: matchupTeams });
    }

    for (const games of groups.values()) {
      games.sort((a, b) => new Date(a.teams[0].game_datetime).getTime() - new Date(b.teams[0].game_datetime).getTime());
    }

    return REGION_ORDER.filter(r => groups.has(r)).map(r => ({
      region: r,
      games: groups.get(r)!,
    }));
  }, [teams]);

  // ─── Loading / Error / Deadline screens ────────────────────────

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

  // ─── Computed values ───────────────────────────────────────────

  const canAddEntry = poolMaxEntries > 1
    && entries.length < poolMaxEntries
    && poolStatus === 'open';

  const currentPoolData = pools.find(p => p.pool_id === poolId);
  const gameCount = teams.length > 0 ? Math.floor(teams.length / 2) : 0;

  const currentDayIdx = allRounds.findIndex(r => r.id === round?.id);
  const dayStr = currentDayIdx >= 0 ? `DAY ${currentDayIdx + 1} OF ${allRounds.length}` : '';

  const pickStr = existingPick && existingPick.team
    ? `(${existingPick.team.seed}) ${existingPick.team.abbreviation}`
    : 'FIRST PICK';

  // Status bar countdown
  const deadlineDiff = deadline && !deadline.is_expired
    ? Math.max(0, new Date(deadline.deadline_datetime).getTime() - now)
    : 0;
  const cHours = Math.floor(deadlineDiff / 3600000);
  const cMinutes = Math.floor((deadlineDiff % 3600000) / 60000);
  const cSeconds = Math.floor((deadlineDiff % 60000) / 1000);
  const countdownStr = cHours > 0
    ? `${cHours}:${String(cMinutes).padStart(2, '0')}:${String(cSeconds).padStart(2, '0')}`
    : `${cMinutes}:${String(cSeconds).padStart(2, '0')}`;

  // Which region has the selected pick
  const selectedRegion = selectedTeam
    ? regionGroups.find(rg => rg.games.some(g => g.teams.some(t => t.id === selectedTeam.id)))?.region || null
    : null;

  // Lock button state
  const isSameAsExisting = selectedTeam?.id === existingPick?.team_id;

  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-48">

      {/* ═══ TOP BAR (Header) ═══ */}
      <div className="bg-[#080810] border-b border-[rgba(255,255,255,0.08)]">
        <div className="max-w-[740px] mx-auto px-4 sm:px-6 py-3 sm:py-4">

          {/* Header row: label/title + round info */}
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <div className="text-[10px] font-bold text-[#FF5722] tracking-[0.2em] mb-0.5"
                style={{ fontFamily: "'Space Mono', monospace" }}>
                PICK TAB
              </div>
              <div className="text-lg sm:text-xl font-bold text-[#E8E6E1] uppercase"
                style={{ fontFamily: "'Oswald', sans-serif" }}>
                Make Your Pick
              </div>
            </div>
            {round && (
              <div className="text-right px-3 sm:px-3.5 py-2 sm:py-2.5 bg-[#0D1B2A] rounded-[10px] border-[1.5px] border-[rgba(255,255,255,0.12)]">
                <div className="text-[10px] font-bold text-[#9BA3AE] tracking-[0.15em] mb-[3px]"
                  style={{ fontFamily: "'Space Mono', monospace" }}>
                  ROUND
                </div>
                <div className="text-base sm:text-lg font-bold text-[#E8E6E1] leading-tight"
                  style={{ fontFamily: "'Oswald', sans-serif" }}>
                  {round.name}
                </div>
                <div className="flex items-center justify-end gap-1.5 mt-1">
                  <span className="text-[10px] font-bold text-[#E8E6E1] tracking-[0.06em]"
                    style={{ fontFamily: "'Space Mono', monospace" }}>
                    {gameCount} GAMES
                  </span>
                  <span className="text-[10px] font-bold text-[#FF5722] bg-[rgba(255,87,34,0.08)] px-1.5 py-[2px] rounded-[3px] border border-[rgba(255,87,34,0.3)] tracking-[0.06em]"
                    style={{ fontFamily: "'Space Mono', monospace" }}>
                    {formatDateET(round.date)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Pool Selector */}
          <div className="relative mb-2">
            <button
              onClick={() => setPoolDropdownOpen(!poolDropdownOpen)}
              className={`w-full flex items-center justify-between px-3 sm:px-3.5 py-2 sm:py-2.5 bg-[#111827] rounded-[10px] transition-colors ${
                poolDropdownOpen ? 'border border-[#FF5722]' : 'border border-[rgba(255,255,255,0.08)]'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[9px] font-bold text-[#5F6B7A] bg-[#243447] px-1.5 py-[2px] rounded-[3px] tracking-[0.12em] flex-shrink-0"
                  style={{ fontFamily: "'Space Mono', monospace" }}>
                  POOL
                </span>
                <span className="text-sm sm:text-[0.9rem] font-semibold text-[#E8E6E1] truncate"
                  style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                  {currentPoolData?.pool_name || 'Loading...'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-[#4CAF50] tracking-[0.06em]"
                  style={{ fontFamily: "'Space Mono', monospace" }}>
                  {currentPoolData?.alive_players ?? '-'}/{currentPoolData?.total_players ?? '-'}
                </span>
                <span className={`text-[10px] text-[#5F6B7A] transition-transform ${
                  poolDropdownOpen ? 'rotate-180' : ''
                }`}>▼</span>
              </div>
            </button>

            {/* Pool dropdown */}
            {poolDropdownOpen && (
              <>
                <div className="fixed inset-0 z-[99]" onClick={() => setPoolDropdownOpen(false)} />
                {pools.length > 1 && (
                  <div className="absolute top-full left-0 right-0 z-[100] mt-[3px] bg-[#1B2A3D] border border-[rgba(255,255,255,0.12)] rounded-[10px] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
                    {pools.map(p => (
                      <button
                        key={p.pool_id}
                        onClick={() => {
                          setPoolDropdownOpen(false);
                          setActivePool(p.pool_id, p.pool_name);
                          router.push(`/pools/${p.pool_id}/pick`);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 transition-colors ${
                          p.pool_id === poolId
                            ? 'bg-[rgba(255,87,34,0.08)] border-l-[3px] border-l-[#FF5722]'
                            : 'border-l-[3px] border-l-transparent hover:bg-[rgba(255,255,255,0.03)]'
                        }`}
                      >
                        <div className="text-left">
                          <div className={`text-sm font-semibold uppercase ${
                            p.pool_id === poolId ? 'text-[#FF5722]' : 'text-[#E8E6E1]'
                          }`} style={{ fontFamily: "'Oswald', sans-serif" }}>
                            {p.pool_name}
                          </div>
                          <div className="text-[9px] text-[#5F6B7A] tracking-[0.06em] mt-0.5"
                            style={{ fontFamily: "'Space Mono', monospace" }}>
                            {p.your_entry_count} {p.your_entry_count === 1 ? 'ENTRY' : 'ENTRIES'}
                          </div>
                        </div>
                        <span className="text-[10px] text-[#4CAF50] tracking-[0.06em]"
                          style={{ fontFamily: "'Space Mono', monospace" }}>
                          {p.alive_players}/{p.total_players}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Entry Tabs */}
          {(entries.length > 1 || canAddEntry) && (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {entries.map(entry => {
                const isActiveEntry = (activeEntryId || poolPlayerId) === entry.id;
                return (
                  <button
                    key={entry.id}
                    onClick={() => {
                      setActiveEntryId(entry.id);
                      loadedRef.current = false;
                      setLoading(true);
                      setExistingPick(null);
                      setSelectedTeam(null);
                      setIsEliminated(false);
                      setPickHistory([]);
                      setEliminationInfo(null);
                      setSpectatorGames([]);
                      setShowAddEntry(false);
                      setExpandedRegion(null);
                      router.replace(`/pools/${poolId}/pick?entry=${entry.id}`);
                    }}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-[7px] rounded-[6px] whitespace-nowrap transition-all ${
                      isActiveEntry
                        ? 'bg-[#1B2A3D] border-[1.5px] border-[#FF5722]'
                        : 'border border-[rgba(255,255,255,0.08)]'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      entry.is_eliminated ? 'bg-[#EF5350]' : entry.has_picked ? 'bg-[#4CAF50]' : 'bg-[#FFB300]'
                    }`} style={{
                      boxShadow: entry.is_eliminated
                        ? '0 0 4px rgba(239,83,80,0.27)'
                        : entry.has_picked
                        ? '0 0 4px rgba(76,175,80,0.27)'
                        : '0 0 4px rgba(255,179,0,0.27)'
                    }} />
                    <span className={`text-xs uppercase ${
                      isActiveEntry ? 'text-[#E8E6E1] font-bold' : 'text-[#9BA3AE] font-medium'
                    }`} style={{ fontFamily: "'Oswald', sans-serif" }}>
                      {entry.entry_label || `Entry ${entry.entry_number}`}
                      {entry.is_eliminated && ' ☠️'}
                    </span>
                  </button>
                );
              })}
              {canAddEntry && (
                <button
                  onClick={() => { setShowAddEntry(!showAddEntry); setAddEntryError(''); }}
                  className="flex-shrink-0 px-2.5 py-1.5 rounded-[6px] text-xs font-semibold text-[#FF5722] transition-colors hover:bg-[rgba(255,87,34,0.05)]"
                  style={{ fontFamily: "'DM Sans', sans-serif", border: '1px dashed rgba(255,87,34,0.3)' }}
                >
                  + Entry
                </button>
              )}
            </div>
          )}

          {/* Add Entry Form */}
          {showAddEntry && (
            <div className="mt-2 pt-2 border-t border-[rgba(255,255,255,0.03)]">
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
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="max-w-[740px] mx-auto px-4 sm:px-6 py-3 sm:py-5">

        {/* Status Bar */}
        {!isEliminated && deadline && !deadline.is_expired && (
          <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-[rgba(76,175,80,0.12)] border border-[rgba(76,175,80,0.15)] rounded-[10px] mb-3 sm:mb-4">
            <div className="w-2 h-2 rounded-full bg-[#4CAF50] flex-shrink-0 animate-pulse" />
            <div className="text-xs font-bold text-[#4CAF50] uppercase"
              style={{ fontFamily: "'Oswald', sans-serif" }}>
              ALIVE
            </div>
            <div className="text-[10px] text-[#5F6B7A] tracking-[0.08em]"
              style={{ fontFamily: "'Space Mono', monospace" }}>
              {dayStr}{dayStr && ' · '}{pickStr}
            </div>
            <div className="ml-auto flex items-center gap-1 px-2 py-[3px] bg-[rgba(255,179,0,0.12)] rounded-full border border-[rgba(255,179,0,0.15)]">
              <span className="text-[9px] font-bold text-[#FFB300] tracking-[0.1em]"
                style={{ fontFamily: "'Space Mono', monospace" }}>
                LOCKS
              </span>
              <span className="text-[11px] font-bold text-[#FFB300]"
                style={{ fontFamily: "'Space Mono', monospace" }}>
                {countdownStr}
              </span>
            </div>
          </div>
        )}

        {isEliminated && (
          <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-[rgba(239,83,80,0.12)] border border-[rgba(239,83,80,0.15)] rounded-[10px] mb-3 sm:mb-4">
            <div className="w-2 h-2 rounded-full bg-[#EF5350] flex-shrink-0" />
            <div className="text-xs font-bold text-[#EF5350] uppercase"
              style={{ fontFamily: "'Oswald', sans-serif" }}>
              ELIMINATED
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-[4px] bg-[rgba(239,83,80,0.1)] text-[#EF5350] ml-auto"
              style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em' }}>
              SPECTATING
            </span>
          </div>
        )}

        {/* ═══ MAIN CONTENT ═══ */}
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
            {/* ═══ GAMES BY REGION ═══ */}
            {regionGroups.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>No games available for today.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 sm:gap-3">
                {regionGroups.map(({ region, games }) => {
                  const hasPickInRegion = selectedRegion === region;
                  const isMobExpanded = expandedRegion === region;
                  const showGames = !isMobile || isMobExpanded;

                  return (
                    <div
                      key={region}
                      className={`rounded-[14px] overflow-hidden transition-all ${
                        hasPickInRegion
                          ? 'border border-[rgba(255,87,34,0.3)] shadow-[0_0_16px_rgba(255,87,34,0.06)]'
                          : 'border border-[rgba(255,255,255,0.05)]'
                      } bg-[#080810]`}
                    >
                      {/* Region Header */}
                      <div
                        onClick={() => isMobile && setExpandedRegion(isMobExpanded ? null : region)}
                        className={`flex items-center justify-between px-3 sm:px-4 py-2.5 bg-[#111827] ${
                          showGames ? 'border-b border-[rgba(255,255,255,0.05)]' : ''
                        } ${isMobile ? 'cursor-pointer' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-5 rounded-sm bg-[#FF5722] flex-shrink-0" />
                          <span className="text-sm sm:text-[0.95rem] font-bold text-[#E8E6E1] uppercase"
                            style={{ fontFamily: "'Oswald', sans-serif" }}>
                            {region}
                          </span>
                          <span className="text-[10px] font-bold text-[#5F6B7A] bg-[#243447] px-1.5 py-[2px] rounded-[3px] tracking-[0.1em]"
                            style={{ fontFamily: "'Space Mono', monospace" }}>
                            {games.length} GAMES
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasPickInRegion && selectedTeam && (
                            <span className="text-[10px] font-bold text-[#FF5722] bg-[rgba(255,87,34,0.08)] px-1.5 py-[2px] rounded-full tracking-[0.08em] border border-[rgba(255,87,34,0.3)]"
                              style={{ fontFamily: "'Space Mono', monospace" }}>
                              PICK: {selectedTeam.name}
                            </span>
                          )}
                          {isMobile && (
                            <span className={`text-[11px] text-[#5F6B7A] transition-transform ${
                              isMobExpanded ? 'rotate-180' : ''
                            }`}>▼</span>
                          )}
                        </div>
                      </div>

                      {/* Games Grid */}
                      {showGames && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[5px] sm:gap-1.5 p-2 sm:p-3.5">
                          {games.map(({ gameId, teams: matchupTeams }) => (
                            <CompactGameCard
                              key={gameId}
                              teams={matchupTeams}
                              selectedTeam={selectedTeam}
                              onSelect={setSelectedTeam}
                              disabled={deadline?.is_expired ?? false}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ═══ PICK TIMELINE ═══ */}
        {allRounds.length > 0 && (
          <div className="mt-5 sm:mt-7">
            <div className="text-[10px] font-bold text-[#FF5722] tracking-[0.18em] mb-[3px]"
              style={{ fontFamily: "'Space Mono', monospace" }}>
              PICK HISTORY
            </div>
            <div className="text-base sm:text-lg font-bold text-[#E8E6E1] uppercase mb-2.5 sm:mb-3.5"
              style={{ fontFamily: "'Oswald', sans-serif" }}>
              Your Run
            </div>
            <PickTimeline
              rounds={allRounds}
              picks={pickHistory}
              currentRoundId={round?.id || null}
            />
          </div>
        )}

        <div className="h-10" />
      </div>

      {/* ═══ FIXED BOTTOM BAR ═══ */}
      {!isEliminated && (
        <div className="fixed bottom-16 inset-x-0 z-20 bg-[#111827] border-t border-[rgba(255,255,255,0.05)] tab-bar-shadow">
          <div className="max-w-[740px] mx-auto px-4 sm:px-5 py-3">
            <button
              onClick={() => selectedTeam && !isSameAsExisting && setShowConfirm(true)}
              disabled={!selectedTeam || isSameAsExisting}
              className={`w-full py-3 rounded-[10px] text-sm font-bold uppercase tracking-[0.05em] transition-all ${
                !selectedTeam
                  ? 'bg-[#243447] text-[#3D4654] cursor-default'
                  : isSameAsExisting
                  ? 'bg-[#1B2A3D] text-[#9BA3AE] cursor-default'
                  : 'btn-orange active:scale-[0.98]'
              }`}
              style={{
                fontFamily: "'Oswald', sans-serif",
                boxShadow: selectedTeam && !isSameAsExisting ? '0 0 20px rgba(255, 87, 34, 0.2)' : 'none',
              }}
            >
              {!selectedTeam
                ? 'Select a Team Above'
                : isSameAsExisting
                ? `Current Pick — (${selectedTeam.seed}) ${selectedTeam.name}`
                : existingPick
                ? `Change Pick → (${selectedTeam.seed}) ${selectedTeam.name}`
                : `Lock Pick → (${selectedTeam.seed}) ${selectedTeam.name}`
              }
            </button>
          </div>
        </div>
      )}

      {/* ═══ CONFIRM MODAL ═══ */}
      {!isEliminated && showConfirm && selectedTeam && (
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

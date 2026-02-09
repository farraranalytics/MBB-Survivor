'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getTournamentState } from '@/lib/status';
import { formatDateET } from '@/lib/timezone';

// ─── Types ──────────────────────────────────────────────────────

interface SplashData {
  tournamentStatus: 'pre_tournament' | 'tournament_live' | 'tournament_complete';
  roundStatus: 'pre_round' | 'round_live' | 'round_complete' | null;
  roundName: string | null;
  countdownTarget: string | null;
  countdownLabel: string | null;
  // User entry aggregates (across all pools)
  userEntriesTotal: number;
  userEntriesAlive: number;
  userEntriesEliminated: number;
  userEntriesPicked: number;          // alive entries that picked this round
  userEntriesNeedPick: number;        // alive entries missing pick this round
  // Round complete: per-round survival
  userSurvivedCount: number;          // entries that survived the last completed round
  userEliminatedThisRound: number;    // entries eliminated in the last completed round
  eliminatedTeamName: string | null;  // team that killed an entry (for display)
  // Game / global stats
  gamesTotal: number;
  gamesFinal: number;
  gamesInProgress: number;
  eliminationsToday: number;
  totalPlayers: number;
  totalAlive: number;
  totalPools: number;
  topPickedTeams: { name: string; abbreviation: string; seed: number; count: number }[];
  lastCompletedRoundName: string | null;
  nextRoundName: string | null;
  nextRoundDate: string | null;
}

// ─── Session Storage ────────────────────────────────────────────

const SPLASH_KEY = 'std_splash_shown';

function hasSeenSplash(): boolean {
  if (typeof window === 'undefined') return true;
  return sessionStorage.getItem(SPLASH_KEY) === 'true';
}

function markSplashSeen(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SPLASH_KEY, 'true');
  }
}

// ─── Data Fetch ─────────────────────────────────────────────────

async function fetchSplashData(userId: string): Promise<SplashData> {
  const state = await getTournamentState();
  const currentRound = state.currentRound;

  // Parallel base queries
  const [playersResult, aliveResult, poolsResult, entriesResult, firstGameResult] = await Promise.all([
    supabase.from('pool_players').select('id', { count: 'exact', head: true }),
    supabase.from('pool_players').select('id', { count: 'exact', head: true }).eq('is_eliminated', false),
    supabase.from('pools').select('id', { count: 'exact', head: true }),
    supabase.from('pool_players').select('id, is_eliminated, elimination_round_id').eq('user_id', userId),
    state.status === 'pre_tournament'
      ? supabase.from('games').select('game_datetime').order('game_datetime', { ascending: true }).limit(1).single()
      : Promise.resolve({ data: null }),
  ]);

  const entries = entriesResult.data || [];
  const totalPlayers = playersResult.count || 0;
  const totalAlive = aliveResult.count || 0;
  const totalPools = poolsResult.count || 0;

  // User entry aggregates
  const userEntriesTotal = entries.length;
  const userEntriesAlive = entries.filter(e => !e.is_eliminated).length;
  const userEntriesEliminated = entries.filter(e => e.is_eliminated).length;

  // Countdown target
  let countdownTarget: string | null = null;
  let countdownLabel: string | null = null;

  if (state.status === 'pre_tournament' && firstGameResult.data?.game_datetime) {
    countdownTarget = firstGameResult.data.game_datetime;
    countdownLabel = 'TIPS OFF IN';
  } else if (currentRound?.status === 'pre_round' && currentRound.deadline) {
    // deadline = earliest game_datetime - 5min, so first tip = deadline + 5min
    countdownTarget = new Date(new Date(currentRound.deadline).getTime() + 5 * 60 * 1000).toISOString();
    countdownLabel = 'TIPS OFF IN';
  }

  // Pick status for current round — count across ALL alive entries
  let userEntriesPicked = 0;
  let userEntriesNeedPick = 0;

  if (currentRound && userEntriesAlive > 0) {
    const aliveEntryIds = entries.filter(e => !e.is_eliminated).map(e => e.id);
    const { data: picks } = await supabase
      .from('picks')
      .select('pool_player_id')
      .eq('round_id', currentRound.id)
      .in('pool_player_id', aliveEntryIds);

    userEntriesPicked = picks?.length || 0;
    userEntriesNeedPick = userEntriesAlive - userEntriesPicked;
  }

  // Eliminations in current round (global count)
  let eliminationsToday = 0;
  if (currentRound) {
    const { count } = await supabase
      .from('pool_players')
      .select('id', { count: 'exact', head: true })
      .eq('elimination_round_id', currentRound.id);
    eliminationsToday = count || 0;
  }

  // Top picked teams (only when picks are visible — round live or complete)
  let topPickedTeams: SplashData['topPickedTeams'] = [];
  if (currentRound && (currentRound.status === 'round_live' || currentRound.status === 'round_complete')) {
    const { data: allPicks } = await supabase
      .from('picks')
      .select('team_id, team:team_id(name, abbreviation, seed)')
      .eq('round_id', currentRound.id);

    if (allPicks && allPicks.length > 0) {
      const counts = new Map<string, { name: string; abbreviation: string; seed: number; count: number }>();
      for (const pick of allPicks) {
        const team = (pick as any).team;
        if (team) {
          const existing = counts.get(pick.team_id);
          if (existing) existing.count++;
          else counts.set(pick.team_id, { name: team.name, abbreviation: team.abbreviation, seed: team.seed, count: 1 });
        }
      }
      topPickedTeams = Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 5);
    }
  }

  // Round complete: count user entries survived vs eliminated this round
  let userSurvivedCount = 0;
  let userEliminatedThisRound = 0;
  let eliminatedTeamName: string | null = null;

  const completedRounds = state.rounds.filter(r => r.status === 'round_complete');
  if (completedRounds.length > 0 && entries.length > 0) {
    const lastCompleted = completedRounds[completedRounds.length - 1];
    const elimEntries = entries.filter(e => e.elimination_round_id === lastCompleted.id);
    userEliminatedThisRound = elimEntries.length;
    userSurvivedCount = userEntriesAlive; // alive entries = survived all rounds including this one

    // Get the team name for one of the eliminated entries
    if (elimEntries.length > 0) {
      const { data: elimPick } = await supabase
        .from('picks')
        .select('team:team_id(name)')
        .eq('round_id', lastCompleted.id)
        .eq('pool_player_id', elimEntries[0].id)
        .maybeSingle();
      if (elimPick) {
        eliminatedTeamName = (elimPick as any).team?.name || null;
      }
    }
  }

  // Round context
  const lastCompletedRoundName = completedRounds.length > 0
    ? completedRounds[completedRounds.length - 1].name
    : null;
  const nextPreRound = state.rounds.find(r => r.status === 'pre_round');
  const nextRoundName = nextPreRound?.name || null;
  const nextRoundDate = nextPreRound?.date || null;

  return {
    tournamentStatus: state.status,
    roundStatus: currentRound?.status || null,
    roundName: currentRound?.name || null,
    countdownTarget,
    countdownLabel,
    userEntriesTotal,
    userEntriesAlive,
    userEntriesEliminated,
    userEntriesPicked,
    userEntriesNeedPick,
    userSurvivedCount,
    userEliminatedThisRound,
    eliminatedTeamName,
    gamesTotal: currentRound?.gamesTotal || 0,
    gamesFinal: currentRound?.gamesFinal || 0,
    gamesInProgress: currentRound?.gamesInProgress || 0,
    eliminationsToday,
    totalPlayers,
    totalAlive,
    totalPools,
    topPickedTeams,
    lastCompletedRoundName,
    nextRoundName,
    nextRoundDate,
  };
}

// ─── Countdown Components ───────────────────────────────────────

function CountdownBox({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 rounded-[10px] border border-[rgba(255,87,34,0.3)] bg-[rgba(255,87,34,0.05)] flex items-center justify-center">
        <span className="text-2xl font-bold text-[#FF5722]" style={{ fontFamily: "'Oswald', sans-serif" }}>
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span className="text-[0.6rem] tracking-[0.2em] text-[#5F6B7A] mt-1" style={{ fontFamily: "'Space Mono', monospace" }}>
        {unit}
      </span>
    </div>
  );
}

function CountdownTimer({ target, label }: { target: string; label: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const diff = Math.max(0, new Date(target).getTime() - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const showDays = days > 0;

  return (
    <div className="text-center">
      <p className="text-label-accent mb-3">{label}</p>
      <div className="flex justify-center gap-3">
        {showDays && <CountdownBox value={days} unit="DAYS" />}
        <CountdownBox value={hours} unit="HRS" />
        <CountdownBox value={minutes} unit="MIN" />
        {!showDays && <CountdownBox value={seconds} unit="SEC" />}
      </div>
    </div>
  );
}

// ─── Wordmark ───────────────────────────────────────────────────

function Wordmark() {
  return (
    <div className="flex justify-center mb-6">
      <div className="inline-flex flex-col items-center" style={{ gap: 0 }}>
        <span
          className="text-[0.75rem] tracking-[0.5em]"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: 'rgba(232, 230, 225, 0.4)', lineHeight: 1 }}
        >
          SURVIVE
        </span>
        <span
          className="text-[1.5rem] tracking-[0.15em] text-[#FF5722]"
          style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, lineHeight: 1.1 }}
        >
          THE
        </span>
        <span
          className="text-[2.75rem] tracking-[-0.02em] text-[#E8E6E1]"
          style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, lineHeight: 0.85 }}
        >
          DANCE
        </span>
      </div>
    </div>
  );
}

// ─── Tap to Enter ───────────────────────────────────────────────

function TapToEnter() {
  return (
    <p
      className="text-[#5F6B7A] text-xs tracking-[0.15em] mt-8"
      style={{ fontFamily: "'Space Mono', monospace", animation: 'pulse-dot 2s ease-in-out infinite' }}
    >
      &mdash; tap to enter &mdash;
    </p>
  );
}

// ─── Splash State: Pre-Tournament ───────────────────────────────

function PreTournamentSplash({ data }: { data: SplashData }) {
  return (
    <>
      <Wordmark />
      <p
        className="text-[0.55rem] tracking-[0.35em] text-[#FF5722] uppercase mb-8"
        style={{ fontFamily: "'Space Mono', monospace" }}
      >
        EVERY PICK COULD BE YOUR LAST
      </p>
      {data.countdownTarget && data.countdownLabel && (
        <div className="mb-6">
          <CountdownTimer target={data.countdownTarget} label={data.countdownLabel} />
        </div>
      )}
      <p className="text-sm text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <span className="text-[#E8E6E1] font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>{data.totalPlayers}</span>
        {' '}players &middot;{' '}
        <span className="text-[#E8E6E1] font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>{data.totalPools}</span>
        {' '}pools ready
      </p>
      <TapToEnter />
    </>
  );
}

// ─── Splash State: Pre-Round (Game Day) ─────────────────────────

function PreRoundSplash({ data }: { data: SplashData }) {
  const allEliminated = data.userEntriesAlive === 0 && data.userEntriesTotal > 0;
  const allPicked = data.userEntriesAlive > 0 && data.userEntriesNeedPick === 0;
  const nonePicked = data.userEntriesAlive > 0 && data.userEntriesPicked === 0;

  // Pick status card color: green if all picked, orange if some, red if none
  let pickCardBorder: string;
  let pickCardBg: string;
  let pickCardText: string;
  if (allPicked) {
    pickCardBorder = 'border-[rgba(76,175,80,0.2)]';
    pickCardBg = 'bg-[rgba(76,175,80,0.08)]';
    pickCardText = 'text-[#4CAF50]';
  } else if (nonePicked) {
    pickCardBorder = 'border-[rgba(239,83,80,0.2)]';
    pickCardBg = 'bg-[rgba(239,83,80,0.08)]';
    pickCardText = 'text-[#EF5350]';
  } else {
    pickCardBorder = 'border-[rgba(255,87,34,0.2)]';
    pickCardBg = 'bg-[rgba(255,87,34,0.08)]';
    pickCardText = 'text-[#FF5722]';
  }

  return (
    <>
      <h1
        className="text-2xl font-bold text-[#E8E6E1] mb-6"
        style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
      >
        {data.roundName}
      </h1>
      {data.countdownTarget && data.countdownLabel && (
        <div className="mb-6">
          <CountdownTimer target={data.countdownTarget} label={data.countdownLabel} />
        </div>
      )}
      <p className="text-sm text-[#9BA3AE] mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <span className="text-[#E8E6E1] font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>{data.gamesTotal}</span>
        {' '}games today
      </p>

      {/* Pick status card */}
      {allEliminated ? (
        <div className="bg-[rgba(155,163,174,0.08)] border border-[rgba(155,163,174,0.2)] rounded-[10px] px-4 py-3">
          <p className="text-sm font-semibold text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            SPECTATING
          </p>
        </div>
      ) : data.userEntriesAlive > 0 ? (
        <div className={`${pickCardBg} border ${pickCardBorder} rounded-[10px] px-4 py-3 space-y-1`}>
          <p className={`text-sm font-semibold ${pickCardText}`} style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {data.userEntriesPicked} of {data.userEntriesAlive} {data.userEntriesAlive === 1 ? 'entry' : 'entries'} picked {allPicked ? '✓' : ''}
          </p>
          {data.userEntriesNeedPick > 0 && (
            <p className="text-sm font-semibold text-[#FF5722]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              ⚠ {data.userEntriesNeedPick} {data.userEntriesNeedPick === 1 ? 'entry needs' : 'entries need'} a pick
            </p>
          )}
        </div>
      ) : null}

      {/* Entry alive/eliminated summary */}
      {data.userEntriesTotal > 0 && data.userEntriesEliminated > 0 && (
        <p className="text-xs text-[#9BA3AE] mt-3" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <span className="text-[#4CAF50]">{data.userEntriesAlive} alive</span>
          {' '}&middot;{' '}
          <span className="text-[#EF5350]">{data.userEntriesEliminated} eliminated</span>
        </p>
      )}
      <TapToEnter />
    </>
  );
}

// ─── Splash State: Games Live ───────────────────────────────────

function GamesLiveSplash({ data }: { data: SplashData }) {
  const progress = data.gamesTotal > 0 ? (data.gamesFinal / data.gamesTotal) * 100 : 0;
  const totalPicks = data.topPickedTeams.reduce((sum, t) => sum + t.count, 0);

  return (
    <>
      <div className="flex items-center justify-center gap-2 mb-1">
        <span
          className="w-2.5 h-2.5 rounded-full bg-[#EF5350]"
          style={{ animation: 'pulse-dot 1.5s ease-in-out infinite' }}
        />
        <h1
          className="text-2xl font-bold text-[#E8E6E1]"
          style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
        >
          GAMES ARE LIVE
        </h1>
      </div>
      <p className="text-sm text-[#9BA3AE] mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        {data.roundName}
      </p>

      {/* Progress bar */}
      <div className="w-full max-w-[280px] mx-auto bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[10px] px-4 py-3 mb-6">
        <p className="text-xs text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <span className="text-[#E8E6E1] font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>{data.gamesFinal}</span>
          {' '}of {data.gamesTotal} games final
        </p>
        <div className="w-full h-2 bg-[#1B2A3D] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#4CAF50] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-right text-[0.6rem] text-[#5F6B7A] mt-1" style={{ fontFamily: "'Space Mono', monospace" }}>
          {Math.round(progress)}%
        </p>
      </div>

      {data.eliminationsToday > 0 && (
        <p className="text-sm text-[#9BA3AE] mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <span className="text-[#EF5350] font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>{data.eliminationsToday}</span>
          {' '}{data.eliminationsToday === 1 ? 'entry' : 'entries'} eliminated today
        </p>
      )}

      {/* Top picked teams */}
      {data.topPickedTeams.length > 0 && totalPicks > 0 && (
        <div className="w-full max-w-[280px] mx-auto text-left">
          <p className="text-label-accent mb-2">MOST PICKED</p>
          <div className="space-y-1.5">
            {data.topPickedTeams.map((team) => (
              <div key={team.name} className="flex items-center justify-between">
                <span className="text-sm text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif" }}>
                  ({team.seed}) {team.name}
                </span>
                <span className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'Space Mono', monospace" }}>
                  {Math.round((team.count / totalPicks) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <TapToEnter />
    </>
  );
}

// ─── Splash State: Round Complete ───────────────────────────────

function RoundCompleteSplash({ data }: { data: SplashData }) {
  const hasSurvived = data.userSurvivedCount > 0;
  const hasEliminated = data.userEliminatedThisRound > 0;

  return (
    <>
      <h1
        className="text-2xl font-bold text-[#E8E6E1] mb-1"
        style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
      >
        ROUND COMPLETE
      </h1>
      <p className="text-sm text-[#9BA3AE] mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        {data.lastCompletedRoundName || data.roundName}
      </p>

      {/* Survival results — show both if mixed */}
      {hasSurvived && (
        <div className="bg-[rgba(76,175,80,0.08)] border border-[rgba(76,175,80,0.2)] rounded-[10px] px-5 py-3 mb-3">
          <p
            className="text-base font-bold text-[#4CAF50]"
            style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
          >
            ✓ {data.userSurvivedCount} {data.userSurvivedCount === 1 ? 'entry' : 'entries'} survived
          </p>
        </div>
      )}
      {hasEliminated && (
        <div className="bg-[rgba(239,83,80,0.08)] border border-[rgba(239,83,80,0.2)] rounded-[10px] px-5 py-3 mb-3">
          <p
            className="text-base font-bold text-[#EF5350]"
            style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
          >
            ☠ {data.userEliminatedThisRound} {data.userEliminatedThisRound === 1 ? 'entry' : 'entries'} eliminated
          </p>
          {data.eliminatedTeamName && (
            <p className="text-xs text-[#EF5350] opacity-70 mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Picked {data.eliminatedTeamName}
            </p>
          )}
        </div>
      )}

      {data.eliminationsToday > 0 && (
        <p className="text-sm text-[#9BA3AE] mt-3 mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <span className="text-[#EF5350] font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>{data.eliminationsToday}</span>
          {' '}eliminated &middot;{' '}
          <span className="text-[#4CAF50] font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>{data.totalAlive}</span>
          {' '}still alive
        </p>
      )}

      {data.nextRoundName && (
        <div className="text-sm text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <p>
            Next round: <span className="text-[#E8E6E1]">{data.nextRoundName}</span>
          </p>
          {data.nextRoundDate && (
            <p className="text-xs text-[#5F6B7A] mt-0.5">Starts {formatDateET(data.nextRoundDate)}</p>
          )}
        </div>
      )}
      <TapToEnter />
    </>
  );
}

// ─── Splash State: Tournament Complete ──────────────────────────

function TournamentCompleteSplash() {
  return (
    <>
      <p className="text-5xl mb-4">🏆</p>
      <h1
        className="text-2xl font-bold text-[#E8E6E1] mb-6"
        style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
      >
        TOURNAMENT COMPLETE
      </h1>
      <p className="text-sm text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        See you next March.
      </p>
      <TapToEnter />
    </>
  );
}

// ─── Main Overlay Component ─────────────────────────────────────

export function SplashOverlay({ userId }: { userId: string | undefined }) {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [data, setData] = useState<SplashData | null>(null);
  const dismissedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    setFading(true);
    markSplashSeen();
    setTimeout(() => setVisible(false), 300);
  }, []);

  useEffect(() => {
    if (!userId || hasSeenSplash()) return;
    setVisible(true);

    fetchSplashData(userId)
      .then(result => {
        setData(result);
        // Auto-dismiss 5 seconds after data loads
        timerRef.current = setTimeout(dismiss, 5000);
      })
      .catch(() => dismiss());

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [userId, dismiss]);

  if (!visible) return null;

  return (
    <div
      onClick={dismiss}
      className="fixed inset-0 z-50 bg-[#0D1B2A] flex items-center justify-center cursor-pointer"
      style={{
        animation: fading ? 'fade-out 300ms ease-out forwards' : 'fade-in 300ms ease-out',
      }}
    >
      <div className="text-center px-6 max-w-sm w-full">
        {!data ? (
          <Wordmark />
        ) : data.tournamentStatus === 'tournament_complete' ? (
          <TournamentCompleteSplash />
        ) : data.roundStatus === 'round_live' ? (
          <GamesLiveSplash data={data} />
        ) : data.tournamentStatus === 'pre_tournament' ? (
          <PreTournamentSplash data={data} />
        ) : data.roundStatus === 'round_complete' ? (
          <RoundCompleteSplash data={data} />
        ) : (
          <PreRoundSplash data={data} />
        )}
      </div>
    </div>
  );
}

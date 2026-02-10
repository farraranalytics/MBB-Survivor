'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getTournamentState } from '@/lib/status';
import { formatDateET } from '@/lib/timezone';
import { CountdownTimer } from '@/components/CountdownTimer';

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

// ─── Animation Wrapper ──────────────────────────────────────────

function AnimateIn({ delay, children, className }: { delay: number; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{ animation: `stagger-up 600ms ease-out ${delay}ms both` }}
    >
      {children}
    </div>
  );
}

// ─── Court Lines Background ─────────────────────────────────────

function CourtLines() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg
        className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] md:w-[900px] md:h-[550px] lg:w-[1100px] lg:h-[650px]"
        viewBox="0 0 800 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Baseline */}
        <line x1="50" y1="480" x2="750" y2="480" stroke="rgba(255,87,34,0.06)" strokeWidth="1.5" />
        {/* Three-point arc */}
        <path d="M 120 480 A 280 280 0 0 1 680 480" stroke="rgba(255,87,34,0.05)" strokeWidth="1.5" />
        {/* Free-throw lane */}
        <rect x="290" y="340" width="220" height="140" rx="2" stroke="rgba(255,87,34,0.04)" strokeWidth="1.5" fill="none" />
        {/* Free-throw circle */}
        <circle cx="400" cy="340" r="60" stroke="rgba(255,87,34,0.04)" strokeWidth="1.5" />
        {/* Center court circle (top) */}
        <circle cx="400" cy="40" r="60" stroke="rgba(255,87,34,0.03)" strokeWidth="1.5" />
        {/* Half-court line */}
        <line x1="50" y1="40" x2="750" y2="40" stroke="rgba(255,87,34,0.03)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

// ─── Floating Basketballs (Desktop) ─────────────────────────────

function FloatingBasketballs() {
  return (
    <div className="hidden lg:block absolute inset-0 pointer-events-none overflow-hidden">
      <span
        className="absolute top-[18%] left-[8%] text-3xl opacity-[0.06]"
        style={{ animation: 'float-drift 8s ease-in-out infinite' }}
      >
        🏀
      </span>
      <span
        className="absolute top-[55%] right-[9%] text-2xl opacity-[0.05]"
        style={{ animation: 'float-drift 10s ease-in-out infinite 2s' }}
      >
        🏀
      </span>
      <span
        className="absolute top-[30%] right-[4%] text-4xl opacity-[0.04]"
        style={{ animation: 'float-drift 12s ease-in-out infinite 4s' }}
      >
        🏀
      </span>
      <span
        className="absolute bottom-[25%] left-[5%] text-xl opacity-[0.04]"
        style={{ animation: 'float-drift 9s ease-in-out infinite 1s' }}
      >
        🏀
      </span>
    </div>
  );
}

// ─── Bracket Arms (Desktop) ────────────────────────────────────

function BracketArms() {
  return (
    <div className="hidden lg:block absolute inset-0 pointer-events-none">
      {/* Left bracket */}
      <div className="absolute top-1/2 left-[4%] -translate-y-1/2 w-[35px] h-[180px] border-l-2 border-t-2 border-b-2 border-[rgba(255,87,34,0.07)] rounded-l-md" />
      {/* Right bracket */}
      <div className="absolute top-1/2 right-[4%] -translate-y-1/2 w-[35px] h-[180px] border-r-2 border-t-2 border-b-2 border-[rgba(255,87,34,0.07)] rounded-r-md" />
    </div>
  );
}

// ─── Wordmark ───────────────────────────────────────────────────

function Wordmark() {
  return (
    <div
      className="flex justify-center mb-6"
      style={{ animation: 'scale-in 600ms ease-out both' }}
    >
      <div className="inline-flex flex-col items-center" style={{ gap: 0 }}>
        <span
          className="text-[0.95rem] md:text-[1.1rem] lg:text-[1.25rem] tracking-[0.5em]"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: 'rgba(232, 230, 225, 0.4)', lineHeight: 1 }}
        >
          SURVIVE
        </span>
        <span
          className="text-[1.95rem] md:text-[2.25rem] lg:text-[2.5rem] tracking-[0.15em] text-[#FF5722]"
          style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, lineHeight: 1.1 }}
        >
          THE
        </span>
        <span
          className="text-[3.6rem] md:text-[4.5rem] lg:text-[5.5rem] tracking-[-0.02em] text-[#E8E6E1]"
          style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, lineHeight: 0.85 }}
        >
          DANCE
        </span>
      </div>
    </div>
  );
}

// ─── Tap to Enter ───────────────────────────────────────────────

function TapToEnter({ delay = 1000 }: { delay?: number }) {
  return (
    <AnimateIn delay={delay}>
      <p
        className="text-[#9BA3AE] text-sm md:text-base tracking-[0.15em] mt-8"
        style={{ fontFamily: "'Space Mono', monospace", animation: 'pulse-tap 2.5s ease-in-out infinite' }}
      >
        tap to enter
      </p>
    </AnimateIn>
  );
}

// ─── Stat Number ────────────────────────────────────────────────

function StatNum({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[#FF5722] font-bold text-base md:text-lg" style={{ fontFamily: "'Space Mono', monospace" }}>
      {children}
    </span>
  );
}

// ─── Splash State: Pre-Tournament ───────────────────────────────

function PreTournamentSplash({ data }: { data: SplashData }) {
  return (
    <>
      <AnimateIn delay={0}>
        <Wordmark />
      </AnimateIn>
      <AnimateIn delay={300}>
        <p
          className="text-[0.55rem] md:text-[0.65rem] tracking-[0.35em] text-[#FF5722] uppercase mb-8"
          style={{ fontFamily: "'Space Mono', monospace" }}
        >
          EVERY PICK COULD BE YOUR LAST
        </p>
      </AnimateIn>
      {data.countdownTarget && data.countdownLabel && (
        <AnimateIn delay={500} className="mb-6">
          <CountdownTimer target={data.countdownTarget} label={data.countdownLabel} />
        </AnimateIn>
      )}
      <AnimateIn delay={800}>
        <p className="text-sm md:text-base text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <StatNum>{data.totalPlayers}</StatNum>
          {' '}players &middot;{' '}
          <StatNum>{data.totalPools}</StatNum>
          {' '}pools ready
        </p>
      </AnimateIn>
      <TapToEnter delay={1000} />
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
      <AnimateIn delay={0}>
        <h1
          className="text-2xl md:text-4xl lg:text-5xl font-bold text-[#E8E6E1] mb-6"
          style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
        >
          {data.roundName}
        </h1>
      </AnimateIn>
      {data.countdownTarget && data.countdownLabel && (
        <AnimateIn delay={300} className="mb-6">
          <CountdownTimer target={data.countdownTarget} label={data.countdownLabel} />
        </AnimateIn>
      )}
      <AnimateIn delay={500}>
        <p className="text-sm md:text-base text-[#9BA3AE] mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <StatNum>{data.gamesTotal}</StatNum>
          {' '}games today
        </p>
      </AnimateIn>

      {/* Pick status card */}
      <AnimateIn delay={700}>
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
      </AnimateIn>

      {/* Entry alive/eliminated summary */}
      {data.userEntriesTotal > 0 && data.userEntriesEliminated > 0 && (
        <AnimateIn delay={900}>
          <p className="text-xs text-[#9BA3AE] mt-3" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <span className="text-[#4CAF50]">{data.userEntriesAlive} alive</span>
            {' '}&middot;{' '}
            <span className="text-[#EF5350]">{data.userEntriesEliminated} eliminated</span>
          </p>
        </AnimateIn>
      )}
      <TapToEnter delay={1100} />
    </>
  );
}

// ─── Splash State: Games Live ───────────────────────────────────

function GamesLiveSplash({ data }: { data: SplashData }) {
  const progress = data.gamesTotal > 0 ? (data.gamesFinal / data.gamesTotal) * 100 : 0;
  const totalPicks = data.topPickedTeams.reduce((sum, t) => sum + t.count, 0);

  return (
    <>
      <AnimateIn delay={0}>
        <div className="flex items-center justify-center gap-2 mb-1">
          <span
            className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#EF5350]"
            style={{ animation: 'pulse-dot 1.5s ease-in-out infinite' }}
          />
          <h1
            className="text-2xl md:text-4xl lg:text-5xl font-bold text-[#E8E6E1]"
            style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
          >
            GAMES ARE LIVE
          </h1>
        </div>
      </AnimateIn>
      <AnimateIn delay={200}>
        <p className="text-sm md:text-base text-[#9BA3AE] mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          {data.roundName}
        </p>
      </AnimateIn>

      {/* Progress bar */}
      <AnimateIn delay={400}>
        <div className="w-full max-w-[280px] md:max-w-[340px] mx-auto bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[10px] px-4 py-3 mb-6">
          <p className="text-xs md:text-sm text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <StatNum>{data.gamesFinal}</StatNum>
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
      </AnimateIn>

      {data.eliminationsToday > 0 && (
        <AnimateIn delay={600}>
          <p className="text-sm md:text-base text-[#9BA3AE] mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <span className="text-[#EF5350] font-bold text-base md:text-lg" style={{ fontFamily: "'Space Mono', monospace" }}>{data.eliminationsToday}</span>
            {' '}{data.eliminationsToday === 1 ? 'entry' : 'entries'} eliminated today
          </p>
        </AnimateIn>
      )}

      {/* Top picked teams */}
      {data.topPickedTeams.length > 0 && totalPicks > 0 && (
        <AnimateIn delay={800}>
          <div className="w-full max-w-[280px] md:max-w-[340px] mx-auto text-left">
            <p className="text-label-accent mb-2">MOST PICKED</p>
            <div className="space-y-1.5">
              {data.topPickedTeams.map((team) => (
                <div key={team.name} className="flex items-center justify-between">
                  <span className="text-sm md:text-base text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif" }}>
                    ({team.seed}) {team.name}
                  </span>
                  <span className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'Space Mono', monospace" }}>
                    {Math.round((team.count / totalPicks) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </AnimateIn>
      )}
      <TapToEnter delay={1000} />
    </>
  );
}

// ─── Splash State: Round Complete ───────────────────────────────

function RoundCompleteSplash({ data }: { data: SplashData }) {
  const hasSurvived = data.userSurvivedCount > 0;
  const hasEliminated = data.userEliminatedThisRound > 0;

  return (
    <>
      <AnimateIn delay={0}>
        <h1
          className="text-2xl md:text-4xl lg:text-5xl font-bold text-[#E8E6E1] mb-1"
          style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
        >
          ROUND COMPLETE
        </h1>
      </AnimateIn>
      <AnimateIn delay={200}>
        <p className="text-sm md:text-base text-[#9BA3AE] mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          {data.lastCompletedRoundName || data.roundName}
        </p>
      </AnimateIn>

      {/* Survival results — show both if mixed */}
      {hasSurvived && (
        <AnimateIn delay={400}>
          <div className="bg-[rgba(76,175,80,0.08)] border border-[rgba(76,175,80,0.2)] rounded-[10px] px-5 py-3 mb-3">
            <p
              className="text-base md:text-lg font-bold text-[#4CAF50]"
              style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
            >
              ✓ {data.userSurvivedCount} {data.userSurvivedCount === 1 ? 'entry' : 'entries'} survived
            </p>
          </div>
        </AnimateIn>
      )}
      {hasEliminated && (
        <AnimateIn delay={hasSurvived ? 550 : 400}>
          <div className="bg-[rgba(239,83,80,0.08)] border border-[rgba(239,83,80,0.2)] rounded-[10px] px-5 py-3 mb-3">
            <p
              className="text-base md:text-lg font-bold text-[#EF5350]"
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
        </AnimateIn>
      )}

      {data.eliminationsToday > 0 && (
        <AnimateIn delay={700}>
          <p className="text-sm md:text-base text-[#9BA3AE] mt-3 mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <span className="text-[#EF5350] font-bold text-base md:text-lg" style={{ fontFamily: "'Space Mono', monospace" }}>{data.eliminationsToday}</span>
            {' '}eliminated &middot;{' '}
            <span className="text-[#4CAF50] font-bold text-base md:text-lg" style={{ fontFamily: "'Space Mono', monospace" }}>{data.totalAlive}</span>
            {' '}still alive
          </p>
        </AnimateIn>
      )}

      {data.nextRoundName && (
        <AnimateIn delay={900}>
          <div className="text-sm md:text-base text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <p>
              Next round: <span className="text-[#E8E6E1]">{data.nextRoundName}</span>
            </p>
            {data.nextRoundDate && (
              <p className="text-xs text-[#5F6B7A] mt-0.5">Starts {formatDateET(data.nextRoundDate)}</p>
            )}
          </div>
        </AnimateIn>
      )}
      <TapToEnter delay={1100} />
    </>
  );
}

// ─── Splash State: Tournament Complete ──────────────────────────

function TournamentCompleteSplash() {
  return (
    <>
      <AnimateIn delay={0}>
        <p className="text-5xl md:text-6xl mb-4">🏆</p>
      </AnimateIn>
      <AnimateIn delay={300}>
        <h1
          className="text-2xl md:text-4xl lg:text-5xl font-bold text-[#E8E6E1] mb-6"
          style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
        >
          TOURNAMENT COMPLETE
        </h1>
      </AnimateIn>
      <AnimateIn delay={600}>
        <p className="text-sm md:text-base text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          See you next March.
        </p>
      </AnimateIn>
      <TapToEnter delay={900} />
    </>
  );
}

// ─── Main Overlay Component ─────────────────────────────────────

export function SplashOverlay({ userId }: { userId: string | undefined }) {
  // 'pending' = waiting for auth/sessionStorage check (block content)
  // 'show' = splash visible
  // 'hide' = splash dismissed or already seen
  const [splashState, setSplashState] = useState<'pending' | 'show' | 'hide'>('pending');
  const [fading, setFading] = useState(false);
  const [data, setData] = useState<SplashData | null>(null);
  const dismissedRef = useRef(false);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setFading(true);
    markSplashSeen();
    setTimeout(() => setSplashState('hide'), 300);
  }, []);

  useEffect(() => {
    // Wait for auth to resolve before deciding
    if (!userId) return;
    const alreadyShown = sessionStorage.getItem(SPLASH_KEY) === 'true';
    if (alreadyShown) {
      setSplashState('hide');
    } else {
      setSplashState('show');
      fetchSplashData(userId)
        .then(result => setData(result))
        .catch(() => dismiss());
    }
  }, [userId, dismiss]);

  // Still deciding (auth loading) — render opaque blocker to prevent content flash
  if (splashState === 'pending') {
    return <div className="fixed inset-0 z-50 bg-[#0D1B2A]" />;
  }

  if (splashState === 'hide') return null;

  return (
    <div
      onClick={dismiss}
      className="fixed inset-0 z-50 bg-[#0D1B2A] flex flex-col items-center justify-start pt-[12vh] md:pt-[14vh] cursor-pointer overflow-hidden"
      style={{
        animation: fading ? 'fade-out 300ms ease-out forwards' : 'fade-in 300ms ease-out',
      }}
    >
      {/* Background layers */}
      <CourtLines />
      <FloatingBasketballs />
      <BracketArms />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-sm md:max-w-lg lg:max-w-2xl w-full">
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

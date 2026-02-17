'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { TeamInfo, Round } from '@/types/picks';
import { BracketGame } from '@/types/bracket';
import {
  PlannerDay,
  PlannerPick,
  PLANNER_REGIONS,
  R64_SEED_PAIRINGS,
  FEEDERS_MAP,
  PREV_ROUND,
  HALF_A,
  HALF_B,
  buildPlannerDays,
  buildLockedAdvancers,
  buildLockedPicks,
  getRegionsForDay as getRegionsForDayUtil,
  mapRoundNameToCode,
  getGameIndexForRound,
  seedToR64Index,
} from '@/lib/bracket';

import DayCard, { MatchupInfo } from './DayCard';
import BracketFlow from './BracketFlow';
import UsageMap from './UsageMap';
import PickSheet from './PickSheet';
import PlannerCoaching, { TUTORIAL_STEPS } from './PlannerCoaching';

interface BracketPlannerProps {
  bracket: Record<string, TeamInfo[]>;
  rounds: Round[];
  games: BracketGame[];
  mode: 'standalone' | 'pool';
  submittedPicks?: Array<{ round_id: string; team_id: string; team?: TeamInfo | null }>;
  usedTeamIdsFromEntry?: string[];
}

export default function BracketPlanner({
  bracket,
  rounds,
  games,
  mode,
  submittedPicks,
  usedTeamIdsFromEntry,
}: BracketPlannerProps) {
  // Build planner days from rounds
  const days = useMemo(() => buildPlannerDays(rounds), [rounds]);

  // Build locked advancers from completed games
  const { advancers: lockedAdvancers, lockedKeys: lockedAdvancerKeys } = useMemo(
    () => buildLockedAdvancers(games, rounds, bracket),
    [games, rounds, bracket]
  );

  // Build locked picks from submitted picks (pool mode only)
  const { picks: lockedPicks, lockedDayIds } = useMemo(() => {
    if (mode === 'pool' && submittedPicks) {
      return buildLockedPicks(submittedPicks, bracket);
    }
    return { picks: {} as Record<string, PlannerPick>, lockedDayIds: new Set<string>() };
  }, [mode, submittedPicks, bracket]);

  // Build game status lookup for completed/in-progress games
  const gameStatuses = useMemo(() => {
    const statuses: Record<string, { status: string; team1Score: number | null; team2Score: number | null; winnerId: string | null; gameDateTime: string | null }> = {};
    const roundIdToCode = new Map<string, string>();
    for (const round of rounds) {
      roundIdToCode.set(round.id, mapRoundNameToCode(round.name));
    }
    for (const game of games) {
      if (!game.team1 || !game.team2) continue;
      const roundCode = roundIdToCode.get(game.round_id);
      if (!roundCode) continue;
      const region = (game.team1 as TeamInfo).region;
      const gameIdx = getGameIndexForRound((game.team1 as TeamInfo).seed, roundCode);
      const key = `${region}_${roundCode}_${gameIdx}`;
      statuses[key] = {
        status: game.status,
        team1Score: game.team1_score,
        team2Score: game.team2_score,
        winnerId: game.winner_id,
        gameDateTime: game.game_datetime || null,
      };
    }
    return statuses;
  }, [games, rounds]);

  // Build actual game indices per round_id per region from DB games
  // This replaces the hardcoded HALF_A/HALF_B split so the planner
  // matches the real schedule (which may have uneven region distribution)
  const actualGameIndices = useMemo(() => {
    const map: Record<string, Record<string, number[]>> = {};
    const roundIdToCode = new Map<string, string>();
    for (const round of rounds) {
      roundIdToCode.set(round.id, mapRoundNameToCode(round.name));
    }
    for (const game of games) {
      if (!game.team1) continue;
      const region = (game.team1 as TeamInfo).region;
      const roundCode = roundIdToCode.get(game.round_id);
      if (!roundCode) continue;
      const gameIdx = getGameIndexForRound((game.team1 as TeamInfo).seed, roundCode);
      if (!map[game.round_id]) map[game.round_id] = {};
      if (!map[game.round_id][region]) map[game.round_id][region] = [];
      if (!map[game.round_id][region].includes(gameIdx)) {
        map[game.round_id][region].push(gameIdx);
      }
    }
    // Sort indices within each group
    for (const roundId of Object.keys(map)) {
      for (const region of Object.keys(map[roundId])) {
        map[roundId][region].sort((a, b) => a - b);
      }
    }
    return map;
  }, [games, rounds]);

  // Build R32 day mapping from R64 game data
  // R32 day is determined by which R64 day the parent games were on
  const r32DayMapping = useMemo(() => {
    const R64_DAY1_ID = rounds.find(r => r.name === 'Round 1 Day 1')?.id;
    const R64_DAY2_ID = rounds.find(r => r.name === 'Round 1 Day 2')?.id;
    const R32_DAY1_ID = rounds.find(r => r.name === 'Round 2 Day 1')?.id;
    const R32_DAY2_ID = rounds.find(r => r.name === 'Round 2 Day 2')?.id;

    if (!R64_DAY1_ID || !R64_DAY2_ID || !R32_DAY1_ID || !R32_DAY2_ID) return {};

    // For each region, figure out which R64 game indices are on Day 1 vs Day 2
    const r64DayByRegionAndIndex: Record<string, Record<number, string>> = {};

    for (const game of games) {
      if (!game.team1) continue;
      const region = (game.team1 as TeamInfo).region;
      const seed = (game.team1 as TeamInfo).seed;
      const gameIdx = seedToR64Index(seed);
      if (gameIdx < 0) continue;

      if (!r64DayByRegionAndIndex[region]) r64DayByRegionAndIndex[region] = {};

      if (game.round_id === R64_DAY1_ID) {
        r64DayByRegionAndIndex[region][gameIdx] = 'Day1';
      } else if (game.round_id === R64_DAY2_ID) {
        r64DayByRegionAndIndex[region][gameIdx] = 'Day2';
      }
    }

    // R32 feeders: R32 game N is fed by R64 games [2N, 2N+1]
    const R32_FEEDERS = [[0,1],[2,3],[4,5],[6,7]];

    // For each region, determine which R32 games go on Day 1 vs Day 2
    const mapping: Record<string, Record<string, number[]>> = {};
    mapping[R32_DAY1_ID] = {};
    mapping[R32_DAY2_ID] = {};

    for (const region of PLANNER_REGIONS) {
      mapping[R32_DAY1_ID][region] = [];
      mapping[R32_DAY2_ID][region] = [];

      for (let r32Idx = 0; r32Idx < R32_FEEDERS.length; r32Idx++) {
        const [f0, f1] = R32_FEEDERS[r32Idx];
        const f0Day = r64DayByRegionAndIndex[region]?.[f0];
        const f1Day = r64DayByRegionAndIndex[region]?.[f1];

        // Both parents should be on the same day (NCAA scheduling guarantees this)
        if (f0Day === 'Day1' || f1Day === 'Day1') {
          mapping[R32_DAY1_ID][region].push(r32Idx);
        } else {
          mapping[R32_DAY2_ID][region].push(r32Idx);
        }
      }
    }

    return mapping;
  }, [games, rounds]);

  // ── State ───────────────────────────────────────────────────
  const [advancers, setAdvancers] = useState<Record<string, TeamInfo>>({});
  const [picks, setPicks] = useState<Record<string, PlannerPick>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [regionFlipped, setRegionFlipped] = useState<Record<string, boolean>>({
    East: false, South: false, West: false, Midwest: false,
  });
  const [e8Swapped, setE8Swapped] = useState(false);

  // Tutorial state
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialDismissed, setTutorialDismissed] = useState(false);

  // Initialize locked state on mount
  useEffect(() => {
    setAdvancers(prev => ({ ...lockedAdvancers, ...prev }));
  }, [lockedAdvancers]);

  useEffect(() => {
    setPicks(prev => ({ ...lockedPicks, ...prev }));
  }, [lockedPicks]);

  // Check if tutorial was dismissed before
  useEffect(() => {
    const dismissed = localStorage.getItem('planner-tutorial-dismissed');
    if (dismissed) {
      setTutorialDismissed(true);
    } else {
      setTutorialActive(true);
    }
  }, []);

  // Auto-expand days during tutorial
  const showTutorial = tutorialActive && !tutorialDismissed;
  const currentStep = showTutorial ? TUTORIAL_STEPS[tutorialStep] : null;

  useEffect(() => {
    if (showTutorial && currentStep?.expandDay) {
      setExpanded(currentStep.expandDay);
    } else if (showTutorial && tutorialStep <= 2 && days.length > 0) {
      // For first 3 steps, expand first day
      setExpanded(days[0]?.id || null);
    }
  }, [showTutorial, tutorialStep, days, currentStep]);

  // ── Derived state ────────────────────────────────────────────
  const usedTeamIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(picks).forEach(p => ids.add(p.team.id));
    // Also include used teams from entry history (pool mode)
    if (usedTeamIdsFromEntry) {
      usedTeamIdsFromEntry.forEach(id => ids.add(id));
    }
    return ids;
  }, [picks, usedTeamIdsFromEntry]);

  const regionCounts = useMemo(() => {
    const c: Record<string, number> = { East: 0, West: 0, South: 0, Midwest: 0 };
    Object.values(picks).forEach(p => {
      if (c[p.region] !== undefined) c[p.region]++;
    });
    return c;
  }, [picks]);

  const totalPicks = Object.keys(picks).length;

  // ── Bracket logic (matches prototype) ────────────────────────
  const findTeam = useCallback(
    (region: string, seed: number): TeamInfo | null => {
      return (bracket[region] || []).find(t => t.seed === seed) || null;
    },
    [bracket]
  );

  const getTeamsInGame = useCallback(
    (region: string, round: string, gameIdx: number): (TeamInfo | null)[] => {
      if (round === 'R64') {
        const pair = R64_SEED_PAIRINGS[gameIdx];
        if (!pair) return [];
        return [findTeam(region, pair[0]), findTeam(region, pair[1])];
      }
      const feeders = FEEDERS_MAP[round];
      if (!feeders || !feeders[gameIdx]) return [];
      return feeders[gameIdx].map(fi => getGameWinner(region, PREV_ROUND[round], fi));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [advancers, bracket]
  );

  const getGameWinner = useCallback(
    (region: string, round: string, gameIdx: number): TeamInfo | null => {
      const gameId = `${region}_${round}_${gameIdx}`;
      const teams = getTeamsInGame(region, round, gameIdx);
      if (advancers[gameId] && teams.some(t => t && t.id === advancers[gameId].id)) {
        return advancers[gameId];
      }
      // Default: chalk (lowest seed wins)
      const valid = teams.filter(Boolean) as TeamInfo[];
      return valid.length ? valid.reduce((a, b) => (a.seed < b.seed ? a : b)) : null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [advancers, bracket]
  );

  // ── Get matchups for a region on a specific day ──────────────
  const getMatchupsForDay = useCallback(
    (region: string, day: PlannerDay): MatchupInfo[] => {
      const { roundCode } = day;

      if (roundCode === 'F4' || roundCode === 'CHIP') {
        const champ = getGameWinner(region, 'E8', 0);
        return champ
          ? [{
              gameIdx: 0,
              teams: [champ],
              label: roundCode === 'F4' ? `${region} Champion` : 'Title Contender',
              round: roundCode,
            }]
          : [];
      }

      // Use actual DB game indices when available, then r32DayMapping, then fallbacks
      const dbIndices = actualGameIndices[day.id]?.[region];
      const r32Indices = r32DayMapping[day.id]?.[region];
      let gameIndices: number[];

      if (dbIndices && dbIndices.length > 0) {
        // Real data — use whatever games are actually on this day for this region
        gameIndices = dbIndices;
      } else if (r32Indices && r32Indices.length > 0) {
        // R32 day mapping derived from R64 game data
        gameIndices = r32Indices;
      } else if (roundCode === 'E8') {
        gameIndices = [0];
      } else if (roundCode === 'S16') {
        gameIndices = [0, 1];
      } else if (roundCode === 'F4' || roundCode === 'CHIP') {
        gameIndices = [0];
      } else {
        // Ultimate fallback for future rounds with no games yet
        let half = day.half;
        if (half && regionFlipped[region]) half = half === 'A' ? 'B' : 'A';
        gameIndices = half === 'A'
          ? (HALF_A[roundCode] || [])
          : half === 'B'
            ? (HALF_B[roundCode] || [])
            : [...(HALF_A[roundCode] || []), ...(HALF_B[roundCode] || [])];
      }

      return gameIndices.map(gi => ({
        gameIdx: gi,
        teams: getTeamsInGame(region, roundCode, gi),
        label: roundCode === 'R64'
          ? `(${R64_SEED_PAIRINGS[gi]?.[0]}) vs (${R64_SEED_PAIRINGS[gi]?.[1]})`
          : getTeamsInGame(region, roundCode, gi)
              .filter(Boolean)
              .map(t => `(${t!.seed}) ${t!.abbreviation || t!.name}`)
              .join(' vs '),
        round: roundCode,
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actualGameIndices, r32DayMapping, advancers, regionFlipped, bracket]
  );

  // ── Actions ──────────────────────────────────────────────────
  const toggleAdvancer = (region: string, round: string, gameIdx: number, team: TeamInfo) => {
    const gameId = `${region}_${round}_${gameIdx}`;
    if (lockedAdvancerKeys.has(gameId)) return; // Can't change completed games
    if (advancers[gameId]?.id === team.id) {
      const n = { ...advancers };
      delete n[gameId];
      setAdvancers(n);
    } else {
      setAdvancers({ ...advancers, [gameId]: team });
    }
  };

  const handlePick = (dayId: string, team: TeamInfo, region: string, round: string, gameIdx: number) => {
    if (lockedDayIds.has(dayId)) return; // Can't change submitted picks
    if (picks[dayId]?.team.id === team.id) {
      const n = { ...picks };
      delete n[dayId];
      setPicks(n);
    } else if (!usedTeamIds.has(team.id) || picks[dayId]?.team.id === team.id) {
      setPicks({
        ...picks,
        [dayId]: { team, region, dayId, isSubmitted: false },
      });
      // Also advance this team if they're not the chalk
      const gameId = `${region}_${round}_${gameIdx}`;
      const teams = getTeamsInGame(region, round, gameIdx);
      const chalk = (teams.filter(Boolean) as TeamInfo[]).reduce(
        (a, b) => (a.seed < b.seed ? a : b),
        teams[0] as TeamInfo
      );
      if (chalk?.id !== team.id) {
        setAdvancers(prev => ({ ...prev, [gameId]: team }));
      }
    }
  };

  const getRegionsForDayWrapped = (day: PlannerDay): string[] => {
    // Use actual DB data if available to determine which regions have games
    const dbRegions = actualGameIndices[day.id];
    if (dbRegions && Object.keys(dbRegions).length > 0) {
      return PLANNER_REGIONS.filter(r => dbRegions[r] && dbRegions[r].length > 0);
    }
    // Use R32 day mapping for R32 days
    const r32Regions = r32DayMapping[day.id];
    if (r32Regions && Object.keys(r32Regions).length > 0) {
      return PLANNER_REGIONS.filter(r => r32Regions[r] && r32Regions[r].length > 0);
    }
    // Use fixedRegions for S16/E8
    if (day.fixedRegions) {
      const base = [...day.fixedRegions];
      return e8Swapped ? base.reverse() : base;
    }
    return PLANNER_REGIONS;
  };

  const resetAll = () => {
    // Keep locked state, reset user predictions
    setAdvancers({ ...lockedAdvancers });
    setPicks({ ...lockedPicks });
    setExpanded(null);
  };

  // ── Tutorial ─────────────────────────────────────────────────
  const advanceTutorial = () => {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
      setTutorialStep(tutorialStep + 1);
    } else {
      setTutorialActive(false);
      setTutorialDismissed(true);
      localStorage.setItem('planner-tutorial-dismissed', 'true');
    }
  };

  const dismissTutorial = () => {
    setTutorialActive(false);
    setTutorialDismissed(true);
    localStorage.setItem('planner-tutorial-dismissed', 'true');
  };

  const restartTutorial = () => {
    setTutorialStep(0);
    setTutorialActive(true);
    setTutorialDismissed(false);
    localStorage.removeItem('planner-tutorial-dismissed');
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: showTutorial ? 110 : 0 }}>
      {/* Top bar */}
      <div
        className="flex flex-wrap items-center justify-between px-4 sm:px-5 py-3 mb-4 gap-2"
        style={{
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--surface-0)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div>
          <div className="text-label-accent text-[0.5rem]">ANALYZE</div>
          <div className="text-heading text-[1.2rem]">Bracket Planner</div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {tutorialDismissed && (
            <button
              onClick={restartTutorial}
              className="font-[family-name:var(--font-mono)] text-[0.5rem] tracking-[0.1em] cursor-pointer px-2 py-1"
              style={{
                background: 'none',
                border: '1px solid var(--border-default)',
                color: 'var(--text-tertiary)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              ?
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <div className="font-[family-name:var(--font-mono)] font-bold text-[0.85rem] tracking-[0.03em]"
              style={{ color: totalPicks === days.length ? 'var(--color-alive)' : 'var(--text-secondary)' }}
            >
              {totalPicks}/{days.length}
            </div>
            <span className="label text-[0.5rem]">SET</span>
          </div>
          {(Object.keys(picks).length > Object.keys(lockedPicks).length || Object.keys(advancers).length > Object.keys(lockedAdvancers).length) && (
            <button
              onClick={resetAll}
              className="btn-secondary py-1 px-3 text-[0.75rem]"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Day Cards */}
      <div className="flex flex-col gap-1.5">
        {days.map((day, idx) => (
          <DayCard
            key={day.id}
            day={day}
            dayIndex={idx}
            isExpanded={expanded === day.id}
            onToggleExpand={() => setExpanded(expanded === day.id ? null : day.id)}
            pick={picks[day.id]}
            regions={getRegionsForDayWrapped(day)}
            getMatchupsForRegion={(region) => getMatchupsForDay(region, day)}
            advancers={advancers}
            usedTeamIds={usedTeamIds}
            lockedAdvancerKeys={lockedAdvancerKeys}
            lockedDayIds={lockedDayIds}
            e8Swapped={e8Swapped}
            onToggleE8Swap={() => setE8Swapped(!e8Swapped)}
            onToggleAdvancer={toggleAdvancer}
            onHandlePick={handlePick}
            gameStatuses={gameStatuses}
            isHighlighted={showTutorial && currentStep?.highlightId === `day-${day.id}`}
          />
        ))}
      </div>

      {/* Bracket Flow */}
      <BracketFlow
        getGameWinner={getGameWinner}
        usedTeamIds={usedTeamIds}
        isHighlighted={showTutorial && currentStep?.highlightId === 'bracket-flow'}
      />

      {/* Usage Map */}
      <UsageMap
        days={days}
        picks={picks}
        regionCounts={regionCounts}
        getRegionsForDay={getRegionsForDayWrapped}
      />

      {/* Pick Sheet */}
      <PickSheet
        days={days}
        picks={picks}
        regionCounts={regionCounts}
      />

      {/* Standalone mode signup nudge */}
      {mode === 'standalone' && (
        <div className="text-center pb-8">
          <p className="font-[family-name:var(--font-body)] text-[0.85rem] text-[var(--text-tertiary)]">
            Like what you see? Create an account and join a pool for the next tournament.
          </p>
        </div>
      )}

      {/* Tutorial coaching bar */}
      {showTutorial && currentStep && (
        <PlannerCoaching
          stepIndex={tutorialStep}
          totalSteps={TUTORIAL_STEPS.length}
          step={currentStep}
          onNext={advanceTutorial}
          onDismiss={dismissTutorial}
        />
      )}
    </div>
  );
}

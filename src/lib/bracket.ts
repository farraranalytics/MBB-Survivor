// Bracket data fetching, structuring, and planner utilities
import { supabase } from '@/lib/supabase/client';
import { Round, Game, TeamInfo } from '@/types/picks';
import { BracketGame, BracketRound, RegionBracket } from '@/types/bracket';

// ── NCAA Bracket Structure Constants ─────────────────────────────────
// Standard seed matchup order (top to bottom of bracket)
export const R64_SEED_PAIRINGS = [[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]];
export const R32_FEEDERS = [[0,1],[2,3],[4,5],[6,7]];
export const S16_FEEDERS = [[0,1],[2,3]];
export const E8_FEEDERS = [[0,1]];

export const HALF_A: Record<string, number[]> = { R64: [0,1,2,3], R32: [0,1], S16: [0] };
export const HALF_B: Record<string, number[]> = { R64: [4,5,6,7], R32: [2,3], S16: [1] };

export const PREV_ROUND: Record<string, string> = { R32: 'R64', S16: 'R32', E8: 'S16', F4: 'E8' };
export const FEEDERS_MAP: Record<string, number[][]> = { R32: R32_FEEDERS, S16: S16_FEEDERS, E8: E8_FEEDERS };

export const PLANNER_REGIONS = ['East', 'South', 'West', 'Midwest'];

export const ROUND_COLORS: Record<string, string> = {
  R64: '#9BA3AE', R32: '#C4CDD5', S16: '#42A5F5',
  E8: '#FFB300', F4: '#EF5350', CHIP: '#FF5722',
};

// ── Planner Types ────────────────────────────────────────────────────

export interface PlannerDay {
  id: string;           // round UUID
  label: string;        // round name from DB
  date: string;         // formatted "Mar 19"
  roundCode: string;    // "R64", "R32", "S16", "E8", "F4", "CHIP"
  half: string | null;  // "A", "B", or null
  allRegions: boolean;
  fixedRegions?: string[];
  deadline?: string;
}

export interface PlannerPick {
  team: TeamInfo;
  region: string;
  dayId: string;        // round UUID
  isSubmitted: boolean; // true = real pick from DB, locked
}

// ── Planner Helpers ──────────────────────────────────────────────────

export function mapRoundNameToCode(name: string): string {
  const n = name.toLowerCase();
  if (n.startsWith('round 1') || n.includes('round of 64')) return 'R64';
  if (n.startsWith('round 2') || n.includes('round of 32')) return 'R32';
  if (n.includes('sweet 16') || n.includes('sweet sixteen')) return 'S16';
  if (n.includes('elite eight') || n.includes('elite 8')) return 'E8';
  if (n.includes('final four')) return 'F4';
  if (n.includes('championship')) return 'CHIP';
  return 'R64';
}

export function inferHalf(name: string): string | null {
  if (name.includes('Day 1')) return 'A';
  if (name.includes('Day 2')) return 'B';
  return null;
}

export function getRegionsForDay(day: PlannerDay, e8Swapped: boolean): string[] {
  if (day.fixedRegions) {
    const base = [...day.fixedRegions];
    return e8Swapped ? base.reverse() : base;
  }
  if (day.allRegions) return PLANNER_REGIONS;
  return PLANNER_REGIONS;
}

// 2026 region-to-day mapping for S16 and E8 (update yearly after Selection Sunday)
const S16_DAY1_REGIONS = ['South', 'West'];      // Thu Mar 26
const S16_DAY2_REGIONS = ['East', 'Midwest'];     // Fri Mar 27
const E8_DAY1_REGIONS  = ['South', 'West'];       // Sat Mar 28
const E8_DAY2_REGIONS  = ['East', 'Midwest'];     // Sun Mar 29

export function buildPlannerDays(rounds: Round[]): PlannerDay[] {
  return rounds.map(round => {
    const roundCode = mapRoundNameToCode(round.name);
    const half = inferHalf(round.name);

    let fixedRegions: string[] | undefined;
    if (roundCode === 'S16') {
      fixedRegions = half === 'A' ? S16_DAY1_REGIONS : S16_DAY2_REGIONS;
    }
    if (roundCode === 'E8') {
      fixedRegions = half === 'A' ? E8_DAY1_REGIONS : E8_DAY2_REGIONS;
    }

    return {
      id: round.id,
      label: round.name,
      date: new Date(round.date + 'T12:00:00').toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }),
      roundCode,
      half,
      allRegions: (roundCode !== 'E8' && roundCode !== 'S16') || !half,
      fixedRegions,
      deadline: round.deadline_datetime,
    };
  });
}

/** Map a team's seed to its R64 game index (bracket position) */
export function seedToR64Index(seed: number): number {
  return R64_SEED_PAIRINGS.findIndex(pair => pair.includes(seed));
}

/** Given a team seed, determine its game index at any round */
export function getGameIndexForRound(teamSeed: number, roundCode: string): number {
  const r64 = seedToR64Index(teamSeed);
  if (r64 < 0) return 0;
  switch (roundCode) {
    case 'R64': return r64;
    case 'R32': return Math.floor(r64 / 2);
    case 'S16': return Math.floor(r64 / 4);
    case 'E8': return 0;
    default: return 0;
  }
}

/** Get game indices for a day — combines halves when no half split */
export function getGameIndicesForDay(roundCode: string, half: string | null): number[] {
  if (roundCode === 'E8') return [0];
  if (roundCode === 'F4' || roundCode === 'CHIP') return [0];
  if (!half) {
    // No half split — show all games for this round
    const a = HALF_A[roundCode] || [];
    const b = HALF_B[roundCode] || [];
    return [...a, ...b];
  }
  return half === 'A' ? (HALF_A[roundCode] || []) : (HALF_B[roundCode] || []);
}

/** Build initial advancers from completed games */
export function buildLockedAdvancers(
  games: BracketGame[],
  rounds: Round[],
  bracket: Record<string, TeamInfo[]>,
): { advancers: Record<string, TeamInfo>; lockedKeys: Set<string> } {
  const advancers: Record<string, TeamInfo> = {};
  const lockedKeys = new Set<string>();

  const roundIdToCode = new Map<string, string>();
  for (const round of rounds) {
    roundIdToCode.set(round.id, mapRoundNameToCode(round.name));
  }

  for (const game of games) {
    if (game.status !== 'final' || !game.winner_id) continue;
    const t1 = game.team1 as TeamInfo | undefined;
    const t2 = game.team2 as TeamInfo | undefined;
    if (!t1 || !t2) continue;

    const winner = game.winner_id === t1.id ? t1 : t2;
    const region = t1.region;
    const roundCode = roundIdToCode.get(game.round_id);
    if (!roundCode) continue;

    const gameIdx = getGameIndexForRound(t1.seed, roundCode);
    const key = `${region}_${roundCode}_${gameIdx}`;
    advancers[key] = winner;
    lockedKeys.add(key);
  }

  return { advancers, lockedKeys };
}

/** Build initial picks from submitted picks */
export function buildLockedPicks(
  picks: Array<{ round_id: string; team_id: string; team?: TeamInfo | null }>,
  bracket: Record<string, TeamInfo[]>,
): { picks: Record<string, PlannerPick>; lockedDayIds: Set<string> } {
  const plannerPicks: Record<string, PlannerPick> = {};
  const lockedDayIds = new Set<string>();

  // Build a team lookup by ID from all regions
  const teamById = new Map<string, TeamInfo>();
  for (const region of Object.values(bracket)) {
    for (const team of region) {
      teamById.set(team.id, team);
    }
  }

  for (const pick of picks) {
    const team = (pick.team as TeamInfo) || teamById.get(pick.team_id);
    if (!team) continue;

    plannerPicks[pick.round_id] = {
      team,
      region: team.region,
      dayId: pick.round_id,
      isSubmitted: true,
    };
    lockedDayIds.add(pick.round_id);
  }

  return { picks: plannerPicks, lockedDayIds };
}

// Backward compat alias
const BRACKET_SEED_ORDER = R64_SEED_PAIRINGS;

/**
 * Fetch all rounds ordered by date
 */
export async function getAllRounds(): Promise<Round[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .order('date', { ascending: true });

  if (error) throw new Error(`Failed to fetch rounds: ${error.message}`);
  return data || [];
}

/**
 * Fetch all games with team1/team2 joins
 */
export async function getAllGamesWithTeams(): Promise<BracketGame[]> {
  const { data, error } = await supabase
    .from('games')
    .select(`
      *,
      team1:team1_id(id, name, mascot, abbreviation, seed, region, logo_url, is_eliminated),
      team2:team2_id(id, name, mascot, abbreviation, seed, region, logo_url, is_eliminated),
      round:round_id(id, name, date, deadline_datetime, is_active, created_at, updated_at)
    `)
    .order('game_datetime', { ascending: true });

  if (error) throw new Error(`Failed to fetch games: ${error.message}`);
  return data || [];
}

/**
 * Sort R1 games into standard bracket order (1v16, 8v9, 5v12, ..., 2v15)
 */
function sortByBracketPosition(games: BracketGame[]): BracketGame[] {
  return [...games].sort((a, b) => {
    const aIndex = getBracketIndex(a);
    const bIndex = getBracketIndex(b);
    return aIndex - bIndex;
  });
}

function getBracketIndex(game: BracketGame): number {
  if (!game.team1 || !game.team2) return 99;
  const higherSeed = Math.min(game.team1.seed, game.team2.seed);
  const idx = BRACKET_SEED_ORDER.findIndex(pair => pair[0] === higherSeed);
  return idx >= 0 ? idx : 99;
}

/** Map DB round name to a display label for bracket columns */
export function mapRoundNameToLabel(name: string): string {
  const code = mapRoundNameToCode(name);
  switch (code) {
    case 'R64': return 'Round of 64';
    case 'R32': return 'Round of 32';
    case 'S16': return 'Sweet 16';
    case 'E8': return 'Elite Eight';
    case 'F4': return 'Final Four';
    case 'CHIP': return 'Championship';
    default: return name;
  }
}

/** Bracket round order for region brackets (no Final Four / Championship) */
const BRACKET_ROUND_ORDER = ['R64', 'R32', 'S16', 'E8'];

/**
 * Build a region bracket from games and rounds.
 * Groups Day 1 + Day 2 rounds into a single bracket column per round.
 * Filters games by team region, sorts R64 by bracket position.
 */
export function buildRegionBracket(
  region: string,
  allGames: BracketGame[],
  allRounds: Round[]
): RegionBracket {
  // Filter games belonging to this region (by team1's region)
  const regionGames = allGames.filter(
    g => g.team1?.region === region || g.team2?.region === region
  );

  // Group games by round CODE (not round ID) — this merges Day 1 + Day 2
  const gamesByCode = new Map<string, BracketGame[]>();
  for (const game of regionGames) {
    // Find the round for this game
    const round = allRounds.find(r => r.id === game.round_id);
    if (!round) continue;
    const code = mapRoundNameToCode(round.name);
    if (!gamesByCode.has(code)) {
      gamesByCode.set(code, []);
    }
    gamesByCode.get(code)!.push(game);
  }

  // Build bracket rounds in standard order (R64 → R32 → S16 → E8)
  const bracketRounds: BracketRound[] = [];

  for (const code of BRACKET_ROUND_ORDER) {
    const games = gamesByCode.get(code) || [];
    if (games.length === 0) {
      // Still include the column if any round with this code exists in the DB
      const dbRound = allRounds.find(r => mapRoundNameToCode(r.name) === code);
      if (!dbRound) continue;
    }

    // Use the first matching DB round as the representative (for the BracketRound type)
    // But override its name with the grouped label
    const dbRound = allRounds.find(r => mapRoundNameToCode(r.name) === code);
    if (!dbRound) continue;

    // Create a synthetic round with the grouped display name
    const syntheticRound: Round = {
      ...dbRound,
      name: mapRoundNameToLabel(dbRound.name),
    };

    // Sort R64 games by bracket seed position
    const sorted = code === 'R64' ? sortByBracketPosition(games) : games;

    bracketRounds.push({ round: syntheticRound, games: sorted });
  }

  return { region, rounds: bracketRounds };
}

/**
 * Build the Final Four mini-bracket (2 semis + championship)
 */
export function buildFinalFour(
  allGames: BracketGame[],
  allRounds: Round[]
): BracketRound[] {
  const ffRounds: BracketRound[] = [];
  const ffRoundNames = ['Final Four', 'Championship'];

  for (const round of allRounds) {
    if (ffRoundNames.some(name => round.name.includes(name) || name.includes(round.name))) {
      const games = allGames.filter(g => g.round_id === round.id);
      ffRounds.push({ round, games });
    }
  }

  return ffRounds;
}

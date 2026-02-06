// Bracket data fetching and structuring
import { supabase } from '@/lib/supabase/client';
import { Round, Game } from '@/types/picks';
import { BracketGame, BracketRound, RegionBracket } from '@/types/bracket';

// Standard NCAA bracket seed matchup order (top to bottom)
const BRACKET_SEED_ORDER = [
  [1, 16],
  [8, 9],
  [5, 12],
  [4, 13],
  [6, 11],
  [3, 14],
  [7, 10],
  [2, 15],
];

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

/**
 * Build a region bracket from games and rounds.
 * Filters games by team region, groups by round, sorts R1 by bracket position.
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

  // Group games by round
  const gamesByRound = new Map<string, BracketGame[]>();
  for (const game of regionGames) {
    const roundId = game.round_id;
    if (!gamesByRound.has(roundId)) {
      gamesByRound.set(roundId, []);
    }
    gamesByRound.get(roundId)!.push(game);
  }

  // Build bracket rounds in order
  const bracketRounds: BracketRound[] = [];
  // Only include rounds that have region games (R1 through Elite 8, not Final Four)
  const regionRoundNames = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite Eight'];

  for (const round of allRounds) {
    if (!regionRoundNames.some(name => round.name.includes(name) || name.includes(round.name))) {
      // Check if this round has games for this region
      if (!gamesByRound.has(round.id)) continue;
    }

    const games = gamesByRound.get(round.id) || [];
    // Sort R1 games by bracket seed position
    const sorted = games.length === 8 ? sortByBracketPosition(games) : games;

    bracketRounds.push({ round, games: sorted });
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

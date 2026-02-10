// ESPN API client for March Madness tournament data
import type {
  Tournament,
  Team,
  Game,
  TournamentRound,
  Region,
  GameScore,
  ESPNTournamentResponse,
  ESPNScoreboardResponse,
} from '@/types/tournament';

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball';

// Current tournament year - update annually
const CURRENT_TOURNAMENT_YEAR = 2026;

export class ESPNApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ESPNApiError';
  }
}

/**
 * Fetch March Madness tournament bracket and games
 */
export async function fetchTournamentBracket(year: number = CURRENT_TOURNAMENT_YEAR): Promise<Tournament> {
  try {
    // ESPN's tournament endpoint - may need adjustment for exact tournament ID
    const url = `${ESPN_BASE_URL}/scoreboard?dates=${year}0301-${year}0430&seasontype=3&division=50`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MBB-Survivor-Pool/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new ESPNApiError(`ESPN API request failed: ${response.status}`, response.status);
    }

    const data: ESPNTournamentResponse = await response.json();
    return parseTournamentData(data, year);
  } catch (error) {
    if (error instanceof ESPNApiError) {
      throw error;
    }
    throw new ESPNApiError(`Failed to fetch tournament bracket: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch live scores and game updates
 */
export async function fetchLiveScores(date?: string): Promise<GameScore[]> {
  try {
    const dateParam = date || getTodayESPNFormat();
    const url = `${ESPN_BASE_URL}/scoreboard?dates=${dateParam}&seasontype=3&division=50`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MBB-Survivor-Pool/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new ESPNApiError(`ESPN API request failed: ${response.status}`, response.status);
    }

    const data: ESPNScoreboardResponse = await response.json();
    return parseGameScores(data);
  } catch (error) {
    if (error instanceof ESPNApiError) {
      throw error;
    }
    throw new ESPNApiError(`Failed to fetch live scores: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch specific team information
 */
export async function fetchTeamInfo(teamId: string): Promise<Team | null> {
  try {
    const url = `${ESPN_BASE_URL}/teams/${teamId}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MBB-Survivor-Pool/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new ESPNApiError(`ESPN API request failed: ${response.status}`, response.status);
    }

    const data = await response.json();
    return parseTeamData(data.team);
  } catch (error) {
    if (error instanceof ESPNApiError) {
      throw error;
    }
    throw new ESPNApiError(`Failed to fetch team info: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get tournament games for a specific date
 */
export async function fetchGamesForDate(date: string): Promise<Game[]> {
  try {
    const url = `${ESPN_BASE_URL}/scoreboard?dates=${date}&seasontype=3&division=50`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MBB-Survivor-Pool/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new ESPNApiError(`ESPN API request failed: ${response.status}`, response.status);
    }

    const data: ESPNTournamentResponse = await response.json();
    return parseGamesFromEvents(data.events);
  } catch (error) {
    if (error instanceof ESPNApiError) {
      throw error;
    }
    throw new ESPNApiError(`Failed to fetch games for date: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to parse tournament data from ESPN response
function parseTournamentData(data: ESPNTournamentResponse, year: number): Tournament {
  const games = parseGamesFromEvents(data.events);
  const teams = extractTeamsFromGames(games);
  const rounds = groupGamesByRounds(games);
  const regions = groupTeamsByRegions(teams, games);

  return {
    id: `march-madness-${year}`,
    name: `NCAA Men's Basketball Tournament ${year}`,
    year,
    startDate: games.length > 0 ? games[0].date : `${year}-03-15`,
    endDate: games.length > 0 ? games[games.length - 1].date : `${year}-04-08`,
    regions,
    rounds,
    status: determinetournamentStatus(games),
  };
}

function parseGamesFromEvents(events: ESPNTournamentResponse['events']): Game[] {
  return events.map(event => {
    const competition = event.competitions[0];
    const competitors = competition.competitors;

    return {
      id: event.id,
      date: event.date,
      status: event.status,
      competitors: [
        {
          id: competitors[0].id,
          team: parseTeamData(competitors[0].team),
          score: competitors[0].score || 0,
          winner: competitors[0].winner || false,
          seed: competitors[0].seed || 16,
        },
        {
          id: competitors[1].id,
          team: parseTeamData(competitors[1].team),
          score: competitors[1].score || 0,
          winner: competitors[1].winner || false,
          seed: competitors[1].seed || 16,
        },
      ],
      venue: competition.venue,
      broadcasts: competition.broadcasts || [],
      round: determineRoundFromDate(event.date),
    };
  });
}

function parseTeamData(teamData: any): Team {
  const winsLosses = teamData.record?.find((r: any) => r.name === 'overall');
  const recordParts = winsLosses?.displayValue?.split('-') || ['0', '0'];

  return {
    id: teamData.id,
    name: teamData.name,
    displayName: teamData.displayName,
    abbreviation: teamData.abbreviation,
    logo: teamData.logo,
    color: teamData.color || '#000000',
    alternateColor: teamData.alternateColor || '#FFFFFF',
    seed: 16, // Will be updated with actual seed data
    record: {
      wins: parseInt(recordParts[0]) || 0,
      losses: parseInt(recordParts[1]) || 0,
    },
    conference: {
      id: '',
      name: '',
      shortName: '',
    },
  };
}

function parseGameScores(data: ESPNScoreboardResponse): GameScore[] {
  return data.events.map(event => {
    const competition = event.competitions[0];
    const competitors = competition.competitors;

    return {
      gameId: event.id,
      homeTeam: {
        id: competitors[0].team.id,
        score: competitors[0].score || 0,
        winner: competitors[0].winner || false,
      },
      awayTeam: {
        id: competitors[1].team.id,
        score: competitors[1].score || 0,
        winner: competitors[1].winner || false,
      },
      status: event.status.type.name,
      completed: event.status.type.completed,
      lastUpdated: new Date().toISOString(),
    };
  });
}

function extractTeamsFromGames(games: Game[]): Team[] {
  const teamMap = new Map<string, Team>();
  
  games.forEach(game => {
    game.competitors.forEach(competitor => {
      if (!teamMap.has(competitor.team.id)) {
        teamMap.set(competitor.team.id, {
          ...competitor.team,
          seed: competitor.seed,
        });
      }
    });
  });

  return Array.from(teamMap.values());
}

function groupGamesByRounds(games: Game[]): TournamentRound[] {
  const roundsMap = new Map<number, Game[]>();
  
  games.forEach(game => {
    if (!roundsMap.has(game.round)) {
      roundsMap.set(game.round, []);
    }
    roundsMap.get(game.round)!.push(game);
  });

  return Array.from(roundsMap.entries()).map(([roundNumber, roundGames]) => ({
    number: roundNumber,
    name: getRoundName(roundNumber),
    startDate: roundGames.length > 0 ? roundGames[0].date : '',
    endDate: roundGames.length > 0 ? roundGames[roundGames.length - 1].date : '',
    games: roundGames.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
  }));
}

function groupTeamsByRegions(teams: Team[], games: Game[]): Region[] {
  // Simplified region grouping - in real implementation, would use seed/bracket data
  const regions = ['East', 'West', 'South', 'Midwest'];
  const teamsPerRegion = Math.ceil(teams.length / 4);

  return regions.map((regionName, index) => ({
    id: regionName.toLowerCase(),
    name: regionName,
    teams: teams.slice(index * teamsPerRegion, (index + 1) * teamsPerRegion),
    games: games.filter(game => 
      game.competitors.some(comp => 
        teams.slice(index * teamsPerRegion, (index + 1) * teamsPerRegion)
          .some(team => team.id === comp.team.id)
      )
    ),
  }));
}

function determineRoundFromDate(dateString: string): number {
  // Use ET date parts — late-night ET games (e.g. 11 PM ET) are already the next UTC day
  const date = new Date(dateString);
  const etParts = date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'numeric',
    day: 'numeric',
  }).split('/'); // "3/19" → ['3', '19']
  const month = parseInt(etParts[0]);
  const day = parseInt(etParts[1]);

  // Rough tournament schedule - adjust based on actual dates
  if (month === 3) {
    if (day <= 17) return 1; // First Four / First Round
    if (day <= 19) return 2; // Second Round
    if (day <= 26) return 3; // Sweet 16
    if (day <= 28) return 4; // Elite Eight
  } else if (month === 4) {
    if (day <= 6) return 5; // Final Four
    return 6; // Championship
  }

  return 1;
}

function getRoundName(roundNumber: number): string {
  const roundNames = {
    1: 'First Round',
    2: 'Second Round',
    3: 'Sweet 16',
    4: 'Elite 8',
    5: 'Final Four',
    6: 'Championship',
  };
  return roundNames[roundNumber as keyof typeof roundNames] || `Round ${roundNumber}`;
}

function determinetournamentStatus(games: Game[]): 'upcoming' | 'in-progress' | 'completed' {
  if (games.length === 0) return 'upcoming';
  
  const now = new Date();
  const hasStarted = games.some(game => new Date(game.date) <= now);
  const allCompleted = games.every(game => game.status.type.completed);
  
  if (allCompleted) return 'completed';
  if (hasStarted) return 'in-progress';
  return 'upcoming';
}

function getTodayESPNFormat(): string {
  // Use ET date — avoids fetching wrong day when UTC has rolled past midnight but ET hasn't
  const now = new Date();
  const etDate = now.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }); // "03/19/2026"
  const [month, day, year] = etDate.split('/');
  return `${year}${month}${day}`;
}

// Cache for API responses to avoid rate limiting
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCachedData<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as T;
  }
  return null;
}

function setCachedData<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}
// Tournament data types for March Madness
export interface Team {
  id: string;
  name: string;
  displayName: string;
  abbreviation: string;
  logo: string;
  color: string;
  alternateColor: string;
  seed: number;
  record: {
    wins: number;
    losses: number;
  };
  conference: {
    id: string;
    name: string;
    shortName: string;
  };
}

export interface Game {
  id: string;
  date: string;
  status: {
    clock: number;
    displayClock: string;
    period: number;
    type: {
      id: string;
      name: string;
      state: string; // 'pre', 'in', 'post'
      completed: boolean;
      shortDetail: string;
      detail: string;
    };
  };
  competitors: [
    {
      id: string;
      team: Team;
      score: number;
      winner: boolean;
      seed: number;
    },
    {
      id: string;
      team: Team;
      score: number;
      winner: boolean;
      seed: number;
    }
  ];
  venue: {
    id: string;
    fullName: string;
    address: {
      city: string;
      state: string;
    };
  };
  broadcasts: Array<{
    market: string;
    names: string[];
  }>;
  round: number;
  region?: string;
}

export interface TournamentRound {
  number: number;
  name: string; // "First Round", "Second Round", "Sweet 16", "Elite 8", "Final Four", "Championship"
  startDate: string;
  endDate: string;
  games: Game[];
}

export interface Region {
  id: string;
  name: string; // "East", "West", "South", "Midwest"
  teams: Team[];
  games: Game[];
}

export interface Tournament {
  id: string;
  name: string;
  year: number;
  startDate: string;
  endDate: string;
  regions: Region[];
  rounds: TournamentRound[];
  champion?: Team;
  status: 'upcoming' | 'in-progress' | 'completed';
}

export interface GameScore {
  gameId: string;
  homeTeam: {
    id: string;
    score: number;
    winner: boolean;
  };
  awayTeam: {
    id: string;
    score: number;
    winner: boolean;
  };
  status: string;
  completed: boolean;
  lastUpdated: string;
}

export interface TournamentPickOption {
  teamId: string;
  team: Team;
  gameId: string;
  game: Game;
  round: number;
  available: boolean; // false if team already used by player
  riskLevel: 'low' | 'medium' | 'high'; // based on seed differential
}

// ESPN API Response Types
export interface ESPNTournamentResponse {
  events: Array<{
    id: string;
    date: string;
    status: {
      clock: number;
      displayClock: string;
      period: number;
      type: {
        id: string;
        name: string;
        state: string;
        completed: boolean;
        shortDetail: string;
        detail: string;
      };
    };
    competitions: Array<{
      id: string;
      venue: {
        id: string;
        fullName: string;
        address: {
          city: string;
          state: string;
        };
      };
      competitors: Array<{
        id: string;
        team: {
          id: string;
          displayName: string;
          shortDisplayName: string;
          name: string;
          abbreviation: string;
          logo: string;
          color: string;
          alternateColor: string;
          record: Array<{
            name: string;
            displayValue: string;
            value: number;
          }>;
        };
        score: number;
        winner: boolean;
        seed: number;
      }>;
      broadcasts: Array<{
        market: string;
        names: string[];
      }>;
    }>;
    season: {
      year: number;
      type: number;
    };
  }>;
}

export interface ESPNScoreboardResponse {
  events: Array<{
    id: string;
    date: string;
    status: {
      clock: number;
      displayClock: string;
      period: number;
      type: {
        id: string;
        name: string;
        state: string;
        completed: boolean;
        shortDetail: string;
        detail: string;
      };
    };
    competitions: Array<{
      competitors: Array<{
        team: {
          id: string;
          displayName: string;
          abbreviation: string;
          logo: string;
        };
        score: number;
        winner?: boolean;
      }>;
    }>;
  }>;
}
// The Odds API v4 response types

export interface OddsEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

export interface OddsBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsMarket[];
}

export interface OddsMarket {
  key: string; // 'h2h' | 'spreads'
  last_update: string;
  outcomes: OddsOutcome[];
}

export interface OddsOutcome {
  name: string;
  price: number;
  point?: number; // only for spreads
}

// Score event from /scores endpoint
export interface ScoreEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: { name: string; score: string }[] | null;
  last_update: string | null;
}

// Domain type for our app
export interface GameOdds {
  team1Moneyline: number | null;
  team2Moneyline: number | null;
  team1Spread: number | null;
  team2Spread: number | null;
  team1WinProbability: number | null;
  team2WinProbability: number | null;
  oddsUpdatedAt: string;
}

// Quota tracking from response headers
export interface OddsQuota {
  remaining: number | null;
  used: number | null;
}

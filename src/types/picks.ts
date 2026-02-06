// Pick submission types for survivor pools

export interface Pool {
  id: string;
  name: string;
  join_code: string;
  creator_id: string;
  entry_fee: number;
  prize_pool: number;
  max_players: number | null;
  is_private: boolean;
  tournament_year: number;
  status: 'open' | 'active' | 'complete';
  winner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PoolPlayer {
  id: string;
  pool_id: string;
  user_id: string;
  display_name: string;
  is_eliminated: boolean;
  elimination_round_id: string | null;
  elimination_reason: 'wrong_pick' | 'missed_pick' | 'manual' | null;
  joined_at: string;
}

export interface Round {
  id: string;
  name: string;
  date: string;
  deadline_datetime: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamInfo {
  id: string;
  name: string;
  mascot: string;
  abbreviation: string;
  seed: number;
  region: string;
  logo_url: string;
  is_eliminated: boolean;
}

export interface Pick {
  id: string;
  pool_player_id: string;
  round_id: string;
  team_id: string;
  confidence: number | null;
  is_correct: boolean | null;
  submitted_at: string;
  // Joined data
  team?: TeamInfo;
  round?: Round;
}

export interface Game {
  id: string;
  round_id: string;
  team1_id: string;
  team2_id: string;
  game_datetime: string;
  winner_id: string | null;
  team1_score: number | null;
  team2_score: number | null;
  status: 'scheduled' | 'in_progress' | 'final';
  espn_game_id: string | null;
  // Joined team data
  team1?: TeamInfo;
  team2?: TeamInfo;
}

export interface PickableTeam {
  id: string;
  name: string;
  mascot: string;
  abbreviation: string;
  seed: number;
  region: string;
  logo_url: string;
  is_eliminated: boolean;
  // Pick context
  game_id: string;
  game_datetime: string;
  opponent: {
    id: string;
    name: string;
    seed: number;
    abbreviation: string;
  };
  already_used: boolean;
  risk_level: 'low' | 'medium' | 'high';
}

export interface PlayerStatus {
  pool_player_id: string;
  display_name: string;
  is_eliminated: boolean;
  elimination_reason: string | null;
  current_pick: Pick | null;
  picks_count: number;
  teams_used: string[]; // team IDs already picked
  survival_streak: number; // correct picks in a row
}

export interface PickDeadline {
  round_id: string;
  round_name: string;
  deadline_datetime: string;
  minutes_remaining: number;
  is_expired: boolean;
  first_game_time: string;
}

export interface PickSubmission {
  pool_player_id: string;
  round_id: string;
  team_id: string;
  confidence?: number;
}

export interface PickValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PoolStandings {
  pool_id: string;
  pool_name: string;
  creator_id: string;
  join_code: string;
  total_players: number;
  alive_players: number;
  eliminated_players: number;
  current_round: Round | null;
  players: PlayerStatus[];
  your_status: PlayerStatus | null;
}

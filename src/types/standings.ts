// Standings & Leaderboard types

export interface RoundResult {
  round_id: string;
  round_name: string;
  round_date: string;
  team_name: string;
  team_seed: number;
  team_abbreviation: string;
  opponent_name: string | null;
  opponent_seed: number | null;
  is_correct: boolean | null; // null = pending
  game_status: 'scheduled' | 'in_progress' | 'final';
  game_score: string | null; // e.g. "72-65"
}

export interface StandingsPlayer {
  pool_player_id: string;
  user_id: string;
  display_name: string;
  entry_label: string;
  is_eliminated: boolean;
  elimination_reason: 'wrong_pick' | 'missed_pick' | 'manual' | null;
  elimination_round_name: string | null;
  picks_count: number;
  correct_picks: number;
  survival_streak: number; // consecutive correct picks from most recent
  longest_streak: number;
  teams_used: string[]; // team names used
  round_results: RoundResult[];
  current_round_pick: RoundResult | null;
}

export interface PoolLeaderboard {
  pool_id: string;
  pool_name: string;
  pool_status: 'open' | 'active' | 'complete';
  total_players: number;
  alive_players: number;
  eliminated_players: number;
  current_round: {
    id: string;
    name: string;
    date: string;
    deadline_datetime: string;
  } | null;
  rounds_played: {
    id: string;
    name: string;
    date: string;
  }[];
  players: StandingsPlayer[];
}

export type StandingsFilter = 'all' | 'alive' | 'eliminated';
export type StandingsSort = 'rank' | 'name' | 'streak' | 'picks';

export interface MyPoolEntry {
  pool_player_id: string;
  entry_number: number;
  entry_label: string;
  is_eliminated: boolean;
  picks_count: number;
  has_picked_today: boolean;
}

export interface MyPool {
  pool_id: string;
  pool_name: string;
  pool_status: 'open' | 'active' | 'complete';
  join_code: string;
  total_players: number;
  alive_players: number;
  your_status: 'active' | 'eliminated';
  your_picks_count: number;
  your_streak: number;
  your_entry_count: number;
  your_entries: MyPoolEntry[];
  current_round_name: string | null;
  has_picked_today: boolean;
  deadline_datetime: string | null;
}

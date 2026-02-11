// src/lib/status.ts
// Derive all tournament/round statuses from game data.
// This replaces rounds.is_active, rounds.deadline_datetime reads, and pools.status reads.

import { supabase } from '@/lib/supabase/client';
import { getEffectiveNow } from '@/lib/clock';

// ─── Types ────────────────────────────────────────────────────

export type TournamentStatus = 'pre_tournament' | 'tournament_live' | 'tournament_complete';
export type RoundStatus = 'pre_round' | 'round_live' | 'round_complete';

export interface RoundInfo {
  id: string;
  name: string;
  date: string;
  status: RoundStatus;
  deadline: string;            // ISO datetime string (earliest game_datetime - 5 min)
  isDeadlinePassed: boolean;   // true if now >= deadline
  gamesScheduled: number;
  gamesInProgress: number;
  gamesFinal: number;
  gamesTotal: number;
}

export interface TournamentState {
  status: TournamentStatus;
  currentRound: RoundInfo | null;   // the round that is pre_round or round_live
  rounds: RoundInfo[];              // all rounds with derived status
}

// ─── Core: Get Tournament State ───────────────────────────────

export async function getTournamentState(): Promise<TournamentState> {
  // Single query: all rounds with their games
  const { data: rounds, error } = await supabase
    .from('rounds')
    .select(`
      id, name, date,
      games(id, status, game_datetime)
    `)
    .order('date', { ascending: true });

  if (error || !rounds || rounds.length === 0) {
    return { status: 'pre_tournament', currentRound: null, rounds: [] };
  }

  const now = await getEffectiveNow();

  const roundInfos: RoundInfo[] = rounds.map(round => {
    const games = (round as any).games || [];
    const scheduled = games.filter((g: any) => g.status === 'scheduled').length;
    const inProgress = games.filter((g: any) => g.status === 'in_progress').length;
    const final_ = games.filter((g: any) => g.status === 'final').length;
    const total = games.length;

    // Derive round status
    let status: RoundStatus;
    if (total === 0 || scheduled === total) {
      status = 'pre_round';
    } else if (final_ === total) {
      status = 'round_complete';
    } else {
      status = 'round_live';
    }

    // Derive deadline = earliest game_datetime - 5 minutes
    let deadline = '';
    let isDeadlinePassed = false;
    if (games.length > 0) {
      const gameTimes = games.map((g: any) => g.game_datetime).filter(Boolean).sort();
      if (gameTimes.length > 0) {
        const earliestGameTime = new Date(gameTimes[0]);
        const deadlineTime = new Date(earliestGameTime.getTime() - 5 * 60 * 1000);
        deadline = deadlineTime.toISOString();
        isDeadlinePassed = now >= deadlineTime;
      }
    }

    return {
      id: round.id,
      name: round.name,
      date: round.date,
      status,
      deadline,
      isDeadlinePassed,
      gamesScheduled: scheduled,
      gamesInProgress: inProgress,
      gamesFinal: final_,
      gamesTotal: total,
    };
  });

  // Derive tournament status
  const allPreRound = roundInfos.every(r => r.status === 'pre_round');
  const lastRound = roundInfos[roundInfos.length - 1];
  const lastRoundComplete = lastRound?.status === 'round_complete';

  let tournamentStatus: TournamentStatus;
  if (allPreRound) {
    tournamentStatus = 'pre_tournament';
  } else if (lastRoundComplete) {
    tournamentStatus = 'tournament_complete';
  } else {
    tournamentStatus = 'tournament_live';
  }

  // Current round = first that is pre_round or round_live
  // If all complete, use the last round
  const currentRound =
    roundInfos.find(r => r.status === 'pre_round' || r.status === 'round_live')
    || (lastRoundComplete ? lastRound : null);

  return {
    status: tournamentStatus,
    currentRound,
    rounds: roundInfos,
  };
}

// ─── Convenience Helpers ──────────────────────────────────────

/** Can users create pools, join pools, add entries? Pre-tournament only. */
export function canJoinOrCreate(state: TournamentState): boolean {
  return state.status === 'pre_tournament';
}

/** Can the current user make/change picks for the current round? */
export function canMakePicks(state: TournamentState): boolean {
  if (!state.currentRound) return false;
  return state.currentRound.status === 'pre_round' && !state.currentRound.isDeadlinePassed;
}

/** Are other users' picks visible for a specific round? */
export function arePicksVisible(roundInfo: RoundInfo): boolean {
  return roundInfo.status === 'round_live' || roundInfo.status === 'round_complete';
}

/** Get deadline display info */
export async function getDeadlineDisplay(state: TournamentState): Promise<{
  deadline: string;
  isExpired: boolean;
  minutesRemaining: number;
} | null> {
  if (!state.currentRound?.deadline) return null;

  const deadlineTime = new Date(state.currentRound.deadline);
  const now = await getEffectiveNow();
  const diff = deadlineTime.getTime() - now.getTime();

  return {
    deadline: state.currentRound.deadline,
    isExpired: diff <= 0,
    minutesRemaining: Math.max(0, Math.ceil(diff / 60000)),
  };
}

/**
 * Find a RoundInfo by ID from the tournament state.
 * Useful when you have a round_id from picks data and need to check visibility.
 */
export function getRoundById(state: TournamentState, roundId: string): RoundInfo | undefined {
  return state.rounds.find(r => r.id === roundId);
}

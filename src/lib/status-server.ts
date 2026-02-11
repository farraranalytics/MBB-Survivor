// src/lib/status-server.ts
// Server-side version of tournament state derivation.
// Uses supabaseAdmin (service role) for API routes and cron jobs.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { getEffectiveNowServer } from '@/lib/clock-server';

// Re-export types from status.ts
export type { TournamentStatus, RoundStatus, RoundInfo, TournamentState } from '@/lib/status';
export { canJoinOrCreate, canMakePicks, arePicksVisible, getDeadlineDisplay, getRoundById } from '@/lib/status';

export async function getTournamentStateServer(): Promise<import('@/lib/status').TournamentState> {
  const { data: rounds, error } = await supabaseAdmin
    .from('rounds')
    .select(`
      id, name, date,
      games(id, status, game_datetime)
    `)
    .order('date', { ascending: true });

  if (error || !rounds || rounds.length === 0) {
    return { status: 'pre_tournament', currentRound: null, rounds: [] };
  }

  const now = await getEffectiveNowServer();

  const roundInfos: import('@/lib/status').RoundInfo[] = rounds.map(round => {
    const games = (round as any).games || [];
    const scheduled = games.filter((g: any) => g.status === 'scheduled').length;
    const inProgress = games.filter((g: any) => g.status === 'in_progress').length;
    const final_ = games.filter((g: any) => g.status === 'final').length;
    const total = games.length;

    let status: import('@/lib/status').RoundStatus;
    if (total === 0 || scheduled === total) status = 'pre_round';
    else if (final_ === total) status = 'round_complete';
    else status = 'round_live';

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

    return { id: round.id, name: round.name, date: round.date, status, deadline, isDeadlinePassed, gamesScheduled: scheduled, gamesInProgress: inProgress, gamesFinal: final_, gamesTotal: total };
  });

  const allPreRound = roundInfos.every(r => r.status === 'pre_round');
  const lastRound = roundInfos[roundInfos.length - 1];
  const lastRoundComplete = lastRound?.status === 'round_complete';

  const tournamentStatus = allPreRound ? 'pre_tournament' : lastRoundComplete ? 'tournament_complete' : 'tournament_live';
  const currentRound = roundInfos.find(r => r.status === 'pre_round' || r.status === 'round_live') || (lastRoundComplete ? lastRound : null);

  return { status: tournamentStatus, currentRound, rounds: roundInfos };
}

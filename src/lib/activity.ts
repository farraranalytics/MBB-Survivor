import { supabase } from '@/lib/supabase/client';

export interface ActivityItem {
  id: string;
  type: 'game_final' | 'upset' | 'elimination' | 'player_joined';
  timestamp: string;
  text: string;
  isOwnEvent: boolean;
}

export function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 0) return 'just now';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export async function getActivityFeed(
  userId: string,
  poolIds: string[],
  recentRoundIds: string[]
): Promise<ActivityItem[]> {
  if (poolIds.length === 0) return [];

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const items: ActivityItem[] = [];

  // Build parallel queries
  const promises: PromiseLike<any>[] = [
    // 1. Recent game results (last 24h)
    supabase
      .from('games')
      .select('id, team1_id, team2_id, team1_score, team2_score, game_datetime, winner_id, team1:teams!team1_id(name, seed), team2:teams!team2_id(name, seed)')
      .eq('status', 'final')
      .gte('game_datetime', twentyFourHoursAgo)
      .order('game_datetime', { ascending: false })
      .limit(15),

    // 2. New players in user's pools (last 48h)
    supabase
      .from('pool_players')
      .select('id, display_name, user_id, joined_at, pools(name)')
      .in('pool_id', poolIds)
      .gte('joined_at', fortyEightHoursAgo)
      .order('joined_at', { ascending: false })
      .limit(10),
  ];

  // 3. Eliminations from recent rounds
  if (recentRoundIds.length > 0) {
    promises.push(
      supabase
        .from('pool_players')
        .select('id, display_name, entry_label, user_id, elimination_round_id, pools(name)')
        .in('pool_id', poolIds)
        .eq('is_eliminated', true)
        .in('elimination_round_id', recentRoundIds)
        .limit(20)
    );
  }

  const [gamesRes, joinsRes, elimRes] = await Promise.all(promises);

  // Process game results
  if (gamesRes?.data) {
    for (const game of gamesRes.data) {
      const t1 = (game as any).team1;
      const t2 = (game as any).team2;
      if (!t1 || !t2 || !game.winner_id) continue;

      const isT1Winner = game.winner_id === game.team1_id;
      const winner = isT1Winner ? t1 : t2;
      const loser = isT1Winner ? t2 : t1;
      const winScore = isT1Winner ? game.team1_score : game.team2_score;
      const loseScore = isT1Winner ? game.team2_score : game.team1_score;
      const isUpset = winner.seed > loser.seed;

      items.push({
        id: `game-${game.id}`,
        type: isUpset ? 'upset' : 'game_final',
        timestamp: game.game_datetime,
        text: isUpset
          ? `(${winner.seed}) ${winner.name} upsets (${loser.seed}) ${loser.name}! ${winScore}-${loseScore}`
          : `(${winner.seed}) ${winner.name} ${winScore}, (${loser.seed}) ${loser.name} ${loseScore}`,
        isOwnEvent: false,
      });
    }
  }

  // Process eliminations
  if (elimRes?.data) {
    for (const elim of elimRes.data) {
      const poolName = (elim as any).pools?.name || 'Pool';
      const isOwn = elim.user_id === userId;
      items.push({
        id: `elim-${elim.id}`,
        type: 'elimination',
        timestamp: new Date().toISOString(),
        text: isOwn
          ? `${elim.entry_label || elim.display_name} eliminated · ${poolName}`
          : `${elim.display_name} eliminated · ${poolName}`,
        isOwnEvent: isOwn,
      });
    }
  }

  // Process new players
  if (joinsRes?.data) {
    for (const join of joinsRes.data) {
      const poolName = (join as any).pools?.name || 'Pool';
      const isOwn = join.user_id === userId;
      items.push({
        id: `join-${join.id}`,
        type: 'player_joined',
        timestamp: join.joined_at,
        text: isOwn
          ? `You joined ${poolName}`
          : `${join.display_name} joined ${poolName}`,
        isOwnEvent: isOwn,
      });
    }
  }

  // Sort by timestamp, newest first
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return items.slice(0, 20);
}

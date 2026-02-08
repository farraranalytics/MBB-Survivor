// Analyze tab data functions
import { supabase } from '@/lib/supabase/client';

// ─── Types ───────────────────────────────────────────────────────

export interface InventoryTeam {
  id: string;
  name: string;
  abbreviation: string;
  seed: number;
  region: string;
  is_eliminated: boolean;
  status: 'available' | 'used' | 'eliminated';
}

export interface OpponentInventory {
  pool_player_id: string;
  display_name: string;
  entry_label: string;
  is_eliminated: boolean;
  used_team_ids: string[];
}

// ─── Team Inventory ──────────────────────────────────────────────

export async function getTeamInventory(poolPlayerId: string, excludeRoundId?: string): Promise<InventoryTeam[]> {
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, abbreviation, seed, region, is_eliminated')
    .order('seed', { ascending: true });

  if (teamsError) throw new Error(`Failed to fetch teams: ${teamsError.message}`);

  let query = supabase
    .from('picks')
    .select('team_id')
    .eq('pool_player_id', poolPlayerId);

  if (excludeRoundId) {
    query = query.neq('round_id', excludeRoundId);
  }

  const { data: picks, error: picksError } = await query;

  if (picksError) throw new Error(`Failed to fetch picks: ${picksError.message}`);

  const usedTeamIds = new Set(picks?.map(p => p.team_id) || []);

  return (teams || []).map(team => ({
    id: team.id,
    name: team.name,
    abbreviation: team.abbreviation,
    seed: team.seed,
    region: team.region,
    is_eliminated: team.is_eliminated,
    status: usedTeamIds.has(team.id)
      ? 'used' as const
      : team.is_eliminated
        ? 'eliminated' as const
        : 'available' as const,
  }));
}

// ─── Opponent Inventories ────────────────────────────────────────

export async function getOpponentInventories(
  poolId: string,
  currentPoolPlayerId: string,
  excludeRoundId?: string,
): Promise<OpponentInventory[]> {
  const { data: players, error: playersError } = await supabase
    .from('pool_players')
    .select('id, display_name, entry_label, is_eliminated')
    .eq('pool_id', poolId)
    .eq('is_eliminated', false)
    .order('display_name', { ascending: true });

  if (playersError) throw new Error(`Failed to fetch players: ${playersError.message}`);

  const opponents: OpponentInventory[] = [];

  for (const player of (players || [])) {
    let query = supabase
      .from('picks')
      .select('team_id')
      .eq('pool_player_id', player.id);

    // Exclude current round picks for ALL players before deadline
    if (excludeRoundId) {
      query = query.neq('round_id', excludeRoundId);
    }

    const { data: picks } = await query;

    opponents.push({
      pool_player_id: player.id,
      display_name: player.display_name,
      entry_label: player.entry_label || player.display_name,
      is_eliminated: player.is_eliminated,
      used_team_ids: picks?.map(p => p.team_id) || [],
    });
  }

  return opponents;
}

// ─── Seed Win Probability ────────────────────────────────────────

const SEED_WIN_RATES: Record<string, number> = {
  '1v16': 0.99, '2v15': 0.94, '3v14': 0.85, '4v13': 0.79,
  '5v12': 0.64, '6v11': 0.62, '7v10': 0.61, '8v9': 0.51,
  '1v8': 0.80, '2v7': 0.67, '3v6': 0.58, '4v5': 0.55,
  '1v4': 0.72, '2v3': 0.57,
  '1v2': 0.65,
};

export function getSeedWinProbability(teamSeed: number, opponentSeed: number): number {
  const low = Math.min(teamSeed, opponentSeed);
  const high = Math.max(teamSeed, opponentSeed);
  const key = `${low}v${high}`;

  const baseRate = SEED_WIN_RATES[key];
  if (baseRate !== undefined) {
    return teamSeed <= opponentSeed ? baseRate : 1 - baseRate;
  }

  // Fallback: estimate based on seed difference
  const diff = opponentSeed - teamSeed;
  const prob = 0.5 + (diff * 0.03);
  return Math.max(0.05, Math.min(0.95, prob));
}

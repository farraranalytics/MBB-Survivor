import { supabase } from '@/lib/supabase/client';

export interface PoolAdminData {
  id: string;
  name: string;
  is_private: boolean;
  max_players: number | null;
  entry_fee: number;
  max_entries_per_user: number;
  status: 'open' | 'active' | 'complete';
  creator_id: string;
  join_code: string;
  player_count: number;
}

export interface PoolAdminUpdate {
  name?: string;
  is_private?: boolean;
  max_players?: number | null;
  entry_fee?: number;
  max_entries_per_user?: number;
}

export async function getPoolAdmin(poolId: string, userId: string): Promise<PoolAdminData | null> {
  const { data: pool, error } = await supabase
    .from('pools')
    .select('id, name, is_private, max_players, entry_fee, max_entries_per_user, status, creator_id, join_code, pool_players(count)')
    .eq('id', poolId)
    .eq('creator_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found or not owner
    throw new Error(error.message);
  }

  return {
    id: pool.id,
    name: pool.name,
    is_private: pool.is_private,
    max_players: pool.max_players,
    entry_fee: pool.entry_fee,
    max_entries_per_user: pool.max_entries_per_user ?? 1,
    status: pool.status,
    creator_id: pool.creator_id,
    join_code: pool.join_code,
    player_count: (pool as any).pool_players?.[0]?.count || 0,
  };
}

export async function updatePoolSettings(poolId: string, updates: PoolAdminUpdate): Promise<void> {
  const { error } = await supabase
    .from('pools')
    .update(updates)
    .eq('id', poolId);

  if (error) throw new Error(error.message);
}

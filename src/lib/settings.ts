import { supabase } from '@/lib/supabase/client';

export interface CreatedPool {
  id: string;
  name: string;
  join_code: string;
  status: 'open' | 'active' | 'complete';
  entry_fee: number;
  max_players: number | null;
  is_private: boolean;
  player_count: number;
  created_at: string;
}

export async function getCreatedPools(userId: string): Promise<CreatedPool[]> {
  const { data: pools, error } = await supabase
    .from('pools')
    .select('id, name, join_code, status, entry_fee, max_players, is_private, created_at, pool_players(count)')
    .eq('creator_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (pools || []).map((pool: any) => ({
    id: pool.id,
    name: pool.name,
    join_code: pool.join_code,
    status: pool.status,
    entry_fee: pool.entry_fee,
    max_players: pool.max_players,
    is_private: pool.is_private,
    player_count: pool.pool_players?.[0]?.count || 0,
    created_at: pool.created_at,
  }));
}

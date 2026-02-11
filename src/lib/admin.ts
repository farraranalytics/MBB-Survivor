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
  notes: string | null;
  player_count: number;
}

export interface PoolAdminUpdate {
  name?: string;
  is_private?: boolean;
  max_players?: number | null;
  entry_fee?: number;
  max_entries_per_user?: number;
  notes?: string | null;
}

export interface PoolMember {
  id: string;
  user_id: string;
  display_name: string;
  entry_label: string | null;
  entry_number: number;
  is_eliminated: boolean;
  joined_at: string;
}

export async function getPoolAdmin(poolId: string, userId: string): Promise<PoolAdminData | null> {
  const { data: pool, error } = await supabase
    .from('pools')
    .select('id, name, is_private, max_players, entry_fee, max_entries_per_user, status, creator_id, join_code, notes, pool_players(count)')
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
    notes: (pool as any).notes || null,
    player_count: (pool as any).pool_players?.[0]?.count || 0,
  };
}

// Get pool info for any member (not just creator)
export async function getPoolInfo(poolId: string): Promise<PoolAdminData | null> {
  const { data: pool, error } = await supabase
    .from('pools')
    .select('id, name, is_private, max_players, entry_fee, max_entries_per_user, status, creator_id, join_code, notes, pool_players(count)')
    .eq('id', poolId)
    .single();

  if (error) return null;

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
    notes: (pool as any).notes || null,
    player_count: (pool as any).pool_players?.[0]?.count || 0,
  };
}

// Get all members of a pool (for creator's member list)
export async function getPoolMembers(poolId: string): Promise<PoolMember[]> {
  const { data, error } = await supabase
    .from('pool_players')
    .select('id, user_id, display_name, entry_label, entry_number, is_eliminated, joined_at')
    .eq('pool_id', poolId)
    .order('joined_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

// Remove a player from pool
export async function removePoolMember(poolPlayerId: string): Promise<void> {
  const { error, data } = await supabase
    .from('pool_players')
    .delete()
    .eq('id', poolPlayerId)
    .select('id');

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('Delete failed — you may not have permission. Check RLS policies.');
}

// Leave a pool (remove all of user's entries)
export async function leavePool(poolId: string, userId: string): Promise<void> {
  const { error, data } = await supabase
    .from('pool_players')
    .delete()
    .eq('pool_id', poolId)
    .eq('user_id', userId)
    .select('id');

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('Failed to leave pool — no entries were removed. Please try again or contact the pool admin.');
}

// Update entry label
export async function updateEntryLabel(poolPlayerId: string, newLabel: string): Promise<void> {
  const { error, data } = await supabase
    .from('pool_players')
    .update({ entry_label: newLabel.trim() })
    .eq('id', poolPlayerId)
    .select('id');

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('Update failed — you may not have permission to edit this entry.');
}

export async function updatePoolSettings(poolId: string, updates: PoolAdminUpdate): Promise<void> {
  const { error } = await supabase
    .from('pools')
    .update(updates)
    .eq('id', poolId);

  if (error) throw new Error(error.message);
}

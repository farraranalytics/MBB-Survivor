'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useActivePool } from '@/hooks/useActivePool';
import { supabase } from '@/lib/supabase/client';
import { TeamInfo, Round } from '@/types/picks';
import { BracketGame } from '@/types/bracket';
import BracketPlanner from '@/components/analyze/BracketPlanner';
import { PageHeader, PoolSelectorBar, EntryTabs } from '@/components/pool';

export default function PoolAnalyzePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const poolId = params.id as string;
  const entryId = searchParams.get('entry') || undefined;

  const { user } = useAuth();
  const { pools, setActivePool } = useActivePool();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [bracket, setBracket] = useState<Record<string, TeamInfo[]>>({});
  const [rounds, setRounds] = useState<Round[]>([]);
  const [games, setGames] = useState<BracketGame[]>([]);
  const [submittedPicks, setSubmittedPicks] = useState<Array<{ round_id: string; team_id: string; team?: TeamInfo | null }>>([]);
  const [usedTeamIds, setUsedTeamIds] = useState<string[]>([]);

  // Entry management
  const [entries, setEntries] = useState<{ id: string; entry_number: number; entry_label: string | null; is_eliminated: boolean }[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | undefined>(entryId);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      // Load pool player entries
      const { data: playerEntries } = await supabase
        .from('pool_players')
        .select('id, entry_number, entry_label, is_eliminated')
        .eq('pool_id', poolId)
        .eq('user_id', user.id)
        .order('entry_number', { ascending: true });

      if (!playerEntries || playerEntries.length === 0) {
        setError('You are not a member of this pool.');
        setLoading(false);
        return;
      }

      setEntries(playerEntries);
      const currentEntryId = activeEntryId || playerEntries[0].id;
      setActiveEntryId(currentEntryId);

      // Set active pool in context
      const { data: pool } = await supabase
        .from('pools')
        .select('id, name')
        .eq('id', poolId)
        .single();
      if (pool) setActivePool(pool.id, pool.name);

      // Load teams grouped by region
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name, mascot, abbreviation, seed, region, logo_url, is_eliminated')
        .order('seed', { ascending: true });

      const grouped: Record<string, TeamInfo[]> = {};
      for (const team of (teams || [])) {
        if (!grouped[team.region]) grouped[team.region] = [];
        grouped[team.region].push(team as TeamInfo);
      }
      setBracket(grouped);

      // Load rounds
      const { data: roundsData } = await supabase
        .from('rounds')
        .select('*')
        .order('date', { ascending: true });
      setRounds((roundsData || []) as Round[]);

      // Load games with team joins
      const { data: gamesData } = await supabase
        .from('games')
        .select(`
          *,
          team1:team1_id(id, name, mascot, abbreviation, seed, region, logo_url, is_eliminated),
          team2:team2_id(id, name, mascot, abbreviation, seed, region, logo_url, is_eliminated)
        `)
        .order('game_datetime', { ascending: true });
      setGames((gamesData || []) as BracketGame[]);

      // Load submitted picks for this entry
      const { data: picksData } = await supabase
        .from('picks')
        .select(`
          id, round_id, team_id,
          team:team_id(id, name, mascot, abbreviation, seed, region, logo_url, is_eliminated)
        `)
        .eq('pool_player_id', currentEntryId);

      // Normalize: Supabase returns join as array, extract first element
      const normalizedPicks = (picksData || []).map((p: Record<string, unknown>) => ({
        round_id: p.round_id as string,
        team_id: p.team_id as string,
        team: Array.isArray(p.team) ? (p.team[0] as TeamInfo) : (p.team as TeamInfo | null),
      }));
      setSubmittedPicks(normalizedPicks);

      // Derive used team IDs from picks
      const used = normalizedPicks.map(p => p.team_id);
      setUsedTeamIds(used);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user, poolId, activeEntryId, setActivePool]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Entry switcher handler
  const switchEntry = (entryId: string) => {
    setActiveEntryId(entryId);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--surface-1)] flex items-center justify-center pb-24">
        <p className="text-[var(--text-secondary)]">Please sign in to access the planner.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--surface-1)] pb-24">
        <div className="max-w-4xl mx-auto px-5 pt-6">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-14 rounded-[var(--radius-lg)]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--surface-1)] flex items-center justify-center pb-24">
        <div className="text-center">
          <p className="text-[var(--color-eliminated)] mb-2">{error}</p>
          <button onClick={loadData} className="btn-secondary px-4 py-2 text-sm">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface-1)] pb-24">
      {/* ─── Page Header ─── */}
      <div className="bg-[#080810] border-b border-[rgba(255,255,255,0.08)]">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-2 sm:py-4">
          <PageHeader tabLabel="ANALYZE" heading="Plan Your Path" />
          <PoolSelectorBar currentPoolId={poolId} />
          <EntryTabs
            entries={entries.map(e => {
              const poolEntry = pools.find(p => p.pool_id === poolId)?.your_entries?.find(pe => pe.pool_player_id === e.id);
              return { ...e, has_picked: poolEntry?.has_picked_today };
            })}
            activeEntryId={activeEntryId}
            onEntrySwitch={switchEntry}
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-5 pt-2.5 sm:pt-4">
        <BracketPlanner
          bracket={bracket}
          rounds={rounds}
          games={games}
          mode="pool"
          submittedPicks={submittedPicks}
          usedTeamIdsFromEntry={usedTeamIds}
        />
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { TeamInfo, Round } from '@/types/picks';
import { BracketGame } from '@/types/bracket';
import BracketPlanner from '@/components/analyze/BracketPlanner';

export default function StandaloneAnalyzePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bracket, setBracket] = useState<Record<string, TeamInfo[]>>({});
  const [rounds, setRounds] = useState<Round[]>([]);
  const [games, setGames] = useState<BracketGame[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        // Load teams grouped by region (public read)
        const { data: teams, error: teamsErr } = await supabase
          .from('teams')
          .select('id, name, mascot, abbreviation, seed, region, logo_url, is_eliminated')
          .order('seed', { ascending: true });

        if (teamsErr) throw teamsErr;

        const grouped: Record<string, TeamInfo[]> = {};
        for (const team of (teams || [])) {
          if (!grouped[team.region]) grouped[team.region] = [];
          grouped[team.region].push(team as TeamInfo);
        }
        setBracket(grouped);

        // Load rounds (public read)
        const { data: roundsData, error: roundsErr } = await supabase
          .from('rounds')
          .select('*')
          .order('date', { ascending: true });

        if (roundsErr) throw roundsErr;
        setRounds((roundsData || []) as Round[]);

        // Load games with team joins (public read)
        const { data: gamesData, error: gamesErr } = await supabase
          .from('games')
          .select(`
            *,
            team1:team1_id(id, name, mascot, abbreviation, seed, region, logo_url, is_eliminated),
            team2:team2_id(id, name, mascot, abbreviation, seed, region, logo_url, is_eliminated)
          `)
          .order('game_datetime', { ascending: true });

        if (gamesErr) throw gamesErr;
        setGames((gamesData || []) as BracketGame[]);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load bracket data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

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
          <button onClick={() => window.location.reload()} className="btn-secondary px-4 py-2 text-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface-1)] pb-24">
      <div className="max-w-4xl mx-auto px-5 pt-4">
        <BracketPlanner
          bracket={bracket}
          rounds={rounds}
          games={games}
          mode="standalone"
        />
      </div>
    </div>
  );
}

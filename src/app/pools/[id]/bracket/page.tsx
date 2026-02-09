'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import RegionBracketComponent from '@/components/bracket/RegionBracket';
import BracketMatchupCard from '@/components/bracket/BracketMatchupCard';
import { getAllRounds, getAllGamesWithTeams, buildRegionBracket, buildFinalFour } from '@/lib/bracket';
import type { Round } from '@/types/picks';
import type { BracketGame, RegionBracket, BracketRound } from '@/types/bracket';
import { formatET, formatETShort, formatDateET } from '@/lib/timezone';

const REGIONS = ['East', 'West', 'South', 'Midwest'];
const REGION_TABS = [...REGIONS, 'Final Four'];

export default function PoolBracketPage() {
  const { id: poolId } = useParams<{ id: string }>();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [games, setGames] = useState<BracketGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'schedule' | 'bracket'>('bracket');
  const [selectedRound, setSelectedRound] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState('East');
  const loadedRef = useRef(false);

  // Suppress unused var warning — poolId is available for future pool-overlay features
  void poolId;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [roundsData, gamesData] = await Promise.all([
        getAllRounds(),
        getAllGamesWithTeams(),
      ]);
      setRounds(roundsData);
      setGames(gamesData);
      if (roundsData.length > 0 && !selectedRound) {
        setSelectedRound(roundsData[0].id);
      }
    } catch (err) {
      console.error('Failed to load tournament data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tournament data.');
    } finally {
      setLoading(false);
    }
  }, [selectedRound]);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadData();
    }
  }, [loadData]);

  const regionBracket: RegionBracket | null =
    REGIONS.includes(selectedRegion) && rounds.length > 0
      ? buildRegionBracket(selectedRegion, games, rounds)
      : null;

  const finalFourRounds: BracketRound[] =
    selectedRegion === 'Final Four' ? buildFinalFour(games, rounds) : [];

  const scheduleGames = games.filter(g => g.round_id === selectedRound);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center pb-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-[rgba(255,255,255,0.05)] border-t-[#FF5722] mx-auto" />
          <p className="mt-4 text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Loading tournament data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center pb-24">
        <div className="text-center max-w-md px-5">
          <div className="bg-[rgba(239,83,80,0.1)] border border-[rgba(239,83,80,0.3)] text-[#EF5350] px-4 py-3 rounded-[12px] text-sm mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {error}
          </div>
          <button
            onClick={loadData}
            className="btn-orange px-6 py-3 rounded-[12px] font-semibold"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-24">
      {/* View toggle + refresh */}
      <div className="max-w-7xl mx-auto px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex bg-[#111827] rounded-[12px] p-1">
            <button
              onClick={() => setViewMode('schedule')}
              className={`px-4 py-2 text-sm font-semibold rounded-[8px] transition-colors ${
                viewMode === 'schedule'
                  ? 'bg-[#0D1B2A] text-[#E8E6E1] shadow-sm'
                  : 'text-[#9BA3AE] hover:text-[#E8E6E1]'
              }`}
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Schedule
            </button>
            <button
              onClick={() => setViewMode('bracket')}
              className={`px-4 py-2 text-sm font-semibold rounded-[8px] transition-colors ${
                viewMode === 'bracket'
                  ? 'bg-[#0D1B2A] text-[#E8E6E1] shadow-sm'
                  : 'text-[#9BA3AE] hover:text-[#E8E6E1]'
              }`}
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Bracket
            </button>
          </div>

          <button
            onClick={loadData}
            className="bg-[#111827] border border-[rgba(255,255,255,0.05)] text-[#9BA3AE] hover:text-[#E8E6E1] hover:border-[rgba(255,87,34,0.3)] px-4 py-2 rounded-[12px] text-sm font-semibold transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-5">
        {viewMode === 'schedule' ? (
          <ScheduleView
            rounds={rounds}
            games={scheduleGames}
            selectedRound={selectedRound}
            onRoundChange={setSelectedRound}
          />
        ) : (
          <BracketView
            selectedRegion={selectedRegion}
            onRegionChange={setSelectedRegion}
            regionBracket={regionBracket}
            finalFourRounds={finalFourRounds}
          />
        )}
      </div>
    </div>
  );
}

// ─── Schedule View ─────────────────────────────────────────────────

interface ScheduleViewProps {
  rounds: Round[];
  games: BracketGame[];
  selectedRound: string;
  onRoundChange: (roundId: string) => void;
}

function ScheduleView({ rounds, games, selectedRound, onRoundChange }: ScheduleViewProps) {
  const currentRound = rounds.find(r => r.id === selectedRound);

  return (
    <div>
      {/* Round selector */}
      <div className="flex space-x-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {rounds.map(round => (
          <button
            key={round.id}
            onClick={() => onRoundChange(round.id)}
            className={`flex-shrink-0 px-4 py-2.5 rounded-[12px] text-sm font-semibold transition-colors ${
              selectedRound === round.id
                ? 'btn-orange'
                : 'bg-[#111827] border border-[rgba(255,255,255,0.05)] text-[#9BA3AE] hover:text-[#E8E6E1] hover:border-[rgba(255,87,34,0.3)]'
            }`}
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {round.name}
          </button>
        ))}
      </div>

      {/* Games list */}
      {games.length === 0 ? (
        <div className="text-center py-12 bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px]">
          <p className="text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            No games scheduled{currentRound ? ` for ${currentRound.name}` : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {games.map(game => (
            <ScheduleGameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduleGameCard({ game }: { game: BracketGame }) {
  const team1 = game.team1;
  const team2 = game.team2;
  const hasWinner = game.winner_id !== null;
  const team1Wins = hasWinner && game.winner_id === game.team1_id;
  const team2Wins = hasWinner && game.winner_id === game.team2_id;

  let statusText: string;
  let statusColor: string;
  let statusBg: string;
  if (game.status === 'final') {
    statusText = 'Final';
    statusColor = 'text-[#4CAF50]';
    statusBg = 'bg-[rgba(76,175,80,0.1)]';
  } else if (game.status === 'in_progress') {
    statusText = 'LIVE';
    statusColor = 'text-[#EF5350] font-bold';
    statusBg = 'bg-[rgba(239,83,80,0.1)] animate-pulse';
  } else {
    statusText = formatET(game.game_datetime);
    statusColor = 'text-[#E8E6E1]';
    statusBg = 'bg-[#1B2A3D]';
  }

  const formatDate = (dt: string) => formatDateET(dt);

  return (
    <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-4 hover:border-[rgba(255,87,34,0.3)] transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2.5">
          {/* Team 1 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold w-6 text-center rounded-md py-0.5 ${
                team1Wins ? 'bg-[rgba(76,175,80,0.12)] text-[#4CAF50]' : 'bg-[#1B2A3D] text-[#9BA3AE]'
              }`} style={{ fontFamily: "'Space Mono', monospace" }}>
                {team1?.seed ?? '-'}
              </span>
              <span className={`font-medium text-sm ${
                team1Wins ? 'text-[#E8E6E1] font-bold' : team2Wins ? 'text-[#9BA3AE]' : 'text-[#E8E6E1]'
              }`} style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                {team1?.name ?? 'TBD'}
              </span>
            </div>
            {game.team1_score !== null && (
              <span className={`text-lg font-bold ${
                team1Wins ? 'text-[#E8E6E1]' : 'text-[#9BA3AE]'
              }`} style={{ fontFamily: "'Space Mono', monospace" }}>
                {game.team1_score}
              </span>
            )}
          </div>
          {/* Team 2 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold w-6 text-center rounded-md py-0.5 ${
                team2Wins ? 'bg-[rgba(76,175,80,0.12)] text-[#4CAF50]' : 'bg-[#1B2A3D] text-[#9BA3AE]'
              }`} style={{ fontFamily: "'Space Mono', monospace" }}>
                {team2?.seed ?? '-'}
              </span>
              <span className={`font-medium text-sm ${
                team2Wins ? 'text-[#E8E6E1] font-bold' : team1Wins ? 'text-[#9BA3AE]' : 'text-[#E8E6E1]'
              }`} style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                {team2?.name ?? 'TBD'}
              </span>
            </div>
            {game.team2_score !== null && (
              <span className={`text-lg font-bold ${
                team2Wins ? 'text-[#E8E6E1]' : 'text-[#9BA3AE]'
              }`} style={{ fontFamily: "'Space Mono', monospace" }}>
                {game.team2_score}
              </span>
            )}
          </div>
        </div>

        <div className="ml-5 text-right flex-shrink-0">
          <div className={`inline-flex items-center px-2.5 py-1 rounded-[8px] text-xs font-semibold ${statusBg} ${statusColor}`} style={{ fontFamily: "'Space Mono', monospace" }}>
            {statusText}
          </div>
          <div className="text-[11px] text-[#9BA3AE] mt-1.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>{formatDate(game.game_datetime)}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Bracket View ──────────────────────────────────────────────────

interface BracketViewProps {
  selectedRegion: string;
  onRegionChange: (region: string) => void;
  regionBracket: RegionBracket | null;
  finalFourRounds: BracketRound[];
}

function BracketView({ selectedRegion, onRegionChange, regionBracket, finalFourRounds }: BracketViewProps) {
  return (
    <div>
      {/* Region tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {REGION_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => onRegionChange(tab)}
            className={`flex-shrink-0 px-4 py-2.5 rounded-[12px] text-sm font-semibold transition-colors ${
              selectedRegion === tab
                ? 'btn-orange shadow-lg'
                : 'bg-[#111827] border border-[rgba(255,255,255,0.05)] text-[#9BA3AE] hover:text-[#E8E6E1] hover:border-[rgba(255,87,34,0.3)]'
            }`}
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Bracket content */}
      {selectedRegion === 'Final Four' ? (
        <FinalFourBracket rounds={finalFourRounds} />
      ) : regionBracket ? (
        <RegionBracketComponent bracket={regionBracket} />
      ) : (
        <div className="text-center py-12 bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px]">
          <p className="text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>No bracket data available.</p>
        </div>
      )}
    </div>
  );
}

function FinalFourBracket({ rounds }: { rounds: BracketRound[] }) {
  const hasGames = rounds.some(r => r.games.length > 0);

  if (!hasGames) {
    return (
      <div className="text-center py-12 bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px]">
        <div className="w-12 h-12 bg-[rgba(255,87,34,0.1)] rounded-[12px] flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-[#FF5722]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <p className="text-lg font-bold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Final Four</p>
        <p className="text-[#9BA3AE] mt-1 text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>Games TBD</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-8 min-w-max px-2 items-center" style={{ minHeight: '300px' }}>
        {rounds.map(bracketRound => (
          <div key={bracketRound.round.id} className="flex flex-col flex-shrink-0" style={{ width: '220px' }}>
            <div className="label text-center mb-3">
              {bracketRound.round.name}
            </div>
            <div className="flex flex-col justify-around flex-1 gap-4">
              {bracketRound.games.map(game => (
                <BracketMatchupCard key={game.id} game={game} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

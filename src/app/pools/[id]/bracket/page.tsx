'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import RegionBracketComponent from '@/components/bracket/RegionBracket';
import BracketMatchupCard from '@/components/bracket/BracketMatchupCard';
import { getAllRounds, getAllGamesWithTeams, buildRegionBracket, buildFinalFour } from '@/lib/bracket';
import type { Round } from '@/types/picks';
import type { BracketGame, RegionBracket, BracketRound } from '@/types/bracket';
import { formatET, formatDateET } from '@/lib/timezone';

const REGIONS = ['South', 'East', 'West', 'Midwest'];
const REGION_TABS = [...REGIONS, 'Final Four'];

// Venue info per region (update with actual 2026 data)
const REGION_VENUES: Record<string, string> = {
  South: 'Memphis, TN',
  East: 'Newark, NJ',
  West: 'San Francisco, CA',
  Midwest: 'Indianapolis, IN',
  'Final Four': 'San Antonio, TX',
};

export default function PoolBracketPage() {
  useParams<{ id: string }>();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [games, setGames] = useState<BracketGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'schedule' | 'bracket'>('bracket');
  const [selectedRound, setSelectedRound] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState('South');
  const loadedRef = useRef(false);

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

  // Find region champion (winner of Elite Eight game for this region)
  const regionChampion = regionBracket?.rounds
    .find(r => r.round.name === 'Elite Eight')
    ?.games.find(g => g.winner_id)
    ?.team1?.id === regionBracket?.rounds.find(r => r.round.name === 'Elite Eight')?.games[0]?.winner_id
    ? regionBracket?.rounds.find(r => r.round.name === 'Elite Eight')?.games[0]?.team1
    : regionBracket?.rounds.find(r => r.round.name === 'Elite Eight')?.games[0]?.team2;

  const e8Game = regionBracket?.rounds.find(r => r.round.name === 'Elite Eight')?.games[0];
  const championName = e8Game?.winner_id
    ? (e8Game.winner_id === e8Game.team1_id ? e8Game.team1?.name : e8Game.team2?.name)
    : null;

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
          <button onClick={loadData} className="btn-orange px-6 py-3 rounded-[12px] font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-24">
      {/* ── Tournament Header ── */}
      <div className="bg-[#080810] border-b border-[rgba(255,255,255,0.05)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-5 pt-3 sm:pt-5 pb-2.5 sm:pb-4">
          {/* Title block */}
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.25em] text-[#9BA3AE] mb-0.5" style={{ fontFamily: "'Space Mono', monospace" }}>
                2026 NCAA TOURNAMENT
              </p>
              <h1 className="text-xl sm:text-2xl font-bold text-[#E8E6E1] leading-none" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
                March Madness
              </h1>
            </div>
            {/* Toggle pill */}
            <div className="flex bg-[#111827] rounded-full p-[3px] border border-[rgba(255,255,255,0.06)]">
              <button
                onClick={() => setViewMode('bracket')}
                className={`px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] font-bold rounded-full transition-all ${
                  viewMode === 'bracket'
                    ? 'bg-[#FF5722] text-white shadow-sm'
                    : 'text-[#9BA3AE] hover:text-[#E8E6E1]'
                }`}
                style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase' }}
              >
                Bracket
              </button>
              <button
                onClick={() => setViewMode('schedule')}
                className={`px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] font-bold rounded-full transition-all ${
                  viewMode === 'schedule'
                    ? 'bg-[#FF5722] text-white shadow-sm'
                    : 'text-[#9BA3AE] hover:text-[#E8E6E1]'
                }`}
                style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase' }}
              >
                Schedule
              </button>
            </div>
          </div>

          {/* Region tabs — underline style */}
          {viewMode === 'bracket' && (
            <div className="flex gap-0 overflow-x-auto scrollbar-hide -mb-[1px]">
              {REGION_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setSelectedRegion(tab)}
                  className={`relative flex-shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 text-[11px] font-bold tracking-[0.1em] transition-colors ${
                    selectedRegion === tab
                      ? 'text-[#FF5722]'
                      : 'text-[#5F6B7A] hover:text-[#9BA3AE]'
                  }`}
                  style={{ fontFamily: "'Space Mono', monospace", textTransform: 'uppercase' }}
                >
                  {tab}
                  {selectedRegion === tab && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#FF5722] rounded-full" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-5 pt-3 sm:pt-4">
        {viewMode === 'schedule' ? (
          <ScheduleView
            rounds={rounds}
            games={scheduleGames}
            selectedRound={selectedRound}
            onRoundChange={setSelectedRound}
          />
        ) : (
          <>
            {/* Region header card */}
            {selectedRegion !== 'Final Four' && (
              <div className="flex items-center justify-between bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-[10px] px-4 py-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-[#E8E6E1] leading-tight" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                    {selectedRegion} Region
                  </h2>
                  <p className="text-[11px] text-[#5F6B7A] mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {REGION_VENUES[selectedRegion] || ''}
                  </p>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-[6px] border-l-[3px] ${
                  championName
                    ? 'bg-[rgba(76,175,80,0.08)] border-l-[#4CAF50]'
                    : 'bg-[rgba(255,255,255,0.03)] border-l-[#FF5722]'
                }`}>
                  <span className="text-[10px] font-bold tracking-[0.1em] text-[#9BA3AE]" style={{ fontFamily: "'Space Mono', monospace", textTransform: 'uppercase' }}>
                    Champion
                  </span>
                  <span className="text-xs font-bold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                    {championName || 'TBD'}
                  </span>
                </div>
              </div>
            )}

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
          </>
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
      <div className="flex gap-1 mb-5 overflow-x-auto pb-2 scrollbar-hide">
        {rounds.map(round => (
          <button
            key={round.id}
            onClick={() => onRoundChange(round.id)}
            className={`flex-shrink-0 px-3.5 py-2 rounded-full text-[11px] font-bold tracking-[0.06em] transition-colors ${
              selectedRound === round.id
                ? 'bg-[#FF5722] text-white'
                : 'bg-[#111827] border border-[rgba(255,255,255,0.06)] text-[#9BA3AE] hover:text-[#E8E6E1]'
            }`}
            style={{ fontFamily: "'Space Mono', monospace", textTransform: 'uppercase' }}
          >
            {round.name}
          </button>
        ))}
      </div>

      {/* Games list */}
      {games.length === 0 ? (
        <div className="text-center py-12 bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[10px]">
          <p className="text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            No games scheduled{currentRound ? ` for ${currentRound.name}` : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
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
    statusText = 'Live';
    statusColor = 'text-[#EF5350]';
    statusBg = 'bg-[rgba(239,83,80,0.08)]';
  } else {
    statusText = formatET(game.game_datetime);
    statusColor = 'text-[#E8E6E1]';
    statusBg = 'bg-[#1B2A3D]';
  }

  return (
    <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[10px] p-4 hover:border-[rgba(255,87,34,0.25)] transition-colors">
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
                team1Wins ? 'text-[#E8E6E1] font-bold' : team2Wins ? 'text-[#5F6B7A]' : 'text-[#E8E6E1]'
              }`} style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                {team1?.name ?? 'TBD'}
              </span>
            </div>
            {game.team1_score !== null && (
              <span className={`text-lg font-bold ${
                team1Wins ? 'text-[#E8E6E1]' : 'text-[#5F6B7A]'
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
                team2Wins ? 'text-[#E8E6E1] font-bold' : team1Wins ? 'text-[#5F6B7A]' : 'text-[#E8E6E1]'
              }`} style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                {team2?.name ?? 'TBD'}
              </span>
            </div>
            {game.team2_score !== null && (
              <span className={`text-lg font-bold ${
                team2Wins ? 'text-[#E8E6E1]' : 'text-[#5F6B7A]'
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
          <div className="text-[11px] text-[#5F6B7A] mt-1.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>{formatDateET(game.game_datetime)}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Final Four Bracket ─────────────────────────────────────────────

function FinalFourBracket({ rounds }: { rounds: BracketRound[] }) {
  const hasGames = rounds.some(r => r.games.length > 0);

  if (!hasGames) {
    return (
      <div className="text-center py-12 bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[10px]">
        <div className="w-12 h-12 bg-[rgba(255,87,34,0.1)] rounded-[10px] flex items-center justify-center mx-auto mb-3">
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
          <div key={bracketRound.round.id} className="flex flex-col flex-shrink-0" style={{ width: '200px' }}>
            <div className="text-center mb-2 pb-2 border-b border-[rgba(255,255,255,0.06)]">
              <span className="text-[10px] font-bold tracking-[0.12em] text-[#9BA3AE]" style={{ fontFamily: "'Space Mono', monospace", textTransform: 'uppercase' }}>
                {bracketRound.round.name}
              </span>
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

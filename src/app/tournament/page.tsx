'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import RegionBracketComponent from '@/components/bracket/RegionBracket';
import BracketMatchupCard from '@/components/bracket/BracketMatchupCard';
import { getAllRounds, getAllGamesWithTeams, buildRegionBracket, buildFinalFour } from '@/lib/bracket';
import type { Round } from '@/types/picks';
import type { BracketGame, RegionBracket, BracketRound } from '@/types/bracket';

const REGIONS = ['East', 'West', 'South', 'Midwest'];
const REGION_TABS = [...REGIONS, 'Final Four'];

export default function TournamentPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [games, setGames] = useState<BracketGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'schedule' | 'bracket'>('bracket');
  const [selectedRound, setSelectedRound] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState('East');

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
    loadData();
  }, [loadData]);

  // Build bracket data for the selected region
  const regionBracket: RegionBracket | null =
    REGIONS.includes(selectedRegion) && rounds.length > 0
      ? buildRegionBracket(selectedRegion, games, rounds)
      : null;

  const finalFourRounds: BracketRound[] =
    selectedRegion === 'Final Four' ? buildFinalFour(games, rounds) : [];

  // Schedule view: games for the selected round
  const scheduleGames = games.filter(g => g.round_id === selectedRound);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading tournament data...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <strong className="font-bold">Error: </strong>
              <span>{error}</span>
            </div>
            <button
              onClick={loadData}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <h1 className="text-3xl font-bold text-gray-900">
                  NCAA Tournament
                </h1>

                <div className="flex items-center gap-3">
                  {/* View toggle */}
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('schedule')}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        viewMode === 'schedule'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-700 hover:text-gray-900'
                      }`}
                    >
                      Schedule
                    </button>
                    <button
                      onClick={() => setViewMode('bracket')}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        viewMode === 'bracket'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-700 hover:text-gray-900'
                      }`}
                    >
                      Bracket
                    </button>
                  </div>

                  <button
                    onClick={loadData}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
    </ProtectedRoute>
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
      <div className="flex space-x-2 mb-8 overflow-x-auto pb-2">
        {rounds.map(round => (
          <button
            key={round.id}
            onClick={() => onRoundChange(round.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedRound === round.id
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            {round.name}
          </button>
        ))}
      </div>

      {/* Games list */}
      {games.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <p className="text-gray-500">
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
  if (game.status === 'final') {
    statusText = 'Final';
    statusColor = 'text-green-600';
  } else if (game.status === 'in_progress') {
    statusText = 'Live';
    statusColor = 'text-red-600 animate-pulse';
  } else {
    const dt = new Date(game.game_datetime);
    statusText = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    statusColor = 'text-gray-600';
  }

  const formatDate = (dt: string) =>
    new Date(dt).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2">
          {/* Team 1 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-500 w-6 text-center">
                {team1?.seed ?? '-'}
              </span>
              <span className={`font-medium ${team1Wins ? 'text-gray-900 font-bold' : team2Wins ? 'text-gray-400' : 'text-gray-900'}`}>
                {team1?.name ?? 'TBD'}
              </span>
            </div>
            {game.team1_score !== null && (
              <span className={`text-lg font-bold ${team1Wins ? 'text-gray-900' : 'text-gray-500'}`}>
                {game.team1_score}
              </span>
            )}
          </div>
          {/* Team 2 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-500 w-6 text-center">
                {team2?.seed ?? '-'}
              </span>
              <span className={`font-medium ${team2Wins ? 'text-gray-900 font-bold' : team1Wins ? 'text-gray-400' : 'text-gray-900'}`}>
                {team2?.name ?? 'TBD'}
              </span>
            </div>
            {game.team2_score !== null && (
              <span className={`text-lg font-bold ${team2Wins ? 'text-gray-900' : 'text-gray-500'}`}>
                {game.team2_score}
              </span>
            )}
          </div>
        </div>

        <div className="ml-6 text-right">
          <div className={`font-medium ${statusColor}`}>{statusText}</div>
          <div className="text-sm text-gray-500 mt-1">{formatDate(game.game_datetime)}</div>
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
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {REGION_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => onRegionChange(tab)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedRegion === tab
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
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
        <div className="text-center py-12 bg-white rounded-lg">
          <p className="text-gray-500">No bracket data available.</p>
        </div>
      )}
    </div>
  );
}

function FinalFourBracket({ rounds }: { rounds: BracketRound[] }) {
  const hasGames = rounds.some(r => r.games.length > 0);

  if (!hasGames) {
    return (
      <div className="text-center py-12 bg-white rounded-lg">
        <p className="text-lg font-medium text-gray-500">Final Four</p>
        <p className="text-gray-400 mt-2">Games TBD</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-8 min-w-max px-2 items-center" style={{ minHeight: '300px' }}>
        {rounds.map(bracketRound => (
          <div key={bracketRound.round.id} className="flex flex-col flex-shrink-0" style={{ width: '208px' }}>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center mb-3">
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

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { fetchTournamentBracket, fetchLiveScores, ESPNApiError } from '@/lib/espn';
import type { Tournament, Game, GameScore, TournamentRound } from '@/types/tournament';

export default function TournamentPage() {
  const { user } = useAuth();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [liveScores, setLiveScores] = useState<GameScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'schedule' | 'bracket'>('schedule');

  useEffect(() => {
    loadTournamentData();
    
    // Set up live score updates every 30 seconds during tournament
    const interval = setInterval(() => {
      if (tournament?.status === 'in-progress') {
        updateLiveScores();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadTournamentData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const tournamentData = await fetchTournamentBracket();
      setTournament(tournamentData);
      
      // Load initial live scores
      await updateLiveScores();
    } catch (err) {
      console.error('Failed to load tournament data:', err);
      if (err instanceof ESPNApiError) {
        setError(`ESPN API Error: ${err.message}`);
      } else {
        setError('Failed to load tournament data. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateLiveScores = async () => {
    try {
      const scores = await fetchLiveScores();
      setLiveScores(scores);
    } catch (err) {
      console.error('Failed to update live scores:', err);
      // Don't show error for live score updates, just log it
    }
  };

  const getLiveScoreForGame = (gameId: string): GameScore | null => {
    return liveScores.find(score => score.gameId === gameId) || null;
  };

  const formatGameTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  const getGameStatus = (game: Game): { text: string; color: string } => {
    const liveScore = getLiveScoreForGame(game.id);
    
    if (liveScore?.completed) {
      return { text: 'Final', color: 'text-green-600' };
    }
    
    if (game.status.type.state === 'in') {
      return { text: game.status.displayClock || 'Live', color: 'text-red-600 animate-pulse' };
    }
    
    if (game.status.type.state === 'post') {
      return { text: 'Final', color: 'text-green-600' };
    }
    
    const gameTime = new Date(game.date);
    const now = new Date();
    
    if (gameTime > now) {
      return { 
        text: gameTime.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit' 
        }), 
        color: 'text-gray-600' 
      };
    }
    
    return { text: 'Scheduled', color: 'text-gray-600' };
  };

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
              onClick={loadTournamentData}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!tournament) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600">No tournament data available.</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    {tournament.name}
                  </h1>
                  <p className="mt-1 text-sm text-gray-500">
                    {tournament.status === 'in-progress' && (
                      <span className="inline-flex items-center">
                        <span className="flex w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></span>
                        Live Tournament
                      </span>
                    )}
                    {tournament.status === 'upcoming' && 'Tournament Upcoming'}
                    {tournament.status === 'completed' && 'Tournament Complete'}
                  </p>
                </div>
                
                <div className="flex space-x-4">
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
                    onClick={updateLiveScores}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Refresh Scores
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {viewMode === 'schedule' && (
            <ScheduleView 
              tournament={tournament}
              selectedRound={selectedRound}
              onRoundChange={setSelectedRound}
              getLiveScoreForGame={getLiveScoreForGame}
              getGameStatus={getGameStatus}
              formatGameTime={formatGameTime}
            />
          )}
          
          {viewMode === 'bracket' && (
            <BracketView 
              tournament={tournament}
              getLiveScoreForGame={getLiveScoreForGame}
              getGameStatus={getGameStatus}
            />
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

interface ScheduleViewProps {
  tournament: Tournament;
  selectedRound: number;
  onRoundChange: (round: number) => void;
  getLiveScoreForGame: (gameId: string) => GameScore | null;
  getGameStatus: (game: Game) => { text: string; color: string };
  formatGameTime: (dateString: string) => string;
}

function ScheduleView({ 
  tournament, 
  selectedRound, 
  onRoundChange, 
  getLiveScoreForGame, 
  getGameStatus, 
  formatGameTime 
}: ScheduleViewProps) {
  const currentRound = tournament.rounds.find(r => r.number === selectedRound);

  return (
    <div>
      {/* Round Selector */}
      <div className="flex space-x-2 mb-8 overflow-x-auto pb-2">
        {tournament.rounds.map((round) => (
          <button
            key={round.number}
            onClick={() => onRoundChange(round.number)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedRound === round.number
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            {round.name}
          </button>
        ))}
      </div>

      {/* Games List */}
      {currentRound && (
        <div className="space-y-4">
          {currentRound.games.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg">
              <p className="text-gray-500">No games scheduled for {currentRound.name}</p>
            </div>
          ) : (
            currentRound.games.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                liveScore={getLiveScoreForGame(game.id)}
                status={getGameStatus(game)}
                formatGameTime={formatGameTime}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface BracketViewProps {
  tournament: Tournament;
  getLiveScoreForGame: (gameId: string) => GameScore | null;
  getGameStatus: (game: Game) => { text: string; color: string };
}

function BracketView({ tournament, getLiveScoreForGame, getGameStatus }: BracketViewProps) {
  return (
    <div className="bg-white rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Tournament Bracket</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tournament.regions.map((region) => (
          <div key={region.id} className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 text-center">
              {region.name} Region
            </h3>
            <div className="space-y-2">
              {region.teams.slice(0, 8).map((team) => (
                <div
                  key={team.id}
                  className="flex items-center space-x-3 p-2 bg-gray-50 rounded"
                >
                  <span className="text-sm font-medium text-gray-600 w-6">
                    {team.seed}
                  </span>
                  <img
                    src={team.logo}
                    alt={team.name}
                    className="w-6 h-6 object-contain"
                  />
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {team.displayName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface GameCardProps {
  game: Game;
  liveScore: GameScore | null;
  status: { text: string; color: string };
  formatGameTime: (dateString: string) => string;
}

function GameCard({ game, liveScore, status, formatGameTime }: GameCardProps) {
  const team1 = game.competitors[0];
  const team2 = game.competitors[1];
  
  const team1Score = liveScore?.homeTeam.id === team1.team.id 
    ? liveScore.homeTeam.score 
    : liveScore?.awayTeam.score || team1.score;
  
  const team2Score = liveScore?.homeTeam.id === team2.team.id 
    ? liveScore.homeTeam.score 
    : liveScore?.awayTeam.score || team2.score;

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              <img
                src={team1.team.logo}
                alt={team1.team.name}
                className="w-8 h-8 object-contain"
              />
              <div>
                <span className="font-medium text-gray-900">
                  {team1.team.displayName}
                </span>
                <span className="ml-2 text-sm text-gray-500">
                  ({team1.seed})
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-gray-900">
                {team1Score}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img
                src={team2.team.logo}
                alt={team2.team.name}
                className="w-8 h-8 object-contain"
              />
              <div>
                <span className="font-medium text-gray-900">
                  {team2.team.displayName}
                </span>
                <span className="ml-2 text-sm text-gray-500">
                  ({team2.seed})
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-gray-900">
                {team2Score}
              </span>
            </div>
          </div>
        </div>
        
        <div className="ml-6 text-right">
          <div className={`font-medium ${status.color}`}>
            {status.text}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {formatGameTime(game.date)}
          </div>
          {game.venue && (
            <div className="text-xs text-gray-400 mt-1">
              {game.venue.address.city}, {game.venue.address.state}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
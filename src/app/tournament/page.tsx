'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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

  const regionBracket: RegionBracket | null =
    REGIONS.includes(selectedRegion) && rounds.length > 0
      ? buildRegionBracket(selectedRegion, games, rounds)
      : null;

  const finalFourRounds: BracketRound[] =
    selectedRegion === 'Final Four' ? buildFinalFour(games, rounds) : [];

  const scheduleGames = games.filter(g => g.round_id === selectedRound);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-dark-base flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-dark-border border-t-accent mx-auto" />
            <p className="mt-4 text-text-muted">Loading tournament data...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-dark-base flex items-center justify-center">
          <div className="text-center max-w-md px-5">
            <div className="bg-eliminated/10 border border-eliminated/30 text-eliminated px-4 py-3 rounded-xl text-sm mb-4">
              {error}
            </div>
            <button
              onClick={loadData}
              className="btn-accent text-white px-6 py-3 rounded-xl font-semibold"
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
      <div className="min-h-screen bg-dark-base">
        {/* Header */}
        <header className="bg-dark-surface border-b border-dark-border">
          <div className="max-w-7xl mx-auto px-5">
            <div className="py-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Link
                    href="/dashboard"
                    className="text-text-muted hover:text-text-secondary transition-colors"
                    aria-label="Back to dashboard"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </Link>
                  <h1 className="text-xl font-bold text-white">
                    NCAA Tournament
                  </h1>
                </div>

                <div className="flex items-center gap-2">
                  {/* View toggle */}
                  <div className="flex bg-dark-base rounded-xl p-1">
                    <button
                      onClick={() => setViewMode('schedule')}
                      className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                        viewMode === 'schedule'
                          ? 'bg-dark-card text-white shadow-sm'
                          : 'text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      Schedule
                    </button>
                    <button
                      onClick={() => setViewMode('bracket')}
                      className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                        viewMode === 'bracket'
                          ? 'bg-dark-card text-white shadow-sm'
                          : 'text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      Bracket
                    </button>
                  </div>

                  <button
                    onClick={loadData}
                    className="bg-dark-card border border-dark-border text-text-secondary hover:text-white hover:border-accent/30 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-5 py-6">
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
      <div className="flex space-x-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {rounds.map(round => (
          <button
            key={round.id}
            onClick={() => onRoundChange(round.id)}
            className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              selectedRound === round.id
                ? 'bg-accent text-white'
                : 'bg-dark-card border border-dark-border text-text-muted hover:text-white hover:border-accent/30'
            }`}
          >
            {round.name}
          </button>
        ))}
      </div>

      {/* Games list */}
      {games.length === 0 ? (
        <div className="text-center py-12 bg-dark-card border border-dark-border rounded-2xl">
          <p className="text-text-muted">
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
    statusColor = 'text-alive';
    statusBg = 'bg-alive/10';
  } else if (game.status === 'in_progress') {
    statusText = 'LIVE';
    statusColor = 'text-eliminated font-bold';
    statusBg = 'bg-eliminated/10 animate-pulse';
  } else {
    const dt = new Date(game.game_datetime);
    statusText = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    statusColor = 'text-text-muted';
    statusBg = 'bg-dark-surface';
  }

  const formatDate = (dt: string) =>
    new Date(dt).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl p-4 hover:border-accent/20 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2.5">
          {/* Team 1 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold w-6 text-center rounded-md py-0.5 ${
                team1Wins ? 'bg-alive/15 text-alive' : 'bg-dark-surface text-text-muted'
              }`}>
                {team1?.seed ?? '-'}
              </span>
              <span className={`font-medium text-sm ${
                team1Wins ? 'text-white font-bold' : team2Wins ? 'text-text-muted' : 'text-white'
              }`}>
                {team1?.name ?? 'TBD'}
              </span>
            </div>
            {game.team1_score !== null && (
              <span className={`text-lg font-bold font-mono ${
                team1Wins ? 'text-white' : 'text-text-muted'
              }`}>
                {game.team1_score}
              </span>
            )}
          </div>
          {/* Team 2 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold w-6 text-center rounded-md py-0.5 ${
                team2Wins ? 'bg-alive/15 text-alive' : 'bg-dark-surface text-text-muted'
              }`}>
                {team2?.seed ?? '-'}
              </span>
              <span className={`font-medium text-sm ${
                team2Wins ? 'text-white font-bold' : team1Wins ? 'text-text-muted' : 'text-white'
              }`}>
                {team2?.name ?? 'TBD'}
              </span>
            </div>
            {game.team2_score !== null && (
              <span className={`text-lg font-bold font-mono ${
                team2Wins ? 'text-white' : 'text-text-muted'
              }`}>
                {game.team2_score}
              </span>
            )}
          </div>
        </div>

        <div className="ml-5 text-right flex-shrink-0">
          <div className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${statusBg} ${statusColor}`}>
            {statusText}
          </div>
          <div className="text-[11px] text-text-muted mt-1.5">{formatDate(game.game_datetime)}</div>
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
            className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              selectedRegion === tab
                ? 'bg-accent text-white shadow-lg shadow-accent-dim'
                : 'bg-dark-card border border-dark-border text-text-muted hover:text-white hover:border-accent/30'
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
        <div className="text-center py-12 bg-dark-card border border-dark-border rounded-2xl">
          <p className="text-text-muted">No bracket data available.</p>
        </div>
      )}
    </div>
  );
}

function FinalFourBracket({ rounds }: { rounds: BracketRound[] }) {
  const hasGames = rounds.some(r => r.games.length > 0);

  if (!hasGames) {
    return (
      <div className="text-center py-12 bg-dark-card border border-dark-border rounded-2xl">
        <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <p className="text-lg font-bold text-white">Final Four</p>
        <p className="text-text-muted mt-1 text-sm">Games TBD</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-8 min-w-max px-2 items-center" style={{ minHeight: '300px' }}>
        {rounds.map(bracketRound => (
          <div key={bracketRound.round.id} className="flex flex-col flex-shrink-0" style={{ width: '220px' }}>
            <div className="text-xs font-semibold text-text-muted uppercase tracking-widest text-center mb-3">
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

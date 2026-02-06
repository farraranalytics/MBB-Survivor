'use client';

import { BracketGame } from '@/types/bracket';
import { TeamInfo } from '@/types/picks';

interface BracketMatchupCardProps {
  game: BracketGame;
  compact?: boolean;
}

function TeamRow({
  team,
  score,
  isWinner,
  isLoser,
}: {
  team: TeamInfo | null;
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
}) {
  if (!team) {
    return (
      <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 w-5 text-center">-</span>
          <span className="text-xs text-gray-400 italic">TBD</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between px-2 py-1.5 ${
        isWinner ? 'bg-green-50' : isLoser ? 'bg-gray-100' : 'bg-white'
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-xs font-semibold text-gray-500 w-5 text-center flex-shrink-0">
          {team.seed}
        </span>
        <span
          className={`text-xs truncate ${
            isWinner ? 'font-bold text-gray-900' : isLoser ? 'text-gray-400' : 'font-medium text-gray-800'
          }`}
        >
          {team.name}
        </span>
      </div>
      {score !== null && (
        <span
          className={`text-xs ml-2 flex-shrink-0 ${
            isWinner ? 'font-bold text-gray-900' : 'text-gray-500'
          }`}
        >
          {score}
        </span>
      )}
    </div>
  );
}

export default function BracketMatchupCard({ game, compact }: BracketMatchupCardProps) {
  const team1 = game.team1 ?? null;
  const team2 = game.team2 ?? null;
  const hasWinner = game.winner_id !== null;
  const team1Wins = hasWinner && game.winner_id === game.team1_id;
  const team2Wins = hasWinner && game.winner_id === game.team2_id;

  // Status badge
  let statusText = '';
  let statusColor = '';
  if (game.status === 'final') {
    statusText = 'Final';
    statusColor = 'text-green-600';
  } else if (game.status === 'in_progress') {
    statusText = 'Live';
    statusColor = 'text-red-600 animate-pulse';
  } else {
    statusText = '';
    statusColor = 'text-gray-500';
  }

  return (
    <div className={`w-48 border border-gray-300 rounded overflow-hidden bg-white shadow-sm ${compact ? 'text-xs' : ''}`}>
      <TeamRow
        team={team1}
        score={game.team1_score}
        isWinner={team1Wins}
        isLoser={team2Wins}
      />
      <div className="border-t border-gray-200" />
      <TeamRow
        team={team2}
        score={game.team2_score}
        isWinner={team2Wins}
        isLoser={team1Wins}
      />
      {statusText && (
        <div className={`text-center text-[10px] py-0.5 border-t border-gray-200 ${statusColor}`}>
          {statusText}
        </div>
      )}
    </div>
  );
}

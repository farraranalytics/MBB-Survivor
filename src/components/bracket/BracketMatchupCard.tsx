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
      <div className="flex items-center justify-between px-2.5 py-2 bg-[#1B2A3D]">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[#9BA3AE] w-5 text-center" style={{ fontFamily: "'Space Mono', monospace" }}>-</span>
          <span className="text-xs text-[#9BA3AE] italic" style={{ fontFamily: "'DM Sans', sans-serif" }}>TBD</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between px-2.5 py-2 transition-colors ${
        isWinner
          ? 'bg-[rgba(76,175,80,0.1)]'
          : isLoser
            ? 'bg-[#1B2A3D]'
            : 'bg-[#111827]'
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-[10px] font-bold w-5 text-center flex-shrink-0 rounded py-0.5 ${
          isWinner ? 'bg-[rgba(76,175,80,0.2)] text-[#4CAF50]' : 'text-[#9BA3AE]'
        }`} style={{ fontFamily: "'Space Mono', monospace" }}>
          {team.seed}
        </span>
        <span
          className={`text-xs truncate ${
            isWinner
              ? 'font-bold text-[#E8E6E1]'
              : isLoser
                ? 'text-[#9BA3AE]'
                : 'font-medium text-[#E8E6E1]'
          }`}
          style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
        >
          {team.name}
        </span>
      </div>
      {score !== null && (
        <span
          className={`text-xs ml-2 flex-shrink-0 ${
            isWinner ? 'font-bold text-[#E8E6E1]' : 'text-[#9BA3AE]'
          }`}
          style={{ fontFamily: "'Space Mono', monospace" }}
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

  let statusText = '';
  let statusColor = '';
  if (game.status === 'final') {
    statusText = 'Final';
    statusColor = 'text-[#4CAF50] bg-[rgba(76,175,80,0.1)]';
  } else if (game.status === 'in_progress') {
    statusText = 'LIVE';
    statusColor = 'text-[#EF5350] bg-[rgba(239,83,80,0.1)] animate-pulse';
  }

  return (
    <div className={`w-52 border border-[rgba(255,255,255,0.05)] rounded-[12px] overflow-hidden bg-[#111827] shadow-sm hover:border-[rgba(255,87,34,0.3)] transition-colors ${compact ? 'text-xs' : ''}`}>
      <TeamRow
        team={team1}
        score={game.team1_score}
        isWinner={team1Wins}
        isLoser={team2Wins}
      />
      <div className="border-t border-[rgba(255,255,255,0.05)]" />
      <TeamRow
        team={team2}
        score={game.team2_score}
        isWinner={team2Wins}
        isLoser={team1Wins}
      />
      {statusText && (
        <div className={`text-center text-[10px] font-semibold py-1 border-t border-[rgba(255,255,255,0.05)] ${statusColor}`} style={{ fontFamily: "'Space Mono', monospace" }}>
          {statusText}
        </div>
      )}
    </div>
  );
}

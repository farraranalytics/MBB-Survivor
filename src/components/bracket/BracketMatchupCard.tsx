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
      <div className="flex items-center justify-between px-2.5 py-2 bg-dark-surface">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted w-5 text-center">-</span>
          <span className="text-xs text-text-muted italic">TBD</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between px-2.5 py-2 transition-colors ${
        isWinner
          ? 'bg-alive/10'
          : isLoser
            ? 'bg-dark-surface'
            : 'bg-dark-card'
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-[10px] font-bold w-5 text-center flex-shrink-0 rounded py-0.5 ${
          isWinner ? 'bg-alive/20 text-alive' : 'text-text-muted'
        }`}>
          {team.seed}
        </span>
        <span
          className={`text-xs truncate ${
            isWinner
              ? 'font-bold text-white'
              : isLoser
                ? 'text-text-muted'
                : 'font-medium text-text-secondary'
          }`}
        >
          {team.name}
        </span>
      </div>
      {score !== null && (
        <span
          className={`text-xs font-mono ml-2 flex-shrink-0 ${
            isWinner ? 'font-bold text-white' : 'text-text-muted'
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

  let statusText = '';
  let statusColor = '';
  if (game.status === 'final') {
    statusText = 'Final';
    statusColor = 'text-alive bg-alive/10';
  } else if (game.status === 'in_progress') {
    statusText = 'LIVE';
    statusColor = 'text-eliminated bg-eliminated/10 animate-pulse';
  }

  return (
    <div className={`w-52 border border-dark-border rounded-xl overflow-hidden bg-dark-card shadow-sm hover:border-accent/30 transition-colors ${compact ? 'text-xs' : ''}`}>
      <TeamRow
        team={team1}
        score={game.team1_score}
        isWinner={team1Wins}
        isLoser={team2Wins}
      />
      <div className="border-t border-dark-border-subtle" />
      <TeamRow
        team={team2}
        score={game.team2_score}
        isWinner={team2Wins}
        isLoser={team1Wins}
      />
      {statusText && (
        <div className={`text-center text-[10px] font-semibold py-1 border-t border-dark-border-subtle ${statusColor}`}>
          {statusText}
        </div>
      )}
    </div>
  );
}

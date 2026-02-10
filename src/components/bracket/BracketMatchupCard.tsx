'use client';

import { BracketGame } from '@/types/bracket';
import { TeamInfo } from '@/types/picks';
import { formatETShort, formatDateET } from '@/lib/timezone';

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
      <div className="flex items-center justify-between px-2 py-[5px]">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[#5F6B7A] w-4 text-center" style={{ fontFamily: "'Space Mono', monospace" }}>-</span>
          <span className="text-[11px] text-[#5F6B7A] italic" style={{ fontFamily: "'DM Sans', sans-serif" }}>TBD</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between px-2 py-[5px] ${
        isWinner
          ? 'bg-[rgba(76,175,80,0.08)]'
          : ''
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-[10px] font-bold w-4 text-center flex-shrink-0 ${
          isWinner ? 'text-[#4CAF50]' : 'text-[#9BA3AE]'
        }`} style={{ fontFamily: "'Space Mono', monospace" }}>
          {team.seed}
        </span>
        <span
          className={`text-[11px] truncate ${
            isWinner
              ? 'font-bold text-[#E8E6E1]'
              : isLoser
                ? 'text-[#5F6B7A]'
                : 'font-medium text-[#E8E6E1]'
          }`}
          style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
        >
          {team.name}
        </span>
      </div>
      {score !== null && (
        <span
          className={`text-[10px] ml-1.5 flex-shrink-0 tabular-nums ${
            isWinner ? 'font-bold text-[#E8E6E1]' : 'text-[#5F6B7A]'
          }`}
          style={{ fontFamily: "'Space Mono', monospace" }}
        >
          {score}
        </span>
      )}
    </div>
  );
}

/** Format game datetime as compact "THU 12:15P" style */
function formatCompactDateTime(dateString: string): { day: string; time: string } {
  const date = new Date(dateString);
  const day = date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
  }).toUpperCase();
  const time = date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).replace(' AM', 'A').replace(' PM', 'P');
  return { day, time };
}

export default function BracketMatchupCard({ game, compact }: BracketMatchupCardProps) {
  const team1 = game.team1 ?? null;
  const team2 = game.team2 ?? null;
  const hasWinner = game.winner_id !== null;
  const team1Wins = hasWinner && game.winner_id === game.team1_id;
  const team2Wins = hasWinner && game.winner_id === game.team2_id;
  const isTBD = !team1 && !team2;

  const { day, time } = formatCompactDateTime(game.game_datetime);

  return (
    <div className={`w-full border rounded-[6px] overflow-hidden transition-colors ${
      isTBD
        ? 'border-dashed border-[rgba(255,255,255,0.06)] bg-[#0D1B2A]'
        : game.status === 'final'
          ? 'border-[rgba(76,175,80,0.15)] bg-[#111827]'
          : 'border-[rgba(255,255,255,0.06)] bg-[#111827] hover:border-[rgba(255,87,34,0.25)]'
    }`}>
      {/* Time header */}
      <div className="flex items-center justify-between px-2 py-[3px] bg-[rgba(255,255,255,0.02)]">
        <span className="text-[9px] font-semibold text-[#5F6B7A] tracking-wider" style={{ fontFamily: "'Space Mono', monospace" }}>
          {game.status === 'final' ? 'FINAL' : game.status === 'in_progress' ? 'LIVE' : `${day} ${time}`}
        </span>
        {game.status === 'in_progress' && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#EF5350]" />
        )}
        {isTBD && (
          <span className="text-[8px] font-bold text-[#5F6B7A] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 rounded" style={{ fontFamily: "'Space Mono', monospace" }}>
            TBD
          </span>
        )}
      </div>
      {/* Teams */}
      <TeamRow
        team={team1}
        score={game.team1_score}
        isWinner={team1Wins}
        isLoser={team2Wins}
      />
      <div className="border-t border-[rgba(255,255,255,0.04)]" />
      <TeamRow
        team={team2}
        score={game.team2_score}
        isWinner={team2Wins}
        isLoser={team1Wins}
      />
    </div>
  );
}

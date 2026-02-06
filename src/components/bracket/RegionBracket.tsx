'use client';

import { RegionBracket as RegionBracketType, BracketGame, BracketRound } from '@/types/bracket';
import BracketMatchupCard from './BracketMatchupCard';

interface RegionBracketProps {
  bracket: RegionBracketType;
}

function TBDMatchupCard() {
  return (
    <div className="w-52 border border-dashed border-dark-border rounded-xl overflow-hidden bg-dark-surface">
      <div className="flex items-center justify-between px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted w-5 text-center">-</span>
          <span className="text-xs text-text-muted italic">TBD</span>
        </div>
      </div>
      <div className="border-t border-dark-border-subtle" />
      <div className="flex items-center justify-between px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted w-5 text-center">-</span>
          <span className="text-xs text-text-muted italic">TBD</span>
        </div>
      </div>
    </div>
  );
}

const EXPECTED_GAMES = [8, 4, 2, 1];

function RoundColumn({
  bracketRound,
  expectedGames,
  roundIndex,
}: {
  bracketRound: BracketRound | null;
  expectedGames: number;
  roundIndex: number;
}) {
  const roundLabels = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite Eight'];
  const label = bracketRound?.round.name || roundLabels[roundIndex] || `Round ${roundIndex + 1}`;
  const games = bracketRound?.games || [];

  const slots: (BracketGame | null)[] = [];
  for (let i = 0; i < expectedGames; i++) {
    slots.push(games[i] ?? null);
  }

  return (
    <div className="flex flex-col flex-shrink-0" style={{ width: '220px' }}>
      <div className="text-xs font-semibold text-text-muted uppercase tracking-widest text-center mb-3 px-1 truncate">
        {label}
      </div>
      <div className="flex flex-col justify-around flex-1 gap-2">
        {slots.map((game, idx) => (
          <div key={game?.id ?? `tbd-${roundIndex}-${idx}`} className="flex items-center justify-center">
            {game ? (
              <BracketMatchupCard game={game} compact={roundIndex > 0} />
            ) : (
              <TBDMatchupCard />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RegionBracket({ bracket }: RegionBracketProps) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max px-2" style={{ minHeight: '500px' }}>
        {EXPECTED_GAMES.map((expectedCount, roundIndex) => {
          const bracketRound = bracket.rounds[roundIndex] ?? null;
          return (
            <RoundColumn
              key={roundIndex}
              bracketRound={bracketRound}
              expectedGames={expectedCount}
              roundIndex={roundIndex}
            />
          );
        })}
      </div>
    </div>
  );
}

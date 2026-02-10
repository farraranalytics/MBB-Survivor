'use client';

import React from 'react';
import { RegionBracket as RegionBracketType, BracketGame, BracketRound } from '@/types/bracket';
import BracketMatchupCard from './BracketMatchupCard';

interface RegionBracketProps {
  bracket: RegionBracketType;
}

function TBDMatchupCard() {
  return (
    <div className="w-full border border-dashed border-[rgba(255,255,255,0.06)] rounded-[6px] overflow-hidden bg-[#0D1B2A]">
      <div className="flex items-center justify-between px-2 py-[3px] bg-[rgba(255,255,255,0.02)]">
        <span className="text-[9px] font-semibold text-[#5F6B7A] tracking-wider" style={{ fontFamily: "'Space Mono', monospace" }}>—</span>
        <span className="text-[8px] font-bold text-[#5F6B7A] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 rounded" style={{ fontFamily: "'Space Mono', monospace" }}>
          TBD
        </span>
      </div>
      <div className="flex items-center justify-between px-2 py-[5px]">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[#5F6B7A] w-4 text-center" style={{ fontFamily: "'Space Mono', monospace" }}>-</span>
          <span className="text-[11px] text-[#5F6B7A] italic" style={{ fontFamily: "'DM Sans', sans-serif" }}>TBD</span>
        </div>
      </div>
      <div className="border-t border-[rgba(255,255,255,0.04)]" />
      <div className="flex items-center justify-between px-2 py-[5px]">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[#5F6B7A] w-4 text-center" style={{ fontFamily: "'Space Mono', monospace" }}>-</span>
          <span className="text-[11px] text-[#5F6B7A] italic" style={{ fontFamily: "'DM Sans', sans-serif" }}>TBD</span>
        </div>
      </div>
    </div>
  );
}

const EXPECTED_GAMES = [8, 4, 2, 1];
const ROUND_LABELS = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite Eight'];
const CARD_HEIGHT = 58; // Approximate height of a matchup card in px
const CONNECTOR_GAP = 16; // Horizontal gap for connector lines

function RoundColumn({
  bracketRound,
  expectedGames,
  roundIndex,
}: {
  bracketRound: BracketRound | null;
  expectedGames: number;
  roundIndex: number;
}) {
  const label = bracketRound?.round.name || ROUND_LABELS[roundIndex] || `Round ${roundIndex + 1}`;
  const games = bracketRound?.games || [];

  const slots: (BracketGame | null)[] = [];
  for (let i = 0; i < expectedGames; i++) {
    slots.push(games[i] ?? null);
  }

  // Calculate spacing: later rounds need more vertical space between cards
  // R64: no extra gap, R32: 1x, S16: 3x, E8: 7x (binary tree spacing)
  const spacingMultiplier = Math.pow(2, roundIndex) - 1;
  const verticalGap = CARD_HEIGHT * spacingMultiplier + (spacingMultiplier > 0 ? 8 * spacingMultiplier : 0);

  return (
    <div className="flex flex-col flex-shrink-0" style={{ width: '175px' }}>
      {/* Column header */}
      <div className="text-center mb-2 pb-2 border-b border-[rgba(255,255,255,0.06)]">
        <span className="text-[10px] font-bold tracking-[0.12em] text-[#9BA3AE]" style={{ fontFamily: "'Space Mono', monospace", textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      {/* Games */}
      <div className="flex flex-col items-stretch" style={{ gap: `${Math.max(verticalGap, 4)}px` }}>
        {slots.map((game, idx) => (
          <div key={game?.id ?? `tbd-${roundIndex}-${idx}`}>
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

/** SVG connector lines between round columns */
function ConnectorLines({ roundIndex, gameCount }: { roundIndex: number; gameCount: number }) {
  // Each pair of games in round N feeds one game in round N+1
  const pairs = gameCount / 2;
  const prevCardHeight = CARD_HEIGHT;
  const prevMultiplier = Math.pow(2, roundIndex) - 1;
  const prevGap = prevCardHeight * prevMultiplier + (prevMultiplier > 0 ? 8 * prevMultiplier : 0);
  const prevStride = prevCardHeight + Math.max(prevGap, 4); // total vertical distance per card

  // Height of header
  const headerHeight = 30;

  const svgHeight = headerHeight + pairs * prevStride * 2;
  const lines: React.ReactNode[] = [];

  for (let i = 0; i < pairs; i++) {
    const topGameCenter = headerHeight + i * 2 * prevStride + prevCardHeight / 2;
    const bottomGameCenter = headerHeight + (i * 2 + 1) * prevStride + prevCardHeight / 2;
    const midY = (topGameCenter + bottomGameCenter) / 2;
    const midX = CONNECTOR_GAP / 2;

    // Line from top game right edge to mid
    lines.push(
      <line key={`t-${i}`} x1={0} y1={topGameCenter} x2={midX} y2={topGameCenter} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />,
      <line key={`tv-${i}`} x1={midX} y1={topGameCenter} x2={midX} y2={midY} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />,
    );
    // Line from bottom game right edge to mid
    lines.push(
      <line key={`b-${i}`} x1={0} y1={bottomGameCenter} x2={midX} y2={bottomGameCenter} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />,
      <line key={`bv-${i}`} x1={midX} y1={bottomGameCenter} x2={midX} y2={midY} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />,
    );
    // Horizontal line from mid to next round
    lines.push(
      <line key={`m-${i}`} x1={midX} y1={midY} x2={CONNECTOR_GAP} y2={midY} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />,
    );
  }

  return (
    <svg width={CONNECTOR_GAP} height={svgHeight} className="flex-shrink-0" style={{ overflow: 'visible' }}>
      {lines}
    </svg>
  );
}

export default function RegionBracket({ bracket }: RegionBracketProps) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max px-2 items-start">
        {EXPECTED_GAMES.map((expectedCount, roundIndex) => {
          const bracketRound = bracket.rounds[roundIndex] ?? null;
          return (
            <div key={roundIndex} className="flex items-start">
              <RoundColumn
                bracketRound={bracketRound}
                expectedGames={expectedCount}
                roundIndex={roundIndex}
              />
              {roundIndex < EXPECTED_GAMES.length - 1 && (
                <ConnectorLines roundIndex={roundIndex} gameCount={expectedCount} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

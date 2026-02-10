'use client';

import { RegionBracket as RegionBracketType, BracketGame } from '@/types/bracket';
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

/** Reusable bracket connector — merges two feeder games into one output.
 *  Uses viewBox so the same SVG works for any row span (2, 4, or 8 rows). */
function BracketConnector() {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="w-full h-full block"
    >
      <line x1={0} y1={25} x2={50} y2={25} stroke="rgba(255,255,255,0.1)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <line x1={0} y1={75} x2={50} y2={75} stroke="rgba(255,255,255,0.1)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <line x1={50} y1={25} x2={50} y2={75} stroke="rgba(255,255,255,0.1)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <line x1={50} y1={50} x2={100} y2={50} stroke="rgba(255,255,255,0.1)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const ROUND_LABELS = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite Eight'];
const CARD_COLS = [1, 3, 5, 7];
const CONN_COLS = [2, 4, 6];

function GameCell({ game, gridColumn, gridRow, compact }: {
  game: BracketGame | null;
  gridColumn: number;
  gridRow: string;
  compact: boolean;
}) {
  return (
    <div
      style={{ gridColumn, gridRow }}
      className="flex items-center py-[3px]"
    >
      {game ? (
        <BracketMatchupCard game={game} compact={compact} />
      ) : (
        <TBDMatchupCard />
      )}
    </div>
  );
}

export default function RegionBracket({ bracket }: RegionBracketProps) {
  return (
    <div className="overflow-x-auto pb-4">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '165px 20px 165px 20px 165px 20px 165px',
          gridTemplateRows: 'auto repeat(8, 1fr)',
        }}
      >
        {/* ── Column Headers (row 1) ── */}
        {ROUND_LABELS.map((label, i) => (
          <div
            key={label}
            style={{ gridColumn: CARD_COLS[i], gridRow: 1 }}
            className="text-center pb-2 mb-1 border-b border-[rgba(255,255,255,0.06)]"
          >
            <span
              className="text-[10px] font-bold tracking-[0.12em] text-[#9BA3AE]"
              style={{ fontFamily: "'Space Mono', monospace", textTransform: 'uppercase' }}
            >
              {bracket.rounds[i]?.round.name || label}
            </span>
          </div>
        ))}

        {/* ── R64: 8 games, one per row (rows 2–9) ── */}
        {Array.from({ length: 8 }).map((_, i) => (
          <GameCell
            key={`r64-${i}`}
            game={bracket.rounds[0]?.games[i] ?? null}
            gridColumn={CARD_COLS[0]}
            gridRow={`${i + 2}`}
            compact={false}
          />
        ))}

        {/* ── R64→R32 connectors: 4, each spanning 2 rows ── */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`c0-${i}`}
            style={{ gridColumn: CONN_COLS[0], gridRow: `${i * 2 + 2} / span 2` }}
          >
            <BracketConnector />
          </div>
        ))}

        {/* ── R32: 4 games, each spanning 2 rows ── */}
        {Array.from({ length: 4 }).map((_, i) => (
          <GameCell
            key={`r32-${i}`}
            game={bracket.rounds[1]?.games[i] ?? null}
            gridColumn={CARD_COLS[1]}
            gridRow={`${i * 2 + 2} / span 2`}
            compact
          />
        ))}

        {/* ── R32→S16 connectors: 2, each spanning 4 rows ── */}
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={`c1-${i}`}
            style={{ gridColumn: CONN_COLS[1], gridRow: `${i * 4 + 2} / span 4` }}
          >
            <BracketConnector />
          </div>
        ))}

        {/* ── S16: 2 games, each spanning 4 rows ── */}
        {Array.from({ length: 2 }).map((_, i) => (
          <GameCell
            key={`s16-${i}`}
            game={bracket.rounds[2]?.games[i] ?? null}
            gridColumn={CARD_COLS[2]}
            gridRow={`${i * 4 + 2} / span 4`}
            compact
          />
        ))}

        {/* ── S16→E8 connector: 1, spanning all 8 rows ── */}
        <div style={{ gridColumn: CONN_COLS[2], gridRow: '2 / span 8' }}>
          <BracketConnector />
        </div>

        {/* ── E8: 1 game, spanning all 8 rows ── */}
        <GameCell
          game={bracket.rounds[3]?.games[0] ?? null}
          gridColumn={CARD_COLS[3]}
          gridRow="2 / span 8"
          compact
        />
      </div>
    </div>
  );
}

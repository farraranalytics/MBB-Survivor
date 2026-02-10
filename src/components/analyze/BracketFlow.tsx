'use client';

import { TeamInfo } from '@/types/picks';
import { PLANNER_REGIONS } from '@/lib/bracket';

interface BracketFlowProps {
  getGameWinner: (region: string, round: string, gameIdx: number) => TeamInfo | null;
  usedTeamIds: Set<string>;
  isHighlighted?: boolean;
}

function TeamPill({ team, big }: { team: TeamInfo | null; big?: boolean }) {
  if (!team) return null;
  const isUsed = false; // Will be checked by parent passing down
  return null; // placeholder
}

export default function BracketFlow({
  getGameWinner,
  usedTeamIds,
  isHighlighted,
}: BracketFlowProps) {
  const Pill = ({ t, big }: { t: TeamInfo | null; big?: boolean }) => {
    if (!t) return null;
    const isUsed = usedTeamIds.has(t.id);
    return (
      <span
        className="inline-block"
        style={{
          fontFamily: big ? 'var(--font-display)' : 'var(--font-mono)',
          fontSize: big ? '0.9rem' : '0.6rem',
          fontWeight: 700,
          padding: big ? '4px 10px' : '2px 6px',
          borderRadius: big ? 'var(--radius-sm)' : '3px',
          letterSpacing: '0.03em',
          textTransform: big ? 'uppercase' : 'none',
          background: isUsed
            ? 'var(--color-eliminated-subtle)'
            : big
              ? 'var(--color-orange-subtle)'
              : 'var(--surface-3)',
          color: isUsed
            ? 'var(--color-eliminated)'
            : big
              ? 'var(--color-orange)'
              : 'var(--text-primary)',
          border: `1px solid ${
            isUsed
              ? 'rgba(239,83,80,0.3)'
              : big
                ? 'var(--border-accent)'
                : 'var(--border-default)'
          }`,
          textDecoration: isUsed ? 'line-through' : 'none',
        }}
      >
        ({t.seed}) {t.abbreviation || t.name}
      </span>
    );
  };

  return (
    <div
      id="bracket-flow"
      className="card p-5 mt-5"
      style={{
        boxShadow: isHighlighted ? '0 0 0 2px var(--color-orange), 0 0 20px rgba(255,87,34,0.15)' : undefined,
        zIndex: isHighlighted ? 400 : undefined,
        position: isHighlighted ? 'relative' : undefined,
      }}
    >
      <div className="text-label-accent mb-2">PROJECTED PATH</div>
      <h3 className="text-heading text-[1.1rem] mb-4">Bracket Flow</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {PLANNER_REGIONS.map(region => {
          const r32 = [0, 1, 2, 3].map(gi => getGameWinner(region, 'R32', gi));
          const s16 = [0, 1].map(gi => getGameWinner(region, 'S16', gi));
          const e8W = getGameWinner(region, 'E8', 0);

          return (
            <div
              key={region}
              className="rounded-[var(--radius-md)] p-3"
              style={{
                background: 'var(--surface-0)',
                border: '1px solid var(--border-subtle)',
                borderTop: '3px solid var(--color-orange)',
              }}
            >
              <div className="font-[family-name:var(--font-display)] font-semibold text-[0.85rem] uppercase mb-2.5">
                {region}
              </div>

              <div className="mb-2">
                <div className="label text-[0.45rem] mb-1">R32 WINNERS</div>
                <div className="flex flex-wrap gap-[3px]">
                  {r32.map((t, i) => <Pill key={i} t={t} />)}
                </div>
              </div>

              <div className="mb-2">
                <div className="label text-[0.45rem] mb-1">S16 WINNERS</div>
                <div className="flex flex-wrap gap-[3px]">
                  {s16.map((t, i) => <Pill key={i} t={t} />)}
                </div>
              </div>

              <div>
                <div className="label text-[0.45rem] mb-1">REGION CHAMP</div>
                <Pill t={e8W} big />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

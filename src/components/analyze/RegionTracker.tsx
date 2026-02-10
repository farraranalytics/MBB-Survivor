'use client';

import { TeamInfo } from '@/types/picks';
import { PLANNER_REGIONS } from '@/lib/bracket';

interface RegionTrackerProps {
  regionCounts: Record<string, number>;
  bracket: Record<string, TeamInfo[]>;
  usedTeamIds: Set<string>;
  regionFlipped: Record<string, boolean>;
  onFlipRegion: (region: string) => void;
}

export default function RegionTracker({
  regionCounts,
  bracket,
  usedTeamIds,
  regionFlipped,
  onFlipRegion,
}: RegionTrackerProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
      {PLANNER_REGIONS.map(region => {
        const cnt = regionCounts[region] || 0;
        const avail = (bracket[region] || []).filter(t => !usedTeamIds.has(t.id)).length;
        const total = (bracket[region] || []).length;
        const danger = cnt >= 4;
        const warn = cnt >= 3;

        return (
          <div
            key={region}
            className="card p-3"
            style={{
              borderLeft: `3px solid ${danger ? 'var(--color-eliminated)' : warn ? 'var(--color-warning)' : 'var(--border-strong)'}`,
            }}
          >
            <div className="flex justify-between items-center">
              <span className="font-[family-name:var(--font-display)] font-semibold text-[0.9rem] uppercase text-[var(--text-primary)]">
                {region}
              </span>
              <span
                className="badge"
                style={{
                  background: danger
                    ? 'var(--color-eliminated-subtle)'
                    : warn
                      ? 'var(--color-warning-subtle)'
                      : 'var(--color-orange-subtle)',
                  color: danger
                    ? 'var(--color-eliminated)'
                    : warn
                      ? 'var(--color-warning)'
                      : 'var(--color-orange)',
                }}
              >
                {cnt} USED
              </span>
            </div>

            {/* Progress bars */}
            <div className="flex gap-[3px] mt-2.5">
              {[...Array(4)].map((_, i) => {
                const barColor = danger
                  ? 'var(--color-eliminated)'
                  : warn
                    ? 'var(--color-warning)'
                    : 'var(--color-orange)';
                return (
                  <div
                    key={i}
                    className="flex-1 h-1.5 rounded-sm transition-all duration-250"
                    style={{
                      background: i < cnt ? barColor : 'rgba(255,255,255,0.06)',
                      boxShadow: i < cnt ? `0 0 6px ${barColor}33` : 'none',
                    }}
                  />
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center mt-1.5">
              <span className="font-[family-name:var(--font-mono)] text-[0.6rem] text-[var(--text-tertiary)]">
                {avail}/{total} LEFT
              </span>
              <button
                onClick={() => onFlipRegion(region)}
                className="font-[family-name:var(--font-mono)] text-[0.55rem] tracking-[0.1em] px-1.5 py-px rounded-sm cursor-pointer"
                style={{
                  background: 'none',
                  border: '1px solid var(--border-default)',
                  color: regionFlipped[region] ? 'var(--color-orange)' : 'var(--text-tertiary)',
                }}
              >
                {regionFlipped[region] ? '⇄ FLIPPED' : '⇄ FLIP'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

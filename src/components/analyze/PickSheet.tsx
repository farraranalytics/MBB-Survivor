'use client';

import { PlannerDay, PlannerPick } from '@/lib/bracket';

interface PickSheetProps {
  days: PlannerDay[];
  picks: Record<string, PlannerPick>;
  regionCounts: Record<string, number>;
}

export default function PickSheet({
  days,
  picks,
  regionCounts,
}: PickSheetProps) {
  const totalPicks = Object.keys(picks).length;
  const overexposedRegions = Object.entries(regionCounts).filter(([_, c]) => c >= 4);

  return (
    <div className="card p-5 mt-3.5 mb-8">
      <div className="text-label-accent mb-2">YOUR PLAN</div>
      <h3 className="text-heading text-[1.1rem] mb-4">Pick Sheet</h3>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        {days.map(day => {
          const p = picks[day.id];
          return (
            <div
              key={day.id}
              className="rounded-[var(--radius-sm)] p-2 text-center"
              style={{
                background: p ? 'var(--color-orange-subtle)' : 'var(--surface-0)',
                border: p ? '1.5px solid var(--color-orange)' : '1px dashed var(--border-default)',
                boxShadow: p ? '0 0 12px rgba(255,87,34,0.1)' : 'none',
              }}
            >
              <div className="font-[family-name:var(--font-mono)] text-[0.5rem] tracking-[0.15em] text-[var(--text-tertiary)] mb-1">
                {day.label}
              </div>
              {p ? (
                <>
                  <div className="font-[family-name:var(--font-display)] font-bold text-[0.85rem] uppercase text-[var(--color-orange)]">
                    {p.team.abbreviation || p.team.name}
                  </div>
                  <div className="font-[family-name:var(--font-mono)] text-[0.5rem] text-[var(--text-tertiary)] mt-0.5">
                    ({p.team.seed}) · {p.region.toUpperCase()}
                    {p.isSubmitted && ' · 🔒'}
                  </div>
                </>
              ) : (
                <div className="font-[family-name:var(--font-body)] text-[0.8rem] text-[var(--text-disabled)] py-1">
                  —
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Regional exposure warning */}
      {overexposedRegions.length > 0 && (
        <div
          className="mt-3.5 p-3 px-4 rounded-[var(--radius-md)] flex items-center gap-3"
          style={{
            background: 'var(--color-eliminated-subtle)',
            border: '1px solid var(--color-eliminated)',
          }}
        >
          <span className="text-[1.2rem]">⚠</span>
          <div>
            <div className="font-[family-name:var(--font-body)] font-medium text-[0.9rem] text-[var(--color-eliminated)]">
              Heavy regional exposure
            </div>
            <div className="font-[family-name:var(--font-body)] text-[0.8rem] text-[var(--text-secondary)] mt-0.5">
              {overexposedRegions.map(([r]) => r).join(', ')} — you&apos;re burning through teams in later rounds.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

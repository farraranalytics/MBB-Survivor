'use client';

import { PLANNER_REGIONS, PlannerDay, PlannerPick } from '@/lib/bracket';

interface UsageMapProps {
  days: PlannerDay[];
  picks: Record<string, PlannerPick>;
  regionCounts: Record<string, number>;
  getRegionsForDay: (day: PlannerDay) => string[];
}

export default function UsageMap({
  days,
  picks,
  regionCounts,
  getRegionsForDay,
}: UsageMapProps) {
  return (
    <div className="card p-5 mt-3.5">
      <div className="text-label-accent mb-2">USAGE MAP</div>
      <h3 className="text-heading text-[1.1rem] mb-4">Region × Day</h3>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 3, tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th className="label text-[0.5rem] text-left p-1" style={{ width: 70 }}>
                REGION
              </th>
              {days.map(d => (
                <th
                  key={d.id}
                  className="font-[family-name:var(--font-mono)] text-[0.4rem] text-[var(--text-tertiary)] text-center p-[3px] font-semibold tracking-[0.08em]"
                >
                  {d.label.replace('Day ', 'D').replace('Round ', 'R')}
                </th>
              ))}
              <th className="label text-[0.5rem] text-center p-1" style={{ width: 36 }}>
                TOT
              </th>
            </tr>
          </thead>
          <tbody>
            {PLANNER_REGIONS.map(region => {
              const dayPicks: Record<string, boolean> = {};
              Object.values(picks).forEach(p => {
                if (p.region === region) dayPicks[p.dayId] = true;
              });
              const tot = regionCounts[region] || 0;

              return (
                <tr key={region}>
                  <td className="font-[family-name:var(--font-display)] font-semibold text-[0.8rem] uppercase p-1">
                    {region}
                  </td>
                  {days.map(day => {
                    const hasPick = dayPicks[day.id];
                    const hasGames = getRegionsForDay(day).includes(region);
                    return (
                      <td
                        key={day.id}
                        className="text-center p-1 rounded-sm font-[family-name:var(--font-mono)] text-[0.7rem] font-bold"
                        style={{
                          background: hasPick
                            ? 'var(--color-orange-subtle)'
                            : !hasGames
                              ? 'var(--surface-0)'
                              : 'var(--surface-2)',
                          border: hasPick ? '1px solid var(--border-accent)' : '1px solid transparent',
                          color: hasPick
                            ? 'var(--color-orange)'
                            : !hasGames
                              ? 'var(--surface-1)'
                              : 'var(--text-disabled)',
                        }}
                      >
                        {!hasGames ? '—' : hasPick ? '●' : '·'}
                      </td>
                    );
                  })}
                  <td
                    className="text-center p-1 rounded-sm font-[family-name:var(--font-mono)] text-[0.85rem] font-bold"
                    style={{
                      background: tot >= 4
                        ? 'var(--color-eliminated-subtle)'
                        : tot >= 3
                          ? 'var(--color-warning-subtle)'
                          : 'var(--surface-2)',
                      color: tot >= 4
                        ? 'var(--color-eliminated)'
                        : tot >= 3
                          ? 'var(--color-warning)'
                          : 'var(--text-tertiary)',
                    }}
                  >
                    {tot}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

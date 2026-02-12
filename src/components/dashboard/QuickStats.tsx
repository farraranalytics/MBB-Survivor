'use client';

import { MyPool } from '@/types/standings';

interface QuickStatsProps {
  pools: MyPool[];
}

export default function QuickStats({ pools }: QuickStatsProps) {
  // Alive entries across all pools
  const totalEntries = pools.reduce((sum, p) => sum + p.your_entries.length, 0);
  const aliveEntries = pools.reduce(
    (sum, p) => sum + p.your_entries.filter(e => !e.is_eliminated).length,
    0
  );

  // Best streak across all entries
  const bestStreak = pools.reduce((best, p) => Math.max(best, p.your_streak), 0);

  // Active pool count
  const activePools = pools.length;

  const stats = [
    {
      value: aliveEntries,
      label: `of ${totalEntries}`,
      title: 'ALIVE',
      color: '#4CAF50',
      bgColor: 'rgba(76,175,80,0.08)',
      borderColor: 'rgba(76,175,80,0.15)',
    },
    {
      value: bestStreak,
      label: 'DAYS',
      title: 'BEST STREAK',
      color: '#FFB300',
      bgColor: 'rgba(255,179,0,0.08)',
      borderColor: 'rgba(255,179,0,0.15)',
    },
    {
      value: activePools,
      label: 'ACTIVE',
      title: 'POOLS',
      color: '#42A5F5',
      bgColor: 'rgba(66,165,245,0.08)',
      borderColor: 'rgba(66,165,245,0.15)',
    },
  ];

  return (
    <div className="flex gap-2.5">
      {stats.map((stat, i) => (
        <div
          key={i}
          className="flex-1 rounded-[10px] p-3 text-center"
          style={{
            background: stat.bgColor,
            border: `1px solid ${stat.borderColor}`,
          }}
        >
          <p
            className="text-[9px] tracking-[0.15em] mb-1"
            style={{
              fontFamily: "'Space Mono', monospace",
              color: stat.color,
              opacity: 0.8,
            }}
          >
            {stat.title}
          </p>
          <p
            className="text-2xl font-bold leading-none"
            style={{ fontFamily: "'Oswald', sans-serif", color: stat.color }}
          >
            {stat.value}
          </p>
          <p
            className="text-[9px] mt-1 tracking-[0.1em]"
            style={{
              fontFamily: "'Space Mono', monospace",
              color: stat.color,
              opacity: 0.6,
            }}
          >
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  );
}

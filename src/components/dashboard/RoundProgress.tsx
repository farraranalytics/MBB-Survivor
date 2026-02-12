'use client';

import { RoundInfo } from '@/lib/status';
import { formatDateET } from '@/lib/timezone';

interface RoundProgressProps {
  rounds: RoundInfo[];
}

export default function RoundProgress({ rounds }: RoundProgressProps) {
  if (rounds.length === 0) return null;

  // Find the current day index (first round that is pre_round or round_live)
  const currentIdx = rounds.findIndex(r => r.status === 'pre_round' || r.status === 'round_live');
  const completedCount = rounds.filter(r => r.status === 'round_complete').length;
  const currentRound = currentIdx >= 0 ? rounds[currentIdx] : rounds[rounds.length - 1];
  const dayLabel = currentIdx >= 0 ? currentIdx + 1 : rounds.length;

  return (
    <div
      className="rounded-[14px] border border-[rgba(255,255,255,0.05)] p-4"
      style={{ background: '#111827' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p
            className="text-xs font-bold text-[#E8E6E1]"
            style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
          >
            {currentRound.name}
          </p>
          <p
            className="text-[10px] text-[#5F6B7A] mt-0.5"
            style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em' }}
          >
            {currentRound.date ? formatDateET(currentRound.date) : ''}
          </p>
        </div>
        <p
          className="text-[10px] text-[#9BA3AE] tracking-[0.15em]"
          style={{ fontFamily: "'Space Mono', monospace" }}
        >
          DAY {dayLabel} OF {rounds.length}
        </p>
      </div>

      {/* Progress bar segments */}
      <div className="flex gap-1">
        {rounds.map((round, i) => {
          let bgColor: string;
          if (round.status === 'round_complete') {
            bgColor = '#4CAF50'; // green
          } else if (i === currentIdx) {
            bgColor = '#FF5722'; // orange (current)
          } else {
            bgColor = '#243447'; // dark (future)
          }

          const isPulsing = i === currentIdx && round.status !== 'round_complete';

          return (
            <div
              key={round.id}
              className="h-2 flex-1 rounded-full"
              style={{
                background: bgColor,
                animation: isPulsing ? 'segment-pulse 2s ease-in-out infinite' : undefined,
              }}
              title={`${round.name} - ${round.status.replace('_', ' ')}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-2.5">
        {[
          { color: '#4CAF50', label: `${completedCount} Complete` },
          { color: '#FF5722', label: 'Current' },
          { color: '#243447', label: `${rounds.length - completedCount - (currentIdx >= 0 ? 1 : 0)} Remaining` },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
            <span
              className="text-[9px] text-[#5F6B7A] tracking-[0.06em]"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

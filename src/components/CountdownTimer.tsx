'use client';

import { useEffect, useState } from 'react';

// ─── Types ──────────────────────────────────────────────────────

type CountdownSize = 'lg' | 'md';

interface CountdownTimerProps {
  target: string;              // ISO datetime to count down to
  label: string;               // e.g. "TIPS OFF IN", "PICKS LOCK IN"
  size?: CountdownSize;        // 'lg' = splash overlay, 'md' = pick page
  urgent?: boolean;            // manual override: red border + pulsing numbers
  urgentLabel?: string;        // label to show when urgent (e.g. "⚠ DEADLINE APPROACHING")
  urgentThresholdMs?: number;  // auto-urgent when remaining time drops below this (e.g. 1800000 = 30 min)
}

// ─── Size Config ────────────────────────────────────────────────

const sizeConfig = {
  lg: {
    box: 'w-[80px] h-[80px]',
    number: 'text-[40px]',
    colon: 'text-[30px]',
    unit: 'text-[0.6rem] tracking-[0.15em] mt-1.5',
    gap: 'gap-2',
  },
  md: {
    box: 'w-[50px] h-[50px]',
    number: 'text-[28px]',
    colon: 'text-[22px]',
    unit: 'text-[0.55rem] tracking-[0.15em] mt-1',
    gap: 'gap-1.5',
  },
} as const;

// ─── Countdown Box ──────────────────────────────────────────────

function CountdownBox({
  value,
  unit,
  size,
  urgent,
}: {
  value: number;
  unit: string;
  size: CountdownSize;
  urgent: boolean;
}) {
  const s = sizeConfig[size];
  const borderColor = urgent ? 'border-[rgba(239,83,80,0.5)]' : 'border-[rgba(255,87,34,0.3)]';
  const bgColor = urgent ? 'bg-[rgba(239,83,80,0.08)]' : 'bg-[rgba(255,87,34,0.08)]';
  const numColor = urgent ? 'text-[#EF5350]' : 'text-[#FF5722]';
  const pulseClass = urgent ? 'countdown-urgent' : '';

  const glowShadow = urgent
    ? '0 0 20px rgba(239,83,80,0.2)'
    : '0 0 20px rgba(255,87,34,0.15)';

  return (
    <div className="flex flex-col items-center">
      <div
        className={`${s.box} rounded-[4px] border ${borderColor} ${bgColor} flex items-center justify-center`}
        style={{ boxShadow: glowShadow }}
      >
        <span
          className={`${s.number} font-bold ${numColor} ${pulseClass}`}
          style={{ fontFamily: "'Oswald', sans-serif", lineHeight: 1 }}
        >
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span
        className={`${s.unit} text-[#5F6B7A]`}
        style={{ fontFamily: "'Space Mono', monospace" }}
      >
        {unit}
      </span>
    </div>
  );
}

// ─── Colon Separator ────────────────────────────────────────────

function Colon({ size, urgent }: { size: CountdownSize; urgent: boolean }) {
  const s = sizeConfig[size];
  const color = urgent ? 'text-[rgba(239,83,80,0.5)]' : 'text-[#5F6B7A]';
  return (
    <span
      className={`${s.colon} font-bold ${color} self-start`}
      style={{
        fontFamily: "'Oswald', sans-serif",
        lineHeight: 1,
        // Vertically center the colon within the box height
        paddingTop: size === 'lg' ? '22px' : '12px',
      }}
    >
      :
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export function CountdownTimer({
  target,
  label,
  size = 'lg',
  urgent = false,
  urgentLabel,
  urgentThresholdMs,
}: CountdownTimerProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const diff = Math.max(0, new Date(target).getTime() - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const showDays = days > 0;

  // Auto-urgent: kicks in when remaining time drops below threshold
  const isUrgent = urgent || (urgentThresholdMs !== undefined && diff > 0 && diff < urgentThresholdMs);
  const displayLabel = isUrgent && urgentLabel ? urgentLabel : label;

  const s = sizeConfig[size];

  return (
    <div className="text-center">
      <p className="text-label-accent mb-3">{displayLabel}</p>
      <div className={`flex items-start justify-center ${s.gap}`}>
        {showDays && (
          <>
            <CountdownBox value={days} unit="DAYS" size={size} urgent={isUrgent} />
            <Colon size={size} urgent={isUrgent} />
          </>
        )}
        <CountdownBox value={hours} unit="HRS" size={size} urgent={isUrgent} />
        <Colon size={size} urgent={isUrgent} />
        <CountdownBox value={minutes} unit="MIN" size={size} urgent={isUrgent} />
        {!showDays && (
          <>
            <Colon size={size} urgent={isUrgent} />
            <CountdownBox value={seconds} unit="SEC" size={size} urgent={isUrgent} />
          </>
        )}
      </div>
    </div>
  );
}

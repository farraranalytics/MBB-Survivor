'use client';

interface PageHeaderProps {
  tabLabel: string;
  heading: string;
  roundInfo?: {
    roundName: string;
    gameCount?: number;
    dateLabel?: string;
  };
}

export default function PageHeader({ tabLabel, heading, roundInfo }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-1.5 sm:mb-2.5">
      <div>
        <div className="text-[10px] font-bold text-[#FF5722] tracking-[0.2em] mb-0.5"
          style={{ fontFamily: "'Space Mono', monospace" }}>
          {tabLabel}
        </div>
        <div className="text-base sm:text-xl font-bold text-[#E8E6E1] uppercase"
          style={{ fontFamily: "'Oswald', sans-serif" }}>
          {heading}
        </div>
      </div>
      {roundInfo && (
        <div className="text-right px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 bg-[#0D1B2A] rounded-[10px] border-[1.5px] border-[rgba(255,255,255,0.12)]">
          <div className="text-[10px] font-bold text-[#9BA3AE] tracking-[0.15em] mb-[2px]"
            style={{ fontFamily: "'Space Mono', monospace" }}>
            ROUND
          </div>
          <div className="text-sm sm:text-lg font-bold text-[#E8E6E1] leading-tight"
            style={{ fontFamily: "'Oswald', sans-serif" }}>
            {roundInfo.roundName}
          </div>
          {(roundInfo.gameCount !== undefined || roundInfo.dateLabel) && (
            <div className="flex items-center justify-end gap-1.5 mt-0.5 sm:mt-1">
              {roundInfo.gameCount !== undefined && (
                <span className="text-[10px] font-bold text-[#E8E6E1] tracking-[0.06em]"
                  style={{ fontFamily: "'Space Mono', monospace" }}>
                  {roundInfo.gameCount} GAMES
                </span>
              )}
              {roundInfo.dateLabel && (
                <span className="text-[10px] font-bold text-[#FF5722] bg-[rgba(255,87,34,0.08)] px-1.5 py-[2px] rounded-[3px] border border-[rgba(255,87,34,0.3)] tracking-[0.06em]"
                  style={{ fontFamily: "'Space Mono', monospace" }}>
                  {roundInfo.dateLabel}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

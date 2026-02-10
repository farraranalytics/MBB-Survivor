// Reusable ESPN team logo component with fallback
interface TeamLogoProps {
  espnTeamId: number | null;
  teamName: string;
  size?: 'xs' | 'sm' | 'md' | 'lg'; // 14, 20, 32, 48px
  className?: string;
}

const sizeMap = { xs: 14, sm: 20, md: 32, lg: 48 };

export function TeamLogo({ espnTeamId, teamName, size = 'sm', className = '' }: TeamLogoProps) {
  const px = sizeMap[size];

  if (!espnTeamId) {
    return (
      <div
        className={`rounded-full bg-[#243447] flex items-center justify-center flex-shrink-0 ${className}`}
        style={{ width: px, height: px }}
      >
        <span
          style={{ fontSize: px * 0.5, fontFamily: "'Oswald', sans-serif", lineHeight: 1 }}
          className="text-[#9BA3AE] font-bold"
        >
          {teamName.charAt(0)}
        </span>
      </div>
    );
  }

  return (
    <img
      src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${espnTeamId}.png`}
      alt={teamName}
      width={px}
      height={px}
      className={`object-contain flex-shrink-0 ${className}`}
      loading="lazy"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}

export function getESPNStatsUrl(espnTeamId: number): string {
  return `https://www.espn.com/mens-college-basketball/team/stats/_/id/${espnTeamId}`;
}

export function getESPNTeamUrl(espnTeamId: number): string {
  return `https://www.espn.com/mens-college-basketball/team/_/id/${espnTeamId}`;
}

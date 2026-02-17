'use client';

import { TeamInfo } from '@/types/picks';
import { PlannerPick } from '@/lib/bracket';

interface MatchupInfo {
  gameIdx: number;
  teams: (TeamInfo | null)[];
  label: string;
  round: string;
}

interface MatchupCardProps {
  matchup: MatchupInfo;
  region: string;
  dayId: string;
  dayPick: PlannerPick | undefined;
  advancerKey: string; // `${region}_${round}_${gameIdx}`
  advancer: TeamInfo | undefined;
  usedTeamIds: Set<string>;
  lockedAdvancerKeys: Set<string>;
  lockedDayIds: Set<string>;
  onToggleAdvancer: (region: string, round: string, gameIdx: number, team: TeamInfo) => void;
  onHandlePick: (dayId: string, team: TeamInfo, region: string, round: string, gameIdx: number) => void;
  gameStatus?: 'scheduled' | 'in_progress' | 'final';
  gameScore?: { team1Score: number | null; team2Score: number | null; winnerId: string | null };
  gameDateTime?: string | null;
}

export default function MatchupCard({
  matchup,
  region,
  dayId,
  dayPick,
  advancerKey,
  advancer,
  usedTeamIds,
  lockedAdvancerKeys,
  lockedDayIds,
  onToggleAdvancer,
  onHandlePick,
  gameStatus,
  gameScore,
  gameDateTime,
}: MatchupCardProps) {
  const { gameIdx, teams, label, round } = matchup;
  const isSingle = teams.length === 1 || round === 'F4' || round === 'CHIP';
  const isLocked = lockedAdvancerKeys.has(advancerKey);
  const isDayLocked = lockedDayIds.has(dayId);
  const isFinal = gameStatus === 'final';
  const isLive = gameStatus === 'in_progress';

  // Format game time in ET
  const timeLabel = (() => {
    if (isSingle) return label;
    if (!gameDateTime) return `GAME ${gameIdx + 1}`;
    try {
      const d = new Date(gameDateTime);
      return d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }) + ' ET';
    } catch {
      return `GAME ${gameIdx + 1}`;
    }
  })();

  // Check if any team in this card is the day pick
  const hasPickInCard = teams.some(t => t && dayPick?.team.id === t.id);

  return (
    <div className={`rounded-[6px] overflow-hidden transition-all ${
      hasPickInCard
        ? 'border border-[rgba(255,87,34,0.3)] shadow-[0_0_12px_rgba(255,87,34,0.08)]'
        : 'border border-[rgba(255,255,255,0.05)]'
    } bg-[#111827]`}>
      {/* Time strip */}
      <div className={`flex items-center justify-between px-2.5 py-[3px] ${
        isLive ? 'bg-[rgba(255,179,0,0.12)]' : 'bg-[#1B2A3D]'
      }`}>
        <span className="text-[10px] font-bold tracking-[0.08em]"
          style={{
            fontFamily: "'Space Mono', monospace",
            color: isLive ? '#FFB300' : '#5F6B7A',
          }}>
          {isLive ? 'LIVE' : isFinal ? 'FINAL' : timeLabel}
        </span>
        {/* Badges */}
        <div className="flex items-center gap-1">
          {isFinal && gameScore?.winnerId && (() => {
            const chalkSeed = teams.filter(Boolean).reduce((min, t) => Math.min(min, t!.seed), 99);
            const winner = teams.find(t => t?.id === gameScore.winnerId);
            if (winner && winner.seed > chalkSeed) {
              return (
                <span className="text-[8px] font-bold tracking-[0.1em] text-[#FFB300] bg-[rgba(255,179,0,0.12)] px-1 py-px rounded-[3px]"
                  style={{ fontFamily: "'Space Mono', monospace" }}>UPSET</span>
              );
            }
            return null;
          })()}
        </div>
      </div>

      {/* Team rows */}
      {teams.map((team, idx) => {
        if (!team) return null;
        const isUsed = usedTeamIds.has(team.id);
        const isPick = dayPick?.team.id === team.id;
        const isAdv = advancer?.id === team.id;
        const canPick = (!isUsed || isPick) && !isDayLocked;
        const isWinner = isFinal && gameScore?.winnerId === team.id;
        const isLoser = isFinal && gameScore?.winnerId && gameScore.winnerId !== team.id;
        const score = gameScore
          ? (team.id === teams[0]?.id ? gameScore.team1Score : gameScore.team2Score)
          : null;

        return (
          <div
            key={team.id}
            className={`flex items-center ${
              idx === 0 && teams.filter(Boolean).length > 1 ? 'border-b border-[rgba(255,255,255,0.05)]' : ''
            }`}
          >
            {/* Team name button (predict winner / click to advance) */}
            <button
              onClick={() => {
                if (!isSingle && !isLocked) onToggleAdvancer(region, round, gameIdx, team);
              }}
              disabled={isSingle || isLocked}
              className={`flex-1 flex items-center gap-1.5 px-2.5 py-[7px] text-left transition-all ${
                isPick
                  ? 'bg-[rgba(255,87,34,0.08)] border-l-[2.5px] border-l-[#FF5722]'
                  : isAdv && !isSingle
                    ? 'bg-[rgba(76,175,80,0.06)] border-l-[2.5px] border-l-[#4CAF50]'
                    : 'border-l-[2.5px] border-l-transparent'
              } ${isUsed && !isPick ? 'opacity-25' : ''}`}
              style={{ cursor: isSingle || isLocked ? 'default' : 'pointer' }}
            >
              <span className={`text-[11px] font-bold min-w-[16px] text-center flex-shrink-0 ${
                isPick ? 'text-[#FF5722]' : isAdv ? 'text-[#4CAF50]' : 'text-[#5F6B7A]'
              }`} style={{ fontFamily: "'Oswald', sans-serif" }}>
                {team.seed}
              </span>
              <span className={`text-[13px] flex-1 truncate ${
                isPick ? 'text-[#FF5722] font-bold' :
                isWinner ? 'text-[#E8E6E1] font-bold' :
                isLoser ? 'text-[#5F6B7A] font-semibold' :
                isAdv ? 'text-[#E8E6E1] font-bold' :
                'text-[#E8E6E1] font-semibold'
              } ${isUsed && !isPick ? 'line-through' : ''}`}
                style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                {team.abbreviation || team.name}
              </span>
              {score !== null && (
                <span className={`text-[11px] font-bold flex-shrink-0 ${
                  isWinner ? 'text-[#E8E6E1]' : 'text-[#5F6B7A]'
                }`} style={{ fontFamily: "'Space Mono', monospace" }}>
                  {score}
                </span>
              )}
              {isAdv && !isSingle && !isFinal && !isPick && (
                <span className="text-[10px] font-bold text-[#4CAF50] flex-shrink-0"
                  style={{ fontFamily: "'Space Mono', monospace" }}>
                  ✓
                </span>
              )}
              {isUsed && !isPick && (
                <span className="text-[8px] font-bold text-[#EF5350] tracking-[0.1em] flex-shrink-0"
                  style={{ fontFamily: "'Space Mono', monospace" }}>
                  USED
                </span>
              )}
              {isPick && (
                <span className="text-[10px] font-bold text-[#FF5722] flex-shrink-0"
                  style={{ fontFamily: "'Space Mono', monospace" }}>
                  ✓
                </span>
              )}
            </button>

            {/* Pin pick button */}
            {!isFinal && (
              <button
                onClick={() => {
                  if (canPick) onHandlePick(dayId, team, region, round, gameIdx);
                }}
                disabled={!canPick}
                className="w-7 h-7 shrink-0 flex items-center justify-center mr-1 transition-all duration-150"
                style={{
                  background: isPick ? 'rgba(255,87,34,0.12)' : 'transparent',
                  border: isPick ? '1.5px solid rgba(255,87,34,0.4)' : '1.5px solid rgba(255,255,255,0.08)',
                  borderRadius: '4px',
                  color: isPick ? '#FF5722' : canPick ? '#5F6B7A' : '#243447',
                  cursor: canPick ? 'pointer' : 'not-allowed',
                  opacity: canPick ? 1 : 0.3,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.7rem',
                  boxShadow: isPick ? '0 0 0 1px rgba(255,87,34,0.15), 0 0 8px rgba(255,87,34,0.1)' : 'none',
                }}
                title={isPick ? 'Remove pick' : `Pick ${team.abbreviation || team.name}`}
              >
                {isDayLocked && isPick ? '🔒' : '✎'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

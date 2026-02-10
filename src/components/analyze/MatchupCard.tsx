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
}: MatchupCardProps) {
  const { gameIdx, teams, label, round } = matchup;
  const isSingle = teams.length === 1 || round === 'F4' || round === 'CHIP';
  const isLocked = lockedAdvancerKeys.has(advancerKey);
  const isDayLocked = lockedDayIds.has(dayId);
  const isFinal = gameStatus === 'final';

  // Detect upset
  const chalkSeed = teams.filter(Boolean).reduce((min, t) => Math.min(min, t!.seed), 99);
  const hasUpset = !isSingle && advancer && advancer.seed > chalkSeed;

  return (
    <div
      className="mb-2 rounded-[var(--radius-sm)] p-2"
      style={{
        background: 'var(--surface-2)',
        border: hasUpset
          ? '1px solid rgba(255,179,0,0.27)'
          : '1px solid var(--border-subtle)',
      }}
    >
      {/* Header row */}
      <div className="flex justify-between mb-1.5">
        <span className="font-[family-name:var(--font-mono)] text-[0.55rem] tracking-[0.1em] font-semibold text-[var(--text-secondary)]">
          {isSingle ? label : `GAME ${gameIdx + 1}`}
        </span>
        <div className="flex items-center gap-1.5">
          {hasUpset && (
            <span className="badge" style={{ background: 'var(--color-warning-subtle)', color: 'var(--color-warning)', fontSize: '0.5rem', padding: '2px 6px' }}>
              UPSET
            </span>
          )}
          {isFinal && (
            <span className="badge" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontSize: '0.5rem', padding: '2px 6px' }}>
              FINAL
            </span>
          )}
        </div>
      </div>

      {/* Team rows */}
      {teams.map(team => {
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
          <div key={team.id} className="flex items-center gap-1.5 mb-1">
            {/* Team name button (predict winner) */}
            <button
              onClick={() => {
                if (!isSingle && !isLocked) onToggleAdvancer(region, round, gameIdx, team);
              }}
              disabled={isSingle || isLocked}
              className="flex-1 flex items-center gap-2 py-1.5 px-2.5 rounded-[var(--radius-sm)] text-left transition-all duration-150"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: isAdv ? 700 : 500,
                fontSize: '0.9rem',
                textTransform: 'uppercase',
                background: isPick
                  ? 'var(--color-orange-subtle)'
                  : isAdv && !isSingle
                    ? 'var(--surface-3)'
                    : 'transparent',
                color: isPick
                  ? 'var(--color-orange)'
                  : isUsed && !isPick
                    ? 'var(--text-tertiary)'
                    : 'var(--text-primary)',
                border: isPick
                  ? '1.5px solid var(--color-orange)'
                  : isAdv && !isSingle
                    ? '1px solid var(--border-default)'
                    : '1px solid transparent',
                cursor: isSingle || isLocked ? 'default' : 'pointer',
                textDecoration: isUsed && !isPick ? 'line-through' : 'none',
                opacity: isUsed && !isPick ? 0.35 : 1,
              }}
            >
              <span className="font-[family-name:var(--font-display)] font-bold text-[0.75rem] text-[var(--text-secondary)] min-w-[18px] text-center">
                {team.seed}
              </span>
              <span className="truncate">{team.abbreviation || team.name}</span>
              {score !== null && (
                <span className="font-[family-name:var(--font-mono)] text-[0.75rem] ml-auto" style={{ color: isWinner ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {score}
                </span>
              )}
              {isAdv && !isSingle && !isFinal && (
                <span className="font-[family-name:var(--font-mono)] text-[0.55rem] text-[var(--color-alive)] ml-auto">✓</span>
              )}
              {isWinner && (
                <span className="font-[family-name:var(--font-mono)] text-[0.55rem] text-[var(--color-alive)] ml-1">W</span>
              )}
              {isLoser && (
                <span className="font-[family-name:var(--font-mono)] text-[0.55rem] text-[var(--text-secondary)] ml-1">L</span>
              )}
            </button>

            {/* Pin pick button */}
            {!isFinal && (
              <button
                onClick={() => {
                  if (canPick) onHandlePick(dayId, team, region, round, gameIdx);
                }}
                disabled={!canPick}
                className="w-7 h-7 rounded-[var(--radius-sm)] shrink-0 flex items-center justify-center transition-all duration-150"
                style={{
                  background: isPick ? 'var(--color-orange-subtle)' : 'transparent',
                  border: isPick ? '1.5px solid var(--color-orange)' : '1.5px solid var(--border-default)',
                  color: isPick ? 'var(--color-orange)' : canPick ? 'var(--text-secondary)' : 'var(--text-disabled)',
                  cursor: canPick ? 'pointer' : 'not-allowed',
                  opacity: canPick ? 1 : 0.25,
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.75rem',
                  boxShadow: isPick ? '0 0 0 1px var(--color-orange), 0 0 12px rgba(255,87,34,0.2)' : 'none',
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

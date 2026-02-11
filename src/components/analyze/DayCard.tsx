'use client';

import { TeamInfo } from '@/types/picks';
import { PlannerDay, PlannerPick, ROUND_COLORS } from '@/lib/bracket';
import MatchupCard from './MatchupCard';

export interface MatchupInfo {
  gameIdx: number;
  teams: (TeamInfo | null)[];
  label: string;
  round: string;
}

interface DayCardProps {
  day: PlannerDay;
  dayIndex: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  pick: PlannerPick | undefined;
  regions: string[];
  getMatchupsForRegion: (region: string) => MatchupInfo[];
  advancers: Record<string, TeamInfo>;
  usedTeamIds: Set<string>;
  lockedAdvancerKeys: Set<string>;
  lockedDayIds: Set<string>;
  e8Swapped: boolean;
  onToggleE8Swap: () => void;
  onToggleAdvancer: (region: string, round: string, gameIdx: number, team: TeamInfo) => void;
  onHandlePick: (dayId: string, team: TeamInfo, region: string, round: string, gameIdx: number) => void;
  gameStatuses?: Record<string, { status: string; team1Score: number | null; team2Score: number | null; winnerId: string | null; gameDateTime: string | null }>;
  isHighlighted?: boolean;
}

export default function DayCard({
  day,
  dayIndex,
  isExpanded,
  onToggleExpand,
  pick,
  regions,
  getMatchupsForRegion,
  advancers,
  usedTeamIds,
  lockedAdvancerKeys,
  lockedDayIds,
  e8Swapped,
  onToggleE8Swap,
  onToggleAdvancer,
  onHandlePick,
  gameStatuses,
  isHighlighted,
}: DayCardProps) {
  const rc = ROUND_COLORS[day.roundCode] || 'var(--text-tertiary)';

  return (
    <div
      id={`day-${day.id}`}
      className="transition-all duration-250"
      style={{
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background: isExpanded ? 'var(--surface-2)' : 'var(--surface-0)',
        border: pick
          ? '1px solid var(--border-accent)'
          : `1px solid ${isExpanded ? 'var(--border-default)' : 'var(--border-subtle)'}`,
        boxShadow: pick ? '0 0 20px rgba(255,87,34,0.08)' : isHighlighted ? `0 0 0 2px var(--color-orange), 0 0 20px rgba(255,87,34,0.15)` : 'none',
        zIndex: isHighlighted ? 400 : 'auto',
        position: 'relative',
      }}
    >
      {/* Header — always visible, two-row layout */}
      <div onClick={onToggleExpand} className="py-3 px-4 sm:px-5 cursor-pointer">
        {/* Row 1: Day number + date + region pills */}
        <div className="flex items-center gap-2.5">
          <div
            className="font-[family-name:var(--font-display)] font-bold text-[1rem] min-w-7 text-center"
            style={{ color: rc }}
          >
            {dayIndex + 1}
          </div>
          <div className="min-w-0">
            <div className="font-[family-name:var(--font-display)] font-semibold text-[0.95rem] uppercase text-[var(--text-primary)]">
              {day.date}
            </div>
            <div className="font-[family-name:var(--font-mono)] text-[0.6rem] tracking-[0.12em] mt-0.5" style={{ color: rc }}>
              {day.label}
            </div>
          </div>
          {day.roundCode === 'E8' && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleE8Swap(); }}
              className="font-[family-name:var(--font-mono)] text-[0.6rem] cursor-pointer px-1.5 py-0.5 rounded-[4px] ml-auto"
              style={{
                background: 'none',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
              }}
            >
              ⇄
            </button>
          )}
        </div>

        {/* Row 2: Pick display + chevron */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 min-w-0">
            {pick ? (
              <div
                className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] py-1.5 px-3"
                style={{
                  background: 'var(--color-orange-subtle)',
                  border: '1.5px solid var(--color-orange)',
                  boxShadow: '0 0 0 1px rgba(255,87,34,0.15), 0 0 20px rgba(255,87,34,0.12)',
                }}
              >
                <span className="font-[family-name:var(--font-display)] font-bold text-[0.6rem] text-[var(--text-secondary)] min-w-4 text-center">
                  {pick.team.seed}
                </span>
                <span className="font-[family-name:var(--font-display)] font-bold text-[0.9rem] uppercase text-[var(--color-orange)] truncate">
                  {pick.team.abbreviation || pick.team.name}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[0.5rem] text-[var(--text-secondary)] tracking-[0.1em]">
                  {pick.region.toUpperCase()}
                </span>
                {pick.isSubmitted && <span className="text-[0.45rem]">🔒</span>}
              </div>
            ) : (
              <span className="font-[family-name:var(--font-body)] text-[0.85rem] text-[var(--text-secondary)]">
                No pick set
              </span>
            )}
          </div>
          <span className="text-[var(--text-secondary)] text-[0.7rem]">
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Expanded content — matchups by region */}
      {isExpanded && (
        <div
          className={`px-5 pb-5 pt-1 gap-2.5 grid ${
            regions.length <= 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          }`}
        >
          {regions.map(region => {
            const matchups = getMatchupsForRegion(region);
            return (
              <div
                key={region}
                className="rounded-[var(--radius-md)] p-3"
                style={{
                  background: 'var(--surface-0)',
                  border: '1px solid var(--border-subtle)',
                  borderTop: '3px solid var(--color-orange)',
                }}
              >
                <div className="flex justify-between mb-2.5">
                  <span className="font-[family-name:var(--font-display)] font-semibold text-[0.85rem] uppercase text-[var(--text-primary)]">
                    {region}
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[0.55rem] tracking-[0.1em] text-[var(--text-secondary)]">
                    {matchups.length} GAME{matchups.length !== 1 ? 'S' : ''}
                  </span>
                </div>
                {matchups.map((mu, i) => (
                  <MatchupCard
                    key={i}
                    matchup={mu}
                    region={region}
                    dayId={day.id}
                    dayPick={pick}
                    advancerKey={`${region}_${mu.round}_${mu.gameIdx}`}
                    advancer={advancers[`${region}_${mu.round}_${mu.gameIdx}`]}
                    usedTeamIds={usedTeamIds}
                    lockedAdvancerKeys={lockedAdvancerKeys}
                    lockedDayIds={lockedDayIds}
                    onToggleAdvancer={onToggleAdvancer}
                    onHandlePick={onHandlePick}
                    gameStatus={gameStatuses?.[`${region}_${mu.round}_${mu.gameIdx}`]?.status as 'scheduled' | 'in_progress' | 'final' | undefined}
                    gameScore={gameStatuses?.[`${region}_${mu.round}_${mu.gameIdx}`]}
                    gameDateTime={gameStatuses?.[`${region}_${mu.round}_${mu.gameIdx}`]?.gameDateTime}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  gameStatuses?: Record<string, { status: string; team1Score: number | null; team2Score: number | null; winnerId: string | null }>;
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
      {/* Header — always visible */}
      <div
        onClick={onToggleExpand}
        className="flex items-center py-3 px-5 cursor-pointer gap-3.5"
      >
        {/* Day number */}
        <div
          className="font-[family-name:var(--font-display)] font-bold text-[0.9rem] min-w-7 text-center"
          style={{ color: rc }}
        >
          {dayIndex + 1}
        </div>
        <div className="w-px h-8" style={{ background: 'var(--border-default)' }} />

        {/* Date + label */}
        <div className="min-w-[110px]">
          <div className="font-[family-name:var(--font-display)] font-semibold text-[0.95rem] uppercase">
            {day.date}
          </div>
          <div className="font-[family-name:var(--font-mono)] text-[0.55rem] tracking-[0.15em] mt-0.5" style={{ color: rc }}>
            {day.label}
            {day.half && (
              <span className="text-[var(--text-tertiary)]"> · {day.half === 'A' ? 'TOP' : 'BTM'} HALF</span>
            )}
          </div>
        </div>

        {/* Region pills */}
        <div className="flex gap-1 items-center">
          {regions.map(r => (
            <span
              key={r}
              className="badge"
              style={{
                background: 'var(--surface-3)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
                fontSize: '0.5rem',
                padding: '3px 7px',
              }}
            >
              {r.slice(0, 2)}
            </span>
          ))}
          {day.roundCode === 'E8' && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleE8Swap(); }}
              className="font-[family-name:var(--font-mono)] text-[0.6rem] cursor-pointer px-1.5 py-0.5 rounded-[4px]"
              style={{
                background: 'none',
                border: '1px solid var(--border-default)',
                color: 'var(--text-tertiary)',
              }}
            >
              ⇄
            </button>
          )}
        </div>

        {/* Current pick display */}
        <div className="flex-1">
          {pick ? (
            <div
              className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] py-1.5 px-3.5"
              style={{
                background: 'var(--color-orange-subtle)',
                border: '1.5px solid var(--color-orange)',
                boxShadow: '0 0 0 1px rgba(255,87,34,0.15), 0 0 20px rgba(255,87,34,0.12)',
              }}
            >
              <span className="font-[family-name:var(--font-display)] font-bold text-[0.55rem] text-[var(--text-tertiary)] min-w-4 text-center">
                {pick.team.seed}
              </span>
              <span className="font-[family-name:var(--font-display)] font-bold text-[0.95rem] uppercase text-[var(--color-orange)]">
                {pick.team.abbreviation || pick.team.name}
              </span>
              <span className="font-[family-name:var(--font-mono)] text-[0.5rem] text-[var(--text-tertiary)] tracking-[0.1em]">
                {pick.region.toUpperCase()}
              </span>
              {pick.isSubmitted && (
                <span className="font-[family-name:var(--font-mono)] text-[0.45rem] text-[var(--text-tertiary)] tracking-[0.1em]">
                  🔒
                </span>
              )}
            </div>
          ) : (
            <span className="font-[family-name:var(--font-body)] text-[0.85rem] text-[var(--text-disabled)]">
              No pick set
            </span>
          )}
        </div>

        {/* Chevron */}
        <span className="text-[var(--text-tertiary)] text-[0.7rem]">
          {isExpanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded content — matchups by region */}
      {isExpanded && (
        <div
          className="px-5 pb-5 pt-1 gap-2.5"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(regions.length, 4)}, 1fr)`,
          }}
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
                  <span className="font-[family-name:var(--font-display)] font-semibold text-[0.85rem] uppercase">
                    {region}
                  </span>
                  <span className="label text-[0.5rem]">
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

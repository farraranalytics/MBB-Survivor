'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  getPoolPlayer,
  getActiveRound,
  getPickDeadline,
  getPickableTeams,
  getPlayerPick,
  getPoolStandings,
} from '@/lib/picks';
import { getTeamInventory, getOpponentInventories, getSeedWinProbability } from '@/lib/analyze';
import { supabase } from '@/lib/supabase/client';
import type { PickableTeam, PickDeadline, Round, Pick, PoolStandings } from '@/types/picks';
import type { InventoryTeam, OpponentInventory } from '@/lib/analyze';
import { formatET } from '@/lib/timezone';

// ─── Loading Skeleton ────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-24">
      <div className="max-w-lg mx-auto px-5 py-4 space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-4 animate-pulse">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-4 w-32 bg-[#1B2A3D] rounded mb-1.5" />
                <div className="h-3 w-24 bg-[#1B2A3D] rounded" />
              </div>
              <div className="h-4 w-4 bg-[#1B2A3D] rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Error State ─────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-24">
      <div className="max-w-lg mx-auto px-5 py-6">
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-8 text-center">
          <div className="w-12 h-12 bg-[rgba(239,83,80,0.1)] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#EF5350]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-[#E8E6E1] font-semibold mb-1" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Analysis Unavailable</p>
          <p className="text-[#9BA3AE] text-sm mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>{message}</p>
          <button onClick={onRetry} className="btn-orange px-5 py-2.5 rounded-[12px] text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Collapsible Module Wrapper ──────────────────────────────────

function ModuleSection({
  title,
  subtitle,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px] overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left">
        <div className="min-w-0 flex-1 mr-3">
          <h2 className="text-sm font-bold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-[#9BA3AE] mt-0.5 truncate" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {subtitle}
            </p>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-[#9BA3AE] flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-[rgba(255,255,255,0.05)]">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Win Probability Bar ─────────────────────────────────────────

function WinProbBar({ probability, isTop }: { probability: number; isTop: boolean }) {
  const pct = Math.round(probability * 100);
  let color: string;
  if (pct >= 80) color = '#4CAF50';
  else if (pct >= 60) color = '#FFB300';
  else color = '#EF5350';

  return (
    <div className="flex items-center gap-2">
      <span
        className="text-xs font-bold w-9 text-right flex-shrink-0"
        style={{ fontFamily: "'Space Mono', monospace", color }}
      >
        {pct}%
      </span>
      <div className="flex-1 h-2 bg-[#1B2A3D] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: isTop ? '#FF5722' : 'rgba(138,134,148,0.4)' }}
        />
      </div>
    </div>
  );
}

// ─── Module 1: Today's Games ─────────────────────────────────────

function TodaysGamesModule({
  games,
  round,
  existingPick,
}: {
  games: PickableTeam[];
  round: Round | null;
  existingPick: Pick | null;
}) {
  if (!round || games.length === 0) {
    return (
      <div className="pt-3">
        <p className="text-sm text-[#9BA3AE] text-center py-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          No games scheduled. Check back on game day.
        </p>
      </div>
    );
  }

  // Group by game_id to get matchups
  const matchups = new Map<string, { team1: PickableTeam; team2: PickableTeam }>();
  for (const team of games) {
    if (!matchups.has(team.game_id)) {
      matchups.set(team.game_id, { team1: team, team2: team });
    } else {
      matchups.get(team.game_id)!.team2 = team;
    }
  }

  return (
    <div className="pt-3 space-y-3">
      {Array.from(matchups.values()).map(({ team1, team2 }) => {
        const prob1 = getSeedWinProbability(team1.seed, team2.seed);
        const prob2 = 1 - prob1;
        const isFav1 = prob1 >= prob2;
        const userPickedTeam1 = existingPick?.team_id === team1.id;
        const userPickedTeam2 = existingPick?.team_id === team2.id;
        const gameTime = formatET(team1.game_datetime);

        return (
          <div key={team1.game_id} className="bg-[#1B2A3D] rounded-[8px] p-3 space-y-2">
            {/* Team 1 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`text-sm ${isFav1 ? 'font-bold text-[#E8E6E1]' : 'text-[#9BA3AE]'}`} style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    ({team1.seed}) {team1.name}
                  </span>
                  {userPickedTeam1 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[rgba(255,87,34,0.15)] text-[#FF5722]" style={{ fontFamily: "'Space Mono', monospace" }}>
                      YOUR PICK
                    </span>
                  )}
                </div>
              </div>
              <WinProbBar probability={prob1} isTop={isFav1} />
            </div>

            <p className="text-[10px] text-[#9BA3AE] text-center uppercase tracking-widest" style={{ fontFamily: "'Space Mono', monospace" }}>vs</p>

            {/* Team 2 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`text-sm ${!isFav1 ? 'font-bold text-[#E8E6E1]' : 'text-[#9BA3AE]'}`} style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    ({team2.seed}) {team2.name}
                  </span>
                  {userPickedTeam2 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[rgba(255,87,34,0.15)] text-[#FF5722]" style={{ fontFamily: "'Space Mono', monospace" }}>
                      YOUR PICK
                    </span>
                  )}
                </div>
              </div>
              <WinProbBar probability={prob2} isTop={!isFav1} />
            </div>

            <p className="text-[10px] text-[#9BA3AE] text-center" style={{ fontFamily: "'Space Mono', monospace" }}>
              {gameTime}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Module 2: Team Inventory (64-Team Grid) ────────────────────

function TeamInventoryModule({ inventory, todayPickTeamId }: { inventory: InventoryTeam[]; todayPickTeamId?: string }) {
  const available = inventory.filter(t => t.status === 'available');
  const total = inventory.length;

  return (
    <div className="pt-3">
      {/* Header */}
      <p className="label mb-3">
        Your Team Pool &mdash;{' '}
        <span className="text-[#E8E6E1]">{available.length}</span>{' '}
        of {total} available
      </p>

      {/* Grid */}
      <div className="grid grid-cols-5 gap-1.5">
        {inventory.map(team => {
          const isToday = team.id === todayPickTeamId;
          const isAvailable = team.status === 'available';
          const isUsed = team.status === 'used';
          const isOut = team.status === 'eliminated';

          let cellBg = 'bg-[#1B2A3D]';
          let textColor = 'text-[#E8E6E1]';
          let border = 'border border-transparent';
          let opacity = '';

          if (isToday) {
            cellBg = 'bg-[rgba(255,87,34,0.12)]';
            textColor = 'text-[#FF5722]';
            border = 'border border-[#FF5722]';
          } else if (isUsed) {
            cellBg = 'bg-[#111827]';
            textColor = 'text-[#5F6B7A]';
          } else if (isOut) {
            cellBg = 'bg-[#111827]';
            textColor = 'text-[#5F6B7A]';
            opacity = 'opacity-40';
          }

          return (
            <div
              key={team.id}
              className={`${cellBg} ${border} ${opacity} rounded-[6px] px-1 py-2 text-center`}
              title={`(${team.seed}) ${team.name} · ${team.region}${isToday ? ' · TODAY' : isUsed ? ' · USED' : isOut ? ' · OUT' : ''}`}
            >
              <span
                className={`text-[11px] font-bold ${textColor} block leading-tight`}
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                {team.abbreviation}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[10px] text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[3px] bg-[#1B2A3D]" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[3px] bg-[rgba(255,87,34,0.12)] border border-[#FF5722]" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[3px] bg-[#111827]" />
          <span>Used</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[3px] bg-[#111827] opacity-40" />
          <span>Out</span>
        </div>
      </div>
    </div>
  );
}

// ─── Module 3: Opponent X-Ray ────────────────────────────────────

function OpponentXrayModule({
  opponents,
  inventory,
  currentPoolPlayerId,
}: {
  opponents: OpponentInventory[];
  inventory: InventoryTeam[];
  currentPoolPlayerId: string;
}) {
  const alivePlayers = opponents.filter(o => !o.is_eliminated);
  const availableTeams = inventory.filter(t => t.status === 'available');

  if (alivePlayers.length <= 1) {
    return (
      <div className="pt-3">
        <p className="text-sm text-[#9BA3AE] text-center py-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Not enough opponents for comparison.
        </p>
      </div>
    );
  }

  // Limit display to first 8 opponents
  const maxDisplay = 8;
  const displayPlayers = alivePlayers.slice(0, maxDisplay);
  const hiddenCount = alivePlayers.length - displayPlayers.length;

  // Current user entry
  const currentUser = alivePlayers.find(p => p.pool_player_id === currentPoolPlayerId);
  const othersToShow = displayPlayers.filter(p => p.pool_player_id !== currentPoolPlayerId);

  // Build team availability matrix
  const teamMatrix = availableTeams.map(team => {
    const youHaveIt = currentUser ? !currentUser.used_team_ids.includes(team.id) : false;
    const opponentAvailability = othersToShow.map(opp => !opp.used_team_ids.includes(team.id));
    const totalWithIt = (youHaveIt ? 1 : 0) + opponentAvailability.filter(Boolean).length;

    return { team, youHaveIt, opponentAvailability, totalWithIt };
  });

  // Insights
  const uniqueToYou = teamMatrix.filter(m => m.youHaveIt && m.totalWithIt === 1);
  const highCollision = teamMatrix.filter(m => m.youHaveIt && m.totalWithIt >= alivePlayers.length * 0.8);

  return (
    <div className="pt-3">
      <p className="text-xs text-[#9BA3AE] mb-3" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        {alivePlayers.length} survivors
      </p>

      {/* Scrollable table */}
      <div className="overflow-x-auto -mx-4 px-4 pb-2">
        <table className="w-full text-xs" style={{ fontFamily: "'Space Mono', monospace" }}>
          <thead>
            <tr className="text-[#9BA3AE]">
              <th className="text-left py-1 pr-3 sticky left-0 bg-[#111827] z-10 font-normal">Team</th>
              <th className="text-center py-1 px-1.5 font-normal whitespace-nowrap">You</th>
              {othersToShow.map(opp => (
                <th key={opp.pool_player_id} className="text-center py-1 px-1.5 font-normal whitespace-nowrap max-w-[48px] truncate">
                  {opp.display_name.split(' ')[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teamMatrix.slice(0, 20).map(({ team, youHaveIt, opponentAvailability }) => (
              <tr key={team.id} className="border-t border-[rgba(255,255,255,0.03)]">
                <td className="py-1 pr-3 sticky left-0 bg-[#111827] z-10 text-[#E8E6E1] whitespace-nowrap" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px' }}>
                  ({team.seed}) {team.abbreviation}
                </td>
                <td className="text-center py-1 px-1.5">
                  <span className={youHaveIt ? 'text-[#4CAF50]' : 'text-[#9BA3AE]'}>{youHaveIt ? '✓' : '✗'}</span>
                </td>
                {opponentAvailability.map((has, i) => (
                  <td key={i} className="text-center py-1 px-1.5">
                    <span className={has ? 'text-[#4CAF50]' : 'text-[#9BA3AE]'}>{has ? '✓' : '✗'}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {availableTeams.length > 20 && (
          <p className="text-[10px] text-[#9BA3AE] text-center mt-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Showing top 20 of {availableTeams.length} available teams
          </p>
        )}
      </div>

      {hiddenCount > 0 && (
        <p className="text-[10px] text-[#9BA3AE] mt-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          and {hiddenCount} more {hiddenCount === 1 ? 'player' : 'players'}
        </p>
      )}

      {/* Insights */}
      {(uniqueToYou.length > 0 || highCollision.length > 0) && (
        <div className="mt-3 space-y-1.5">
          {uniqueToYou.slice(0, 3).map(({ team }) => (
            <p key={team.id} className="text-xs text-[#4CAF50]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              ★ ({team.seed}) {team.name} — only you have it
            </p>
          ))}
          {highCollision.slice(0, 3).map(({ team, totalWithIt }) => (
            <p key={team.id} className="text-xs text-[#FFB300]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              ⚠ ({team.seed}) {team.name} — {totalWithIt}/{alivePlayers.length} survivors have it
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Module 4: Path Simulator (Mocked) ──────────────────────────

function PathSimulatorModule() {
  const stages = [
    { label: 'Survive to Sweet 16', value: '—%' },
    { label: 'Survive to Elite 8', value: '—%' },
    { label: 'Survive to Final 4', value: '—%' },
    { label: 'Win the pool', value: '—%' },
  ];

  return (
    <div className="pt-3 space-y-3">
      {stages.map(stage => (
        <div key={stage.label}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-[#E8E6E1]" style={{ fontFamily: "'DM Sans', sans-serif" }}>{stage.label}</span>
            <span className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'Space Mono', monospace" }}>{stage.value}</span>
          </div>
          <div className="h-2 bg-[#1B2A3D] rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: '0%', backgroundColor: '#FF5722', borderStyle: 'dashed' }} />
          </div>
        </div>
      ))}
      <p className="text-xs text-[#9BA3AE] text-center pt-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        Coming soon — survival odds based on team win probabilities and remaining schedule.
      </p>
    </div>
  );
}

// ─── Module 5: Pick Optimizer ────────────────────────────────────

function PickOptimizerModule({
  games,
  inventory,
  opponents,
  existingPick,
  deadline,
  isEliminated,
}: {
  games: PickableTeam[];
  inventory: InventoryTeam[];
  opponents: OpponentInventory[];
  existingPick: Pick | null;
  deadline: PickDeadline | null;
  isEliminated: boolean;
}) {
  // Show message if eliminated or deadline passed
  if (isEliminated) {
    return (
      <div className="pt-3">
        <p className="text-sm text-[#9BA3AE] text-center py-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          You&apos;ve been eliminated — no pick needed.
        </p>
      </div>
    );
  }
  if (deadline?.is_expired) {
    return (
      <div className="pt-3">
        <p className="text-sm text-[#9BA3AE] text-center py-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Picks are locked for this round.
        </p>
      </div>
    );
  }

  if (games.length === 0) return null;

  const availableIds = new Set(inventory.filter(t => t.status === 'available').map(t => t.id));
  const playableToday = games.filter(t => availableIds.has(t.id) && !t.already_used);

  if (playableToday.length === 0) {
    return (
      <div className="pt-3">
        <p className="text-sm text-[#9BA3AE] text-center py-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          No available teams playing today.
        </p>
      </div>
    );
  }

  const alivePlayers = opponents.filter(o => !o.is_eliminated);
  const totalOpponents = alivePlayers.length;

  // Compute scored recommendations
  const scored = playableToday.map(team => {
    const winProb = getSeedWinProbability(team.seed, team.opponent.seed);
    const opponentsWithTeam = alivePlayers.filter(o => !o.used_team_ids.includes(team.id)).length;
    const uniqueness = totalOpponents > 0 ? 1 - (opponentsWithTeam / totalOpponents) : 0;
    const smartScore = winProb * (1 - (totalOpponents > 0 ? opponentsWithTeam / totalOpponents : 0));

    return { team, winProb, uniqueness, smartScore, opponentsWithTeam };
  });

  // Best Pick: highest win prob
  const bestPick = [...scored].sort((a, b) => b.winProb - a.winProb)[0];
  // Smart Pick: best combined score
  const smartPick = [...scored].sort((a, b) => b.smartScore - a.smartScore)[0];
  // Contrarian: highest uniqueness with >50% win prob
  const contrarianCandidates = scored.filter(s => s.winProb > 0.5);
  const contrarianPick = contrarianCandidates.length > 0
    ? [...contrarianCandidates].sort((a, b) => b.uniqueness - a.uniqueness)[0]
    : null;

  const hasPicked = !!existingPick;

  function RecommendationCard({ label, emoji, team, winProb, detail, dimmed }: {
    label: string; emoji: string; team: PickableTeam; winProb: number; detail: string; dimmed: boolean;
  }) {
    const pct = Math.round(winProb * 100);
    let probColor: string;
    if (pct >= 80) probColor = '#4CAF50';
    else if (pct >= 60) probColor = '#FFB300';
    else probColor = '#EF5350';

    return (
      <div className={`bg-[#1B2A3D] rounded-[8px] p-3 ${dimmed ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">{emoji}</span>
          <span className="text-xs font-bold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>{label}</span>
          {dimmed && <span className="text-[9px] text-[#9BA3AE] ml-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>For next time</span>}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#E8E6E1] font-medium" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            ({team.seed}) {team.name}
          </span>
          <span className="text-sm font-bold" style={{ fontFamily: "'Space Mono', monospace", color: probColor }}>
            {pct}%
          </span>
        </div>
        <p className="text-[10px] text-[#9BA3AE] mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          vs ({team.opponent.seed}) {team.opponent.name} · {detail}
        </p>
      </div>
    );
  }

  return (
    <div className="pt-3 space-y-2.5">
      {/* Existing pick banner */}
      {hasPicked && existingPick?.team && (
        <div className="bg-[rgba(255,87,34,0.08)] border border-[rgba(255,87,34,0.2)] rounded-[8px] p-3 mb-1">
          <p className="text-sm text-[#E8E6E1] text-center" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            You picked <strong className="text-[#FF5722]">({existingPick.team.seed}) {existingPick.team.name}</strong>
          </p>
        </div>
      )}

      <RecommendationCard
        label="Best Pick" emoji="🏆" team={bestPick.team} winProb={bestPick.winProb}
        detail="Highest win probability" dimmed={hasPicked}
      />
      {smartPick.team.id !== bestPick.team.id && (
        <RecommendationCard
          label="Smart Pick" emoji="🎯" team={smartPick.team} winProb={smartPick.winProb}
          detail={`${smartPick.opponentsWithTeam}/${totalOpponents} opponents also have it`} dimmed={hasPicked}
        />
      )}
      {contrarianPick && contrarianPick.team.id !== bestPick.team.id && contrarianPick.team.id !== smartPick.team.id && (
        <RecommendationCard
          label="Contrarian Pick" emoji="🎲" team={contrarianPick.team} winProb={contrarianPick.winProb}
          detail={`Only ${contrarianPick.opponentsWithTeam}/${totalOpponents} opponents have it`} dimmed={hasPicked}
        />
      )}

      <p className="text-[10px] text-[#9BA3AE] text-center pt-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        ⚠ Strategy analysis, not a guarantee. Trust your gut.
      </p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function PoolAnalyzePage() {
  const params = useParams();
  const { user } = useAuth();
  const poolId = params.id as string;

  const [poolPlayerId, setPoolPlayerId] = useState<string | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [deadline, setDeadline] = useState<PickDeadline | null>(null);
  const [games, setGames] = useState<PickableTeam[]>([]);
  const [existingPick, setExistingPick] = useState<Pick | null>(null);
  const [inventory, setInventory] = useState<InventoryTeam[]>([]);
  const [opponents, setOpponents] = useState<OpponentInventory[]>([]);
  const [standings, setStandings] = useState<PoolStandings | null>(null);
  const [isEliminated, setIsEliminated] = useState(false);
  const [eliminationRoundName, setEliminationRoundName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    todaysGames: true,
    pickOptimizer: true,
    teamInventory: false,
    opponentXray: false,
    pathSimulator: false,
  });

  const toggleModule = (id: string) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const loadData = useCallback(async () => {
    if (!user || !poolId) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Pool player
      const player = await getPoolPlayer(poolId, user.id);
      if (!player) {
        setError('Join a pool to see analysis.');
        setLoading(false);
        return;
      }
      setPoolPlayerId(player.id);
      setIsEliminated(player.is_eliminated);

      if (player.is_eliminated && player.elimination_round_id) {
        const { data: elimRound } = await supabase
          .from('rounds')
          .select('name')
          .eq('id', player.elimination_round_id)
          .single();
        if (elimRound) setEliminationRoundName(elimRound.name);
      }

      // 2. Active round
      const activeRound = await getActiveRound();
      setRound(activeRound);

      // Parallel fetches
      const promises: Promise<void>[] = [];

      // 3-5. If active round: games, deadline, existing pick
      let deadlineInfo: PickDeadline | null = null;
      if (activeRound) {
        deadlineInfo = await getPickDeadline(activeRound.id);
        setDeadline(deadlineInfo);
        promises.push(
          getPickableTeams(player.id, activeRound.id).then(g => setGames(g)),
          getPlayerPick(player.id, activeRound.id).then(p => setExistingPick(p)),
        );
      }

      // 6-7. Exclude current round picks from inventory & opponent data before deadline
      const hideCurrentRound = activeRound && deadlineInfo && !deadlineInfo.is_expired
        ? activeRound.id : undefined;

      // 6. Team inventory
      promises.push(getTeamInventory(player.id, hideCurrentRound).then(inv => setInventory(inv)));

      // 7. Opponent inventories
      promises.push(getOpponentInventories(poolId, player.id, hideCurrentRound).then(opp => setOpponents(opp)));

      // 8. Pool standings
      promises.push(getPoolStandings(poolId, user.id).then(s => setStandings(s)));

      await Promise.all(promises);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis data.');
    } finally {
      setLoading(false);
    }
  }, [user, poolId]);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadData();
    }
  }, [loadData]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  // Summary strings for collapsed modules
  const available = inventory.filter(t => t.status === 'available').length;
  const used = inventory.filter(t => t.status === 'used').length;
  const eliminated = inventory.filter(t => t.status === 'eliminated').length;
  const inventorySubtitle = `${available} available · ${used} used · ${eliminated} eliminated`;

  const uniqueTeams = (() => {
    if (!poolPlayerId || opponents.length <= 1) return 0;
    const currentUser = opponents.find(o => o.pool_player_id === poolPlayerId);
    if (!currentUser) return 0;
    const availableTeamIds = new Set(inventory.filter(t => t.status === 'available').map(t => t.id));
    let count = 0;
    for (const teamId of Array.from(availableTeamIds)) {
      if (currentUser.used_team_ids.includes(teamId)) continue;
      const othersHaveIt = opponents.filter(o => o.pool_player_id !== poolPlayerId && !o.used_team_ids.includes(teamId)).length;
      if (othersHaveIt === 0) count++;
    }
    return count;
  })();
  const xraySubtitle = `${uniqueTeams} team${uniqueTeams !== 1 ? 's' : ''} only you have · ${standings?.alive_players || 0} survivors`;

  // Best pick for optimizer subtitle
  const availableIds = new Set(inventory.filter(t => t.status === 'available').map(t => t.id));
  const playableToday = games.filter(t => availableIds.has(t.id) && !t.already_used);
  let optimizerSubtitle = 'No recommendations';
  if (playableToday.length > 0) {
    const best = playableToday.reduce((a, b) => {
      const probA = getSeedWinProbability(a.seed, a.opponent.seed);
      const probB = getSeedWinProbability(b.seed, b.opponent.seed);
      return probA >= probB ? a : b;
    });
    const bestProb = Math.round(getSeedWinProbability(best.seed, best.opponent.seed) * 100);
    optimizerSubtitle = `Top pick: (${best.seed}) ${best.name} — ${bestProb}% win`;
  }

  // Show/hide Module 5 based on state
  const showOptimizer = !!round;
  const gamesSubtitle = round ? `${games.length / 2} matchups · ${round.name}` : 'No games scheduled';

  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-24">
      <div className="max-w-lg mx-auto px-5 py-4 space-y-3">
        {/* Spectating banner for eliminated users */}
        {isEliminated && (
          <div className="flex items-center justify-center gap-2 bg-[rgba(239,83,80,0.06)] border border-[rgba(239,83,80,0.12)] rounded-[10px] px-4 py-2.5">
            <span className="text-xs">☠️</span>
            <p className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              You&apos;re spectating{eliminationRoundName ? ` · Eliminated in ${eliminationRoundName}` : ''}
            </p>
          </div>
        )}

        {/* Module 1: Today's Games */}
        <ModuleSection
          title="Today's Games"
          subtitle={gamesSubtitle}
          expanded={expandedModules.todaysGames}
          onToggle={() => toggleModule('todaysGames')}
        >
          <TodaysGamesModule games={games} round={round} existingPick={existingPick} />
        </ModuleSection>

        {/* Module 5: Pick Optimizer */}
        {showOptimizer && (
          <ModuleSection
            title="Pick Optimizer"
            subtitle={optimizerSubtitle}
            expanded={expandedModules.pickOptimizer}
            onToggle={() => toggleModule('pickOptimizer')}
          >
            <PickOptimizerModule
              games={games}
              inventory={inventory}
              opponents={opponents}
              existingPick={existingPick}
              deadline={deadline}
              isEliminated={isEliminated}
            />
          </ModuleSection>
        )}

        {/* Module 2: Team Inventory */}
        <ModuleSection
          title="64-Team Inventory"
          subtitle={inventorySubtitle}
          expanded={expandedModules.teamInventory}
          onToggle={() => toggleModule('teamInventory')}
        >
          <TeamInventoryModule inventory={inventory} todayPickTeamId={existingPick?.team_id} />
        </ModuleSection>

        {/* Module 3: Opponent X-Ray */}
        <ModuleSection
          title="Opponent X-Ray"
          subtitle={xraySubtitle}
          expanded={expandedModules.opponentXray}
          onToggle={() => toggleModule('opponentXray')}
        >
          {poolPlayerId ? (
            <OpponentXrayModule opponents={opponents} inventory={inventory} currentPoolPlayerId={poolPlayerId} />
          ) : (
            <div className="pt-3">
              <p className="text-sm text-[#9BA3AE] text-center py-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>No data available.</p>
            </div>
          )}
        </ModuleSection>

        {/* Module 4: Path Simulator */}
        <ModuleSection
          title="Path to Victory"
          subtitle="Coming soon"
          expanded={expandedModules.pathSimulator}
          onToggle={() => toggleModule('pathSimulator')}
        >
          <PathSimulatorModule />
        </ModuleSection>
      </div>
    </div>
  );
}

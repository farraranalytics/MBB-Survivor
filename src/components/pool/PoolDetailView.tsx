'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PoolStandings, PickDeadline } from '@/types/picks';
import type { User } from '@supabase/supabase-js';

// ─── Join Code Card ──────────────────────────────────────────────

function JoinCodeCard({ joinCode, poolName }: { joinCode: string; poolName: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinCode);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = joinCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const shareData = {
      title: `Join ${poolName} on Survive the Dance`,
      text: `Join my March Madness Survivor pool! Use code: ${joinCode}`,
      url: `${window.location.origin}/join`,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); return; } catch { /* cancelled */ }
    }
    handleCopy();
  };

  return (
    <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-5 mb-4">
      <p className="label mb-2">Join Code</p>
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold text-[#FF5722] tracking-[0.2em]" style={{ fontFamily: "'Space Mono', monospace" }}>
          {joinCode}
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className={`px-3 py-2 rounded-[8px] text-xs font-semibold transition-all ${
              copied
                ? 'bg-[rgba(76,175,80,0.15)] text-[#4CAF50]'
                : 'bg-[#1A1A24] border border-[rgba(255,255,255,0.05)] text-[#8A8694] hover:text-[#E8E6E1] hover:border-[rgba(255,87,34,0.3)]'
            }`}
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            <span className="flex items-center gap-1">
              {copied ? (
                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>Copied</>
              ) : (
                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
              )}
            </span>
          </button>
          <button
            onClick={handleShare}
            className="px-3 py-2 rounded-[8px] text-xs font-semibold bg-[#1A1A24] border border-[rgba(255,255,255,0.05)] text-[#8A8694] hover:text-[#E8E6E1] hover:border-[rgba(255,87,34,0.3)] transition-all"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              Share
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pool Detail View ────────────────────────────────────────────

interface PoolDetailViewProps {
  standings: PoolStandings;
  deadline: PickDeadline | null;
  user: User;
  poolId: string;
  showBackButton?: boolean;
}

export default function PoolDetailView({ standings, deadline, user, poolId, showBackButton = false }: PoolDetailViewProps) {
  const router = useRouter();

  const yourStatus = standings.your_entries[0] ?? null;
  const canMakePick = yourStatus && !yourStatus.is_eliminated && standings.current_round && !deadline?.is_expired;
  const hasMadePick = yourStatus?.current_pick != null;
  const topPlayers = standings.players.slice(0, 5);

  const formatTimeRemaining = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getDeadlineColor = () => {
    if (!deadline || deadline.is_expired) return 'text-[#EF5350]';
    if (deadline.minutes_remaining < 30) return 'text-[#EF5350]';
    if (deadline.minutes_remaining < 120) return 'text-[#FFB300]';
    return 'text-[#4CAF50]';
  };

  return (
    <div className="max-w-lg mx-auto px-5 py-6">
      {/* Pool Header */}
      <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-[#E8E6E1] truncate mr-3" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>{standings.pool_name}</h1>
          {showBackButton && (
            <button onClick={() => router.push('/dashboard')} className="text-[#8A8694] hover:text-[#E8E6E1] text-sm flex-shrink-0 transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
          )}
        </div>

        <div className="text-center mb-3">
          <p className="text-[#8A8694] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {standings.alive_players} alive. {standings.eliminated_players} eliminated. {standings.total_players} entered.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-[rgba(76,175,80,0.1)] rounded-[8px] p-3">
            <p className="text-2xl font-bold text-[#4CAF50]" style={{ fontFamily: "'Oswald', sans-serif" }}>{standings.alive_players}</p>
            <p className="label text-[#4CAF50]" style={{ fontSize: '0.6rem' }}>Alive</p>
          </div>
          <div className="bg-[rgba(239,83,80,0.1)] rounded-[8px] p-3">
            <p className="text-2xl font-bold text-[#EF5350]" style={{ fontFamily: "'Oswald', sans-serif" }}>{standings.eliminated_players}</p>
            <p className="label text-[#EF5350]" style={{ fontSize: '0.6rem' }}>Out</p>
          </div>
          <div className="bg-[#1A1A24] rounded-[8px] p-3">
            <p className="text-2xl font-bold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif" }}>{standings.total_players}</p>
            <p className="label text-[#8A8694]" style={{ fontSize: '0.6rem' }}>Total</p>
          </div>
        </div>
      </div>

      {/* Creator Join Code */}
      {standings.creator_id === user.id && standings.join_code && (
        <JoinCodeCard joinCode={standings.join_code} poolName={standings.pool_name} />
      )}

      {/* Your Entries */}
      {standings.your_entries.length > 0 && (
        <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <p className="label">{standings.your_entries.length > 1 ? 'Your Entries' : 'Your Status'}</p>
          </div>

          <div className={standings.your_entries.length > 1 ? 'space-y-3' : ''}>
            {standings.your_entries.map((entry) => {
              const entryCanPick = !entry.is_eliminated && standings.current_round && !deadline?.is_expired;
              const entryHasPick = entry.current_pick != null;
              const entryLabel = entry.entry_label || `Bracket ${entry.entry_number}`;

              return (
                <div key={entry.pool_player_id} className={standings.your_entries.length > 1 ? 'bg-[#1A1A24] border border-[rgba(255,255,255,0.05)] rounded-[8px] p-4' : ''}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#FF5722] mb-1.5" style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        {entryLabel}
                      </p>
                      <div className="flex items-center gap-3 mb-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            entry.is_eliminated
                              ? 'bg-[rgba(239,83,80,0.15)] text-[#EF5350]'
                              : 'bg-[rgba(76,175,80,0.15)] text-[#4CAF50]'
                          }`}
                          style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em' }}
                        >
                          {entry.is_eliminated ? 'OUT' : 'ALIVE'}
                        </span>
                        <span className="text-sm text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                          {entry.picks_count} pick{entry.picks_count !== 1 ? 's' : ''}
                        </span>
                        {entry.survival_streak > 1 && (
                          <span className="text-sm text-[#FF5722] font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>
                            {entry.survival_streak} streak
                          </span>
                        )}
                      </div>

                      {entry.is_eliminated && entry.elimination_reason && (
                        <p className="text-xs text-[#EF5350]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                          {entry.elimination_reason.replace('_', ' ')}
                        </p>
                      )}

                      {entry.current_pick?.team && (
                        <p className="text-sm text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                          Pick:{' '}
                          <span className="font-semibold text-[#E8E6E1]">
                            ({entry.current_pick.team.seed}) {entry.current_pick.team.name}
                          </span>
                        </p>
                      )}
                    </div>

                    <div className="flex-shrink-0 ml-3">
                      {entryCanPick && !entryHasPick && (
                        <button
                          onClick={() => router.push(`/pools/${poolId}/pick?entry=${entry.pool_player_id}`)}
                          className="btn-orange text-[#E8E6E1] px-4 py-2.5 rounded-[12px] font-bold text-sm"
                          style={{ fontFamily: "'DM Sans', sans-serif", boxShadow: '0 4px 16px rgba(255, 87, 34, 0.3)' }}
                        >
                          Pick
                        </button>
                      )}

                      {entryHasPick && !deadline?.is_expired && (
                        <button
                          onClick={() => router.push(`/pools/${poolId}/pick?entry=${entry.pool_player_id}`)}
                          className="bg-[rgba(255,179,0,0.15)] text-[#FFB300] border border-[rgba(255,179,0,0.3)] px-4 py-2.5 rounded-[12px] font-bold text-sm hover:bg-[rgba(255,179,0,0.25)] transition-colors"
                          style={{ fontFamily: "'DM Sans', sans-serif" }}
                        >
                          Change
                        </button>
                      )}

                      {entryHasPick && deadline?.is_expired && (
                        <span className="text-[#4CAF50] font-semibold text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>Locked</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Deadline */}
          {standings.current_round && deadline && (
            <div className="mt-4 p-4 bg-[#1A1A24] border border-[rgba(255,255,255,0.05)] rounded-[8px]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                    {standings.current_round.name}
                  </p>
                  <p className="text-xs text-[#8A8694] mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {deadline?.is_expired ? 'Picks locked' : "Clock's ticking"}
                  </p>
                </div>
                <div className="text-right">
                  {deadline.is_expired ? (
                    <p className="text-sm font-bold text-[#EF5350]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Passed</p>
                  ) : (
                    <>
                      <p className={`text-lg font-bold ${getDeadlineColor()}`} style={{ fontFamily: "'Space Mono', monospace" }}>
                        {formatTimeRemaining(deadline.minutes_remaining)}
                      </p>
                      <p className="text-[10px] text-[#8A8694]" style={{ fontFamily: "'Space Mono', monospace" }}>
                        {new Date(deadline.deadline_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Standings */}
      <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="label">Standings</p>
          <button onClick={() => router.push(`/pools/${poolId}/standings`)} className="text-[#FF5722] hover:text-[#E64A19] text-xs font-semibold transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            View All
          </button>
        </div>

        <div className="space-y-2">
          {topPlayers.map((player, index) => {
            const isYou = player.pool_player_id === yourStatus?.pool_player_id;
            return (
              <div
                key={player.pool_player_id}
                className={`flex items-center justify-between p-3 rounded-[8px] ${
                  isYou ? 'bg-[rgba(255,87,34,0.06)] border border-[rgba(255,87,34,0.2)]' : 'bg-[#1A1A24]'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold text-[#8A8694] w-5 text-right" style={{ fontFamily: "'Space Mono', monospace" }}>
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-[#E8E6E1] text-sm" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                      {player.display_name}
                      {isYou && <span className="text-[#FF5722] text-xs ml-1.5" style={{ fontFamily: "'Space Mono', monospace" }}>YOU</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`inline-flex items-center w-2 h-2 rounded-full ${player.is_eliminated ? 'bg-[#EF5350]' : 'bg-[#4CAF50]'}`} />
                      <span className="text-[11px] text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        {player.picks_count} pick{player.picks_count !== 1 ? 's' : ''}
                      </span>
                      {player.survival_streak > 1 && (
                        <span className="text-[11px] text-[#FF5722] font-medium" style={{ fontFamily: "'Space Mono', monospace" }}>
                          {player.survival_streak}x
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {player.current_pick?.team && (
                  <div className="text-right">
                    <p className="text-xs font-semibold text-[#E8E6E1]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      {player.current_pick.team.name}
                    </p>
                    <p className="text-[10px] text-[#8A8694]" style={{ fontFamily: "'Space Mono', monospace" }}>
                      {player.current_pick.team.seed} SEED
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {standings.players.length === 0 && (
          <p className="text-center text-[#8A8694] py-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>No players in this pool yet.</p>
        )}

        {standings.players.length > 5 && (
          <button
            onClick={() => router.push(`/pools/${poolId}/standings`)}
            className="w-full mt-3 py-3 text-center text-sm font-semibold text-[#FF5722] bg-[rgba(255,87,34,0.06)] rounded-[8px] hover:bg-[rgba(255,87,34,0.12)] transition-colors"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            See all {standings.players.length} players
          </button>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => router.push(`/pools/${poolId}/standings`)}
          className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-4 text-center hover:border-[rgba(255,87,34,0.3)] transition-colors"
        >
          <div className="w-10 h-10 bg-[rgba(27,58,92,0.3)] rounded-[8px] flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 text-[#1B3A5C]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
          <span className="text-xs font-semibold text-[#E8E6E1] block" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: '0.02em' }}>Full Standings</span>
        </button>
        <button
          onClick={() => router.push('/tournament')}
          className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-4 text-center hover:border-[rgba(255,87,34,0.3)] transition-colors"
        >
          <div className="w-10 h-10 bg-[rgba(255,87,34,0.08)] rounded-[8px] flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 text-[#FF5722]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <span className="text-xs font-semibold text-[#E8E6E1] block" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: '0.02em' }}>Tournament</span>
        </button>
      </div>
    </div>
  );
}

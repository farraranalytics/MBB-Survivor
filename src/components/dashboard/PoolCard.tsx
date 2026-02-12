'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MyPool, MyPoolEntry } from '@/types/standings';
import { useToast } from '@/hooks/useToast';

interface PoolCardProps {
  pool: MyPool;
  isActive: boolean;
  onActivate: () => void;
}

export default function PoolCard({ pool, isActive, onActivate }: PoolCardProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [showCode, setShowCode] = useState(false);

  const survivalRate = pool.total_players > 0
    ? Math.round((pool.alive_players / pool.total_players) * 100)
    : 0;
  const eliminated = pool.total_players - pool.alive_players;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(pool.join_code);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = pool.join_code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    addToast('info', 'Join code copied!', 2000);
  };

  return (
    <div
      onClick={() => {
        onActivate();
        router.push(`/pools/${pool.pool_id}/standings`);
      }}
      className={`rounded-[14px] p-4 cursor-pointer transition-all ${
        isActive
          ? 'border-[1.5px] border-[#FF5722] bg-[rgba(255,87,34,0.03)]'
          : 'border border-[rgba(255,255,255,0.05)] bg-[#111827] hover:border-[rgba(255,87,34,0.2)]'
      }`}
    >
      {/* Header: Pool name + prize pot */}
      <div className="flex items-start justify-between mb-1">
        <h3
          className={`font-bold text-base truncate ${isActive ? 'text-[#FF5722]' : 'text-[#E8E6E1]'}`}
          style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
        >
          {pool.pool_name}
        </h3>
        {pool.prize_pool > 0 && (
          <span
            className="text-sm font-bold text-[#4CAF50] flex-shrink-0 ml-2"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            ${pool.prize_pool.toLocaleString()}
          </span>
        )}
      </div>

      {/* Subtitle: hosted by + buy-in */}
      <p
        className="text-[10px] text-[#5F6B7A] mb-3 tracking-[0.08em]"
        style={{ fontFamily: "'Space Mono', monospace" }}
      >
        HOSTED BY {pool.creator_name.toUpperCase()}
        {pool.entry_fee > 0 && ` \u00B7 $${pool.entry_fee} BUY-IN`}
      </p>

      {/* Survival bar */}
      <div className="mb-3">
        <div className="h-5 bg-[#1B2A3D] rounded-full overflow-hidden relative">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${survivalRate}%`,
              background: 'linear-gradient(90deg, #4CAF50, #66BB6A)',
              minWidth: pool.alive_players > 0 ? '20px' : '0',
            }}
          />
          {/* Labels inside the bar */}
          <div className="absolute inset-0 flex items-center justify-between px-2.5">
            <span
              className="text-[9px] font-bold text-white tracking-[0.06em]"
              style={{ fontFamily: "'Space Mono', monospace", textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
            >
              {pool.alive_players} ALIVE
            </span>
            {eliminated > 0 && (
              <span
                className="text-[9px] font-bold text-[#EF5350] tracking-[0.06em]"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                {eliminated} OUT
              </span>
            )}
          </div>
        </div>
        <p
          className="text-[9px] text-[#5F6B7A] mt-1 tracking-[0.08em]"
          style={{ fontFamily: "'Space Mono', monospace" }}
        >
          {survivalRate}% SURVIVAL RATE
        </p>
      </div>

      {/* My entries list */}
      <div className="space-y-1.5">
        {pool.your_entries.map(entry => (
          <EntryRow key={entry.pool_player_id} entry={entry} />
        ))}
      </div>

      {/* Join code (subtle, toggleable) */}
      {pool.pool_status !== 'complete' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-3 pt-2.5 border-t border-[rgba(255,255,255,0.05)]"
        >
          {showCode ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="text-[9px] text-[#5F6B7A] tracking-[0.15em]"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  CODE
                </span>
                <span
                  className="text-xs font-bold text-[#FF5722] tracking-[0.1em]"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  {pool.join_code}
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="text-[10px] text-[#9BA3AE] hover:text-[#E8E6E1] transition-colors px-2 py-0.5 rounded bg-[#1B2A3D]"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Copy
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setShowCode(true); }}
              className="text-[10px] text-[#5F6B7A] hover:text-[#9BA3AE] transition-colors flex items-center gap-1"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share invite code
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Entry Row ──────────────────────────────────────────────────

function EntryRow({ entry }: { entry: MyPoolEntry }) {
  const alive = !entry.is_eliminated;

  // Badge logic
  let badge: { text: string; bgColor: string; textColor: string };
  if (entry.is_eliminated) {
    const reason = entry.elimination_reason === 'missed_pick' ? 'MISSED' : 'OUT';
    badge = {
      text: entry.elimination_round_name ? `\u2620 ${entry.elimination_round_name}` : `\u2620 ${reason}`,
      bgColor: 'rgba(239,83,80,0.1)',
      textColor: '#EF5350',
    };
  } else if (!entry.has_picked_today) {
    badge = {
      text: 'PICK NEEDED',
      bgColor: 'rgba(255,87,34,0.12)',
      textColor: '#FF5722',
    };
  } else {
    badge = {
      text: '\u2713 LOCKED',
      bgColor: 'rgba(76,175,80,0.1)',
      textColor: '#4CAF50',
    };
  }

  return (
    <div className="flex items-center gap-2 py-1">
      {/* Status dot */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{
          background: alive ? '#4CAF50' : '#EF5350',
          boxShadow: alive ? '0 0 4px rgba(76,175,80,0.4)' : 'none',
        }}
      />

      {/* Entry name */}
      <p
        className={`text-xs flex-1 min-w-0 truncate ${
          alive ? 'text-[#E8E6E1]' : 'text-[#5F6B7A] line-through'
        }`}
        style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
      >
        {entry.entry_label}
      </p>

      {/* Badge */}
      <span
        className="text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] flex-shrink-0 tracking-[0.04em]"
        style={{
          fontFamily: "'Space Mono', monospace",
          background: badge.bgColor,
          color: badge.textColor,
        }}
      >
        {badge.text}
      </span>

    </div>
  );
}

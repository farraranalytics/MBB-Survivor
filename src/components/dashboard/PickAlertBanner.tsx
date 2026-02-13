'use client';

import Link from 'next/link';
import { MyPool } from '@/types/standings';
import { formatET } from '@/lib/timezone';

function formatDeadline(dt: string, clockOffset: number = 0): { text: string; color: string } {
  const diff = new Date(dt).getTime() - (Date.now() + clockOffset);
  if (diff <= 0) return { text: 'Picks locked', color: 'text-[#EF5350]' };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const cd = h > 0 ? `${h}h ${m}m` : `${m}m`;
  let color = 'text-[#4CAF50]';
  if (diff < 1800000) color = 'text-[#EF5350]';
  else if (diff < 3600000) color = 'text-[#FF5722]';
  else if (diff < 7200000) color = 'text-[#FFB300]';
  return { text: `${cd} until lock`, color };
}

export default function PickAlertBanner({ pools, activePoolId, clockOffset = 0 }: { pools: MyPool[]; activePoolId: string | null; clockOffset?: number }) {
  const needs = pools.flatMap(pool => {
    if (!pool.deadline_datetime || !pool.current_round_name) return [];
    if (new Date(pool.deadline_datetime).getTime() <= (Date.now() + clockOffset)) return [];
    if (pool.pool_status !== 'active' && pool.pool_status !== 'open') return [];
    return pool.your_entries
      .filter(e => !e.is_eliminated && !e.has_picked_today)
      .map(e => ({ ...e, poolId: pool.pool_id, deadline: pool.deadline_datetime }));
  });

  if (needs.length === 0) return null;

  const firstPoolId = needs[0].poolId;
  const deadline = needs[0].deadline;
  const deadlineInfo = deadline ? formatDeadline(deadline, clockOffset) : null;

  return (
    <Link
      href={`/pools/${activePoolId || firstPoolId}/pick`}
      className="block rounded-[14px] overflow-hidden transition-transform active:scale-[0.98]"
      style={{
        background: 'linear-gradient(135deg, rgba(255,87,34,0.06) 0%, rgba(255,87,34,0.02) 100%)',
        border: '1.5px solid rgba(255,87,34,0.3)',
      }}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,87,34,0.12)' }}
        >
          <span className="text-lg">&#127936;</span>
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-bold text-[#FF5722] tracking-[0.05em]"
            style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
          >
            {needs.length} {needs.length === 1 ? 'ENTRY NEEDS' : 'ENTRIES NEED'} A PICK
          </p>
          {deadlineInfo && (
            <p
              className={`text-[11px] mt-0.5 ${deadlineInfo.color}`}
              style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.03em' }}
            >
              {deadlineInfo.text}
            </p>
          )}
        </div>
        <svg className="flex-shrink-0 text-[#FF5722] w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

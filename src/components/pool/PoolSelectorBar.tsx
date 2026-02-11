'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useActivePool } from '@/hooks/useActivePool';

interface PoolSelectorBarProps {
  currentPoolId: string;
}

export default function PoolSelectorBar({ currentPoolId }: PoolSelectorBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { pools, setActivePool } = useActivePool();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  // Close on route change
  useEffect(() => {
    setDropdownOpen(false);
  }, [pathname]);

  if (pools.length === 0) return null;

  const currentPool = pools.find(p => p.pool_id === currentPoolId);

  // Infer sub-path from current URL for navigation
  const subPathMatch = pathname.match(/^\/pools\/[^/]+(\/[^?]*)/);
  const subPath = subPathMatch?.[1] || '';

  const handlePoolSelect = (poolId: string, poolName: string) => {
    setDropdownOpen(false);
    setActivePool(poolId, poolName);
    router.push(`/pools/${poolId}${subPath}`);
  };

  return (
    <div className="relative mb-1.5 sm:mb-2" ref={ref}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={`w-full flex items-center justify-between px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 bg-[#111827] rounded-[10px] transition-colors ${
          dropdownOpen ? 'border border-[#FF5722]' : 'border border-[rgba(255,255,255,0.08)]'
        }`}
      >
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="text-[9px] font-bold text-[#5F6B7A] bg-[#243447] px-1.5 py-[2px] rounded-[3px] tracking-[0.12em] flex-shrink-0"
            style={{ fontFamily: "'Space Mono', monospace" }}>
            POOL
          </span>
          <span className="text-sm sm:text-[0.9rem] font-semibold text-[#E8E6E1] truncate"
            style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
            {currentPool?.pool_name || 'Loading...'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-[#4CAF50] tracking-[0.06em]"
            style={{ fontFamily: "'Space Mono', monospace" }}>
            {currentPool?.alive_players ?? '-'}/{currentPool?.total_players ?? '-'}
          </span>
          {pools.length > 1 && (
            <span className={`text-[10px] text-[#5F6B7A] transition-transform ${
              dropdownOpen ? 'rotate-180' : ''
            }`}>▼</span>
          )}
        </div>
      </button>

      {dropdownOpen && pools.length > 1 && (
        <>
          <div className="fixed inset-0 z-[99]" onClick={() => setDropdownOpen(false)} />
          <div className="absolute top-full left-0 right-0 z-[100] mt-[3px] bg-[#1B2A3D] border border-[rgba(255,255,255,0.12)] rounded-[10px] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
            {pools.map(p => (
              <button
                key={p.pool_id}
                onClick={() => handlePoolSelect(p.pool_id, p.pool_name)}
                className={`w-full flex items-center justify-between px-3 py-2 sm:py-2.5 transition-colors ${
                  p.pool_id === currentPoolId
                    ? 'bg-[rgba(255,87,34,0.08)] border-l-[3px] border-l-[#FF5722]'
                    : 'border-l-[3px] border-l-transparent hover:bg-[rgba(255,255,255,0.03)]'
                }`}
              >
                <div className="text-left">
                  <div className={`text-sm font-semibold uppercase ${
                    p.pool_id === currentPoolId ? 'text-[#FF5722]' : 'text-[#E8E6E1]'
                  }`} style={{ fontFamily: "'Oswald', sans-serif" }}>
                    {p.pool_name}
                  </div>
                  <div className="text-[9px] text-[#5F6B7A] tracking-[0.06em] mt-0.5"
                    style={{ fontFamily: "'Space Mono', monospace" }}>
                    {p.your_entry_count} {p.your_entry_count === 1 ? 'ENTRY' : 'ENTRIES'}
                  </div>
                </div>
                <span className="text-[10px] text-[#4CAF50] tracking-[0.06em]"
                  style={{ fontFamily: "'Space Mono', monospace" }}>
                  {p.alive_players}/{p.total_players}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

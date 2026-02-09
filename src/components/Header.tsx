'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useActivePool } from '@/hooks/useActivePool';

function shouldHideHeader(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname.startsWith('/auth')) return true;
  if (pathname.startsWith('/join')) return true;
  if (pathname === '/pools/create') return true;
  return false;
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { activePoolId, activePoolName, pools, setActivePool } = useActivePool();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [dropdownOpen]);

  // Close dropdown on route change
  useEffect(() => {
    setDropdownOpen(false);
  }, [pathname]);

  if (!user || shouldHideHeader(pathname)) return null;

  const handlePoolSelect = (poolId: string, poolName: string) => {
    setActivePool(poolId, poolName);
    setDropdownOpen(false);
    // If on a pool-scoped page, navigate to the same sub-page for the new pool
    const poolPageMatch = pathname.match(/^\/pools\/[^/]+(\/.*)?$/);
    if (poolPageMatch) {
      const subPath = poolPageMatch[1] || '';
      router.push(`/pools/${poolId}${subPath}`);
    }
  };

  return (
    <div className="sticky top-0 z-40 bg-[#111827] border-b border-[rgba(255,255,255,0.05)]">
      <div className="max-w-lg mx-auto px-5 py-3 flex items-center justify-between">
        {/* Left — Wordmark (always visible) */}
        <Link href="/dashboard" className="flex flex-col items-center leading-none">
          <span
            className="uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: '0.5rem',
              letterSpacing: '0.25em',
              color: 'rgba(232, 230, 225, 0.4)',
            }}
          >
            Survive
          </span>
          <span
            className="uppercase"
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 700,
              fontSize: '0.65rem',
              letterSpacing: '0.1em',
              color: '#FF5722',
            }}
          >
            The
          </span>
          <span
            className="uppercase"
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 700,
              fontSize: '1.1rem',
              color: '#E8E6E1',
              lineHeight: 0.85,
            }}
          >
            Dance
          </span>
        </Link>

        {/* Right — Pool dropdown + Settings gear */}
        <div className="flex items-center gap-2">
          {activePoolName && pools.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1B2A3D] border border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,87,34,0.3)] transition-colors"
              >
                <span
                  className="text-xs font-semibold text-[#E8E6E1] truncate max-w-[120px]"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {activePoolName}
                </span>
                <svg
                  className={`w-3 h-3 text-[#9BA3AE] transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-56 rounded-[10px] bg-[#1B2A3D] border border-[rgba(255,255,255,0.08)] shadow-lg shadow-black/40 overflow-hidden">
                  <div className="py-1">
                    {pools.map(pool => (
                      <button
                        key={pool.pool_id}
                        onClick={() => handlePoolSelect(pool.pool_id, pool.pool_name)}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                      >
                        <span className="w-4 flex-shrink-0 text-center">
                          {pool.pool_id === activePoolId && (
                            <svg className="w-3.5 h-3.5 text-[#FF5722]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span
                          className={`text-xs font-semibold truncate ${pool.pool_id === activePoolId ? 'text-[#E8E6E1]' : 'text-[#9BA3AE]'}`}
                          style={{ fontFamily: "'DM Sans', sans-serif" }}
                        >
                          {pool.pool_name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <Link
            href={activePoolId ? `/pools/${activePoolId}/settings` : '/settings'}
            className="text-[#9BA3AE] hover:text-[#E8E6E1] transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

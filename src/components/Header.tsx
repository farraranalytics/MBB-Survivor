'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  const { user } = useAuth();
  const { activePoolName } = useActivePool();

  if (!user || shouldHideHeader(pathname)) return null;

  return (
    <div className="sticky top-0 z-40 bg-[#111118] border-b border-[rgba(255,255,255,0.05)]">
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

        {/* Right — Pool pill + Settings gear */}
        <div className="flex items-center gap-2">
          {activePoolName && (
            <Link
              href="/dashboard"
              className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#1A1A24] border border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,87,34,0.3)] transition-colors"
            >
              <span
                className="text-xs font-semibold text-[#E8E6E1] truncate max-w-[140px]"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {activePoolName}
              </span>
            </Link>
          )}
          <Link
            href="/settings"
            className="text-[#8A8694] hover:text-[#E8E6E1] transition-colors p-1"
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

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useActivePool } from '@/hooks/useActivePool';

// Routes where the bottom nav should be hidden
function shouldHideNav(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname.startsWith('/auth')) return true;
  if (pathname.startsWith('/join')) return true;
  if (pathname === '/pools/create') return true;
  return false;
}

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { activePoolId } = useActivePool();

  if (!user || shouldHideNav(pathname)) return null;

  const poolBase = activePoolId ? `/pools/${activePoolId}` : null;

  const tabs = [
    {
      label: 'Home',
      href: '/dashboard',
      match: pathname === '/dashboard',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
        </svg>
      ),
    },
    {
      label: 'Pick',
      href: poolBase ? `${poolBase}/pick` : '/dashboard',
      match: /^\/pools\/[^/]+\/pick$/.test(pathname),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
          <circle cx="12" cy="12" r="5" strokeWidth={1.8} />
          <circle cx="12" cy="12" r="1" strokeWidth={1.8} />
        </svg>
      ),
    },
    {
      label: 'The Field',
      href: poolBase ? `${poolBase}/standings` : '/dashboard',
      match: /^\/pools\/[^/]+\/standings$/.test(pathname),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 21h8m-4-4v4m-4.5-8.5L12 8l4.5 4.5M6 12l-2-2V6a1 1 0 011-1h3l1-2h6l1 2h3a1 1 0 011 1v4l-2 2" />
        </svg>
      ),
    },
    {
      label: 'Bracket',
      href: poolBase ? `${poolBase}/bracket` : '/dashboard',
      match: /^\/pools\/[^/]+\/bracket$/.test(pathname) || pathname === '/tournament',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h4v4H4zM4 14h4v4H4zM16 10h4v4h-4zM8 8h4M8 16h4M12 8v8M16 12h-4" />
        </svg>
      ),
    },
    {
      label: 'Analyze',
      href: poolBase ? `${poolBase}/analyze` : '/analyze',
      match: /^\/pools\/[^/]+\/analyze$/.test(pathname) || pathname === '/analyze',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 20h16M4 20V10m0 10h4V14m0 6h4V8m0 12h4V12m0 8h4V6" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-[#080810] border-t border-[rgba(255,255,255,0.05)] tab-bar-shadow safe-area-bottom">
      <div className="max-w-lg mx-auto flex justify-around items-center h-14 sm:h-16">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={`relative flex flex-col items-center justify-center gap-[2px] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-[8px] transition-colors min-w-[52px] sm:min-w-[60px] ${
              tab.match ? 'text-[#FF5722]' : 'text-[#5F6B7A] hover:text-[#E8E6E1]'
            }`}
          >
            {tab.match && (
              <span className="absolute top-0 left-[20%] w-[60%] h-[2px] bg-[#FF5722]" />
            )}
            {tab.icon}
            <span
              className={`text-[8px] font-semibold ${tab.match ? 'text-[#FF5722]' : ''}`}
              style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.12em', textTransform: 'uppercase' as const }}
            >
              {tab.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

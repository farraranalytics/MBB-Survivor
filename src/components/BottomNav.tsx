'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';

const tabs = [
  {
    label: 'Home',
    href: '/dashboard',
    match: (path: string) => path === '/dashboard' || path.startsWith('/pools'),
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
      </svg>
    ),
  },
  {
    label: 'Bracket',
    href: '/tournament',
    match: (path: string) => path.startsWith('/tournament'),
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h4v4H4zM4 14h4v4H4zM16 10h4v4h-4zM8 8h4M8 16h4M12 8v8M16 12h-4" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/settings',
    match: (path: string) => path === '/settings',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

// Routes where the bottom nav should be hidden
function shouldHideNav(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname.startsWith('/auth')) return true;
  if (pathname.startsWith('/join')) return true;
  if (/^\/pools\/[^/]+\/pick$/.test(pathname)) return true;
  return false;
}

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user || shouldHideNav(pathname)) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-[#111118] border-t border-[rgba(255,255,255,0.05)] tab-bar-shadow safe-area-bottom">
      <div className="max-w-lg mx-auto flex justify-around items-center h-16">
        {tabs.map((tab) => {
          const isActive = tab.match(pathname);
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-[8px] transition-colors min-w-[60px] ${
                isActive ? 'text-[#FF5722]' : 'text-[#8A8694] hover:text-[#E8E6E1]'
              }`}
            >
              {tab.icon}
              <span
                className={`text-[10px] font-semibold ${isActive ? 'text-[#FF5722]' : ''}`}
                style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.05em' }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

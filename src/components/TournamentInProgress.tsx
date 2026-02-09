'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase/client';

interface TournamentStats {
  totalPlayers: number;
  totalPools: number;
  gamesToday: number;
}

export default function TournamentInProgress() {
  const { user } = useAuth();
  const [stats, setStats] = useState<TournamentStats | null>(null);

  useEffect(() => {
    async function loadStats() {
      const [playersRes, poolsRes, gamesRes] = await Promise.all([
        supabase.from('pool_players').select('id', { count: 'exact', head: true }),
        supabase.from('pools').select('id', { count: 'exact', head: true }),
        supabase.from('games').select('id', { count: 'exact', head: true }).eq('status', 'final'),
      ]);

      setStats({
        totalPlayers: playersRes.count ?? 0,
        totalPools: poolsRes.count ?? 0,
        gamesToday: gamesRes.count ?? 0,
      });
    }
    loadStats();
  }, []);

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex flex-col items-center justify-center px-5 py-12">
      <div className="max-w-md w-full text-center animate-fade-in">
        {/* Small wordmark */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex flex-col items-center" style={{ gap: 0 }}>
            <span
              className="text-[0.5rem] tracking-[0.5em]"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: 'rgba(232, 230, 225, 0.4)', lineHeight: 1 }}
            >
              SURVIVE
            </span>
            <span
              className="text-[1rem] tracking-[0.15em] text-[#FF5722]"
              style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, lineHeight: 1.1 }}
            >
              THE
            </span>
            <span
              className="text-[1.75rem] tracking-[-0.02em] text-[#E8E6E1]"
              style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, lineHeight: 0.85 }}
            >
              Dance
            </span>
          </div>
        </div>

        {/* Lock icon */}
        <div className="w-14 h-14 bg-[rgba(255,87,34,0.1)] rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-[#FF5722]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        {/* Heading */}
        <h1
          className="text-2xl font-bold text-[#E8E6E1] mb-3"
          style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
        >
          Tournament In Progress
        </h1>

        {/* Subtext */}
        <p className="text-[#9BA3AE] text-sm mb-8 leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          The 2026 March Madness survivor pools are locked. Creating new pools and joining existing pools is closed once games begin.
        </p>

        {/* CTAs based on auth state */}
        {user ? (
          <div className="space-y-3 mb-8">
            <Link
              href="/dashboard"
              className="block w-full py-3.5 rounded-[10px] btn-orange font-bold text-base text-center"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Go to Dashboard
            </Link>
            <p className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              You may already be in a pool — check your dashboard.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            <Link
              href="/auth/signup"
              className="block w-full py-3.5 rounded-[10px] btn-orange font-bold text-base text-center"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Sign Up for Next Year
            </Link>
            <p className="text-xs text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Create an account now and be the first to know when pools open for the 2027 tournament.
            </p>
            <Link
              href="/auth/login"
              className="text-[#FF5722] hover:text-[#E64A19] text-sm font-medium transition-colors"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Already have an account? Sign in
            </Link>
          </div>
        )}

        {/* Live tournament ticker */}
        {stats && (stats.totalPlayers > 0 || stats.totalPools > 0) && (
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[10px] px-4 py-3 mb-6">
            <p className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <span className="mr-1.5">🏀</span>
              Tournament is live
              <span className="text-[#5F6B7A] mx-1.5">&middot;</span>
              <span className="text-[#E8E6E1] font-semibold" style={{ fontFamily: "'Space Mono', monospace" }}>{stats.totalPlayers}</span> players across{' '}
              <span className="text-[#E8E6E1] font-semibold" style={{ fontFamily: "'Space Mono', monospace" }}>{stats.totalPools}</span> pools
              {stats.gamesToday > 0 && (
                <>
                  <span className="text-[#5F6B7A] mx-1.5">&middot;</span>
                  <span className="text-[#E8E6E1] font-semibold" style={{ fontFamily: "'Space Mono', monospace" }}>{stats.gamesToday}</span> games completed
                </>
              )}
            </p>
          </div>
        )}

        {/* About link */}
        <Link
          href="/about"
          className="text-[#9BA3AE] hover:text-[#E8E6E1] text-xs transition-colors"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          About Survive the Dance
        </Link>
      </div>
    </div>
  );
}

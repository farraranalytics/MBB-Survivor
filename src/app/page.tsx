'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-[rgba(255,255,255,0.08)] border-t-[#FF5722] mx-auto mb-4" />
          <p className="text-[#8A8694] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] relative overflow-hidden">
      {/* Ambient glow backgrounds */}
      <div className="absolute inset-0 ambient-glow pointer-events-none" />

      {/* Court circle background element */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] court-circle opacity-30 pointer-events-none" />
      <div className="absolute top-1/2 left-0 right-0 court-line opacity-20 pointer-events-none" />

      {/* Hero */}
      <div className="flex items-center justify-center min-h-screen px-5 relative z-10">
        <div className="text-center max-w-md w-full animate-fade-in">
          {/* Wordmark */}
          <div className="mb-10">
            <p
              className="text-[0.7rem] tracking-[0.5em] text-[rgba(255,255,255,0.5)] mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
            >
              SURVIVE
            </p>
            <p
              className="text-[1.8rem] tracking-[0.15em] text-[#FF5722] leading-none mb-0"
              style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700 }}
            >
              THE
            </p>
            <p
              className="text-[4.5rem] tracking-[-0.02em] text-[#E8E6E1] leading-none"
              style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700 }}
            >
              DANCE
            </p>
          </div>

          {/* Sub-tagline */}
          <p
            className="text-[0.55rem] tracking-[0.35em] text-[#FF5722] uppercase mb-10"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            EVERY PICK COULD BE YOUR LAST
          </p>

          {/* CTAs */}
          <div className="flex flex-col gap-3 mb-12">
            <Link
              href="/auth/signup"
              className="btn-orange w-full py-4 text-lg font-bold rounded-[12px] text-center"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Get Started
            </Link>
            <Link
              href="/auth/login"
              className="w-full py-4 bg-[#111118] border border-[rgba(255,255,255,0.05)] text-[#E8E6E1] text-lg font-semibold rounded-[12px] hover:border-[rgba(255,87,34,0.3)] transition-colors text-center"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Sign In
            </Link>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-5 text-left flex items-start gap-4 hover:border-[rgba(255,87,34,0.3)] transition-colors">
              <div className="w-11 h-11 rounded-[8px] bg-[rgba(76,175,80,0.1)] flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#4CAF50]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#E8E6E1] mb-1" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: '0.02em' }}>Simple Rules</h3>
                <p className="text-sm text-[#8A8694] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>Pick one team per tournament day. Each team can only be used once.</p>
              </div>
            </div>

            <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-5 text-left flex items-start gap-4 hover:border-[rgba(255,87,34,0.3)] transition-colors">
              <div className="w-11 h-11 rounded-[8px] bg-[rgba(27,58,92,0.3)] flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#1B3A5C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#E8E6E1] mb-1" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: '0.02em' }}>Compete with Friends</h3>
                <p className="text-sm text-[#8A8694] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>Create private pools or join existing ones with unique codes.</p>
              </div>
            </div>

            <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-5 text-left flex items-start gap-4 hover:border-[rgba(255,87,34,0.3)] transition-colors">
              <div className="w-11 h-11 rounded-[8px] bg-[rgba(255,87,34,0.08)] flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#FF5722]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#E8E6E1] mb-1" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: '0.02em' }}>Live Updates</h3>
                <p className="text-sm text-[#8A8694] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>Real-time scores, standings, and elimination updates.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-[#8A8694] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <p>&copy; 2026 Survive the Dance</p>
      </footer>
    </div>
  );
}

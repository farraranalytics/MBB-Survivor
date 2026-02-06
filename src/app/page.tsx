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
      <div className="min-h-screen bg-dark-base flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-dark-border border-t-accent mx-auto mb-4"></div>
          <p className="text-text-secondary text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-dark-base relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-electric/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Hero */}
      <div className="flex items-center justify-center min-h-screen px-5">
        <div className="text-center max-w-md w-full animate-fade-in">
          {/* Logo mark */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center shadow-lg shadow-accent-dim">
            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="none"/>
              <path d="M8.5 9.5l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>

          <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight">
            MBB Survivor
          </h1>
          <p className="text-lg text-text-secondary mb-8 leading-relaxed">
            The ultimate March Madness challenge.<br />
            Pick one team per day. Survive to win it all.
          </p>

          <div className="flex flex-col gap-3 mb-10">
            <Link
              href="/auth/signup"
              className="btn-accent w-full py-4 text-white text-lg font-bold rounded-xl text-center shadow-lg shadow-accent-dim"
            >
              Get Started
            </Link>
            <Link
              href="/auth/login"
              className="w-full py-4 bg-dark-card border border-dark-border text-white text-lg font-semibold rounded-xl hover:bg-dark-elevated transition-colors text-center"
            >
              Sign In
            </Link>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 gap-4 mt-8">
            <div className="bg-dark-card border border-dark-border-subtle rounded-2xl p-5 text-left flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-alive/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-alive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white mb-1">Simple Rules</h3>
                <p className="text-sm text-text-secondary leading-relaxed">Pick one team per tournament day. Each team can only be used once.</p>
              </div>
            </div>

            <div className="bg-dark-card border border-dark-border-subtle rounded-2xl p-5 text-left flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-electric/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-electric" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white mb-1">Compete with Friends</h3>
                <p className="text-sm text-text-secondary leading-relaxed">Create private pools or join existing ones with unique codes.</p>
              </div>
            </div>

            <div className="bg-dark-card border border-dark-border-subtle rounded-2xl p-5 text-left flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white mb-1">Live Updates</h3>
                <p className="text-sm text-text-secondary leading-relaxed">Real-time scores, standings, and elimination updates.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-text-muted text-sm">
        <p>&copy; 2026 MBB Survivor Pool</p>
      </footer>
    </div>
  );
}

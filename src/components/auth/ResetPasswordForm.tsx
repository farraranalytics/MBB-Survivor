'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

const inputClass = "w-full px-4 py-3 bg-[#1B2A3D] border border-[rgba(255,255,255,0.05)] rounded-[12px] text-[#E8E6E1] placeholder-[#9BA3AE] focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-transparent transition-colors";

export default function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  // Wait for Supabase to pick up the recovery tokens from the URL hash
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
      }
    });

    // Also check if user already has a session (e.g. tokens were processed before mount)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    }

    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-5">
        <div className="max-w-md w-full bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-8 text-center animate-fade-in">
          <div className="mx-auto w-16 h-16 bg-[rgba(76,175,80,0.12)] rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#4CAF50]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#E8E6E1] mb-2" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Password Updated</h1>
          <p className="text-[#9BA3AE] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Redirecting to your dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-5">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-[rgba(255,255,255,0.05)] border-t-[#FF5722] mx-auto mb-4" />
          <p className="text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Verifying reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-5">
      <div className="max-w-md w-full animate-fade-in">
        <Link href="/auth/login" className="inline-flex items-center text-sm text-[#9BA3AE] hover:text-[#E8E6E1] mb-8 transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          Back to Sign In
        </Link>

        <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-6 sm:p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#E8E6E1] mb-2" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>New Password</h1>
            <p className="text-[#9BA3AE] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>Enter your new password below</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-[rgba(239,83,80,0.1)] border border-[rgba(239,83,80,0.3)] text-[#EF5350] px-4 py-3 rounded-[8px] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={inputClass}
                placeholder="At least 6 characters"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={inputClass}
                placeholder="Confirm your new password"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-orange py-3.5 px-4 rounded-[12px] font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

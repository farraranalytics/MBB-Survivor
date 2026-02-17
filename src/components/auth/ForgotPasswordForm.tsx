'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

const inputClass = "w-full px-4 py-3 bg-[#1B2A3D] border border-[rgba(255,255,255,0.05)] rounded-[12px] text-[#E8E6E1] placeholder-[#9BA3AE] focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-transparent transition-colors";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }

    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-5">
        <div className="max-w-md w-full bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-8 text-center animate-fade-in">
          <div className="mx-auto w-16 h-16 bg-[rgba(76,175,80,0.12)] rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#4CAF50]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#E8E6E1] mb-2" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Check Your Email</h1>
          <p className="text-[#9BA3AE] text-sm mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            We sent a password reset link to <span className="text-[#E8E6E1] font-medium">{email}</span>. Click the link in the email to set a new password.
          </p>
          <Link
            href="/auth/login"
            className="text-[#FF5722] hover:text-[#E64A19] font-medium transition-colors text-sm"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Back to Sign In
          </Link>
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
            <h1 className="text-2xl font-bold text-[#E8E6E1] mb-2" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Reset Password</h1>
            <p className="text-[#9BA3AE] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>Enter your email and we&apos;ll send you a reset link</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-[rgba(239,83,80,0.1)] border border-[rgba(239,83,80,0.3)] text-[#EF5350] px-4 py-3 rounded-[8px] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
                placeholder="Enter your email"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-orange py-3.5 px-4 rounded-[12px] font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from './AuthProvider';

const inputClass = "w-full px-4 py-3 bg-[#1B2A3D] border border-[rgba(255,255,255,0.05)] rounded-[12px] text-[#E8E6E1] placeholder-[#9BA3AE] focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-transparent transition-colors";

export default function SignUpForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    const { error } = await signUp(email, password, displayName);

    if (error === 'ACCOUNT_EXISTS') {
      sessionStorage.setItem('std_auth_message', 'An account with this email already exists. Please sign in.');
      router.push('/auth/login');
      return;
    }

    if (error) {
      setError(error);
    } else {
      setSuccess(true);
      setTimeout(() => {
        router.push('/auth/login');
      }, 3000);
    }

    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-5">
        <div className="max-w-md w-full bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-8 text-center animate-bounce-in">
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-[rgba(76,175,80,0.12)] rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[#4CAF50]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#E8E6E1] mb-2" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Account Created!</h1>
            <p className="text-[#9BA3AE] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {typeof window !== 'undefined' && sessionStorage.getItem('std_pending_join_code')
                ? 'After verifying your email, log in to join the pool.'
                : 'Check your email to verify your account. Redirecting to login...'}
            </p>
          </div>
          <Link
            href="/auth/login"
            className="text-[#FF5722] hover:text-[#E64A19] font-medium transition-colors"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-5">
      <div className="max-w-md w-full animate-fade-in">
        <Link href="/" className="inline-flex items-center text-sm text-[#9BA3AE] hover:text-[#E8E6E1] mb-8 transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          Back
        </Link>

        <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-6 sm:p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#E8E6E1] mb-2" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Create Account</h1>
            <p className="text-[#9BA3AE] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>Join Survive the Dance</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-[rgba(239,83,80,0.1)] border border-[rgba(239,83,80,0.3)] text-[#EF5350] px-4 py-3 rounded-[8px] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Display Name</label>
              <input id="displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} placeholder="How you'll appear in pools" style={{ fontFamily: "'DM Sans', sans-serif" }} />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} placeholder="Enter your email" style={{ fontFamily: "'DM Sans', sans-serif" }} />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={inputClass} placeholder="At least 6 characters" style={{ fontFamily: "'DM Sans', sans-serif" }} />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Confirm Password</label>
              <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={inputClass} placeholder="Confirm your password" style={{ fontFamily: "'DM Sans', sans-serif" }} />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-orange py-3.5 px-4 rounded-[12px] font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[#9BA3AE] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Already have an account?{' '}
              <Link href="/auth/login" className="text-[#FF5722] hover:text-[#E64A19] font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from './AuthProvider';

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
      <div className="min-h-screen bg-dark-base flex items-center justify-center px-5">
        <div className="max-w-md w-full bg-dark-card border border-dark-border rounded-2xl p-8 text-center animate-bounce-in">
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-alive/15 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-alive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Account Created!</h1>
            <p className="text-text-secondary text-sm">
              Please check your email to verify your account. Redirecting to login...
            </p>
          </div>
          <Link
            href="/auth/login"
            className="text-accent hover:text-accent-hover font-medium transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  const inputClass = "w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-xl text-white placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-colors";

  return (
    <div className="min-h-screen bg-dark-base flex items-center justify-center px-5">
      <div className="max-w-md w-full animate-fade-in">
        {/* Back link */}
        <Link href="/" className="inline-flex items-center text-sm text-text-muted hover:text-text-secondary mb-8 transition-colors">
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          Back
        </Link>

        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 sm:p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-text-secondary text-sm">Join the MBB Survivor Pool</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-eliminated/10 border border-eliminated/30 text-eliminated px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-text-secondary mb-2">
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputClass}
                placeholder="How you'll appear in pools"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">
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
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-2">
                Password
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
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-secondary mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={inputClass}
                placeholder="Confirm your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-accent text-white py-3.5 px-4 rounded-xl font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-text-muted text-sm">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-accent hover:text-accent-hover font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

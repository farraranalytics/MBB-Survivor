'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'

export default function JoinWithCode() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pool, setPool] = useState<any>(null)

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setLoading(true)
    setError('')
    setPool(null)

    const { data, error } = await supabase
      .from('pools')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .eq('is_active', true)
      .single()

    if (error || !data) {
      setError('Pool not found or inactive')
      setLoading(false)
    } else {
      setPool(data)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-base flex items-center justify-center p-5">
      <div className="max-w-md w-full animate-fade-in">
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-white mb-6 text-center">Join Pool</h1>

          {error && (
            <div className="bg-eliminated/10 border border-eliminated/30 text-eliminated px-4 py-3 rounded-xl text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleLookup} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-text-secondary mb-2">
                Pool Code
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                maxLength={6}
                className="w-full px-4 py-3.5 bg-dark-surface border border-dark-border rounded-xl text-white text-center text-xl font-mono tracking-[0.3em] placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-colors"
                placeholder="ABC123"
              />
            </div>

            {!pool && (
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full btn-accent text-white font-bold py-3.5 px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Looking up...' : 'Find Pool'}
              </button>
            )}
          </form>

          {pool && (
            <div className="mt-6 pt-6 border-t border-dark-border animate-slide-up">
              <div className="bg-alive/10 border border-alive/25 rounded-xl p-4 mb-5">
                <h3 className="font-semibold text-alive text-sm uppercase tracking-wide mb-2">Pool Found</h3>
                <h4 className="font-bold text-white text-lg">{pool.name}</h4>
                <div className="text-sm text-text-secondary mt-2 space-y-1">
                  <p>Code: <span className="font-mono text-text-primary">{pool.code}</span></p>
                  {pool.entry_fee && <p>Entry Fee: <span className="text-accent font-bold">${pool.entry_fee}</span></p>}
                  {pool.max_players && <p>Max Players: {pool.max_players}</p>}
                </div>
              </div>

              <div className="bg-dark-surface border border-dark-border-subtle rounded-xl p-4 mb-5">
                <p className="text-text-secondary text-sm">
                  Create an account or log in to join this pool.
                </p>
              </div>

              <div className="space-y-3">
                <Link
                  href={`/auth/signup?poolCode=${pool.code}`}
                  className="block w-full btn-accent text-white font-bold py-3.5 px-4 rounded-xl text-center"
                >
                  Create Account & Join
                </Link>
                <Link
                  href={`/auth/login?poolCode=${pool.code}`}
                  className="block w-full bg-dark-surface border border-dark-border text-white font-semibold py-3.5 px-4 rounded-xl hover:border-accent/30 transition-colors text-center"
                >
                  Login & Join
                </Link>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link href="/" className="text-text-muted hover:text-text-secondary text-sm transition-colors">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

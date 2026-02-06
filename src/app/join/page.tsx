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
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center p-5">
      <div className="max-w-md w-full animate-fade-in">
        <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-[#E8E6E1] mb-6 text-center" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Join Pool</h1>

          {error && (
            <div className="bg-[rgba(239,83,80,0.1)] border border-[rgba(239,83,80,0.3)] text-[#EF5350] px-4 py-3 rounded-[8px] text-sm mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLookup} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-[#8A8694] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Pool Code
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                maxLength={6}
                className="w-full px-4 py-3.5 bg-[#1A1A24] border border-[rgba(255,255,255,0.05)] rounded-[12px] text-[#E8E6E1] text-center text-xl tracking-[0.3em] placeholder-[#8A8694] focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-transparent transition-colors"
                placeholder="ABC123"
                style={{ fontFamily: "'Space Mono', monospace" }}
              />
            </div>

            {!pool && (
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full btn-orange font-bold py-3.5 px-4 rounded-[12px] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {loading ? 'Looking up...' : 'Find Pool'}
              </button>
            )}
          </form>

          {pool && (
            <div className="mt-6 pt-6 border-t border-[rgba(255,255,255,0.05)] animate-slide-up">
              <div className="bg-[rgba(76,175,80,0.1)] border border-[rgba(76,175,80,0.25)] rounded-[8px] p-4 mb-5">
                <p className="label mb-2">Pool Found</p>
                <h4 className="font-bold text-[#E8E6E1] text-lg" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>{pool.name}</h4>
                <div className="text-sm text-[#8A8694] mt-2 space-y-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  <p>Code: <span className="text-[#E8E6E1]" style={{ fontFamily: "'Space Mono', monospace" }}>{pool.code}</span></p>
                  {pool.entry_fee && <p>Entry Fee: <span className="text-[#FF5722] font-bold">${pool.entry_fee}</span></p>}
                  {pool.max_players && <p>Max Players: {pool.max_players}</p>}
                </div>
              </div>

              <div className="bg-[#1A1A24] border border-[rgba(255,255,255,0.05)] rounded-[8px] p-4 mb-5">
                <p className="text-[#8A8694] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Create an account or log in to join this pool.
                </p>
              </div>

              <div className="space-y-3">
                <Link
                  href={`/auth/signup?poolCode=${pool.code}`}
                  className="block w-full btn-orange font-bold py-3.5 px-4 rounded-[12px] text-center"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Create Account & Join
                </Link>
                <Link
                  href={`/auth/login?poolCode=${pool.code}`}
                  className="block w-full bg-[#1A1A24] border border-[rgba(255,255,255,0.05)] text-[#E8E6E1] font-semibold py-3.5 px-4 rounded-[12px] hover:border-[rgba(255,87,34,0.3)] transition-colors text-center"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Login & Join
                </Link>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link href="/" className="text-[#8A8694] hover:text-[#E8E6E1] text-sm transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

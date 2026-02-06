'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/auth/AuthProvider';
import { getCreatedPools, CreatedPool } from '@/lib/settings';
import Link from 'next/link';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [pools, setPools] = useState<CreatedPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getCreatedPools(user.id)
      .then(setPools)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const handleCopy = async (code: string, poolId: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedId(poolId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShare = async (pool: CreatedPool) => {
    const shareData = {
      title: `Join ${pool.name} on Survive the Dance`,
      text: `Join my March Madness Survivor pool! Use code: ${pool.join_code}`,
      url: `${window.location.origin}/join`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled or share failed
      }
    }
    handleCopy(pool.join_code, pool.id);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0D1B2A] pb-24">
        <main className="max-w-lg mx-auto px-5 py-6 space-y-6">
          <h1 className="text-xl font-bold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Settings</h1>
          {/* My Created Pools */}
          <section>
            <p className="label mb-3">My Created Pools</p>

            {loading ? (
              <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[rgba(255,255,255,0.05)] border-t-[#FF5722] mx-auto" />
              </div>
            ) : pools.length === 0 ? (
              <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-6 text-center">
                <p className="text-[#8A8694] text-sm mb-3" style={{ fontFamily: "'DM Sans', sans-serif" }}>You haven't created any pools yet.</p>
                <Link
                  href="/pools/create"
                  className="inline-block btn-orange font-semibold py-2.5 px-5 rounded-[12px] text-sm"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Create a Pool
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {pools.map((pool) => (
                  <div key={pool.id} className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-5">
                    {/* Pool header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="min-w-0">
                        <h3 className="font-bold text-[#E8E6E1] text-base truncate" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>{pool.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold ${
                              pool.status === 'active'
                                ? 'bg-[rgba(76,175,80,0.15)] text-[#4CAF50]'
                                : pool.status === 'complete'
                                  ? 'bg-[rgba(138,134,148,0.15)] text-[#8A8694]'
                                  : 'bg-[rgba(255,87,34,0.15)] text-[#FF5722]'
                            }`}
                            style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}
                          >
                            {pool.status}
                          </span>
                          <span className="text-xs text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                            {pool.player_count} player{pool.player_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Link
                          href={`/pools/${pool.id}/admin`}
                          className="text-[#8A8694] hover:text-[#FF5722] transition-colors p-1"
                          title="Admin Settings"
                        >
                          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </Link>
                        <Link
                          href={`/pools/${pool.id}`}
                          className="text-[#8A8694] hover:text-[#FF5722] transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    </div>

                    {/* Join Code */}
                    <div className="bg-[#1A1A24] border border-[rgba(255,255,255,0.05)] rounded-[8px] p-4">
                      <p className="label mb-2">Join Code</p>
                      <div className="flex items-center justify-between">
                        <span
                          className="text-2xl font-bold text-[#FF5722] tracking-[0.2em]"
                          style={{ fontFamily: "'Space Mono', monospace" }}
                        >
                          {pool.join_code}
                        </span>
                        <div className="flex gap-2">
                          {/* Copy button */}
                          <button
                            onClick={() => handleCopy(pool.join_code, pool.id)}
                            className={`px-3 py-2 rounded-[8px] text-xs font-semibold transition-all ${
                              copiedId === pool.id
                                ? 'bg-[rgba(76,175,80,0.15)] text-[#4CAF50]'
                                : 'bg-[#111118] border border-[rgba(255,255,255,0.05)] text-[#8A8694] hover:text-[#E8E6E1] hover:border-[rgba(255,87,34,0.3)]'
                            }`}
                            style={{ fontFamily: "'DM Sans', sans-serif" }}
                          >
                            {copiedId === pool.id ? (
                              <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                                Copied
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                Copy
                              </span>
                            )}
                          </button>

                          {/* Share button */}
                          <button
                            onClick={() => handleShare(pool)}
                            className="px-3 py-2 rounded-[8px] text-xs font-semibold bg-[#111118] border border-[rgba(255,255,255,0.05)] text-[#8A8694] hover:text-[#E8E6E1] hover:border-[rgba(255,87,34,0.3)] transition-all"
                            style={{ fontFamily: "'DM Sans', sans-serif" }}
                          >
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                              Share
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Account */}
          <section>
            <p className="label mb-3">Account</p>
            <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-5 space-y-4">
              <div>
                <p className="text-xs text-[#8A8694] mb-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>Display Name</p>
                <p className="text-sm font-medium text-[#E8E6E1]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Player'}
                </p>
              </div>
              <div className="border-t border-[rgba(255,255,255,0.05)]" />
              <div>
                <p className="text-xs text-[#8A8694] mb-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>Email</p>
                <p className="text-sm text-[#8A8694]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {user?.email}
                </p>
              </div>
              <div className="border-t border-[rgba(255,255,255,0.05)]" />
              <button
                onClick={() => signOut()}
                className="w-full py-3 rounded-[12px] text-sm font-semibold text-[#EF5350] bg-[rgba(239,83,80,0.1)] border border-[rgba(239,83,80,0.2)] hover:border-[rgba(239,83,80,0.4)] transition-colors"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Sign Out
              </button>
            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}

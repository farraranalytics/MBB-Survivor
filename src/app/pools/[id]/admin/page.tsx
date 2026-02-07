'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { getPoolAdmin, updatePoolSettings, PoolAdminData } from '@/lib/admin';

const inputClass = "w-full px-4 py-3 bg-[#1B2A3D] border border-[rgba(255,255,255,0.05)] rounded-[12px] text-[#E8E6E1] placeholder-[#9BA3AE] focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-transparent transition-colors";

export default function PoolAdminPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const poolId = params.id as string;

  const [pool, setPool] = useState<PoolAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [maxPlayers, setMaxPlayers] = useState('');
  const [entryFee, setEntryFee] = useState('');
  const [maxEntries, setMaxEntries] = useState('1');

  useEffect(() => {
    if (!user) return;

    getPoolAdmin(poolId, user.id)
      .then((data) => {
        if (!data) {
          router.push(`/pools/${poolId}`);
          return;
        }
        setPool(data);
        setName(data.name);
        setIsPrivate(data.is_private);
        setMaxPlayers(data.max_players?.toString() || '');
        setEntryFee(data.entry_fee > 0 ? data.entry_fee.toString() : '');
        setMaxEntries(data.max_entries_per_user?.toString() || '1');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user, poolId, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pool) return;

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      await updatePoolSettings(poolId, {
        name: name.trim(),
        is_private: isPrivate,
        max_players: maxPlayers ? parseInt(maxPlayers) : null,
        entry_fee: entryFee ? parseFloat(entryFee) : 0,
        max_entries_per_user: maxEntries ? parseInt(maxEntries) : 1,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-[rgba(255,255,255,0.08)] border-t-[#FF5722]" />
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <div className="text-center px-5">
          <h1 className="text-2xl font-bold text-[#E8E6E1] mb-2" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Not Authorized</h1>
          <p className="text-[#9BA3AE] mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>Only the pool creator can access admin settings.</p>
          <button onClick={() => router.push(`/pools/${poolId}`)} className="btn-orange text-[#E8E6E1] px-6 py-3 rounded-[12px] font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Back to Pool
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-24">
      {/* Header */}
      <header className="bg-[#111827] border-b border-[rgba(255,255,255,0.05)]">
        <div className="max-w-lg mx-auto px-5">
          <div className="flex items-center justify-between py-4">
            <h1 className="text-xl font-bold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Pool Admin</h1>
            <button onClick={() => router.push(`/pools/${poolId}`)} className="text-[#9BA3AE] hover:text-[#E8E6E1] text-sm font-medium transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6">
        {/* Pool info bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm font-semibold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>{pool.name}</p>
            <p className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>{pool.player_count} player{pool.player_count !== 1 ? 's' : ''}</p>
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold ${
              pool.status === 'active'
                ? 'bg-[rgba(76,175,80,0.12)] text-[#4CAF50]'
                : pool.status === 'complete'
                  ? 'bg-[rgba(138,134,148,0.15)] text-[#9BA3AE]'
                  : 'bg-[rgba(255,87,34,0.15)] text-[#FF5722]'
            }`}
            style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}
          >
            {pool.status}
          </span>
        </div>

        {/* Success toast */}
        {success && (
          <div className="bg-[rgba(76,175,80,0.1)] border border-[rgba(76,175,80,0.3)] text-[#4CAF50] px-4 py-3 rounded-[8px] text-sm mb-6 flex items-center gap-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
            Settings saved successfully
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-[rgba(239,83,80,0.1)] border border-[rgba(239,83,80,0.3)] text-[#EF5350] px-4 py-3 rounded-[8px] text-sm mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {error}
          </div>
        )}

        {/* Settings Form */}
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-6">
          <p className="label mb-4">Pool Settings</p>

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Pool Name *</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
                className={inputClass}
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              />
            </div>

            <div>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-5 h-5 rounded bg-[#1B2A3D] border-[rgba(255,255,255,0.08)] text-[#FF5722] focus:ring-[#FF5722] focus:ring-offset-0"
                />
                <span className="text-sm font-medium text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Private Pool</span>
              </label>
              <p className="text-xs text-[#9BA3AE] mt-1.5 ml-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>Private pools require a join code to enter.</p>
            </div>

            <div>
              <label htmlFor="maxPlayers" className="block text-sm font-medium text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Max Players</label>
              <input
                id="maxPlayers"
                type="number"
                min="2"
                max="1000"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
                className={inputClass}
                placeholder="No limit"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              />
              <p className="text-xs text-[#9BA3AE] mt-1.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>Leave blank for unlimited</p>
            </div>

            <div>
              <label htmlFor="entryFee" className="block text-sm font-medium text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Entry Fee</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-[#9BA3AE] text-sm">$</span>
                </div>
                <input
                  id="entryFee"
                  type="number"
                  step="0.01"
                  min="0"
                  max="999.99"
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value)}
                  className={`${inputClass} pl-8`}
                  placeholder="0.00"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                />
              </div>
              <p className="text-xs text-[#9BA3AE] mt-1.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>Leave blank or 0 for free pools</p>
            </div>

            <div>
              <label htmlFor="maxEntries" className="block text-sm font-medium text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Entries Per Player</label>
              <input
                id="maxEntries"
                type="number"
                min="1"
                max="10"
                value={maxEntries}
                onChange={(e) => setMaxEntries(e.target.value)}
                className={inputClass}
                placeholder="1"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              />
              <p className="text-xs text-[#9BA3AE] mt-1.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>Allow players to run multiple brackets in this pool</p>
            </div>

            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="w-full btn-orange font-bold py-4 px-4 rounded-[12px] disabled:opacity-50 disabled:cursor-not-allowed text-base"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>

        {/* Join Code (read-only reference) */}
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-5 mt-4">
          <p className="label mb-2">Join Code</p>
          <p className="text-2xl font-bold text-[#FF5722] tracking-[0.2em]" style={{ fontFamily: "'Space Mono', monospace" }}>
            {pool.join_code}
          </p>
          <p className="text-xs text-[#9BA3AE] mt-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Share this code with players to join your pool.</p>
        </div>
      </main>
    </div>
  );
}

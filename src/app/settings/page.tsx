'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useActivePool } from '@/hooks/useActivePool';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/lib/supabase/client';
import NotificationToggle from '@/components/NotificationToggle';

const inputClass = "w-full px-4 py-3 bg-[#1B2A3D] border border-[rgba(255,255,255,0.05)] rounded-[12px] text-[#E8E6E1] placeholder-[#9BA3AE] focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-transparent transition-colors";

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { activePoolId, refreshPools } = useActivePool();
  const { addToast } = useToast();

  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const currentName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Player';

  // If user has an active pool, redirect to pool-specific settings
  if (activePoolId) {
    router.replace(`/pools/${activePoolId}/settings`);
    return null;
  }

  const handleSaveDisplayName = async () => {
    if (!newDisplayName.trim()) return;
    setSavingName(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { display_name: newDisplayName.trim() }
      });
      if (updateError) throw updateError;

      await supabase
        .from('pool_players')
        .update({ display_name: newDisplayName.trim() })
        .eq('user_id', user!.id);

      await supabase.auth.refreshSession();
      setEditingName(false);
      refreshPools();
      addToast('success', 'Display name updated');
    } catch {
      addToast('error', 'Failed to update display name');
    } finally {
      setSavingName(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-24">
      <div className="bg-[#080810] border-b border-[rgba(255,255,255,0.08)]">
        <div className="max-w-lg mx-auto px-5 py-2 sm:py-4">
          <div className="text-label-accent text-[0.5rem]">SETTINGS</div>
          <h1 className="text-heading text-[1.2rem]">Account</h1>
        </div>
      </div>

      <main className="max-w-lg mx-auto px-5 py-6 space-y-4">
        {/* Account */}
        <section>
          <p className="label mb-3">Account</p>
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[14px] p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Display Name</p>
                {!editingName && (
                  <button
                    onClick={() => { setNewDisplayName(currentName); setEditingName(true); }}
                    className="text-xs text-[#FF5722] font-semibold hover:text-[#E64A19] transition-colors"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Edit
                  </button>
                )}
              </div>
              {editingName ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    maxLength={30}
                    autoFocus
                    className={inputClass}
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDisplayName(); if (e.key === 'Escape') setEditingName(false); }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingName(false)}
                      disabled={savingName}
                      className="flex-1 py-2 rounded-[8px] text-xs font-semibold border border-[rgba(255,255,255,0.05)] text-[#9BA3AE] hover:bg-[#1B2A3D] transition-colors disabled:opacity-50"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveDisplayName}
                      disabled={savingName || !newDisplayName.trim()}
                      className="flex-1 py-2 rounded-[8px] text-xs font-semibold btn-orange disabled:opacity-50 flex items-center justify-center"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {savingName ? (
                        <div className="h-3.5 w-3.5 border-2 border-[rgba(255,255,255,0.3)] border-t-white rounded-full animate-spin" />
                      ) : (
                        'Save'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-medium text-[#E8E6E1]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {currentName}
                </p>
              )}
            </div>
            <div className="border-t border-[rgba(255,255,255,0.05)]" />
            <div>
              <p className="text-xs text-[#9BA3AE] mb-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>Email</p>
              <p className="text-sm text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {user.email}
              </p>
            </div>
            <div className="border-t border-[rgba(255,255,255,0.05)]" />
            <NotificationToggle />
          </div>
        </section>

        {/* Sign Out */}
        <section className="pt-2">
          <button
            onClick={() => setShowSignOutConfirm(true)}
            className="w-full py-3 rounded-[12px] text-sm font-semibold text-[#EF5350] bg-[rgba(239,83,80,0.1)] border border-[rgba(239,83,80,0.2)] hover:border-[rgba(239,83,80,0.4)] transition-colors"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Sign Out
          </button>
        </section>

        {/* Sign Out Confirmation Modal */}
        {showSignOutConfirm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowSignOutConfirm(false)} />
            <div className="relative bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-t-[16px] sm:rounded-[16px] w-full max-w-sm mx-auto p-6 pb-8 sm:pb-6 shadow-2xl animate-slide-up">
              <h3 className="text-lg font-bold text-[#E8E6E1] text-center mb-2" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
                Sign Out
              </h3>
              <p className="text-sm text-[#9BA3AE] text-center mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Are you sure you want to sign out?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSignOutConfirm(false)}
                  className="flex-1 py-3 rounded-[12px] border border-[rgba(255,255,255,0.05)] text-[#9BA3AE] font-semibold hover:bg-[#1B2A3D] transition-colors"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => { await signOut(); router.push('/'); }}
                  className="flex-1 py-3 rounded-[12px] font-semibold text-white bg-[#EF5350] hover:bg-[#E53935] transition-colors"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-[#9BA3AE] opacity-50 pt-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          v1.0.0 · &copy; 2026 Survive the Dance
        </p>
      </main>
    </div>
  );
}

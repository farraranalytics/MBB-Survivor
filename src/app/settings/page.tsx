'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase/client';

export default function SettingsPage() {
  const { user, signOut } = useAuth();

  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const currentName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Player';

  const handleSaveName = async () => {
    if (!newDisplayName.trim()) return;
    setSavingName(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: newDisplayName.trim() }
      });
      if (error) throw error;
      setEditingName(false);
    } catch (err) {
      console.error('Failed to update display name:', err);
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-24">
      <main className="max-w-lg mx-auto px-5 py-6 space-y-6">
        <h1 className="text-xl font-bold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Settings</h1>

        {/* Account */}
        <section>
          <p className="label mb-3">Account</p>
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-5 space-y-4">
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
                    className="w-full bg-[#1B2A3D] border border-[rgba(255,255,255,0.1)] rounded-[8px] px-3 py-2 text-sm text-[#E8E6E1] focus:outline-none focus:border-[#FF5722] transition-colors"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
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
                      onClick={handleSaveName}
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
                {user?.email}
              </p>
            </div>
          </div>
        </section>

        {/* Sign Out */}
        <section>
          <button
            onClick={() => signOut()}
            className="w-full py-3 rounded-[12px] text-sm font-semibold text-[#EF5350] bg-[rgba(239,83,80,0.1)] border border-[rgba(239,83,80,0.2)] hover:border-[rgba(239,83,80,0.4)] transition-colors"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Sign Out
          </button>
        </section>

        {/* Version */}
        <p className="text-center text-xs text-[#9BA3AE] opacity-50 pt-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          v1.0.0 · © 2026 Survive the Dance
        </p>
      </main>
    </div>
  );
}

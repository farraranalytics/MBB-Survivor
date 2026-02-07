'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase/client';
import {
  getPoolInfo,
  getPoolMembers,
  updatePoolSettings,
  removePoolMember,
  leavePool,
  updateEntryLabel,
  PoolAdminData,
  PoolAdminUpdate,
  PoolMember,
} from '@/lib/admin';

// ─── Section Header ──────────────────────────────────────────────

function SectionHeader({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <p
      className={accent ? 'label text-label-accent mb-3' : 'label mb-3'}
    >
      {label}
    </p>
  );
}

// ─── Inline Confirm Button ──────────────────────────────────────

function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className,
  disabled,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          {confirmLabel}
        </span>
        <button
          onClick={() => { onConfirm(); setConfirming(false); }}
          className="text-xs font-semibold text-[#EF5350] hover:text-[#E53935] transition-colors"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Yes
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs font-semibold text-[#9BA3AE] hover:text-[#E8E6E1] transition-colors"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      disabled={disabled}
      className={className}
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {label}
    </button>
  );
}

// ─── Entry Row (editable label) ─────────────────────────────────

function EntryRow({ entry, onSave }: {
  entry: { id: string; entry_label: string | null; entry_number: number; is_eliminated: boolean };
  onSave: (id: string, label: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(entry.entry_label || `Entry ${entry.entry_number}`);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await onSave(entry.id, value.trim());
      setEditing(false);
    } catch {
      // keep editing open on error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${entry.is_eliminated ? 'bg-[#EF5350]' : 'bg-[#4CAF50]'}`} />
        {editing ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={30}
              autoFocus
              className="flex-1 min-w-0 bg-[#1B2A3D] border border-[rgba(255,255,255,0.1)] rounded-[8px] px-3 py-1.5 text-sm text-[#E8E6E1] focus:outline-none focus:border-[#FF5722] transition-colors"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
            />
            <button
              onClick={handleSave}
              disabled={saving || !value.trim()}
              className="text-xs font-semibold text-[#FF5722] hover:text-[#E64A19] transition-colors disabled:opacity-50"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {saving ? '...' : 'Save'}
            </button>
            <button
              onClick={() => { setValue(entry.entry_label || `Entry ${entry.entry_number}`); setEditing(false); }}
              className="text-xs font-semibold text-[#9BA3AE] hover:text-[#E8E6E1] transition-colors"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <span className="text-sm font-medium text-[#E8E6E1] truncate" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {entry.entry_label || `Entry ${entry.entry_number}`}
            </span>
            <span className="text-xs text-[#9BA3AE] flex-shrink-0" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {entry.is_eliminated ? 'Eliminated' : 'Alive'}
            </span>
          </>
        )}
      </div>
      {!editing && (
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-[#FF5722] font-semibold hover:text-[#E64A19] transition-colors ml-2 flex-shrink-0"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Edit
        </button>
      )}
    </div>
  );
}

// ─── Member Row (creator's member list) ─────────────────────────

function MemberRow({ member, canRemove, onRemove }: {
  member: PoolMember;
  canRemove: boolean;
  onRemove: (id: string, name: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await onRemove(member.id, member.display_name);
    } finally {
      setRemoving(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-[#9BA3AE] truncate" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Remove {member.display_name}?
        </span>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={handleRemove}
            disabled={removing}
            className="text-xs font-semibold text-[#EF5350] hover:text-[#E53935] transition-colors disabled:opacity-50"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {removing ? '...' : 'Yes'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={removing}
            className="text-xs font-semibold text-[#9BA3AE] hover:text-[#E8E6E1] transition-colors disabled:opacity-50"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${member.is_eliminated ? 'bg-[#EF5350]' : 'bg-[#4CAF50]'}`} />
        <div className="min-w-0 flex-1">
          <span className="text-sm text-[#E8E6E1] font-medium truncate block" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {member.display_name}
          </span>
          {member.entry_label && (
            <span className="text-xs text-[#9BA3AE] truncate block" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {member.entry_label}
            </span>
          )}
        </div>
        <span className="text-xs text-[#9BA3AE] flex-shrink-0" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          {member.is_eliminated ? 'Eliminated' : 'Alive'}
        </span>
      </div>
      {canRemove && (
        <button
          onClick={() => setConfirming(true)}
          className="ml-2 w-6 h-6 flex items-center justify-center rounded text-[#EF5350] hover:bg-[rgba(239,83,80,0.1)] transition-colors text-xs flex-shrink-0"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

const inputClass = "w-full px-4 py-3 bg-[#1B2A3D] border border-[rgba(255,255,255,0.05)] rounded-[12px] text-[#E8E6E1] placeholder-[#9BA3AE] focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-transparent transition-colors";

export default function PoolSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const poolId = params.id as string;

  const [pool, setPool] = useState<PoolAdminData | null>(null);
  const [members, setMembers] = useState<PoolMember[]>([]);
  const [myEntries, setMyEntries] = useState<{ id: string; entry_label: string | null; entry_number: number; is_eliminated: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Creator form state
  const [name, setName] = useState('');

  const [maxPlayers, setMaxPlayers] = useState('');
  const [entryFee, setEntryFee] = useState('');
  const [maxEntries, setMaxEntries] = useState('1');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Account edit state
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Join code copy
  const [copiedCode, setCopiedCode] = useState(false);

  const isCreator = pool?.creator_id === user?.id;
  const currentName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Player';

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, poolId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    try {
      const poolData = await getPoolInfo(poolId);
      if (!poolData) {
        router.push('/dashboard');
        return;
      }
      setPool(poolData);
      setName(poolData.name);
      setMaxPlayers(poolData.max_players?.toString() || '');
      setEntryFee(poolData.entry_fee > 0 ? poolData.entry_fee.toString() : '');
      setMaxEntries(poolData.max_entries_per_user?.toString() || '1');
      setNotes(poolData.notes || '');

      // Fetch user's entries in this pool
      const { data: entries } = await supabase
        .from('pool_players')
        .select('id, entry_label, entry_number, is_eliminated')
        .eq('pool_id', poolId)
        .eq('user_id', user!.id)
        .order('entry_number', { ascending: true });

      setMyEntries(entries || []);

      // If creator, also fetch all members
      if (poolData.creator_id === user!.id) {
        const memberData = await getPoolMembers(poolId);
        setMembers(memberData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load pool settings');
    } finally {
      setLoading(false);
    }
  }

  // ── Handlers ────────────────────────────────────────────────────

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pool) return;

    setSaving(true);
    setError('');
    setSaveSuccess(false);

    try {
      const updates: PoolAdminUpdate = {
        name: name.trim(),
        max_players: maxPlayers ? parseInt(maxPlayers) : null,
        entry_fee: entryFee ? parseFloat(entryFee) : 0,
        max_entries_per_user: maxEntries ? parseInt(maxEntries) : 1,
        notes: notes.trim() || null,
      };
      await updatePoolSettings(poolId, updates);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDisplayName = async () => {
    if (!newDisplayName.trim()) return;
    setSavingName(true);
    setError('');
    try {
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        data: { display_name: newDisplayName.trim() }
      });
      if (updateError) throw updateError;

      // Verify the update actually persisted
      const { data: { user: freshUser } } = await supabase.auth.getUser();
      const savedName = freshUser?.user_metadata?.display_name;
      if (savedName !== newDisplayName.trim()) {
        throw new Error(`Display name did not save. Expected "${newDisplayName.trim()}" but got "${savedName}". Check Supabase Auth settings.`);
      }

      // Also update display_name in all pool_players rows for this user
      await supabase
        .from('pool_players')
        .update({ display_name: newDisplayName.trim() })
        .eq('user_id', user!.id);

      // Update local members list if creator
      setMembers(prev => prev.map(m =>
        m.user_id === user!.id ? { ...m, display_name: newDisplayName.trim() } : m
      ));

      // Force session refresh so AuthProvider picks up the change
      await supabase.auth.refreshSession();
      setEditingName(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update display name');
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveEntryLabel = async (entryId: string, newLabel: string) => {
    await updateEntryLabel(entryId, newLabel);
    setMyEntries(prev => prev.map(e => e.id === entryId ? { ...e, entry_label: newLabel } : e));
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    try {
      await removePoolMember(memberId);
      await loadData();
    } catch (err: any) {
      setError(err.message || `Failed to remove ${memberName}`);
    }
  };

  const handleLeavePool = async () => {
    if (!user) return;
    try {
      await leavePool(poolId, user.id);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to leave pool');
    }
  };

  const handleCopyCode = async () => {
    if (!pool) return;
    try {
      await navigator.clipboard.writeText(pool.join_code);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = pool.join_code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShare = async () => {
    if (!pool) return;
    const shareData = {
      title: `Join ${pool.name} on Survive the Dance`,
      text: `Join my March Madness Survivor pool! Use code: ${pool.join_code}`,
      url: `${window.location.origin}/pools/join?code=${pool.join_code}`,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); return; } catch { /* cancelled */ }
    }
    handleCopyCode();
  };

  // ── Loading ─────────────────────────────────────────────────────

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
          <h1 className="text-2xl font-bold text-[#E8E6E1] mb-2" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Pool Not Found</h1>
          <p className="text-[#9BA3AE] mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>This pool doesn&apos;t exist or you don&apos;t have access.</p>
          <button onClick={() => router.push('/dashboard')} className="btn-orange text-[#E8E6E1] px-6 py-3 rounded-[12px] font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Status badge
  const statusConfig = {
    open: { label: 'PRE-TOURNAMENT', cls: 'bg-[rgba(255,87,34,0.15)] text-[#FF5722]' },
    active: { label: 'ACTIVE', cls: 'bg-[rgba(76,175,80,0.12)] text-[#4CAF50]' },
    complete: { label: 'COMPLETE', cls: 'bg-[rgba(138,134,148,0.15)] text-[#9BA3AE]' },
  };
  const status = statusConfig[pool.status];

  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-24">
      <main className="max-w-lg mx-auto px-5 py-6 space-y-4">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              Pool Settings
            </h1>
            <p className="text-sm text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {pool.name}
            </p>
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold ${status.cls}`}
            style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}
          >
            {status.label}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-[rgba(239,83,80,0.1)] border border-[rgba(239,83,80,0.3)] text-[#EF5350] px-4 py-3 rounded-[8px] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {error}
          </div>
        )}

        {/* Success toast */}
        {saveSuccess && (
          <div className="bg-[rgba(76,175,80,0.1)] border border-[rgba(76,175,80,0.3)] text-[#4CAF50] px-4 py-3 rounded-[8px] text-sm flex items-center gap-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
            Settings saved successfully
          </div>
        )}

        {/* ─── SECTION 1: YOUR ENTRIES ─────────────────────────────── */}
        <section>
          <SectionHeader label="Your Entries" />
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[14px] p-5">
            {myEntries.length === 0 ? (
              <p className="text-sm text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>No entries in this pool.</p>
            ) : (
              <div className="divide-y divide-[rgba(255,255,255,0.05)]">
                {myEntries.map(entry => (
                  <EntryRow key={entry.id} entry={entry} onSave={handleSaveEntryLabel} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ─── SECTION 2: ACCOUNT ──────────────────────────────────── */}
        <section>
          <SectionHeader label="Account" />
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
                    className="w-full bg-[#1B2A3D] border border-[rgba(255,255,255,0.1)] rounded-[8px] px-3 py-2 text-sm text-[#E8E6E1] focus:outline-none focus:border-[#FF5722] transition-colors"
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
                {user?.email}
              </p>
            </div>
          </div>
        </section>

        {/* ─── SECTION 3: POOL INFO (read-only) ───────────────────── */}
        <section>
          <SectionHeader label="Pool Info" />
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[14px] p-5 space-y-3">
            {/* Join Code */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#9BA3AE] mb-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>Join Code</p>
                <p className="text-lg font-bold text-[#FF5722] tracking-[0.15em]" style={{ fontFamily: "'Space Mono', monospace" }}>
                  {pool.join_code}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={handleCopyCode}
                  className={`px-2.5 py-1 rounded-[6px] text-[11px] font-semibold transition-all ${
                    copiedCode
                      ? 'bg-[rgba(76,175,80,0.12)] text-[#4CAF50]'
                      : 'bg-[#1B2A3D] border border-[rgba(255,255,255,0.05)] text-[#9BA3AE] hover:text-[#E8E6E1]'
                  }`}
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {copiedCode ? '✓ Copied' : 'Copy'}
                </button>
                <button
                  onClick={handleShare}
                  className="px-2.5 py-1 rounded-[6px] text-[11px] font-semibold bg-[#1B2A3D] border border-[rgba(255,255,255,0.05)] text-[#9BA3AE] hover:text-[#E8E6E1] transition-all"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Share
                </button>
              </div>
            </div>

            <div className="border-t border-[rgba(255,255,255,0.05)]" />

            {/* Pool details */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Players</p>
                <p className="text-sm font-medium text-[#E8E6E1]" style={{ fontFamily: "'Space Mono', monospace" }}>{pool.player_count}</p>
              </div>
              <div>
                <p className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Max Players</p>
                <p className="text-sm font-medium text-[#E8E6E1]" style={{ fontFamily: "'Space Mono', monospace" }}>{pool.max_players || 'Unlimited'}</p>
              </div>
              <div>
                <p className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Entries Per Player</p>
                <p className="text-sm font-medium text-[#E8E6E1]" style={{ fontFamily: "'Space Mono', monospace" }}>{pool.max_entries_per_user}</p>
              </div>
              <div>
                <p className="text-xs text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Entry Fee</p>
                <p className="text-sm font-medium text-[#E8E6E1]" style={{ fontFamily: "'Space Mono', monospace" }}>{pool.entry_fee > 0 ? `$${pool.entry_fee}` : 'Free'}</p>
              </div>
            </div>

            {/* Pool notes (from creator) */}
            {pool.notes && (
              <>
                <div className="border-t border-[rgba(255,255,255,0.05)]" />
                <div>
                  <p className="text-xs text-[#9BA3AE] mb-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>Pool Notes</p>
                  <p className="text-sm text-[#E8E6E1] whitespace-pre-wrap" style={{ fontFamily: "'DM Sans', sans-serif" }}>{pool.notes}</p>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ═══ CREATOR-ONLY SECTIONS ═══════════════════════════════ */}
        {isCreator && (
          <>
            {/* Divider */}
            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 h-px bg-[rgba(255,87,34,0.2)]" />
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#FF5722] uppercase" style={{ fontFamily: "'Space Mono', monospace" }}>
                Pool Admin
              </span>
              <div className="flex-1 h-px bg-[rgba(255,87,34,0.2)]" />
            </div>

            {/* ─── SECTION 4: POOL SETTINGS (creator form) ─────────── */}
            <section>
              <SectionHeader label="Pool Settings" accent />
              <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[14px] p-5">
                <form onSubmit={handleSaveSettings} className="space-y-5">
                  <div>
                    <label htmlFor="poolName" className="block text-sm font-medium text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Pool Name *</label>
                    <input
                      id="poolName"
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
                    <label htmlFor="maxPlayersInput" className="block text-sm font-medium text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Max Players</label>
                    <input
                      id="maxPlayersInput"
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
                    <label htmlFor="maxEntriesInput" className="block text-sm font-medium text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Entries Per Player</label>
                    <input
                      id="maxEntriesInput"
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

                  <div>
                    <label htmlFor="entryFeeInput" className="block text-sm font-medium text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Entry Fee</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-[#9BA3AE] text-sm">$</span>
                      </div>
                      <input
                        id="entryFeeInput"
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
                    <label htmlFor="poolNotes" className="block text-sm font-medium text-[#9BA3AE] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Pool Notes</label>
                    <textarea
                      id="poolNotes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={500}
                      rows={3}
                      className={`${inputClass} resize-none`}
                      placeholder="Welcome message, rules, payout info..."
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    />
                    <p className="text-xs text-[#9BA3AE] mt-1.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>Visible to all pool members · {notes.length}/500</p>
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
            </section>

            {/* ─── SECTION 5: MEMBERS (creator only) ────────────────── */}
            <section>
              <SectionHeader label={`Members (${members.length})`} accent />
              <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[14px] p-5">
                {members.length === 0 ? (
                  <p className="text-sm text-[#9BA3AE]" style={{ fontFamily: "'DM Sans', sans-serif" }}>No members yet.</p>
                ) : (
                  <div className="divide-y divide-[rgba(255,255,255,0.05)]">
                    {members.map(member => {
                      const isOwnEntry = member.user_id === user?.id;
                      const ownEntryCount = isOwnEntry ? members.filter(m => m.user_id === user?.id).length : 0;
                      const canRemove = !isOwnEntry || ownEntryCount > 1;
                      return (
                        <MemberRow
                          key={member.id}
                          member={member}
                          canRemove={canRemove}
                          onRemove={handleRemoveMember}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* ─── SECTION 6: DANGER ZONE ──────────────────────────────── */}
        {!isCreator && pool.status === 'open' && (
          <section>
            <SectionHeader label="Danger Zone" />
            <div className="bg-[rgba(239,83,80,0.05)] border border-[rgba(239,83,80,0.15)] rounded-[14px] p-5">
              <ConfirmButton
                label="Leave Pool"
                confirmLabel={`Leave ${pool.name}? Your entries and pick history will be deleted. This cannot be undone.`}
                onConfirm={handleLeavePool}
                className="w-full py-3 rounded-[12px] text-sm font-semibold text-[#EF5350] bg-[rgba(239,83,80,0.1)] border border-[rgba(239,83,80,0.2)] hover:border-[rgba(239,83,80,0.4)] transition-colors"
              />
            </div>
          </section>
        )}

        {/* ─── SECTION 7: SIGN OUT + VERSION ───────────────────────── */}
        <section className="pt-2">
          <button
            onClick={() => signOut()}
            className="w-full py-3 rounded-[12px] text-sm font-semibold text-[#EF5350] bg-[rgba(239,83,80,0.1)] border border-[rgba(239,83,80,0.2)] hover:border-[rgba(239,83,80,0.4)] transition-colors"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Sign Out
          </button>
        </section>

        <p className="text-center text-xs text-[#9BA3AE] opacity-50 pt-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          v1.0.0 · © 2026 Survive the Dance
        </p>
      </main>
    </div>
  );
}

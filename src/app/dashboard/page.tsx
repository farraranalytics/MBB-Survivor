'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/auth/AuthProvider';
import { getMyPools } from '@/lib/standings';
import { MyPool, MyPoolEntry } from '@/types/standings';
import { usePoolDetail } from '@/hooks/usePoolDetail';
import PoolDetailView from '@/components/pool/PoolDetailView';
import Link from 'next/link';

const SELECTED_POOL_KEY = 'std_selected_pool';

function EmptyState() {
  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-24">
      <header className="bg-[#111118] border-b border-[rgba(255,255,255,0.05)]">
        <div className="max-w-lg mx-auto px-5">
          <div className="py-4">
            <h1 className="text-xl font-bold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Survive the Dance</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6">
        <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-8 text-center">
          <div className="w-16 h-16 bg-[rgba(255,87,34,0.08)] rounded-[16px] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#FF5722]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <p className="text-[#E8E6E1] font-semibold text-lg mb-1" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>No Pools Yet</p>
          <p className="text-[#8A8694] text-sm mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>Create or join a pool to start playing.</p>
          <div className="flex justify-center gap-3">
            <Link href="/pools/create" className="btn-orange px-5 py-2.5 text-sm font-semibold rounded-[12px]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Create Pool
            </Link>
            <Link href="/pools/join" className="px-5 py-2.5 bg-[#1A1A24] border border-[rgba(255,255,255,0.05)] text-[#8A8694] text-sm font-semibold rounded-[12px] hover:border-[rgba(255,87,34,0.3)] transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Join Pool
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function PoolSwitcher({ pools, selectedId, onSelect }: { pools: MyPool[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {pools.map((pool) => {
        const isSelected = pool.pool_id === selectedId;
        return (
          <button
            key={pool.pool_id}
            onClick={() => onSelect(pool.pool_id)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              isSelected
                ? 'bg-[#FF5722] text-[#E8E6E1]'
                : 'bg-[#111118] border border-[rgba(255,255,255,0.05)] text-[#8A8694] hover:border-[rgba(255,87,34,0.3)]'
            }`}
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            <span className={`w-2 h-2 rounded-full ${
              pool.your_status === 'eliminated' ? 'bg-[#EF5350]' : 'bg-[#4CAF50]'
            }`} />
            {pool.pool_name}
          </button>
        );
      })}
    </div>
  );
}

function BracketSwitcher({ entries, selectedId, onSelect }: { entries: MyPoolEntry[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {entries.map((entry) => {
        const isSelected = entry.pool_player_id === selectedId;
        return (
          <button
            key={entry.pool_player_id}
            onClick={() => onSelect(entry.pool_player_id)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              isSelected
                ? 'bg-[#FF5722] text-[#E8E6E1]'
                : 'bg-[#111118] border border-[rgba(255,255,255,0.05)] text-[#8A8694] hover:border-[rgba(255,87,34,0.3)]'
            }`}
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            <span className={`w-2 h-2 rounded-full ${
              entry.is_eliminated ? 'bg-[#EF5350]' : 'bg-[#4CAF50]'
            }`} />
            {entry.entry_label}
          </button>
        );
      })}
    </div>
  );
}

function PoolHome({ pool, user }: { pool: MyPool; user: NonNullable<ReturnType<typeof useAuth>['user']> }) {
  const { standings, deadline, loading, error } = usePoolDetail(pool.pool_id, user.id);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-5 py-6">
        <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[rgba(255,255,255,0.08)] border-t-[#FF5722] mx-auto mb-3" />
          <p className="text-[#8A8694] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>Loading pool...</p>
        </div>
      </div>
    );
  }

  if (error || !standings) {
    return (
      <div className="max-w-lg mx-auto px-5 py-6">
        <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-8 text-center">
          <p className="text-[#EF5350] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>{error || 'Failed to load pool'}</p>
        </div>
      </div>
    );
  }

  return <PoolDetailView standings={standings} deadline={deadline} user={user} poolId={pool.pool_id} />;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [pools, setPools] = useState<MyPool[]>([]);
  const [loadingPools, setLoadingPools] = useState(true);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [selectedBracketId, setSelectedBracketId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchPools = async () => {
      try {
        const myPools = await getMyPools(user.id);
        setPools(myPools);

        // Restore saved selection or default to first pool
        if (myPools.length > 0) {
          const saved = localStorage.getItem(SELECTED_POOL_KEY);
          const savedExists = saved && myPools.some(p => p.pool_id === saved);
          const firstPool = savedExists ? myPools.find(p => p.pool_id === saved)! : myPools[0];
          setSelectedPoolId(firstPool.pool_id);
          // Default to first bracket
          if (firstPool.your_entries.length > 0) {
            setSelectedBracketId(firstPool.your_entries[0].pool_player_id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch pools:', err);
      } finally {
        setLoadingPools(false);
      }
    };

    fetchPools();
  }, [user]);

  const handleSelectPool = (poolId: string) => {
    setSelectedPoolId(poolId);
    localStorage.setItem(SELECTED_POOL_KEY, poolId);
    // Reset bracket selection to first entry of new pool
    const pool = pools.find(p => p.pool_id === poolId);
    if (pool && pool.your_entries.length > 0) {
      setSelectedBracketId(pool.your_entries[0].pool_player_id);
    } else {
      setSelectedBracketId(null);
    }
  };

  const handleSelectBracket = (bracketId: string) => {
    setSelectedBracketId(bracketId);
  };

  const selectedPool = pools.find(p => p.pool_id === selectedPoolId) || null;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0D1B2A] pb-24">
        {loadingPools ? (
          <>
            <header className="bg-[#111118] border-b border-[rgba(255,255,255,0.05)]">
              <div className="max-w-lg mx-auto px-5">
                <div className="py-4">
                  <h1 className="text-xl font-bold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Survive the Dance</h1>
                </div>
              </div>
            </header>
            <div className="max-w-lg mx-auto px-5 py-6">
              <div className="bg-[#111118] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[rgba(255,255,255,0.08)] border-t-[#FF5722] mx-auto mb-3" />
                <p className="text-[#8A8694] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>Loading your pools...</p>
              </div>
            </div>
          </>
        ) : pools.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Header */}
            <header className="bg-[#111118] border-b border-[rgba(255,255,255,0.05)]">
              <div className="max-w-lg mx-auto px-5">
                <div className="flex justify-between items-center py-4">
                  <h1 className="text-xl font-bold text-[#E8E6E1]" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Survive the Dance</h1>
                  <div className="flex items-center gap-3">
                    <Link href="/pools/create" className="text-[#8A8694] hover:text-[#FF5722] text-xs font-medium transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      Create
                    </Link>
                    <Link href="/pools/join" className="text-[#8A8694] hover:text-[#FF5722] text-xs font-medium transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      Join
                    </Link>
                  </div>
                </div>

                {/* Pool switcher for multiple pools */}
                {pools.length > 1 && (
                  <div className="pb-3">
                    <PoolSwitcher pools={pools} selectedId={selectedPoolId!} onSelect={handleSelectPool} />
                  </div>
                )}

                {/* Bracket switcher for multi-entry pools */}
                {selectedPool && selectedPool.your_entries.length > 1 && selectedBracketId && (
                  <div className="pb-3">
                    <BracketSwitcher entries={selectedPool.your_entries} selectedId={selectedBracketId} onSelect={handleSelectBracket} />
                  </div>
                )}
              </div>
            </header>

            {/* Pool Detail */}
            {selectedPool && user && (
              <PoolHome key={selectedPool.pool_id} pool={selectedPool} user={user} />
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}

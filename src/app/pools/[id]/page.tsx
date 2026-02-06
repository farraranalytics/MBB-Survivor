'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePoolDetail } from '@/hooks/usePoolDetail';
import PoolDetailView from '@/components/pool/PoolDetailView';

export default function PoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const poolId = params.id as string;

  const { standings, deadline, loading, error } = usePoolDetail(poolId, user?.id ?? null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-[rgba(255,255,255,0.08)] border-t-[#FF5722]" />
      </div>
    );
  }

  if (error || !standings) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <div className="text-center px-5">
          <h1 className="text-2xl font-bold text-[#E8E6E1] mb-2" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Pool Not Found</h1>
          <p className="text-[#8A8694] mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {error || 'This pool does not exist or you don\u2019t have access.'}
          </p>
          <button onClick={() => router.push('/dashboard')} className="btn-orange text-[#E8E6E1] px-6 py-3 rounded-[12px] font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] pb-24">
      <PoolDetailView
        standings={standings}
        deadline={deadline}
        user={user!}
        poolId={poolId}
        showBackButton={true}
      />
    </div>
  );
}

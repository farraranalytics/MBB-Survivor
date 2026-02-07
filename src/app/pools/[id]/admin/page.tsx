'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function AdminRedirect() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    router.replace(`/pools/${params.id}/settings`);
  }, [params.id, router]);

  return null;
}

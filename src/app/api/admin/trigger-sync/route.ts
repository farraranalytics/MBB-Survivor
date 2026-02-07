import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // Verify user is authenticated and is a pool creator
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is a pool creator
  const { data: pools } = await supabase
    .from('pools')
    .select('id')
    .eq('creator_id', user.id)
    .limit(1);

  if (!pools || pools.length === 0) {
    return NextResponse.json({ error: 'Not a pool creator' }, { status: 403 });
  }

  const { action } = await request.json();

  // Forward to the appropriate cron endpoint
  const baseUrl = request.nextUrl.origin;
  const secret = process.env.CRON_SECRET || '';

  let targetUrl: string;
  switch (action) {
    case 'sync-games':
      targetUrl = `${baseUrl}/api/cron/sync-games`;
      break;
    case 'process-results':
      targetUrl = `${baseUrl}/api/cron/process-results`;
      break;
    case 'activate-rounds':
      targetUrl = `${baseUrl}/api/cron/activate-rounds`;
      break;
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const response = await fetch(targetUrl, {
    headers: { 'Authorization': `Bearer ${secret}` },
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

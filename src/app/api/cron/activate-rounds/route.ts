import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getTournamentStateServer } from '@/lib/status-server';

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const state = await getTournamentStateServer();

    // If tournament has started but pools are still 'open', transition them
    if (state.status !== 'pre_tournament') {
      const { data: transitioned } = await supabaseAdmin
        .from('pools')
        .update({ status: 'active' })
        .eq('status', 'open')
        .select('id');

      return NextResponse.json({
        success: true,
        tournamentStatus: state.status,
        poolsTransitioned: transitioned?.length || 0,
      });
    }

    return NextResponse.json({ success: true, message: 'Tournament not started yet' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

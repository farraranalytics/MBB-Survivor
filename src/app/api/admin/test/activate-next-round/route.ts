import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  // Auth: must be a pool creator
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: pools } = await supabase
    .from('pools')
    .select('id')
    .eq('creator_id', user.id)
    .limit(1);

  if (!pools || pools.length === 0) {
    return NextResponse.json({ error: 'Not a pool creator' }, { status: 403 });
  }

  try {
    // Get all rounds ordered by date
    const { data: rounds } = await supabaseAdmin
      .from('rounds')
      .select('id, name, date, is_active')
      .order('date', { ascending: true });

    if (!rounds || rounds.length === 0) {
      return NextResponse.json({ error: 'No rounds found' }, { status: 400 });
    }

    const currentlyActive = rounds.find(r => r.is_active);

    // Find the next round after the active one (or the first round if none active)
    let nextRound;
    if (currentlyActive) {
      const currentIndex = rounds.findIndex(r => r.id === currentlyActive.id);
      nextRound = rounds[currentIndex + 1];

      if (!nextRound) {
        return NextResponse.json({ error: 'No more rounds — tournament is complete' }, { status: 400 });
      }

      // Deactivate current
      await supabaseAdmin
        .from('rounds')
        .update({ is_active: false })
        .eq('id', currentlyActive.id);
    } else {
      // No active round — activate the first one that has non-final games
      nextRound = rounds.find(r => !r.is_active);
      if (!nextRound) {
        return NextResponse.json({ error: 'All rounds are complete' }, { status: 400 });
      }
    }

    // Activate next round
    await supabaseAdmin
      .from('rounds')
      .update({ is_active: true })
      .eq('id', nextRound.id);

    // If this is the first round activation, transition pools from open → active
    const isFirstRound = rounds[0]?.id === nextRound.id;
    let poolsTransitioned = 0;
    if (isFirstRound) {
      const { data: transitioned } = await supabaseAdmin
        .from('pools')
        .update({ status: 'active' })
        .eq('status', 'open')
        .select('id');
      poolsTransitioned = transitioned?.length || 0;
    }

    return NextResponse.json({
      success: true,
      deactivated: currentlyActive?.name || null,
      activated: nextRound.name,
      poolsTransitioned,
    });

  } catch (err: any) {
    console.error('activate-next-round error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

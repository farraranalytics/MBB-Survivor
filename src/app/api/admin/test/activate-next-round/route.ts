import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTournamentStateServer } from '@/lib/status-server';

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
    const state = await getTournamentStateServer();
    if (!state.currentRound) {
      return NextResponse.json({ error: 'No current round' }, { status: 400 });
    }

    if (state.currentRound.status !== 'round_complete') {
      return NextResponse.json({
        error: `Current round "${state.currentRound.name}" is not complete yet. Complete all games first.`,
        gamesRemaining: state.currentRound.gamesScheduled + state.currentRound.gamesInProgress,
      }, { status: 400 });
    }

    // Current round is complete — the next pre_round round is automatically the new current.
    // Re-fetch state to confirm
    const newState = await getTournamentStateServer();
    return NextResponse.json({
      success: true,
      previousRound: state.currentRound.name,
      newCurrentRound: newState.currentRound?.name || 'Tournament complete',
      tournamentStatus: newState.status,
    });

  } catch (err: any) {
    console.error('activate-next-round error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateFullBracket, F4Pairings } from '@/lib/bracket-generator';

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
    const body = await request.json().catch(() => ({}));

    // Optional F4 pairings override
    let f4Pairings: F4Pairings | undefined;
    if (body.f4_pairings) {
      f4Pairings = {
        f4_1: body.f4_pairings.f4_1,
        f4_2: body.f4_pairings.f4_2,
      };
    }

    const result = await generateFullBracket(f4Pairings);

    return NextResponse.json({
      success: result.errors.length === 0,
      ...result,
    });
  } catch (err: any) {
    console.error('generate-bracket error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

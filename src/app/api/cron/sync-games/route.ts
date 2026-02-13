import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyCronAuth } from '@/lib/cron-auth';

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball';

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = { synced: 0, deadlinesUpdated: 0, errors: [] as string[] };

    // 1. Get all rounds from our DB that haven't completed yet
    const { data: rounds } = await supabaseAdmin
      .from('rounds')
      .select('id, name, date, deadline_datetime')
      .order('date', { ascending: true });

    if (!rounds || rounds.length === 0) {
      return NextResponse.json({ message: 'No rounds found', results });
    }

    // 2. For each round, fetch ESPN games for that date
    for (const round of rounds) {
      try {
        const dateFormatted = round.date.replace(/-/g, ''); // '2026-03-20' → '20260320'
        const url = `${ESPN_BASE_URL}/scoreboard?dates=${dateFormatted}&seasontype=3&division=50`;
        
        const response = await fetch(url, {
          headers: { 'User-Agent': 'MBB-Survivor-Pool/1.0', 'Accept': 'application/json' },
          next: { revalidate: 0 }, // no cache
        });

        if (!response.ok) {
          results.errors.push(`ESPN returned ${response.status} for ${round.date}`);
          continue;
        }

        const data = await response.json();
        const events = data.events || [];

        // 3. Get our games for this round
        const { data: ourGames } = await supabaseAdmin
          .from('games')
          .select('id, team1_id, team2_id, espn_game_id, game_datetime, teams_t1:team1_id(name, abbreviation), teams_t2:team2_id(name, abbreviation)')
          .eq('round_id', round.id);

        if (!ourGames) continue;

        // 4. Match ESPN events to our games and update times
        for (const event of events) {
          const espnId = event.id;
          const espnDate = event.date; // ISO datetime
          const competitors = event.competitions?.[0]?.competitors || [];
          
          if (competitors.length < 2) continue;

          const espnTeam1 = competitors[0]?.team?.displayName || competitors[0]?.team?.name || '';
          const espnTeam2 = competitors[1]?.team?.displayName || competitors[1]?.team?.name || '';

          // Find matching game in our DB
          let matchedGame = ourGames.find(g => g.espn_game_id === espnId);
          
          if (!matchedGame) {
            // Try matching by team names
            matchedGame = ourGames.find(g => {
              const t1Name = (g as any).teams_t1?.name || '';
              const t2Name = (g as any).teams_t2?.name || '';
              return (
                (espnTeam1.includes(t1Name) || espnTeam1.includes(t2Name)) &&
                (espnTeam2.includes(t1Name) || espnTeam2.includes(t2Name))
              );
            });
          }

          if (matchedGame) {
            // Update game time and ESPN ID
            await supabaseAdmin
              .from('games')
              .update({
                game_datetime: espnDate,
                espn_game_id: espnId,
              })
              .eq('id', matchedGame.id);
            results.synced++;
          }
        }

        // 5. Calculate deadline: earliest game time for this round minus 5 minutes
        const { data: roundGames } = await supabaseAdmin
          .from('games')
          .select('game_datetime')
          .eq('round_id', round.id)
          .order('game_datetime', { ascending: true })
          .limit(1);

        if (roundGames && roundGames.length > 0) {
          const earliestGame = new Date(roundGames[0].game_datetime);
          const deadline = new Date(earliestGame.getTime() - 5 * 60 * 1000); // 5 min before

          await supabaseAdmin
            .from('rounds')
            .update({ deadline_datetime: deadline.toISOString() })
            .eq('id', round.id);
          results.deadlinesUpdated++;
        }

      } catch (err: any) {
        results.errors.push(`Error syncing round ${round.name}: ${err.message}`);
      }
    }

    return NextResponse.json({ success: true, results });

  } catch (err: any) {
    console.error('sync-games error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

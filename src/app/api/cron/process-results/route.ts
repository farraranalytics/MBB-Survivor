import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getTournamentStateServer } from '@/lib/status-server';
import {
  processCompletedGame,
  processMissedPicks,
  checkRoundCompletion,
} from '@/lib/game-processing';

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball';

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = {
      gamesUpdated: 0,
      gamesCompleted: 0,
      picksMarkedCorrect: 0,
      picksMarkedIncorrect: 0,
      playersEliminated: 0,
      missedPickEliminations: 0,
      roundsCompleted: 0,
      poolsCompleted: 0,
      errors: [] as string[],
    };

    // 1. Get current round from derived tournament state
    const state = await getTournamentStateServer();
    if (!state.currentRound) {
      return NextResponse.json({ message: 'No current round', results });
    }
    const activeRound = { id: state.currentRound.id, name: state.currentRound.name, date: state.currentRound.date };

    const { data: pendingGames } = await supabaseAdmin
      .from('games')
      .select('id, team1_id, team2_id, espn_game_id, status, game_datetime')
      .eq('round_id', activeRound.id)
      .in('status', ['scheduled', 'in_progress']);

    if (!pendingGames || pendingGames.length === 0) {
      // All games may already be final — check for missed pick processing
      await processMissedPicks(activeRound.id, results);
      await checkRoundCompletion(activeRound.id, results);
      return NextResponse.json({ message: 'No pending games', results });
    }

    // 2. Fetch live scores from ESPN for today
    const dateFormatted = activeRound.date.replace(/-/g, '');
    const url = `${ESPN_BASE_URL}/scoreboard?dates=${dateFormatted}&seasontype=3&division=50`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'MBB-Survivor-Pool/1.0', 'Accept': 'application/json' },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `ESPN returned ${response.status}` }, { status: 502 });
    }

    const espnData = await response.json();
    const events = espnData.events || [];

    // 3. Process each pending game
    for (const game of pendingGames) {
      try {
        // Find matching ESPN event
        let espnEvent = events.find((e: any) => e.id === game.espn_game_id);

        if (!espnEvent) {
          // Try matching by team IDs — get our team names first
          const { data: t1 } = await supabaseAdmin.from('teams').select('name').eq('id', game.team1_id).single();
          const { data: t2 } = await supabaseAdmin.from('teams').select('name').eq('id', game.team2_id).single();

          if (t1 && t2) {
            espnEvent = events.find((e: any) => {
              const competitors = e.competitions?.[0]?.competitors || [];
              const names = competitors.map((c: any) => c.team?.displayName || c.team?.name || '');
              return names.some((n: string) => n.includes(t1.name)) &&
                     names.some((n: string) => n.includes(t2.name));
            });
          }
        }

        if (!espnEvent) continue;

        const competition = espnEvent.competitions?.[0];
        if (!competition) continue;

        const competitors = competition.competitors || [];
        const espnStatus = espnEvent.status?.type;
        const isCompleted = espnStatus?.completed === true;
        const isInProgress = espnStatus?.state === 'in';

        // Get scores
        const score1 = competitors[0]?.score;
        const score2 = competitors[1]?.score;

        // Determine which ESPN competitor maps to which of our teams
        const espnTeam1Name = competitors[0]?.team?.displayName || '';

        const { data: ourTeam1 } = await supabaseAdmin.from('teams').select('name').eq('id', game.team1_id).single();

        // Figure out score mapping (ESPN order may differ from our team1/team2)
        let team1Score: number | null = null;
        let team2Score: number | null = null;
        let winnerId: string | null = null;
        let loserId: string | null = null;

        if (score1 != null && score2 != null) {
          if (espnTeam1Name.includes(ourTeam1?.name || '___')) {
            team1Score = typeof score1 === 'string' ? parseInt(score1) : score1;
            team2Score = typeof score2 === 'string' ? parseInt(score2) : score2;
          } else {
            // ESPN has them in reverse order from our DB
            team1Score = typeof score2 === 'string' ? parseInt(score2) : score2;
            team2Score = typeof score1 === 'string' ? parseInt(score1) : score1;
          }

          if (isCompleted && team1Score !== null && team2Score !== null) {
            winnerId = team1Score > team2Score ? game.team1_id : game.team2_id;
            loserId = team1Score > team2Score ? game.team2_id : game.team1_id;
          }
        }

        // Determine new status
        let newStatus: 'scheduled' | 'in_progress' | 'final' = game.status as any;
        if (isCompleted) newStatus = 'final';
        else if (isInProgress) newStatus = 'in_progress';

        // 4. Update game record
        const updateData: any = { status: newStatus };
        if (team1Score !== null) updateData.team1_score = team1Score;
        if (team2Score !== null) updateData.team2_score = team2Score;
        if (winnerId) updateData.winner_id = winnerId;
        if (!game.espn_game_id) updateData.espn_game_id = espnEvent.id;

        await supabaseAdmin.from('games').update(updateData).eq('id', game.id);
        results.gamesUpdated++;

        // 5. If game just completed, process picks using shared logic
        if (isCompleted && winnerId && loserId && game.status !== 'final') {
          await processCompletedGame(activeRound.id, winnerId, loserId, results);
        }

      } catch (err: any) {
        results.errors.push(`Error processing game ${game.id}: ${err.message}`);
      }
    }

    // 7. Check if all games in round are complete → process missed picks
    await processMissedPicks(activeRound.id, results);

    // 8. Check if round is complete → advance to next
    await checkRoundCompletion(activeRound.id, results);

    return NextResponse.json({ success: true, results });

  } catch (err: any) {
    console.error('process-results error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

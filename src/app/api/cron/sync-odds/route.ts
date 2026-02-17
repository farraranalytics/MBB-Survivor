import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyCronAuth } from '@/lib/cron-auth';
import { fetchNcaabOdds, extractBestOdds } from '@/lib/odds';

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = { synced: 0, skipped: 0, errors: [] as string[], quotaRemaining: null as number | null };

    // 1. Fetch odds from The Odds API
    const { events: oddsEvents, quota } = await fetchNcaabOdds();
    results.quotaRemaining = quota.remaining;

    if (oddsEvents.length === 0) {
      return NextResponse.json({ message: 'No odds events returned (NCAAB may be inactive)', results });
    }

    // 2. Get all games from DB with team names
    const { data: dbGames } = await supabaseAdmin
      .from('games')
      .select('id, team1_id, team2_id, teams_t1:team1_id(name), teams_t2:team2_id(name)')
      .not('team1_id', 'is', null)
      .not('team2_id', 'is', null);

    if (!dbGames || dbGames.length === 0) {
      return NextResponse.json({ message: 'No games with teams found in DB', results });
    }

    // 3. Match odds events to DB games by team name
    for (const oddsEvent of oddsEvents) {
      try {
        const matchedGame = findMatchingGame(dbGames, oddsEvent.home_team, oddsEvent.away_team);

        if (!matchedGame) {
          results.skipped++;
          continue;
        }

        // Determine which DB team is home vs away
        const t1Name = (matchedGame as any).teams_t1?.name || '';
        const t2Name = (matchedGame as any).teams_t2?.name || '';

        // Figure out if team1 is home or away in the odds event
        const team1IsHome = fuzzyMatch(t1Name, oddsEvent.home_team);
        const homeTeam = oddsEvent.home_team;
        const awayTeam = oddsEvent.away_team;

        const odds = extractBestOdds(oddsEvent.bookmakers, homeTeam, awayTeam);

        // Map home/away odds to team1/team2
        const team1ML = team1IsHome ? odds.team1Moneyline : odds.team2Moneyline;
        const team2ML = team1IsHome ? odds.team2Moneyline : odds.team1Moneyline;
        const team1Spread = team1IsHome ? odds.team1Spread : odds.team2Spread;
        const team1WinProb = team1IsHome ? odds.team1WinProbability : odds.team2WinProbability;
        const team2WinProb = team1IsHome ? odds.team2WinProbability : odds.team1WinProbability;

        await supabaseAdmin
          .from('games')
          .update({
            team1_moneyline: team1ML,
            team2_moneyline: team2ML,
            team1_spread: team1Spread,
            team1_win_probability: team1WinProb,
            team2_win_probability: team2WinProb,
            odds_updated_at: new Date().toISOString(),
          })
          .eq('id', matchedGame.id);

        results.synced++;
      } catch (err: any) {
        results.errors.push(`Error matching ${oddsEvent.home_team} vs ${oddsEvent.away_team}: ${err.message}`);
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error('sync-odds error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Fuzzy match an odds API team name against our DB team name.
 * Odds API: "Duke Blue Devils", DB: "Duke" or "Duke Blue Devils"
 */
function fuzzyMatch(dbName: string, oddsName: string): boolean {
  const dbLower = dbName.toLowerCase();
  const oddsLower = oddsName.toLowerCase();
  return oddsLower.includes(dbLower) || dbLower.includes(oddsLower);
}

/**
 * Find a DB game that matches the two teams from an odds event.
 */
function findMatchingGame(
  dbGames: any[],
  homeTeam: string,
  awayTeam: string
): any | null {
  return dbGames.find(game => {
    const t1Name = game.teams_t1?.name || '';
    const t2Name = game.teams_t2?.name || '';
    const homeMatchesT1 = fuzzyMatch(t1Name, homeTeam);
    const homeMatchesT2 = fuzzyMatch(t2Name, homeTeam);
    const awayMatchesT1 = fuzzyMatch(t1Name, awayTeam);
    const awayMatchesT2 = fuzzyMatch(t2Name, awayTeam);
    // Either ordering: (t1=home, t2=away) or (t1=away, t2=home)
    return (homeMatchesT1 && awayMatchesT2) || (homeMatchesT2 && awayMatchesT1);
  }) || null;
}

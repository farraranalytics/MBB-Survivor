import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  validateApiKey,
  checkNcaabActive,
  fetchNcaabOdds,
  extractBestOdds,
} from '@/lib/odds';

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball';

export async function POST(request: NextRequest) {
  // Auth: pool creator check
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

  const { test, params } = await request.json();
  const start = Date.now();

  try {
    let data: any;
    let quota: any = null;

    switch (test) {
      case 'espn-scoreboard': {
        const response = await fetch(
          `${ESPN_BASE_URL}/scoreboard?seasontype=3&division=50`,
          {
            headers: { 'User-Agent': 'MBB-Survivor-Pool/1.0', 'Accept': 'application/json' },
            next: { revalidate: 0 },
          }
        );
        if (!response.ok) throw new Error(`ESPN returned ${response.status}`);
        const json = await response.json();
        const events = json.events || [];
        data = {
          status: response.status,
          eventCount: events.length,
          events: events.map((e: any) => ({
            id: e.id,
            name: e.name,
            date: e.date,
            status: e.status?.type?.name,
            completed: e.status?.type?.completed,
          })),
        };
        break;
      }

      case 'espn-team': {
        const teamId = params?.teamId || '150'; // Duke default
        const response = await fetch(
          `${ESPN_BASE_URL}/teams/${teamId}`,
          {
            headers: { 'User-Agent': 'MBB-Survivor-Pool/1.0', 'Accept': 'application/json' },
            next: { revalidate: 0 },
          }
        );
        if (!response.ok) throw new Error(`ESPN returned ${response.status}`);
        const json = await response.json();
        const team = json.team;
        data = {
          status: response.status,
          team: {
            id: team.id,
            name: team.name,
            displayName: team.displayName,
            abbreviation: team.abbreviation,
            logo: team.logos?.[0]?.href,
            color: team.color,
          },
        };
        break;
      }

      case 'espn-game-match': {
        // Get a round's games and compare against ESPN
        const { data: rounds } = await supabaseAdmin
          .from('rounds')
          .select('id, name, date')
          .order('date', { ascending: true });

        if (!rounds || rounds.length === 0) {
          data = { message: 'No rounds in DB' };
          break;
        }

        // Use specified round or first round with a date
        const targetRound = params?.roundId
          ? rounds.find((r: any) => r.id === params.roundId)
          : rounds[0];

        if (!targetRound) {
          data = { message: 'Round not found' };
          break;
        }

        const dateFormatted = targetRound.date?.replace(/-/g, '') || '';
        const response = await fetch(
          `${ESPN_BASE_URL}/scoreboard?dates=${dateFormatted}&seasontype=3&division=50`,
          {
            headers: { 'User-Agent': 'MBB-Survivor-Pool/1.0', 'Accept': 'application/json' },
            next: { revalidate: 0 },
          }
        );

        const json = await response.json();
        const espnEvents = json.events || [];

        const { data: dbGames } = await supabaseAdmin
          .from('games')
          .select('id, espn_game_id, game_datetime, teams_t1:team1_id(name), teams_t2:team2_id(name)')
          .eq('round_id', targetRound.id);

        data = {
          round: targetRound.name,
          date: targetRound.date,
          espnEventCount: espnEvents.length,
          dbGameCount: dbGames?.length || 0,
          espnEvents: espnEvents.map((e: any) => ({
            id: e.id,
            name: e.name,
            date: e.date,
          })),
          dbGames: (dbGames || []).map((g: any) => ({
            id: g.id,
            espnId: g.espn_game_id,
            team1: g.teams_t1?.name,
            team2: g.teams_t2?.name,
            datetime: g.game_datetime,
          })),
        };
        break;
      }

      case 'odds-validate': {
        const result = await validateApiKey();
        data = { valid: result.valid };
        quota = result.quota;
        break;
      }

      case 'odds-ncaab-active': {
        const result = await checkNcaabActive();
        data = { active: result.active };
        quota = result.quota;
        break;
      }

      case 'odds-fetch': {
        const result = await fetchNcaabOdds();
        quota = result.quota;
        data = {
          eventCount: result.events.length,
          events: result.events.map(e => {
            const odds = extractBestOdds(e.bookmakers, e.home_team, e.away_team);
            return {
              id: e.id,
              homeTeam: e.home_team,
              awayTeam: e.away_team,
              commenceTime: e.commence_time,
              bookmakerCount: e.bookmakers.length,
              odds: {
                homeMoneyline: odds.team1Moneyline,
                awayMoneyline: odds.team2Moneyline,
                homeSpread: odds.team1Spread,
                awaySpread: odds.team2Spread,
                homeWinProb: odds.team1WinProbability,
                awayWinProb: odds.team2WinProbability,
              },
            };
          }),
        };
        break;
      }

      case 'odds-sync-preview': {
        // Dry run: show what would be updated
        const { events: oddsEvents, quota: q } = await fetchNcaabOdds();
        quota = q;

        const { data: dbGames } = await supabaseAdmin
          .from('games')
          .select('id, team1_id, team2_id, team1_moneyline, team2_moneyline, teams_t1:team1_id(name), teams_t2:team2_id(name)')
          .not('team1_id', 'is', null)
          .not('team2_id', 'is', null);

        const matches: any[] = [];
        const unmatched: string[] = [];

        for (const event of oddsEvents) {
          const match = (dbGames || []).find((game: any) => {
            const t1 = (game as any).teams_t1?.name?.toLowerCase() || '';
            const t2 = (game as any).teams_t2?.name?.toLowerCase() || '';
            const home = event.home_team.toLowerCase();
            const away = event.away_team.toLowerCase();
            return (home.includes(t1) || t1.includes(home)) && (away.includes(t2) || t2.includes(away))
              || (home.includes(t2) || t2.includes(home)) && (away.includes(t1) || t1.includes(away));
          });

          if (match) {
            const t1Name = (match as any).teams_t1?.name || '';
            const team1IsHome = event.home_team.toLowerCase().includes(t1Name.toLowerCase());
            const odds = extractBestOdds(event.bookmakers, event.home_team, event.away_team);

            matches.push({
              oddsEvent: `${event.away_team} @ ${event.home_team}`,
              dbGame: `${(match as any).teams_t1?.name} vs ${(match as any).teams_t2?.name}`,
              dbGameId: match.id,
              currentML: `${match.team1_moneyline || '—'} / ${match.team2_moneyline || '—'}`,
              proposedML: `${(team1IsHome ? odds.team1Moneyline : odds.team2Moneyline) ?? '—'} / ${(team1IsHome ? odds.team2Moneyline : odds.team1Moneyline) ?? '—'}`,
              proposedSpread: (team1IsHome ? odds.team1Spread : odds.team2Spread) ?? '—',
              proposedProb: `${((team1IsHome ? odds.team1WinProbability : odds.team2WinProbability) ?? 0) * 100}% / ${((team1IsHome ? odds.team2WinProbability : odds.team1WinProbability) ?? 0) * 100}%`,
            });
          } else {
            unmatched.push(`${event.away_team} @ ${event.home_team}`);
          }
        }

        data = {
          totalOddsEvents: oddsEvents.length,
          matched: matches.length,
          unmatched: unmatched.length,
          matches,
          unmatchedEvents: unmatched,
        };
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown test: ${test}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data,
      duration_ms: Date.now() - start,
      ...(quota ? { quota } : {}),
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      duration_ms: Date.now() - start,
    });
  }
}

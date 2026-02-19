import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyCronAuth } from '@/lib/cron-auth';
import { propagateWinner, processNoAvailablePicks, checkForChampions, deleteFuturePicksForEntries } from '@/lib/game-processing';
import { sendBulkNotifications } from '@/lib/notifications';

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
      noAvailablePickEliminations: 0,
      championsDeclared: 0,
      roundsCompleted: 0,
      poolsCompleted: 0,
      roundActivated: null as string | null,
      notificationsSent: 0,
      errors: [] as string[],
    };

    // 0. Activate today's round if needed (replaces separate activate-rounds cron)
    await activateTodaysRound(results);

    // 1. Get active round and its games that aren't final yet
    const { data: activeRound } = await supabaseAdmin
      .from('rounds')
      .select('id, name, date')
      .eq('is_active', true)
      .single();

    if (!activeRound) {
      return NextResponse.json({ message: 'No active round', results });
    }

    const { data: pendingGames } = await supabaseAdmin
      .from('games')
      .select('id, team1_id, team2_id, espn_game_id, status, game_datetime')
      .eq('round_id', activeRound.id)
      .in('status', ['scheduled', 'in_progress']);

    if (!pendingGames || pendingGames.length === 0) {
      // All games may already be final — process eliminations + champion check
      await processMissedPicks(activeRound.id, results);
      await processNoAvailablePicks(activeRound.id, results as any);
      await checkForChampions(activeRound.id, results as any);
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
        const espnTeam2Name = competitors[1]?.team?.displayName || '';
        
        const { data: ourTeam1 } = await supabaseAdmin.from('teams').select('name').eq('id', game.team1_id).single();
        const { data: ourTeam2 } = await supabaseAdmin.from('teams').select('name').eq('id', game.team2_id).single();

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

        // 5. If game just completed, process picks
        if (isCompleted && winnerId && loserId && game.status !== 'final') {
          results.gamesCompleted++;

          // Mark winning picks correct
          const { data: correctPicks } = await supabaseAdmin
            .from('picks')
            .update({ is_correct: true })
            .eq('round_id', activeRound.id)
            .eq('team_id', winnerId)
            .is('is_correct', null)
            .select('id');
          results.picksMarkedCorrect += correctPicks?.length || 0;

          // Mark losing picks incorrect
          const { data: incorrectPicks } = await supabaseAdmin
            .from('picks')
            .update({ is_correct: false })
            .eq('round_id', activeRound.id)
            .eq('team_id', loserId)
            .is('is_correct', null)
            .select('pool_player_id');
          results.picksMarkedIncorrect += incorrectPicks?.length || 0;

          // Eliminate losing team
          await supabaseAdmin
            .from('teams')
            .update({ is_eliminated: true })
            .eq('id', loserId);

          // 6. Eliminate players who picked the loser
          if (incorrectPicks && incorrectPicks.length > 0) {
            const poolPlayerIds = incorrectPicks.map(p => p.pool_player_id);

            const { data: eliminated } = await supabaseAdmin
              .from('pool_players')
              .update({
                is_eliminated: true,
                elimination_round_id: activeRound.id,
                elimination_reason: 'wrong_pick',
              })
              .in('id', poolPlayerIds)
              .eq('is_eliminated', false)
              .select('id, user_id, pool_id');
            results.playersEliminated += eliminated?.length || 0;

            // Delete future round picks for eliminated entries
            if (eliminated && eliminated.length > 0) {
              await deleteFuturePicksForEntries(eliminated.map(e => e.id));

              // Notify eliminated players
              const poolIds = [...new Set(eliminated.map(e => e.pool_id))];
              const { data: pools } = await supabaseAdmin
                .from('pools')
                .select('id, name')
                .in('id', poolIds);
              const poolMap = new Map(pools?.map(p => [p.id, p.name]) || []);

              const notifs = eliminated.map(e => ({
                userId: e.user_id,
                title: 'Eliminated',
                message: `Your pick lost. You've been eliminated from ${poolMap.get(e.pool_id) || 'your pool'}.`,
                url: `/pools/${e.pool_id}/standings`,
                type: 'game_result' as const,
                poolId: e.pool_id,
              }));
              sendBulkNotifications(notifs).then(r => { results.notificationsSent += r.sent; }).catch(() => {});
            }
          }

          // Notify players whose pick won
          if (correctPicks && correctPicks.length > 0) {
            const correctPickIds = correctPicks.map(p => p.id);
            const { data: winPicks } = await supabaseAdmin
              .from('picks')
              .select('pool_player_id')
              .in('id', correctPickIds);

            if (winPicks && winPicks.length > 0) {
              const winPlayerIds = winPicks.map(p => p.pool_player_id);
              const { data: winPlayers } = await supabaseAdmin
                .from('pool_players')
                .select('user_id, pool_id')
                .in('id', winPlayerIds);

              if (winPlayers && winPlayers.length > 0) {
                const poolIds = [...new Set(winPlayers.map(e => e.pool_id))];
                const { data: pools } = await supabaseAdmin
                  .from('pools')
                  .select('id, name')
                  .in('id', poolIds);
                const poolMap = new Map(pools?.map(p => [p.id, p.name]) || []);

                const notifs = winPlayers.map(e => ({
                  userId: e.user_id,
                  title: 'Your Pick Won!',
                  message: `You advance in ${poolMap.get(e.pool_id) || 'your pool'}!`,
                  url: `/pools/${e.pool_id}/standings`,
                  type: 'game_result' as const,
                  poolId: e.pool_id,
                }));
                sendBulkNotifications(notifs).then(r => { results.notificationsSent += r.sent; }).catch(() => {});
              }
            }
          }

          // 7. Propagate winner to next-round game slot
          await propagateWinner(game.id, winnerId);
        }

      } catch (err: any) {
        results.errors.push(`Error processing game ${game.id}: ${err.message}`);
      }
    }

    // 7. Check if all games in round are complete → process eliminations
    await processMissedPicks(activeRound.id, results);
    await processNoAvailablePicks(activeRound.id, results as any);
    await checkForChampions(activeRound.id, results as any);

    // 8. Check if round is complete → advance to next
    await checkRoundCompletion(activeRound.id, results);

    return NextResponse.json({ success: true, results });

  } catch (err: any) {
    console.error('process-results error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * After ALL games in a round are final, eliminate players who didn't submit a pick.
 * We wait until all games are done to avoid false positives.
 */
async function processMissedPicks(
  roundId: string,
  results: { missedPickEliminations: number; errors: string[] }
) {
  // Check if all games in this round are final
  const { data: pendingGames } = await supabaseAdmin
    .from('games')
    .select('id')
    .eq('round_id', roundId)
    .in('status', ['scheduled', 'in_progress']);

  if (pendingGames && pendingGames.length > 0) {
    return; // Still games in progress — don't process missed picks yet
  }

  // Find alive players who have no pick for this round
  // Get all pool_players who are NOT eliminated
  const { data: alivePlayers } = await supabaseAdmin
    .from('pool_players')
    .select('id, pool_id')
    .eq('is_eliminated', false);

  if (!alivePlayers || alivePlayers.length === 0) return;

  // For each alive player, check if they have a pick for this round
  const alivePlayerIds = alivePlayers.map(p => p.id);
  const { data: picksForRound } = await supabaseAdmin
    .from('picks')
    .select('pool_player_id')
    .eq('round_id', roundId)
    .in('pool_player_id', alivePlayerIds);

  const playerIdsWithPicks = new Set(picksForRound?.map(p => p.pool_player_id) || []);
  const playersWithoutPicks = alivePlayers.filter(p => !playerIdsWithPicks.has(p.id));

  if (playersWithoutPicks.length === 0) return;

  // Eliminate players who missed their pick
  const missedIds = playersWithoutPicks.map(p => p.id);
  const { data: missedElim } = await supabaseAdmin
    .from('pool_players')
    .update({
      is_eliminated: true,
      elimination_round_id: roundId,
      elimination_reason: 'missed_pick',
    })
    .in('id', missedIds)
    .eq('is_eliminated', false)
    .select('id, user_id, pool_id');

  results.missedPickEliminations = missedElim?.length || 0;

  // Delete future round picks for eliminated entries
  if (missedElim && missedElim.length > 0) {
    await deleteFuturePicksForEntries(missedElim.map(e => e.id));
  }

  // Notify missed-pick eliminations
  if (missedElim && missedElim.length > 0) {
    const poolIds = [...new Set(missedElim.map(e => e.pool_id))];
    const { data: pools } = await supabaseAdmin
      .from('pools')
      .select('id, name')
      .in('id', poolIds);
    const poolMap = new Map(pools?.map(p => [p.id, p.name]) || []);

    const notifs = missedElim.map(e => ({
      userId: e.user_id,
      title: 'Missed Pick',
      message: `You missed the deadline and have been eliminated from ${poolMap.get(e.pool_id) || 'your pool'}.`,
      url: `/pools/${e.pool_id}/standings`,
      type: 'game_result' as const,
      poolId: e.pool_id,
    }));
    sendBulkNotifications(notifs).catch(() => {});
  }
}

/**
 * Check if a round is complete (all games final) and handle advancement.
 */
async function checkRoundCompletion(
  roundId: string,
  results: { roundsCompleted: number; poolsCompleted: number; errors: string[] }
) {
  // Check if all games in this round are final
  const { data: nonFinalGames } = await supabaseAdmin
    .from('games')
    .select('id')
    .eq('round_id', roundId)
    .neq('status', 'final');

  if (nonFinalGames && nonFinalGames.length > 0) {
    return; // Not all games are done
  }

  // Round is complete — deactivate it
  await supabaseAdmin
    .from('rounds')
    .update({ is_active: false })
    .eq('id', roundId);
  results.roundsCompleted++;

  // Check if this was the LAST round (Championship)
  const { data: futureRounds } = await supabaseAdmin
    .from('rounds')
    .select('id, name, date')
    .gt('date', (await supabaseAdmin.from('rounds').select('date').eq('id', roundId).single()).data?.date || '')
    .order('date', { ascending: true });

  if (!futureRounds || futureRounds.length === 0) {
    // Tournament is over — complete all active pools
    // For each pool, find the winner (last alive player)
    const { data: pools } = await supabaseAdmin
      .from('pools')
      .select('id')
      .eq('status', 'active');

    for (const pool of (pools || [])) {
      const { data: alivePlayers } = await supabaseAdmin
        .from('pool_players')
        .select('user_id')
        .eq('pool_id', pool.id)
        .eq('is_eliminated', false)
        .limit(1);

      const winnerId = alivePlayers?.[0]?.user_id || null;

      await supabaseAdmin
        .from('pools')
        .update({ status: 'complete', winner_id: winnerId })
        .eq('id', pool.id);
      results.poolsCompleted++;
    }
  }
  // If there are future rounds, activateTodaysRound() handles activation on next cron tick
}

/**
 * Activate today's round if deadline is within 6 hours.
 * Inlined from /api/cron/activate-rounds to stay within Vercel Hobby 2-cron limit.
 */
async function activateTodaysRound(results: { roundActivated: string | null; notificationsSent: number; errors: string[] }) {
  try {
    const now = new Date();

    const { data: rounds } = await supabaseAdmin
      .from('rounds')
      .select('id, name, date, deadline_datetime, is_active')
      .order('date', { ascending: true });

    if (!rounds) return;

    const todayET = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayStr = todayET.toISOString().split('T')[0];

    const todayRound = rounds.find(r => r.date === todayStr);
    const currentlyActive = rounds.find(r => r.is_active);

    if (todayRound && !todayRound.is_active) {
      const deadlineTime = new Date(todayRound.deadline_datetime);
      const hoursUntilDeadline = (deadlineTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilDeadline <= 6 && hoursUntilDeadline >= -24) {
        if (currentlyActive && currentlyActive.id !== todayRound.id) {
          await supabaseAdmin
            .from('rounds')
            .update({ is_active: false })
            .eq('id', currentlyActive.id);
        }

        await supabaseAdmin
          .from('rounds')
          .update({ is_active: true })
          .eq('id', todayRound.id);
        results.roundActivated = todayRound.name;

        // Notify alive players: new round available
        const deadlineStr = new Date(todayRound.deadline_datetime).toLocaleString('en-US', {
          timeZone: 'America/New_York',
          month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit', hour12: true,
        });
        const { data: aliveEntries } = await supabaseAdmin
          .from('pool_players')
          .select('user_id, pool_id')
          .eq('is_eliminated', false)
          .eq('entry_deleted', false);

        if (aliveEntries && aliveEntries.length > 0) {
          // Deduplicate by user_id + pool_id
          const seen = new Set<string>();
          const uniqueEntries = aliveEntries.filter(e => {
            const key = `${e.user_id}:${e.pool_id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          const poolIds = [...new Set(uniqueEntries.map(e => e.pool_id))];
          const { data: pools } = await supabaseAdmin
            .from('pools')
            .select('id, name')
            .in('id', poolIds);
          const poolMap = new Map(pools?.map(p => [p.id, p.name]) || []);

          const notifs = uniqueEntries.map(e => ({
            userId: e.user_id,
            title: 'New Round Available',
            message: `${todayRound.name} is live in ${poolMap.get(e.pool_id) || 'your pool'}. Pick before ${deadlineStr} ET.`,
            url: `/pools/${e.pool_id}/pick`,
            type: 'pool_event' as const,
            poolId: e.pool_id,
          }));
          sendBulkNotifications(notifs).then(r => { results.notificationsSent += r.sent; }).catch(() => {});
        }

        // Pool status: open → active on first round
        const isFirstRound = rounds[0]?.id === todayRound.id;
        if (isFirstRound || !rounds.some(r => r.date < todayStr)) {
          const { data: activatedPools } = await supabaseAdmin
            .from('pools')
            .update({ status: 'active' })
            .eq('status', 'open')
            .select('id, name');

          // Notify all members of newly activated pools
          if (activatedPools && activatedPools.length > 0) {
            const activatedPoolIds = activatedPools.map(p => p.id);
            const { data: members } = await supabaseAdmin
              .from('pool_players')
              .select('user_id, pool_id')
              .in('pool_id', activatedPoolIds)
              .eq('entry_deleted', false);

            if (members && members.length > 0) {
              const activatedPoolMap = new Map(activatedPools.map(p => [p.id, p.name]));
              const seenMembers = new Set<string>();
              const uniqueMembers = members.filter(m => {
                const key = `${m.user_id}:${m.pool_id}`;
                if (seenMembers.has(key)) return false;
                seenMembers.add(key);
                return true;
              });

              const poolNotifs = uniqueMembers.map(m => ({
                userId: m.user_id,
                title: 'Pool is Live!',
                message: `${activatedPoolMap.get(m.pool_id) || 'Your pool'} is now active. Make your first pick!`,
                url: `/pools/${m.pool_id}/pick`,
                type: 'pool_event' as const,
                poolId: m.pool_id,
              }));
              sendBulkNotifications(poolNotifs).then(r => { results.notificationsSent += r.sent; }).catch(() => {});
            }
          }
        }
      }
    }
  } catch (err: any) {
    results.errors.push(`activate-round: ${err.message}`);
  }
}

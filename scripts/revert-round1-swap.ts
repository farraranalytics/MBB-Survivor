// Revert the bad round swap — put games back on the correct day based on game_datetime
// Run: npx tsx scripts/revert-round1-swap.ts

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // 1. Get round IDs and dates
  const { data: rounds } = await supabase
    .from('rounds')
    .select('id, name, date')
    .in('name', ['Round 1 Day 1', 'Round 1 Day 2']);

  const day1 = rounds?.find(r => r.name === 'Round 1 Day 1');
  const day2 = rounds?.find(r => r.name === 'Round 1 Day 2');

  if (!day1 || !day2) {
    console.error('Could not find rounds');
    process.exit(1);
  }

  console.log(`Day 1: ${day1.date} (${day1.id})`);
  console.log(`Day 2: ${day2.date} (${day2.id})`);

  // 2. Get ALL Round 1 games
  const { data: games } = await supabase
    .from('games')
    .select(`
      id, round_id, game_datetime,
      team1:team1_id(abbreviation, region)
    `)
    .in('round_id', [day1.id, day2.id])
    .order('game_datetime', { ascending: true });

  if (!games) {
    console.error('No games found');
    process.exit(1);
  }

  // 3. Assign each game to the correct round based on game_datetime
  // Day 1 date: 2026-03-19, Day 2 date: 2026-03-20
  // Games that start before Day 2 16:00 UTC (noon ET) belong to Day 1's session
  // Late-night games (e.g. 01:40 UTC on Mar 20) are still Day 1's evening session
  const day2CutoffUTC = new Date(`${day2.date}T12:00:00Z`); // noon UTC on Day 2 date

  let fixed = 0;
  for (const game of games) {
    const gameTime = new Date(game.game_datetime);
    const correctRoundId = gameTime < day2CutoffUTC ? day1.id : day2.id;

    if (game.round_id !== correctRoundId) {
      const correctDay = correctRoundId === day1.id ? 'Day 1' : 'Day 2';
      const t1 = game.team1 as any;
      console.log(`  Fix: ${t1?.abbreviation} [${t1?.region}] @ ${game.game_datetime} → ${correctDay}`);

      const { error } = await supabase
        .from('games')
        .update({ round_id: correctRoundId })
        .eq('id', game.id);

      if (error) {
        console.error(`  Failed: ${error.message}`);
      } else {
        fixed++;
      }
    }
  }

  if (fixed === 0) {
    console.log('\nAll games already on correct day based on game_datetime.');
  } else {
    console.log(`\nFixed ${fixed} games.`);
  }

  // 4. Verify final distribution
  console.log('\n=== FINAL DISTRIBUTION ===');
  const { data: verifyGames } = await supabase
    .from('games')
    .select(`id, round_id, team1:team1_id(region)`)
    .in('round_id', [day1.id, day2.id]);

  const counts: Record<string, Record<string, number>> = { 'Day 1': {}, 'Day 2': {} };
  for (const g of verifyGames || []) {
    const day = g.round_id === day1.id ? 'Day 1' : 'Day 2';
    const region = (g.team1 as any)?.region || 'NULL';
    counts[day][region] = (counts[day][region] || 0) + 1;
  }

  for (const [day, regions] of Object.entries(counts)) {
    console.log(`${day}: ${Object.entries(regions).sort().map(([r, c]) => `${r}: ${c}`).join(', ')}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });

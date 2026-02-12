// Fix Round 1 game distribution: rebalance to 4 games per region per day
// Run: npx tsx scripts/fix-round1-distribution.ts
//
// Current: Day 1 has 2 East + 6 Midwest, Day 2 has 6 East + 2 Midwest
// Fix:     Move 2 Midwest games Day1→Day2, move 2 East games Day2→Day1

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
  // 1. Get round IDs
  const { data: rounds } = await supabase
    .from('rounds')
    .select('id, name')
    .in('name', ['Round 1 Day 1', 'Round 1 Day 2']);

  const day1 = rounds?.find(r => r.name === 'Round 1 Day 1');
  const day2 = rounds?.find(r => r.name === 'Round 1 Day 2');

  if (!day1 || !day2) {
    console.error('Could not find Round 1 Day 1 and Day 2');
    process.exit(1);
  }

  console.log(`Day 1 round ID: ${day1.id}`);
  console.log(`Day 2 round ID: ${day2.id}`);

  // 2. Get all Day 1 and Day 2 games with team data
  const { data: allGames } = await supabase
    .from('games')
    .select(`
      id, round_id, game_datetime,
      team1:team1_id(id, name, abbreviation, seed, region),
      team2:team2_id(id, name, abbreviation, seed, region)
    `)
    .in('round_id', [day1.id, day2.id])
    .order('game_datetime', { ascending: true });

  if (!allGames) {
    console.error('No games found');
    process.exit(1);
  }

  const day1Games = allGames.filter(g => g.round_id === day1.id);
  const day2Games = allGames.filter(g => g.round_id === day2.id);

  // Find Midwest games on Day 1 (need to move 2 to Day 2)
  const day1Midwest = day1Games.filter(g => (g.team1 as any)?.region === 'Midwest');
  // Find East games on Day 2 (need to move 2 to Day 1)
  const day2East = day2Games.filter(g => (g.team1 as any)?.region === 'East');

  console.log(`\nDay 1 Midwest games: ${day1Midwest.length} (need to move 2 to Day 2)`);
  for (const g of day1Midwest) {
    const t1 = g.team1 as any;
    const t2 = g.team2 as any;
    console.log(`  (${t1.seed}) ${t1.abbreviation} vs (${t2.seed}) ${t2.abbreviation}  @ ${g.game_datetime}`);
  }

  console.log(`\nDay 2 East games: ${day2East.length} (need to move 2 to Day 1)`);
  for (const g of day2East) {
    const t1 = g.team1 as any;
    const t2 = g.team2 as any;
    console.log(`  (${t1.seed}) ${t1.abbreviation} vs (${t2.seed}) ${t2.abbreviation}  @ ${g.game_datetime}`);
  }

  // Strategy: Swap the 7/10 and 8/9 seed games between days
  // Move Midwest (7) UCLA vs (10) USU and (8) GONZ vs (9) UGA from Day1 → Day2
  // Move East (7) SMC vs (10) VAN and (8) MSST vs (9) BAY from Day2 → Day1
  const mwToMove = day1Midwest
    .filter(g => {
      const seed = (g.team1 as any)?.seed;
      return seed === 7 || seed === 8;
    })
    .slice(0, 2);

  const eastToMove = day2East
    .filter(g => {
      const seed = (g.team1 as any)?.seed;
      return seed === 7 || seed === 8;
    })
    .slice(0, 2);

  if (mwToMove.length < 2 || eastToMove.length < 2) {
    console.error(`\nNot enough games to swap! MW to move: ${mwToMove.length}, East to move: ${eastToMove.length}`);
    console.log('\nFalling back: picking last 2 Midwest from Day1 and last 2 East from Day2');
    // Fallback: just pick the last 2 from each
    mwToMove.length = 0;
    mwToMove.push(...day1Midwest.slice(-2));
    eastToMove.length = 0;
    eastToMove.push(...day2East.slice(-2));
  }

  console.log('\n=== SWAPPING ===');
  console.log('Moving Day1→Day2 (Midwest):');
  for (const g of mwToMove) {
    const t1 = g.team1 as any;
    const t2 = g.team2 as any;
    console.log(`  (${t1.seed}) ${t1.abbreviation} vs (${t2.seed}) ${t2.abbreviation}`);
  }
  console.log('Moving Day2→Day1 (East):');
  for (const g of eastToMove) {
    const t1 = g.team1 as any;
    const t2 = g.team2 as any;
    console.log(`  (${t1.seed}) ${t1.abbreviation} vs (${t2.seed}) ${t2.abbreviation}`);
  }

  // 3. Execute the swaps
  // Move Midwest games Day1 → Day2
  for (const g of mwToMove) {
    // Find a Day 2 time slot to use: take the time from the East game we're swapping
    const { error } = await supabase
      .from('games')
      .update({ round_id: day2.id })
      .eq('id', g.id);
    if (error) {
      console.error(`Failed to move game ${g.id}: ${error.message}`);
    } else {
      console.log(`  ✓ Moved game ${g.id} to Day 2`);
    }
  }

  // Move East games Day2 → Day1
  for (const g of eastToMove) {
    const { error } = await supabase
      .from('games')
      .update({ round_id: day1.id })
      .eq('id', g.id);
    if (error) {
      console.error(`Failed to move game ${g.id}: ${error.message}`);
    } else {
      console.log(`  ✓ Moved game ${g.id} to Day 1`);
    }
  }

  // 4. Verify
  console.log('\n=== VERIFICATION ===');
  const { data: verifyGames } = await supabase
    .from('games')
    .select(`
      id, round_id,
      team1:team1_id(region)
    `)
    .in('round_id', [day1.id, day2.id]);

  const day1Counts: Record<string, number> = {};
  const day2Counts: Record<string, number> = {};

  for (const g of verifyGames || []) {
    const region = (g.team1 as any)?.region || 'Unknown';
    if (g.round_id === day1.id) {
      day1Counts[region] = (day1Counts[region] || 0) + 1;
    } else {
      day2Counts[region] = (day2Counts[region] || 0) + 1;
    }
  }

  console.log('Day 1:', Object.entries(day1Counts).sort().map(([r, c]) => `${r}: ${c}`).join(', '));
  console.log('Day 2:', Object.entries(day2Counts).sort().map(([r, c]) => `${r}: ${c}`).join(', '));
}

main().catch(err => { console.error(err); process.exit(1); });

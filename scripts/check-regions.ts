// Quick diagnostic: check team regions for active round games
// Run: npx tsx scripts/check-regions.ts

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
  // 1. Get all rounds
  const { data: rounds } = await supabase
    .from('rounds')
    .select('id, name, date, is_active')
    .order('date', { ascending: true });

  console.log('=== ROUNDS ===');
  for (const r of rounds || []) {
    console.log(`  ${r.name} (${r.date}) ${r.is_active ? '← ACTIVE' : ''}`);
  }

  // 2. Check both Day 1 and Day 2
  const day1 = rounds?.find(r => r.name === 'Round 1 Day 1');
  const day2 = rounds?.find(r => r.name === 'Round 1 Day 2');

  for (const activeRound of [day1, day2].filter(Boolean)) {
    if (!activeRound) continue;

  console.log(`\n=== GAMES FOR: ${activeRound.name} ===`);

  // 3. Get games for active round with team data
  const { data: games } = await supabase
    .from('games')
    .select(`
      id,
      game_datetime,
      team1:team1_id(id, name, abbreviation, seed, region),
      team2:team2_id(id, name, abbreviation, seed, region)
    `)
    .eq('round_id', activeRound.id)
    .order('game_datetime', { ascending: true });

  if (!games || games.length === 0) {
    console.log('  No games found for this round!');
    return;
  }

  // 4. Show each game with team regions
  const regionCounts: Record<string, number> = {};
  const mismatches: string[] = [];

  for (const game of games) {
    const t1 = game.team1 as any;
    const t2 = game.team2 as any;
    const t1Region = t1?.region || 'NULL';
    const t2Region = t2?.region || 'NULL';

    console.log(`  (${t1?.seed}) ${t1?.abbreviation} [${t1Region}] vs (${t2?.seed}) ${t2?.abbreviation} [${t2Region}]  @ ${game.game_datetime}`);

    if (t1Region !== t2Region) {
      mismatches.push(`${t1?.name} [${t1Region}] vs ${t2?.name} [${t2Region}]`);
    }

    // Count by first team's region (how pick page does it)
    regionCounts[t1Region] = (regionCounts[t1Region] || 0) + 1;
  }

  console.log(`\n=== REGION COUNTS (by team1 region) ===`);
  for (const [region, count] of Object.entries(regionCounts).sort()) {
    console.log(`  ${region}: ${count} games`);
  }

  if (mismatches.length > 0) {
    console.log(`\n=== REGION MISMATCHES (team1 vs team2 different region) ===`);
    for (const m of mismatches) {
      console.log(`  ⚠ ${m}`);
    }
  } else {
    console.log('\n✓ All games have both teams in same region');
  }

  // 5. Also count by "first team in sorted order" (how pick page actually does it)
  console.log(`\n=== REGION COUNTS (by lower seed, how pick page groups) ===`);
  const pickPageCounts: Record<string, number> = {};
  for (const game of games) {
    const t1 = game.team1 as any;
    const t2 = game.team2 as any;
    // Pick page sorts by seed ASC, so lower seed comes first
    const firstTeam = (t1?.seed || 99) <= (t2?.seed || 99) ? t1 : t2;
    const region = firstTeam?.region || 'NULL';
    pickPageCounts[region] = (pickPageCounts[region] || 0) + 1;
  }
  for (const [region, count] of Object.entries(pickPageCounts).sort()) {
    console.log(`  ${region}: ${count} games`);
  }

  console.log(`\nTotal games: ${games.length}`);
  } // end for each round
}

main().catch(err => { console.error(err); process.exit(1); });

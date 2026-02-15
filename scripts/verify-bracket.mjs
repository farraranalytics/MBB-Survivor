import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://yavrvdzbfloyhbecvwpm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhdnJ2ZHpiZmxveWhiZWN2d3BtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMyNjk5MiwiZXhwIjoyMDg1OTAyOTkyfQ.k39mL9r0AnEfcqQwbqhai9JL7NikvZys6Qf6IBojFcM'
);

const { data: games } = await sb.from('games')
  .select('id, matchup_code, tournament_round, advances_to_game_id, advances_to_slot, team1_id, team2_id, parent_game_a_id, parent_game_b_id, round_id')
  .not('matchup_code', 'is', null)
  .order('matchup_code');

console.log('=== GAMES BY ROUND ===');
const byRound = {};
for (const g of games) {
  const r = g.tournament_round;
  if (!byRound[r]) byRound[r] = [];
  byRound[r].push(g);
}
for (const [round, gs] of Object.entries(byRound)) {
  console.log(`  ${round}: ${gs.length} games`);
}

console.log('\n=== ADVANCEMENT CHAIN VALIDATION ===');
let errors = 0;

// Check every game's advancement target
for (const g of games) {
  if (g.matchup_code === 'CHIP_1') {
    if (g.advances_to_game_id !== null) { console.log('ERROR: CHIP_1 should have null advancement'); errors++; }
    continue;
  }
  if (!g.advances_to_game_id || !g.advances_to_slot) {
    console.log(`ERROR: ${g.matchup_code} missing advancement`);
    errors++;
    continue;
  }
  const target = games.find(t => t.id === g.advances_to_game_id);
  if (!target) { console.log(`ERROR: ${g.matchup_code} target game not found`); errors++; continue; }
  if (g.advances_to_slot !== 1 && g.advances_to_slot !== 2) {
    console.log(`ERROR: ${g.matchup_code} slot=${g.advances_to_slot}`); errors++;
  }
}

// Check parent game references for non-R64 games
for (const g of games) {
  if (g.tournament_round === 'R64') continue;
  if (!g.parent_game_a_id || !g.parent_game_b_id) {
    console.log(`WARNING: ${g.matchup_code} missing parent ref (a=${!!g.parent_game_a_id} b=${!!g.parent_game_b_id})`);
  }
}

// R64 games all have teams
const r64NoTeams = games.filter(g => g.tournament_round === 'R64' && (!g.team1_id || !g.team2_id));
if (r64NoTeams.length > 0) { console.log(`ERROR: ${r64NoTeams.length} R64 games missing teams`); errors++; }

// Non-R64 all have NULL teams
const nonR64WithTeams = games.filter(g => g.tournament_round !== 'R64' && (g.team1_id || g.team2_id));
if (nonR64WithTeams.length > 0) { console.log(`ERROR: ${nonR64WithTeams.length} non-R64 games have teams`); errors++; }

// No duplicate advancement slots
const advMap = new Map();
for (const g of games) {
  if (!g.advances_to_game_id) continue;
  const key = `${g.advances_to_game_id}_${g.advances_to_slot}`;
  if (advMap.has(key)) {
    console.log(`ERROR: Duplicate advancement: ${g.matchup_code} and ${advMap.get(key)} both target same slot`);
    errors++;
  }
  advMap.set(key, g.matchup_code);
}

// Unique round_ids
const roundIds = new Set(games.map(g => g.round_id));
console.log(`\nUnique round_ids used: ${roundIds.size}`);

// Trace all 4 region chains
console.log('\n=== REGION CHAINS ===');
for (const region of ['EAST', 'SOUTH', 'WEST', 'MIDWEST']) {
  const chain = [];
  let code = `${region}_R64_1`;
  while (code) {
    const game = games.find(g => g.matchup_code === code);
    if (!game) break;
    chain.push(code);
    if (!game.advances_to_game_id) break;
    const next = games.find(g => g.id === game.advances_to_game_id);
    code = next?.matchup_code || null;
  }
  console.log(`  ${region}: ${chain.join(' → ')}`);
}

console.log(`\nTotal errors: ${errors}`);
if (errors === 0) console.log('ALL CHECKS PASSED ✓');

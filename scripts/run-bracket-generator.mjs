/**
 * Standalone bracket generator script.
 * Runs the full bracket generation against the live Supabase DB via REST API.
 *
 * Usage: node scripts/run-bracket-generator.mjs
 *
 * This script inlines the necessary constants from bracket.ts and the full
 * generateFullBracket() logic from bracket-generator.ts, using @supabase/supabase-js
 * directly (no path alias resolution needed).
 */

import { createClient } from '@supabase/supabase-js';

// ── Supabase client ──────────────────────────────────────────────
const SUPABASE_URL = 'https://yavrvdzbfloyhbecvwpm.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhdnJ2ZHpiZmxveWhiZWN2d3BtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMyNjk5MiwiZXhwIjoyMDg1OTAyOTkyfQ.k39mL9r0AnEfcqQwbqhai9JL7NikvZys6Qf6IBojFcM';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Inlined constants from bracket.ts ────────────────────────────
const R64_SEED_PAIRINGS = [[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]];

const REGIONS = ['East', 'South', 'West', 'Midwest'];

const ROUND_GAME_COUNTS = { R64: 8, R32: 4, S16: 2, E8: 1 };

// 2026 region-to-day mapping
const R64_DAY1_REGIONS = ['East', 'South'];
const R64_DAY2_REGIONS = ['West', 'Midwest'];
const S16_DAY1_REGIONS = ['South', 'West'];
const S16_DAY2_REGIONS = ['East', 'Midwest'];
const E8_DAY1_REGIONS = ['South', 'West'];
const E8_DAY2_REGIONS = ['East', 'Midwest'];

// Default 2026 F4 pairings
const DEFAULT_F4_PAIRINGS = [['East', 'West'], ['South', 'Midwest']];

function mapRoundNameToCode(name) {
  const n = name.toLowerCase();
  if (n.startsWith('round 1') || n.includes('round of 64')) return 'R64';
  if (n.startsWith('round 2') || n.includes('round of 32')) return 'R32';
  if (n.includes('sweet 16') || n.includes('sweet sixteen')) return 'S16';
  if (n.includes('elite eight') || n.includes('elite 8')) return 'E8';
  if (n.includes('final four')) return 'F4';
  if (n.includes('championship')) return 'CHIP';
  return 'R64';
}

function inferHalf(name) {
  if (name.includes('Day 1')) return 'A';
  if (name.includes('Day 2')) return 'B';
  return null;
}

// ── Round ID Map builder ─────────────────────────────────────────

function buildRoundIdMap(rounds) {
  const map = new Map();
  const roundsByCode = new Map();
  for (const r of rounds) {
    const code = mapRoundNameToCode(r.name);
    if (!roundsByCode.has(code)) roundsByCode.set(code, []);
    roundsByCode.get(code).push(r);
  }

  // R64
  const r64Rounds = roundsByCode.get('R64') || [];
  const r64Day1 = r64Rounds.find(r => inferHalf(r.name) === 'A');
  const r64Day2 = r64Rounds.find(r => inferHalf(r.name) === 'B');
  if (r64Day1) for (const region of R64_DAY1_REGIONS) map.set(`R64_${region}`, r64Day1.id);
  if (r64Day2) for (const region of R64_DAY2_REGIONS) map.set(`R64_${region}`, r64Day2.id);
  if (r64Rounds.length === 1) for (const region of REGIONS) map.set(`R64_${region}`, r64Rounds[0].id);

  // R32 (same day split as R64)
  const r32Rounds = roundsByCode.get('R32') || [];
  const r32Day1 = r32Rounds.find(r => inferHalf(r.name) === 'A');
  const r32Day2 = r32Rounds.find(r => inferHalf(r.name) === 'B');
  if (r32Day1) for (const region of R64_DAY1_REGIONS) map.set(`R32_${region}`, r32Day1.id);
  if (r32Day2) for (const region of R64_DAY2_REGIONS) map.set(`R32_${region}`, r32Day2.id);
  if (r32Rounds.length === 1) for (const region of REGIONS) map.set(`R32_${region}`, r32Rounds[0].id);

  // S16
  const s16Rounds = roundsByCode.get('S16') || [];
  if (s16Rounds.length >= 2) {
    const s16Day1 = s16Rounds.find(r => inferHalf(r.name) === 'A') || s16Rounds[0];
    const s16Day2 = s16Rounds.find(r => inferHalf(r.name) === 'B') || s16Rounds[1];
    for (const region of S16_DAY1_REGIONS) map.set(`S16_${region}`, s16Day1.id);
    for (const region of S16_DAY2_REGIONS) map.set(`S16_${region}`, s16Day2.id);
  } else if (s16Rounds.length === 1) {
    for (const region of REGIONS) map.set(`S16_${region}`, s16Rounds[0].id);
  }

  // E8
  const e8Rounds = roundsByCode.get('E8') || [];
  if (e8Rounds.length >= 2) {
    const e8Day1 = e8Rounds.find(r => inferHalf(r.name) === 'A') || e8Rounds[0];
    const e8Day2 = e8Rounds.find(r => inferHalf(r.name) === 'B') || e8Rounds[1];
    for (const region of E8_DAY1_REGIONS) map.set(`E8_${region}`, e8Day1.id);
    for (const region of E8_DAY2_REGIONS) map.set(`E8_${region}`, e8Day2.id);
  } else if (e8Rounds.length === 1) {
    for (const region of REGIONS) map.set(`E8_${region}`, e8Rounds[0].id);
  }

  // F4 and CHIP
  const f4Rounds = roundsByCode.get('F4') || [];
  if (f4Rounds.length > 0) map.set('F4', f4Rounds[0].id);
  const chipRounds = roundsByCode.get('CHIP') || [];
  if (chipRounds.length > 0) map.set('CHIP', chipRounds[0].id);

  return map;
}

// ── Helpers ──────────────────────────────────────────────────────

function getPlaceholderDatetime(rounds, roundId, slotOffset) {
  const round = rounds.find(r => r.id === roundId);
  const date = round?.date || '2026-03-20';
  const baseHour = 19;
  const offsetMs = slotOffset * 2.5 * 60 * 60 * 1000;
  const dt = new Date(`${date}T${String(baseHour).padStart(2, '0')}:00:00Z`);
  return new Date(dt.getTime() + offsetMs).toISOString();
}

function getPrevRoundMatchupCode(regionUpper, roundCode, slot, feederSlot) {
  const prevRoundCode = { R32: 'R64', S16: 'R32', E8: 'S16' };
  const prev = prevRoundCode[roundCode];
  if (!prev) return null;
  const prevSlot = (slot - 1) * 2 + feederSlot;
  return `${regionUpper}_${prev}_${prevSlot}`;
}

function getAdvancementTarget(matchupCode, pairings) {
  const parts = matchupCode.split('_');

  // F4 → CHIP
  if (parts[0] === 'F4') {
    return { targetCode: 'CHIP_1', targetSlot: parseInt(parts[1]) };
  }

  // E8 → F4
  if (parts.length === 3 && parts[1] === 'E8') {
    const region = parts[0];
    const regionTitleCase = region.charAt(0) + region.slice(1).toLowerCase();
    if (pairings.f4_1.includes(regionTitleCase)) {
      const isFirst = pairings.f4_1[0].toUpperCase() === region;
      return { targetCode: 'F4_1', targetSlot: isFirst ? 1 : 2 };
    }
    if (pairings.f4_2.includes(regionTitleCase)) {
      const isFirst = pairings.f4_2[0].toUpperCase() === region;
      return { targetCode: 'F4_2', targetSlot: isFirst ? 1 : 2 };
    }
    return { targetCode: null, targetSlot: 0 };
  }

  // Within-region: R64→R32, R32→S16, S16→E8
  if (parts.length === 3) {
    const region = parts[0];
    const roundCode = parts[1];
    const slot = parseInt(parts[2]);
    const nextRound = { R64: 'R32', R32: 'S16', S16: 'E8' };
    const next = nextRound[roundCode];
    if (!next) return { targetCode: null, targetSlot: 0 };
    const targetSlotNum = Math.ceil(slot / 2);
    const targetSlot = ((slot - 1) % 2) + 1;
    return { targetCode: `${region}_${next}_${targetSlotNum}`, targetSlot };
  }

  return { targetCode: null, targetSlot: 0 };
}

// ── Main: Generate Full Bracket ──────────────────────────────────

async function generateFullBracket() {
  const pairings = {
    f4_1: DEFAULT_F4_PAIRINGS[0],
    f4_2: DEFAULT_F4_PAIRINGS[1],
  };

  const result = {
    r64Backfilled: 0,
    gamesCreated: 0,
    advancementsWired: 0,
    errors: [],
  };

  // ── 1. Validate preconditions ──────────────────────────────────
  console.log('Step 1: Validating preconditions...');

  const { data: allTeams } = await supabaseAdmin.from('teams').select('id');
  const teamCount = allTeams?.length || 0;
  console.log(`  Teams: ${teamCount}`);
  if (teamCount < 64) {
    result.errors.push(`Need 64 teams, found ${teamCount}`);
    return result;
  }

  const { data: rounds } = await supabaseAdmin
    .from('rounds')
    .select('id, name, date')
    .order('date', { ascending: true });

  console.log(`  Rounds: ${rounds?.length || 0}`);
  if (!rounds || rounds.length < 8) {
    result.errors.push(`Need at least 8 rounds, found ${rounds?.length || 0}`);
    return result;
  }

  // Map round IDs to codes
  const roundIdToCode = new Map();
  for (const r of rounds) roundIdToCode.set(r.id, mapRoundNameToCode(r.name));

  // Get R64 games with team details
  const { data: r64Games } = await supabaseAdmin
    .from('games')
    .select('id, round_id, team1_id, team2_id, game_datetime, team1:team1_id(id, seed, region), team2:team2_id(id, seed, region)')
    .not('team1_id', 'is', null)
    .not('team2_id', 'is', null);

  const actualR64Games = (r64Games || []).filter(g => roundIdToCode.get(g.round_id) === 'R64');
  console.log(`  R64 games: ${actualR64Games.length}`);
  if (actualR64Games.length < 32) {
    result.errors.push(`Need 32 R64 games, found ${actualR64Games.length}`);
    return result;
  }

  // ── 2. Build round_id map ──────────────────────────────────────
  console.log('Step 2: Building round ID map...');
  const roundIdMap = buildRoundIdMap(rounds);
  console.log(`  Mapped ${roundIdMap.size} round keys`);
  for (const [key, id] of roundIdMap) {
    const round = rounds.find(r => r.id === id);
    console.log(`    ${key} → ${round?.name} (${id.slice(0,8)}...)`);
  }

  // ── 3. Backfill R64 matchup_codes ──────────────────────────────
  console.log('Step 3: Backfilling R64 matchup codes...');

  for (const game of actualR64Games) {
    const team1 = game.team1;
    if (!team1?.region || !team1?.seed) {
      result.errors.push(`Game ${game.id} missing team1 region/seed`);
      continue;
    }

    const region = team1.region.toUpperCase();
    const seed = team1.seed;
    const slotIndex = R64_SEED_PAIRINGS.findIndex(pair => pair.includes(seed));
    if (slotIndex < 0) {
      result.errors.push(`Seed ${seed} not in R64_SEED_PAIRINGS`);
      continue;
    }

    const slot = slotIndex + 1;
    const matchupCode = `${region}_R64_${slot}`;

    const { error } = await supabaseAdmin
      .from('games')
      .update({ matchup_code: matchupCode, bracket_position: slotIndex, tournament_round: 'R64' })
      .eq('id', game.id);

    if (error) {
      result.errors.push(`Backfill R64 ${matchupCode}: ${error.message}`);
    } else {
      result.r64Backfilled++;
      console.log(`  ${matchupCode} ← game ${game.id.slice(0,8)}... (${team1.seed} seed)`);
    }
  }

  // ── 4. Clean existing shell games ──────────────────────────────
  console.log('Step 4: Cleaning existing shell games...');

  const { data: existingShells } = await supabaseAdmin
    .from('games')
    .select('id, tournament_round')
    .in('tournament_round', ['R32', 'S16', 'E8', 'F4', 'CHIP']);

  if (existingShells && existingShells.length > 0) {
    console.log(`  Removing ${existingShells.length} existing shells...`);
    await supabaseAdmin
      .from('games')
      .update({ advances_to_game_id: null, advances_to_slot: null })
      .not('advances_to_game_id', 'is', null);
    await supabaseAdmin
      .from('games')
      .update({ parent_game_a_id: null, parent_game_b_id: null })
      .in('tournament_round', ['R32', 'S16', 'E8', 'F4', 'CHIP']);
    await supabaseAdmin
      .from('games')
      .delete()
      .in('tournament_round', ['R32', 'S16', 'E8', 'F4', 'CHIP']);
  } else {
    console.log('  No existing shells to clean.');
  }

  // ── 5. Build matchup_code → game_id map from R64 ──────────────
  const matchupCodeToId = new Map();
  const { data: r64Updated } = await supabaseAdmin
    .from('games')
    .select('id, matchup_code')
    .eq('tournament_round', 'R64')
    .not('matchup_code', 'is', null);

  for (const g of r64Updated || []) {
    if (g.matchup_code) matchupCodeToId.set(g.matchup_code, g.id);
  }
  console.log(`  R64 matchup codes mapped: ${matchupCodeToId.size}`);

  // ── 6. Insert shell games (R32, S16, E8) per region ────────────
  console.log('Step 5: Inserting shell games...');

  for (const region of REGIONS) {
    const regionUpper = region.toUpperCase();

    for (const roundCode of ['R32', 'S16', 'E8']) {
      const gameCount = ROUND_GAME_COUNTS[roundCode];
      const roundId = roundIdMap.get(`${roundCode}_${region}`);
      if (!roundId) {
        result.errors.push(`No round_id for ${roundCode}_${region}`);
        continue;
      }

      for (let slot = 1; slot <= gameCount; slot++) {
        const matchupCode = `${regionUpper}_${roundCode}_${slot}`;
        const bracketPosition = slot - 1;
        const parentACode = getPrevRoundMatchupCode(regionUpper, roundCode, slot, 1);
        const parentBCode = getPrevRoundMatchupCode(regionUpper, roundCode, slot, 2);
        const parentAId = parentACode ? matchupCodeToId.get(parentACode) || null : null;
        const parentBId = parentBCode ? matchupCodeToId.get(parentBCode) || null : null;

        const { data: inserted, error } = await supabaseAdmin
          .from('games')
          .insert({
            round_id: roundId,
            game_datetime: getPlaceholderDatetime(rounds, roundId, slot - 1),
            status: 'scheduled',
            matchup_code: matchupCode,
            bracket_position: bracketPosition,
            tournament_round: roundCode,
            parent_game_a_id: parentAId,
            parent_game_b_id: parentBId,
          })
          .select('id')
          .single();

        if (error) {
          result.errors.push(`Insert ${matchupCode}: ${error.message}`);
        } else if (inserted) {
          matchupCodeToId.set(matchupCode, inserted.id);
          result.gamesCreated++;
          console.log(`  Created ${matchupCode} (${inserted.id.slice(0,8)}...)`);
        }
      }
    }
  }

  // ── 7. Insert F4 games ─────────────────────────────────────────
  const f4RoundId = roundIdMap.get('F4');
  if (f4RoundId) {
    for (let i = 1; i <= 2; i++) {
      const matchupCode = `F4_${i}`;
      const pairing = i === 1 ? pairings.f4_1 : pairings.f4_2;
      const parentACode = `${pairing[0].toUpperCase()}_E8_1`;
      const parentBCode = `${pairing[1].toUpperCase()}_E8_1`;

      const { data: inserted, error } = await supabaseAdmin
        .from('games')
        .insert({
          round_id: f4RoundId,
          game_datetime: getPlaceholderDatetime(rounds, f4RoundId, i - 1),
          status: 'scheduled',
          matchup_code: matchupCode,
          bracket_position: i - 1,
          tournament_round: 'F4',
          parent_game_a_id: matchupCodeToId.get(parentACode) || null,
          parent_game_b_id: matchupCodeToId.get(parentBCode) || null,
        })
        .select('id')
        .single();

      if (error) {
        result.errors.push(`Insert ${matchupCode}: ${error.message}`);
      } else if (inserted) {
        matchupCodeToId.set(matchupCode, inserted.id);
        result.gamesCreated++;
        console.log(`  Created ${matchupCode} (${inserted.id.slice(0,8)}...)`);
      }
    }
  }

  // ── 8. Insert Championship ─────────────────────────────────────
  const chipRoundId = roundIdMap.get('CHIP');
  if (chipRoundId) {
    const { data: inserted, error } = await supabaseAdmin
      .from('games')
      .insert({
        round_id: chipRoundId,
        game_datetime: getPlaceholderDatetime(rounds, chipRoundId, 0),
        status: 'scheduled',
        matchup_code: 'CHIP_1',
        bracket_position: 0,
        tournament_round: 'CHIP',
        parent_game_a_id: matchupCodeToId.get('F4_1') || null,
        parent_game_b_id: matchupCodeToId.get('F4_2') || null,
      })
      .select('id')
      .single();

    if (error) {
      result.errors.push(`Insert CHIP_1: ${error.message}`);
    } else if (inserted) {
      matchupCodeToId.set('CHIP_1', inserted.id);
      result.gamesCreated++;
      console.log(`  Created CHIP_1 (${inserted.id.slice(0,8)}...)`);
    }
  }

  // ── 9. Wire advances_to_game_id + advances_to_slot ─────────────
  console.log('Step 6: Wiring advancement FKs...');

  for (const [matchupCode, gameId] of matchupCodeToId.entries()) {
    if (matchupCode === 'CHIP_1') continue;

    const { targetCode, targetSlot } = getAdvancementTarget(matchupCode, pairings);
    if (!targetCode) {
      result.errors.push(`No advancement target for ${matchupCode}`);
      continue;
    }

    const targetGameId = matchupCodeToId.get(targetCode);
    if (!targetGameId) {
      result.errors.push(`Target game ${targetCode} not found for ${matchupCode}`);
      continue;
    }

    const { error } = await supabaseAdmin
      .from('games')
      .update({ advances_to_game_id: targetGameId, advances_to_slot: targetSlot })
      .eq('id', gameId);

    if (error) {
      result.errors.push(`Wire ${matchupCode}→${targetCode}: ${error.message}`);
    } else {
      result.advancementsWired++;
    }
  }

  console.log(`  Wired ${result.advancementsWired} advancements`);
  return result;
}

// ── Run ──────────────────────────────────────────────────────────

console.log('=== Bracket Generator ===\n');

try {
  // First, run migration checks (constraints + indexes can't be added via REST,
  // but the columns already exist, so just verify)
  console.log('Pre-flight: checking column existence...');
  const { data: testGame } = await supabaseAdmin
    .from('games')
    .select('id, matchup_code, advances_to_game_id, advances_to_slot, bracket_position, tournament_round')
    .limit(1)
    .single();

  if (testGame) {
    console.log('  All bracket columns present ✓\n');
  }

  const result = await generateFullBracket();

  console.log('\n=== RESULTS ===');
  console.log(`R64 backfilled:     ${result.r64Backfilled}`);
  console.log(`Games created:      ${result.gamesCreated}`);
  console.log(`Advancements wired: ${result.advancementsWired}`);

  if (result.errors.length > 0) {
    console.log(`\nERRORS (${result.errors.length}):`);
    for (const err of result.errors) console.log(`  ✗ ${err}`);
  } else {
    console.log('\nNo errors ✓');
  }

  // ── Verification queries ─────────────────────────────────────
  console.log('\n=== VERIFICATION ===');

  const { data: allGames } = await supabaseAdmin.from('games').select('id');
  console.log(`Total games: ${allGames?.length || 0} (expected: 63)`);

  const { data: withMatchup } = await supabaseAdmin.from('games').select('id').not('matchup_code', 'is', null);
  console.log(`With matchup_code: ${withMatchup?.length || 0} (expected: 63)`);

  const { data: withAdvance } = await supabaseAdmin.from('games').select('id').not('advances_to_game_id', 'is', null);
  console.log(`With advances_to: ${withAdvance?.length || 0} (expected: 62)`);

  const { data: r64WithTeams } = await supabaseAdmin.from('games').select('id').eq('tournament_round', 'R64').not('team1_id', 'is', null);
  console.log(`R64 with teams: ${r64WithTeams?.length || 0} (expected: 32)`);

  const { data: shellsNoTeams } = await supabaseAdmin.from('games').select('id').neq('tournament_round', 'R64').is('team1_id', null);
  console.log(`Non-R64 with NULL teams: ${shellsNoTeams?.length || 0} (expected: 31)`);

  // Show a sample advancement chain
  console.log('\n=== SAMPLE CHAIN: EAST R64_1 → ... → CHIP ===');
  let currentCode = 'EAST_R64_1';
  while (currentCode) {
    const { data: game } = await supabaseAdmin
      .from('games')
      .select('id, matchup_code, tournament_round, team1_id, team2_id, advances_to_game_id, advances_to_slot')
      .eq('matchup_code', currentCode)
      .single();

    if (!game) {
      console.log(`  ${currentCode}: NOT FOUND`);
      break;
    }

    const t1 = game.team1_id ? game.team1_id.slice(0,8) + '...' : 'TBD';
    const t2 = game.team2_id ? game.team2_id.slice(0,8) + '...' : 'TBD';
    const advStr = game.advances_to_game_id ? `→ slot ${game.advances_to_slot}` : '(champion)';
    console.log(`  ${game.matchup_code}: ${t1} vs ${t2} ${advStr}`);

    if (!game.advances_to_game_id) break;

    // Find next game
    const { data: nextGame } = await supabaseAdmin
      .from('games')
      .select('matchup_code')
      .eq('id', game.advances_to_game_id)
      .single();

    currentCode = nextGame?.matchup_code || null;
  }

} catch (err) {
  console.error('Fatal error:', err);
  process.exit(1);
}

/**
 * Bracket Generator — Pre-generates all 63 tournament games with explicit
 * feeder/advancement FKs. Replaces dynamic cascadeGameResult() approach.
 *
 * Usage: Call generateFullBracket() after 64 teams + 32 R64 games + 12 rounds
 * exist in the DB. This backfills R64 matchup_codes and creates 31 R32→CHIP
 * shell games with wired advances_to_game_id + advances_to_slot.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  R64_SEED_PAIRINGS,
  mapRoundNameToCode,
  inferHalf,
} from '@/lib/bracket';

// ── Constants ────────────────────────────────────────────────────

const REGIONS = ['East', 'South', 'West', 'Midwest'] as const;
type Region = (typeof REGIONS)[number];

// Standard bracket slot → matchup_code within a region
// R64: 8 games per region (slots 1-8, matching seed pairings order)
// R32: 4 games (slots 1-4), S16: 2 (slots 1-2), E8: 1 (slot 1)
const ROUND_GAME_COUNTS: Record<string, number> = {
  R64: 8, R32: 4, S16: 2, E8: 1,
};

// Default 2026 Final Four pairings: which regions meet in each semifinal
// F4_1: East vs West, F4_2: South vs Midwest
const DEFAULT_F4_PAIRINGS: [Region, Region][] = [
  ['East', 'West'],
  ['South', 'Midwest'],
];

// 2026 region-to-day mapping (matches bracket.ts)
const R64_DAY1_REGIONS: Region[] = ['East', 'South'];
const R64_DAY2_REGIONS: Region[] = ['West', 'Midwest'];
const S16_DAY1_REGIONS: Region[] = ['South', 'West'];
const S16_DAY2_REGIONS: Region[] = ['East', 'Midwest'];
const E8_DAY1_REGIONS: Region[] = ['South', 'West'];
const E8_DAY2_REGIONS: Region[] = ['East', 'Midwest'];

// ── Types ────────────────────────────────────────────────────────

export interface F4Pairings {
  f4_1: [Region, Region]; // Regions meeting in F4 game 1
  f4_2: [Region, Region]; // Regions meeting in F4 game 2
}

export interface GenerateBracketResult {
  r64Backfilled: number;
  gamesCreated: number;
  advancementsWired: number;
  errors: string[];
}

// ── Helper: build round_id map ──────────────────────────────────

interface RoundRow {
  id: string;
  name: string;
  date: string;
}

/**
 * Maps (roundCode, region) → round_id using round names and region-day assignments.
 * R64 Day 1 = East+South, R64 Day 2 = West+Midwest (same for R32).
 * S16/E8 have their own day assignments. F4/CHIP have single rows.
 */
function buildRoundIdMap(rounds: RoundRow[]): Map<string, string> {
  const map = new Map<string, string>();

  // Group rounds by code
  const roundsByCode = new Map<string, RoundRow[]>();
  for (const r of rounds) {
    const code = mapRoundNameToCode(r.name);
    if (!roundsByCode.has(code)) roundsByCode.set(code, []);
    roundsByCode.get(code)!.push(r);
  }

  // R64: Day 1 (East, South), Day 2 (West, Midwest)
  const r64Rounds = roundsByCode.get('R64') || [];
  const r64Day1 = r64Rounds.find(r => inferHalf(r.name) === 'A');
  const r64Day2 = r64Rounds.find(r => inferHalf(r.name) === 'B');
  if (r64Day1) {
    for (const region of R64_DAY1_REGIONS) map.set(`R64_${region}`, r64Day1.id);
  }
  if (r64Day2) {
    for (const region of R64_DAY2_REGIONS) map.set(`R64_${region}`, r64Day2.id);
  }
  // If only one R64 round, use it for all regions
  if (r64Rounds.length === 1) {
    for (const region of REGIONS) map.set(`R64_${region}`, r64Rounds[0].id);
  }

  // R32: same day split as R64
  const r32Rounds = roundsByCode.get('R32') || [];
  const r32Day1 = r32Rounds.find(r => inferHalf(r.name) === 'A');
  const r32Day2 = r32Rounds.find(r => inferHalf(r.name) === 'B');
  if (r32Day1) {
    for (const region of R64_DAY1_REGIONS) map.set(`R32_${region}`, r32Day1.id);
  }
  if (r32Day2) {
    for (const region of R64_DAY2_REGIONS) map.set(`R32_${region}`, r32Day2.id);
  }
  if (r32Rounds.length === 1) {
    for (const region of REGIONS) map.set(`R32_${region}`, r32Rounds[0].id);
  }

  // S16: Day 1 = South+West, Day 2 = East+Midwest
  const s16Rounds = roundsByCode.get('S16') || [];
  if (s16Rounds.length >= 2) {
    const s16Day1 = s16Rounds.find(r => inferHalf(r.name) === 'A') || s16Rounds[0];
    const s16Day2 = s16Rounds.find(r => inferHalf(r.name) === 'B') || s16Rounds[1];
    for (const region of S16_DAY1_REGIONS) map.set(`S16_${region}`, s16Day1.id);
    for (const region of S16_DAY2_REGIONS) map.set(`S16_${region}`, s16Day2.id);
  } else if (s16Rounds.length === 1) {
    for (const region of REGIONS) map.set(`S16_${region}`, s16Rounds[0].id);
  }

  // E8: Day 1 = South+West, Day 2 = East+Midwest
  const e8Rounds = roundsByCode.get('E8') || [];
  if (e8Rounds.length >= 2) {
    const e8Day1 = e8Rounds.find(r => inferHalf(r.name) === 'A') || e8Rounds[0];
    const e8Day2 = e8Rounds.find(r => inferHalf(r.name) === 'B') || e8Rounds[1];
    for (const region of E8_DAY1_REGIONS) map.set(`E8_${region}`, e8Day1.id);
    for (const region of E8_DAY2_REGIONS) map.set(`E8_${region}`, e8Day2.id);
  } else if (e8Rounds.length === 1) {
    for (const region of REGIONS) map.set(`E8_${region}`, e8Rounds[0].id);
  }

  // F4 and CHIP: single round each, no region key
  const f4Rounds = roundsByCode.get('F4') || [];
  if (f4Rounds.length > 0) map.set('F4', f4Rounds[0].id);

  const chipRounds = roundsByCode.get('CHIP') || [];
  if (chipRounds.length > 0) map.set('CHIP', chipRounds[0].id);

  return map;
}

// ── Helper: get placeholder datetime for a round ────────────────

function getPlaceholderDatetime(rounds: RoundRow[], roundId: string, slotOffset: number): string {
  const round = rounds.find(r => r.id === roundId);
  const date = round?.date || '2026-03-20';
  const baseHour = 19; // 7 PM UTC (noon MT)
  const offsetMs = slotOffset * 2.5 * 60 * 60 * 1000;
  const dt = new Date(`${date}T${String(baseHour).padStart(2, '0')}:00:00Z`);
  return new Date(dt.getTime() + offsetMs).toISOString();
}

// ── Main function ───────────────────────────────────────────────

export async function generateFullBracket(
  f4Pairings?: F4Pairings,
): Promise<GenerateBracketResult> {
  const pairings = f4Pairings || {
    f4_1: DEFAULT_F4_PAIRINGS[0],
    f4_2: DEFAULT_F4_PAIRINGS[1],
  };

  const result: GenerateBracketResult = {
    r64Backfilled: 0,
    gamesCreated: 0,
    advancementsWired: 0,
    errors: [],
  };

  // ── 1. Validate preconditions ──────────────────────────────────

  const { data: allTeams } = await supabaseAdmin
    .from('teams')
    .select('id');

  const teamCount = allTeams?.length || 0;
  if (teamCount < 64) {
    result.errors.push(`Need 64 teams, found ${teamCount}`);
    return result;
  }

  const { data: rounds } = await supabaseAdmin
    .from('rounds')
    .select('id, name, date')
    .order('date', { ascending: true });

  if (!rounds || rounds.length < 8) {
    result.errors.push(`Need at least 8 rounds, found ${rounds?.length || 0}`);
    return result;
  }

  // Check for R64 games
  const { data: r64Games } = await supabaseAdmin
    .from('games')
    .select(`
      id, round_id, team1_id, team2_id, game_datetime,
      team1:team1_id(id, seed, region),
      team2:team2_id(id, seed, region)
    `)
    .not('team1_id', 'is', null)
    .not('team2_id', 'is', null);

  // Filter to only R64 games (games where both teams exist, no tournament_round yet, or tournament_round = R64)
  const roundIdToCode = new Map<string, string>();
  for (const r of rounds) roundIdToCode.set(r.id, mapRoundNameToCode(r.name));

  const actualR64Games = (r64Games || []).filter(g => {
    const code = roundIdToCode.get(g.round_id);
    return code === 'R64';
  });

  if (actualR64Games.length < 32) {
    result.errors.push(`Need 32 R64 games, found ${actualR64Games.length}`);
    return result;
  }

  // ── 2. Build round_id map ──────────────────────────────────────

  const roundIdMap = buildRoundIdMap(rounds);

  // ── 3. Backfill R64 games with matchup_code, bracket_position, tournament_round ──

  // Build lookup: (region, seed) → R64 slot index (1-indexed)
  // R64_SEED_PAIRINGS[i] = [higher_seed, lower_seed], i is 0-indexed
  // Slot = i + 1

  for (const game of actualR64Games) {
    const team1 = game.team1 as any;
    if (!team1?.region || !team1?.seed) continue;

    const region = team1.region.toUpperCase();
    const seed = team1.seed;

    // Find which R64 slot this seed belongs to
    const slotIndex = R64_SEED_PAIRINGS.findIndex(pair => pair.includes(seed));
    if (slotIndex < 0) {
      result.errors.push(`Seed ${seed} not in R64_SEED_PAIRINGS`);
      continue;
    }

    const slot = slotIndex + 1; // 1-indexed
    const matchupCode = `${region}_R64_${slot}`;

    const { error } = await supabaseAdmin
      .from('games')
      .update({
        matchup_code: matchupCode,
        bracket_position: slotIndex,
        tournament_round: 'R64',
      })
      .eq('id', game.id);

    if (error) {
      result.errors.push(`Backfill R64 ${matchupCode}: ${error.message}`);
    } else {
      result.r64Backfilled++;
    }
  }

  // ── 4. Insert 31 shell games (R32 through CHIP) ────────────────

  // We'll build all shell games, then insert them, then wire advancement.
  // matchup_code → game_id map for wiring
  const matchupCodeToId = new Map<string, string>();

  // First, populate R64 matchup codes
  const { data: r64Updated } = await supabaseAdmin
    .from('games')
    .select('id, matchup_code')
    .eq('tournament_round', 'R64')
    .not('matchup_code', 'is', null);

  for (const g of r64Updated || []) {
    if (g.matchup_code) matchupCodeToId.set(g.matchup_code, g.id);
  }

  // Delete any existing shell games (R32+) to allow re-running
  const { data: existingShells } = await supabaseAdmin
    .from('games')
    .select('id, tournament_round')
    .in('tournament_round', ['R32', 'S16', 'E8', 'F4', 'CHIP']);

  if (existingShells && existingShells.length > 0) {
    // Clear advancement FKs first to avoid FK constraint violations
    await supabaseAdmin
      .from('games')
      .update({ advances_to_game_id: null, advances_to_slot: null })
      .not('advances_to_game_id', 'is', null);

    // Clear parent FKs on shells
    await supabaseAdmin
      .from('games')
      .update({ parent_game_a_id: null, parent_game_b_id: null })
      .in('tournament_round', ['R32', 'S16', 'E8', 'F4', 'CHIP']);

    // Delete shells
    await supabaseAdmin
      .from('games')
      .delete()
      .in('tournament_round', ['R32', 'S16', 'E8', 'F4', 'CHIP']);
  }

  // Insert region games: R32 (4 per region), S16 (2), E8 (1)
  for (const region of REGIONS) {
    const regionUpper = region.toUpperCase();

    for (const roundCode of ['R32', 'S16', 'E8'] as const) {
      const gameCount = ROUND_GAME_COUNTS[roundCode];
      const roundId = roundIdMap.get(`${roundCode}_${region}`);
      if (!roundId) {
        result.errors.push(`No round_id for ${roundCode}_${region}`);
        continue;
      }

      for (let slot = 1; slot <= gameCount; slot++) {
        const matchupCode = `${regionUpper}_${roundCode}_${slot}`;
        const bracketPosition = slot - 1; // 0-indexed

        // Determine parent (feeder) matchup codes
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
        }
      }
    }
  }

  // Insert F4 games (2 semifinals)
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
      }
    }
  }

  // Insert Championship game
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
    }
  }

  // ── 5. Wire advances_to_game_id + advances_to_slot ─────────────

  // For each game (except CHIP_1), compute where its winner goes
  for (const [matchupCode, gameId] of matchupCodeToId.entries()) {
    if (matchupCode === 'CHIP_1') continue; // Championship has no advancement

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
      .update({
        advances_to_game_id: targetGameId,
        advances_to_slot: targetSlot,
      })
      .eq('id', gameId);

    if (error) {
      result.errors.push(`Wire ${matchupCode}→${targetCode}: ${error.message}`);
    } else {
      result.advancementsWired++;
    }
  }

  return result;
}

// ── Helper: compute previous round matchup code ─────────────────

function getPrevRoundMatchupCode(
  regionUpper: string,
  roundCode: string,
  slot: number,
  feederSlot: 1 | 2, // 1 = first feeder (team1), 2 = second feeder (team2)
): string | null {
  // Feeders pattern: R32 slot N is fed by R64 slots (2N-1) and (2N)
  // Same pattern for S16←R32 and E8←S16
  const prevRoundCode: Record<string, string> = { R32: 'R64', S16: 'R32', E8: 'S16' };
  const prev = prevRoundCode[roundCode];
  if (!prev) return null;

  const prevSlot = (slot - 1) * 2 + feederSlot;
  return `${regionUpper}_${prev}_${prevSlot}`;
}

// ── Helper: compute advancement target ──────────────────────────

function getAdvancementTarget(
  matchupCode: string,
  pairings: F4Pairings,
): { targetCode: string | null; targetSlot: number } {
  // Parse matchup code
  const parts = matchupCode.split('_');

  // F4 games advance to CHIP_1
  if (parts[0] === 'F4') {
    const f4Num = parseInt(parts[1]);
    return { targetCode: 'CHIP_1', targetSlot: f4Num };
  }

  // E8 games advance to F4
  if (parts.length === 3 && parts[1] === 'E8') {
    const region = parts[0]; // e.g. EAST
    // Find which F4 game this region goes to
    const regionTitleCase = region.charAt(0) + region.slice(1).toLowerCase();
    if (pairings.f4_1.includes(regionTitleCase as Region)) {
      const isFirst = pairings.f4_1[0].toUpperCase() === region;
      return { targetCode: 'F4_1', targetSlot: isFirst ? 1 : 2 };
    }
    if (pairings.f4_2.includes(regionTitleCase as Region)) {
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

    const nextRound: Record<string, string> = { R64: 'R32', R32: 'S16', S16: 'E8' };
    const next = nextRound[roundCode];
    if (!next) return { targetCode: null, targetSlot: 0 };

    const targetSlotNum = Math.ceil(slot / 2);
    const targetSlot = ((slot - 1) % 2) + 1; // odd slots → 1, even slots → 2

    return { targetCode: `${region}_${next}_${targetSlotNum}`, targetSlot };
  }

  return { targetCode: null, targetSlot: 0 };
}

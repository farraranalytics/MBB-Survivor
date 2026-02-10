// One-time script to populate ESPN team IDs for all teams in the database
// Run: npx tsx scripts/populate-espn-ids.ts
//
// Fetches ALL ESPN NCAAM teams in one request, then fuzzy-matches them
// against our DB teams by location/displayName/abbreviation.

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ESPN_TEAMS_URL =
  'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=400';

interface ESPNTeam {
  id: string;
  location: string;      // e.g. "Auburn", "Alabama", "Michigan State"
  displayName: string;    // e.g. "Auburn Tigers", "Alabama Crimson Tide"
  shortDisplayName: string; // e.g. "Auburn", "Alabama"
  abbreviation: string;   // e.g. "AUB", "ALA"
  nickname: string;       // e.g. "Auburn", "Alabama"
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Manual overrides for tricky names our DB uses vs ESPN's location field
const MANUAL_MAP: Record<string, string> = {
  'ole miss': 'mississippi',
  'uconn': 'connecticut',
  'byu': 'byu',
  'vcu': 'vcu',
  'siu edwardsville': 'siu edwardsville',
  'unc wilmington': 'unc wilmington',
  'uc san diego': 'uc san diego',
  "mount st. mary's": "mount st. mary's",
  "saint mary's": "saint mary's",
  "st. john's": "st. john's",
};

function findBestMatch(dbName: string, dbAbbr: string, espnTeams: ESPNTeam[]): ESPNTeam | null {
  const dbNorm = normalize(dbName);
  const dbAbbrNorm = normalize(dbAbbr);

  // 1. Check manual map
  const manualKey = Object.keys(MANUAL_MAP).find(k => normalize(k) === dbNorm);
  if (manualKey) {
    const target = normalize(MANUAL_MAP[manualKey]);
    const match = espnTeams.find(t => normalize(t.location) === target || normalize(t.nickname) === target);
    if (match) return match;
  }

  // 2. Exact match on location (ESPN "location" = team city/school name, e.g. "Auburn")
  const exactLocation = espnTeams.find(t => normalize(t.location) === dbNorm);
  if (exactLocation) return exactLocation;

  // 3. Exact match on shortDisplayName
  const exactShort = espnTeams.find(t => normalize(t.shortDisplayName) === dbNorm);
  if (exactShort) return exactShort;

  // 4. Match on abbreviation
  const byAbbr = espnTeams.find(t => normalize(t.abbreviation) === dbAbbrNorm);
  if (byAbbr) return byAbbr;

  // 5. DB name starts with ESPN location or vice versa
  const startsWith = espnTeams.find(
    t => dbNorm.startsWith(normalize(t.location)) || normalize(t.location).startsWith(dbNorm)
  );
  if (startsWith) return startsWith;

  // 6. displayName contains DB name
  const contains = espnTeams.find(t => normalize(t.displayName).includes(dbNorm));
  if (contains) return contains;

  return null;
}

async function main() {
  // 1. Fetch all ESPN teams in one request
  console.log('Fetching all ESPN NCAAM teams...');
  const res = await fetch(ESPN_TEAMS_URL, {
    headers: { 'User-Agent': 'MBB-Survivor-Pool/1.0', Accept: 'application/json' },
  });
  if (!res.ok) {
    console.error(`ESPN API failed: ${res.status}`);
    process.exit(1);
  }
  const data = await res.json();
  const espnTeams: ESPNTeam[] = data.sports?.[0]?.leagues?.[0]?.teams?.map((t: any) => t.team) || [];
  console.log(`  Got ${espnTeams.length} ESPN teams.\n`);

  // 2. Fetch our DB teams
  console.log('Fetching teams from database...');
  const { data: dbTeams, error } = await supabase
    .from('teams')
    .select('id, name, abbreviation, espn_team_id')
    .order('name');

  if (error || !dbTeams) {
    console.error('Failed to fetch teams:', error?.message);
    process.exit(1);
  }
  console.log(`  Got ${dbTeams.length} DB teams.\n`);

  // 3. First, clear all bad data from previous run
  console.log('Clearing previous ESPN IDs (resetting to null)...');
  const { error: clearError } = await supabase
    .from('teams')
    .update({ espn_team_id: null, logo_url: null })
    .not('id', 'is', null); // update all rows
  if (clearError) {
    console.error('Failed to clear:', clearError.message);
  } else {
    console.log('  Cleared.\n');
  }

  // 4. Match and update
  let updated = 0;
  let failed = 0;

  for (const team of dbTeams) {
    const match = findBestMatch(team.name, team.abbreviation || '', espnTeams);

    if (!match) {
      console.log(`  ✗ ${team.name} (${team.abbreviation}) — NO MATCH`);
      failed++;
      continue;
    }

    const espnId = parseInt(match.id);
    const logoUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`;

    const { error: updateError } = await supabase
      .from('teams')
      .update({ espn_team_id: espnId, logo_url: logoUrl })
      .eq('id', team.id);

    if (updateError) {
      console.log(`  ✗ ${team.name} — DB error: ${updateError.message}`);
      failed++;
    } else {
      console.log(`  ✓ ${team.name} → ${match.id} ${match.displayName}`);
      updated++;
    }
  }

  console.log(`\nDone! Updated: ${updated}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});

// Import all 362 ESPN NCAAM teams into our teams table
// Run: npx tsx scripts/import-all-espn-teams.ts
//
// This creates a permanent reference of all D1 teams with ESPN IDs and logos.
// Tournament-specific fields (seed, region, is_eliminated) remain null until
// Selection Sunday when the bracket is set.

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

async function main() {
  // 1. Fetch all ESPN teams
  console.log('Fetching all ESPN NCAAM teams...');
  const res = await fetch(ESPN_TEAMS_URL, {
    headers: { 'User-Agent': 'MBB-Survivor-Pool/1.0', Accept: 'application/json' },
  });
  if (!res.ok) {
    console.error(`ESPN API failed: ${res.status}`);
    process.exit(1);
  }
  const data = await res.json();
  const espnTeams = data.sports?.[0]?.leagues?.[0]?.teams?.map((t: any) => t.team) || [];
  console.log(`  Got ${espnTeams.length} ESPN teams.\n`);

  // 2. Fetch existing teams to avoid duplicates
  console.log('Fetching existing DB teams...');
  const { data: existingTeams } = await supabase
    .from('teams')
    .select('id, name, espn_team_id');
  const existingByEspnId = new Map(
    (existingTeams || []).filter(t => t.espn_team_id).map(t => [t.espn_team_id, t])
  );
  const existingByName = new Map(
    (existingTeams || []).map(t => [t.name.toLowerCase(), t])
  );
  console.log(`  Got ${existingTeams?.length || 0} existing teams.\n`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const espn of espnTeams) {
    const espnId = parseInt(espn.id);
    const teamName = espn.location || espn.shortDisplayName; // "Auburn", "Michigan State"
    const mascot = espn.name || ''; // "Tigers", "Spartans" — ESPN's "name" field is the mascot
    const abbreviation = espn.abbreviation || '';
    const logoUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`;

    // Check if already exists by ESPN ID
    const existsByEspn = existingByEspnId.get(espnId);
    if (existsByEspn) {
      // Update logo_url and mascot if missing
      await supabase
        .from('teams')
        .update({ logo_url: logoUrl, mascot: mascot || undefined })
        .eq('id', existsByEspn.id);
      skipped++;
      continue;
    }

    // Check if exists by name (case-insensitive)
    const existsByName = existingByName.get(teamName.toLowerCase());
    if (existsByName) {
      // Update with ESPN ID and logo
      const { error } = await supabase
        .from('teams')
        .update({ espn_team_id: espnId, logo_url: logoUrl, abbreviation, mascot: mascot || undefined })
        .eq('id', existsByName.id);
      if (error) {
        console.log(`  ✗ ${teamName} — update failed: ${error.message}`);
      } else {
        console.log(`  ↑ ${teamName} → updated with ESPN ID ${espnId}`);
        updated++;
      }
      continue;
    }

    // Insert new team (no seed/region/is_eliminated — those are tournament-specific)
    const { error } = await supabase.from('teams').insert({
      name: teamName,
      mascot,
      abbreviation,
      espn_team_id: espnId,
      logo_url: logoUrl,
      seed: null,
      region: null,
      is_eliminated: false,
    });

    if (error) {
      console.log(`  ✗ ${teamName} — insert failed: ${error.message}`);
    } else {
      console.log(`  + ${teamName} (${abbreviation}) — ESPN ID ${espnId}`);
      inserted++;
    }
  }

  console.log(`\nDone! Inserted: ${inserted}, Updated: ${updated}, Already had ESPN ID: ${skipped}`);

  // Summary
  const { count } = await supabase.from('teams').select('*', { count: 'exact', head: true });
  console.log(`Total teams in DB: ${count}`);
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});

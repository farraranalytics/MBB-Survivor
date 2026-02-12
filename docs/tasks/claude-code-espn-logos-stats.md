# ESPN Team Logos & Stats Links Integration

## Overview

Add team logos throughout the app using ESPN's public CDN, and add "View Stats" links that open ESPN's team stats page. The ESPN sync code (`src/lib/espn.ts`) already parses team logos and records from the API — we just need to store them and display them.

**Logo URL pattern:** `https://a.espncdn.com/i/teamlogos/ncaa/500/{espn_team_id}.png`
**Stats URL pattern:** `https://www.espn.com/mens-college-basketball/team/stats/_/id/{espn_team_id}`

---

## Schema Change

Add `espn_team_id` to the `teams` table. The `logo_url` column already exists but is empty.

```sql
ALTER TABLE teams ADD COLUMN IF NOT EXISTS espn_team_id INTEGER;
CREATE INDEX idx_teams_espn_id ON teams(espn_team_id);
```

## Where to Display Logos

### 1. Pick Page — Game Cards
Show small logo (20-24px) next to team name in each matchup card row. The logo sits between the seed number and team name.

```
 [logo] 1  HOUSTON     30-3
 [logo] 16 SIU-E       19-15
```

### 2. Bracket Page — Matchup Cards  
Show small logo (16-20px) next to team name in bracket matchup slots.

### 3. The Field / Standings Page — Grid Cells
Show tiny logo (14-16px) inline with team name in each pick cell. Since cells are compact, the logo should be small.

### 4. Dashboard — Pool Cards
Show logo next to the user's current pick on the pool status card (if pick is made).

### 5. Confirm Modal
Show larger logo (40-48px) centered above the team name in the pick confirmation modal.

## Logo Component

Create a reusable `TeamLogo` component:

```tsx
// src/components/TeamLogo.tsx
interface TeamLogoProps {
  espnTeamId: number | null;
  teamName: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';  // 14, 20, 32, 48px
  className?: string;
}

export function TeamLogo({ espnTeamId, teamName, size = 'sm', className }: TeamLogoProps) {
  const sizeMap = { xs: 14, sm: 20, md: 32, lg: 48 };
  const px = sizeMap[size];
  
  if (!espnTeamId) {
    // Fallback: colored circle with first letter
    return (
      <div className={`rounded-full bg-[#243447] flex items-center justify-center ${className}`}
           style={{ width: px, height: px }}>
        <span style={{ fontSize: px * 0.5, fontFamily: "'Oswald', sans-serif" }} 
              className="text-[#9BA3AE] font-bold">
          {teamName.charAt(0)}
        </span>
      </div>
    );
  }
  
  return (
    <img
      src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${espnTeamId}.png`}
      alt={teamName}
      width={px}
      height={px}
      className={`object-contain ${className}`}
      loading="lazy"
      onError={(e) => {
        // Fallback if logo fails to load
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}
```

## Stats Link Component

Create a small "Stats" link that opens ESPN in a new tab:

```tsx
// Can be part of TeamLogo.tsx or a separate util
export function getESPNStatsUrl(espnTeamId: number): string {
  return `https://www.espn.com/mens-college-basketball/team/stats/_/id/${espnTeamId}`;
}

export function getESPNTeamUrl(espnTeamId: number): string {
  return `https://www.espn.com/mens-college-basketball/team/_/id/${espnTeamId}`;
}
```

**Where to show stats link:**
- On the pick page: small "📊" icon or "STATS" text link on each game card, next to the network/time info. Opens ESPN stats in new tab.
- In the confirm modal: "View team stats →" link below the team name.
- On bracket matchup cards: optional, could add a small stats icon.

## Populating ESPN Team IDs

### For Test Data (2025 tournament)
The ESPN IDs need to be correct for logos to load. Rather than hardcoding all 64, create a **one-time population script** that:

1. Hits the ESPN teams search API for each team name in our DB
2. Matches the response and stores the `espn_team_id`
3. Builds and stores the `logo_url`

```typescript
// Script: scripts/populate-espn-ids.ts
// For each team in our DB:
//   1. Search ESPN API: site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?search={teamName}
//   2. Match by name/abbreviation
//   3. UPDATE teams SET espn_team_id = {id}, logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/{id}.png'
```

Run this script once after seeding test data. It should also be run after populating real 2026 teams on Selection Sunday.

### For ESPN Sync (production)
Update `src/lib/espn.ts` — when the sync processes a game from ESPN scoreboard data, it already has access to `competitors[0].team.id` (the ESPN team ID) and `competitors[0].team.logo`. When matching/creating teams in our DB, store these values:

```typescript
// In the ESPN sync flow (wherever teams are matched to our DB):
await supabase
  .from('teams')
  .update({ 
    espn_team_id: parseInt(espnTeamData.id),
    logo_url: espnTeamData.logo 
  })
  .eq('abbreviation', espnTeamData.abbreviation);
```

This means after the first ESPN sync runs, all team logos will auto-populate.

## Data Flow Through Existing Types

The `PickableTeam` type (`src/types/picks.ts`) already has `logo_url: string`. The `TeamInfo` type also has `logo_url`. So the data path to the UI already exists — we just need to:

1. Actually populate `logo_url` in the database
2. Add `espn_team_id` to `TeamInfo` type for building stats links
3. Use the `TeamLogo` component in the UI

### Type update:
```typescript
// src/types/picks.ts - TeamInfo
export interface TeamInfo {
  id: string;
  name: string;
  mascot: string;
  abbreviation: string;
  seed: number;
  region: string;
  logo_url: string;
  espn_team_id: number | null;  // ADD THIS
  is_eliminated: boolean;
}
```

## Files to Create
1. **`src/components/TeamLogo.tsx`** — Reusable logo component with fallback
2. **`scripts/populate-espn-ids.ts`** — One-time script to fetch ESPN IDs for all teams

## Files to Modify
1. **`src/types/picks.ts`** — Add `espn_team_id` to `TeamInfo`
2. **`src/lib/picks.ts`** — Include `espn_team_id` in team queries
3. **`src/lib/espn.ts`** — Store `espn_team_id` and `logo_url` during sync
4. **`src/app/pools/[id]/pick/page.tsx`** — Add TeamLogo to game cards + stats link
5. **`src/components/bracket/BracketMatchupCard.tsx`** — Add TeamLogo to bracket slots
6. **`src/app/pools/[id]/standings/page.tsx`** — Add TeamLogo to grid cells (if space allows)

## Implementation Order
1. Schema: add `espn_team_id` column
2. Create `TeamLogo` component
3. Create + run populate script for test data
4. Add logos to pick page game cards
5. Add logos to bracket matchup cards  
6. Add logos to standings grid
7. Add ESPN stats links to pick page + confirm modal
8. Update ESPN sync to auto-populate on future syncs

## Notes
- ESPN CDN images are publicly accessible, no API key needed
- Use `loading="lazy"` on all logo images for performance
- The 500px size logos from ESPN are high-res; CSS will scale them down. Could also use `/i/teamlogos/ncaa/500-dark/{id}.png` for dark-background optimized versions if available.
- Fallback gracefully — if `espn_team_id` is null or image fails to load, show the colored-circle-with-initial placeholder
- Don't block page render on logo loading

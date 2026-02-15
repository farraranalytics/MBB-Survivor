# March Madness Survivor - Matchup ID Structure & Propagation Logic

## Overview

This document outlines the recommended approach for managing tournament matchups in a database, including unique ID conventions, feeder relationships, and winner propagation logic.

**Critical Requirement:** Once the brackets are announced and initial data is loaded (teams, regions, seeds, game dates for Round of 64), all matchup records and propagation relationships must be **automatically generated**. No manual intervention should be required to create the bracket structure.

---

## Matchup ID Structure

Use a **positional ID system** that encodes location in the bracket:

```
{REGION}_{ROUND}_{SLOT}
```

**Examples:**
- `SOUTH_R64_1` — South region, Round of 64, first matchup slot
- `SOUTH_R32_1` — South region, Round of 32, first matchup slot
- `SOUTH_S16_1` — South region, Sweet 16, first matchup slot
- `SOUTH_E8_1` — South region, Elite 8 (only one per region)
- `F4_1` — Final Four, first semifinal
- `CHIP_1` — Championship game

---

## Single Region Decision Tree with IDs

```
ROUND OF 64                ROUND OF 32              SWEET 16              ELITE 8
═══════════                ═══════════              ════════              ═══════

┌──────────────┐
│ SOUTH_R64_1  │──┐
│ (1 vs 16)    │  │
└──────────────┘  ├──► SOUTH_R32_1 ──┐
┌──────────────┐  │                  │
│ SOUTH_R64_2  │──┘                  │
│ (8 vs 9)     │                     │
└──────────────┘                     ├──► SOUTH_S16_1 ──┐
┌──────────────┐                     │                  │
│ SOUTH_R64_3  │──┐                  │                  │
│ (5 vs 12)    │  │                  │                  │
└──────────────┘  ├──► SOUTH_R32_2 ──┘                  │
┌──────────────┐  │                                     │
│ SOUTH_R64_4  │──┘                                     │
│ (4 vs 13)    │                                        │
└──────────────┘                                        │
                                                        ├──► SOUTH_E8_1
┌──────────────┐                                        │    (Regional Final)
│ SOUTH_R64_5  │──┐                                     │
│ (6 vs 11)    │  │                                     │
└──────────────┘  ├──► SOUTH_R32_3 ──┐                  │
┌──────────────┐  │                  │                  │
│ SOUTH_R64_6  │──┘                  │                  │
│ (3 vs 14)    │                     │                  │
└──────────────┘                     ├──► SOUTH_S16_2 ──┘
┌──────────────┐                     │
│ SOUTH_R64_7  │──┐                  │
│ (7 vs 10)    │  │                  │
└──────────────┘  ├──► SOUTH_R32_4 ──┘
┌──────────────┐  │
│ SOUTH_R64_8  │──┘
│ (2 vs 15)    │
└──────────────┘
```

---

## Database Schema

### `matchups` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR | Primary key (e.g., `SOUTH_R64_1`) |
| `region` | VARCHAR | `SOUTH`, `EAST`, `WEST`, `MIDWEST`, `FINAL_FOUR`, `CHAMPIONSHIP` |
| `round` | VARCHAR | `R64`, `R32`, `S16`, `E8`, `F4`, `CHIP` |
| `slot` | INT | Position within round (1-8 for R64, 1-4 for R32, etc.) |
| `game_date` | DATE | Actual calendar date of the game |
| `team_1_id` | INT | FK to teams table (nullable until populated) |
| `team_2_id` | INT | FK to teams table (nullable until populated) |
| `team_1_seed` | INT | Seed of team 1 |
| `team_2_seed` | INT | Seed of team 2 |
| `feeder_matchup_1_id` | VARCHAR | FK to matchups (null for R64) |
| `feeder_matchup_2_id` | VARCHAR | FK to matchups (null for R64) |
| `winner_id` | INT | FK to teams table (null until decided) |
| `advances_to_matchup_id` | VARCHAR | FK to the next round matchup |
| `advances_to_slot` | INT | Which slot (1 or 2) winner fills in next matchup |
| `status` | VARCHAR | `SCHEDULED`, `IN_PROGRESS`, `FINAL` |

---

## Feeder Relationship Map (Single Region Example)

This table defines the **static bracket structure** that must be auto-generated:

| Matchup ID | Feeder 1 | Feeder 2 | Advances To | Slot |
|------------|----------|----------|-------------|------|
| `SOUTH_R64_1` | — | — | `SOUTH_R32_1` | 1 |
| `SOUTH_R64_2` | — | — | `SOUTH_R32_1` | 2 |
| `SOUTH_R64_3` | — | — | `SOUTH_R32_2` | 1 |
| `SOUTH_R64_4` | — | — | `SOUTH_R32_2` | 2 |
| `SOUTH_R64_5` | — | — | `SOUTH_R32_3` | 1 |
| `SOUTH_R64_6` | — | — | `SOUTH_R32_3` | 2 |
| `SOUTH_R64_7` | — | — | `SOUTH_R32_4` | 1 |
| `SOUTH_R64_8` | — | — | `SOUTH_R32_4` | 2 |
| `SOUTH_R32_1` | `SOUTH_R64_1` | `SOUTH_R64_2` | `SOUTH_S16_1` | 1 |
| `SOUTH_R32_2` | `SOUTH_R64_3` | `SOUTH_R64_4` | `SOUTH_S16_1` | 2 |
| `SOUTH_R32_3` | `SOUTH_R64_5` | `SOUTH_R64_6` | `SOUTH_S16_2` | 1 |
| `SOUTH_R32_4` | `SOUTH_R64_7` | `SOUTH_R64_8` | `SOUTH_S16_2` | 2 |
| `SOUTH_S16_1` | `SOUTH_R32_1` | `SOUTH_R32_2` | `SOUTH_E8_1` | 1 |
| `SOUTH_S16_2` | `SOUTH_R32_3` | `SOUTH_R32_4` | `SOUTH_E8_1` | 2 |
| `SOUTH_E8_1` | `SOUTH_S16_1` | `SOUTH_S16_2` | `F4_1` or `F4_2` | 1 or 2 |

---

## Full Tournament Structure

| Round | Games per Region | Total Games | ID Pattern |
|-------|------------------|-------------|------------|
| Round of 64 | 8 | 32 | `{REGION}_R64_{1-8}` |
| Round of 32 | 4 | 16 | `{REGION}_R32_{1-4}` |
| Sweet 16 | 2 | 8 | `{REGION}_S16_{1-2}` |
| Elite 8 | 1 | 4 | `{REGION}_E8_1` |
| Final Four | — | 2 | `F4_1`, `F4_2` |
| Championship | — | 1 | `CHIP_1` |
| **Total** | — | **63** | — |

---

## Automation Requirements

### What Must Be Auto-Generated on Bracket Load

When an admin loads the bracket data (Selection Sunday), the system should **automatically create all 63 matchup records** with the following logic:

#### Input Required (Round of 64 Only)

The only manual input needed:
- 64 teams with their assigned region and seed (1-16)
- Game dates for Round of 64 matchups
- (Optional) Game times if tracking pick deadlines

#### Auto-Generated Data

**1. Round of 64 Matchups (32 games)**
- Create matchup records with teams populated based on seed pairings:
  - Slot 1: 1 vs 16
  - Slot 2: 8 vs 9
  - Slot 3: 5 vs 12
  - Slot 4: 4 vs 13
  - Slot 5: 6 vs 11
  - Slot 6: 3 vs 14
  - Slot 7: 7 vs 10
  - Slot 8: 2 vs 15
- Set `advances_to_matchup_id` and `advances_to_slot` based on static bracket structure
- Set `feeder_matchup_1_id` and `feeder_matchup_2_id` to NULL (no feeders for R64)

**2. Round of 32 Matchups (16 games)**
- Create matchup records with `team_1_id` and `team_2_id` as NULL (TBD)
- Set `feeder_matchup_1_id` and `feeder_matchup_2_id` to appropriate R64 matchups
- Set `advances_to_matchup_id` and `advances_to_slot` to appropriate S16 matchups
- Set `game_date` based on tournament schedule logic

**3. Sweet 16 Matchups (8 games)**
- Create matchup records with teams as NULL
- Set feeders to appropriate R32 matchups
- Set advancement to appropriate E8 matchups
- Set `game_date` based on regional assignment (Thu: South/West, Fri: East/Midwest for 2026)

**4. Elite 8 Matchups (4 games)**
- Create matchup records with teams as NULL
- Set feeders to appropriate S16 matchups
- Set advancement to appropriate F4 matchup

**5. Final Four Matchups (2 games)**
- Create matchup records with teams as NULL
- Set feeders to appropriate E8 matchups (based on regional pairings)
- Set advancement to CHIP_1

**6. Championship Matchup (1 game)**
- Create matchup record with teams as NULL
- Set feeders to F4_1 and F4_2

### Bracket Generation Pseudocode

```javascript
function generateBracket(teams, roundOf64Dates) {
  const regions = ['SOUTH', 'EAST', 'WEST', 'MIDWEST'];
  const seedPairings = [
    [1, 16], [8, 9], [5, 12], [4, 13],
    [6, 11], [3, 14], [7, 10], [2, 15]
  ];
  
  const matchups = [];
  
  // Generate all matchups for each region
  for (const region of regions) {
    const regionTeams = teams.filter(t => t.region === region);
    
    // Round of 64 (8 matchups per region)
    for (let slot = 1; slot <= 8; slot++) {
      const [seed1, seed2] = seedPairings[slot - 1];
      const team1 = regionTeams.find(t => t.seed === seed1);
      const team2 = regionTeams.find(t => t.seed === seed2);
      
      matchups.push({
        id: `${region}_R64_${slot}`,
        region: region,
        round: 'R64',
        slot: slot,
        game_date: roundOf64Dates[region][slot],
        team_1_id: team1.id,
        team_2_id: team2.id,
        team_1_seed: seed1,
        team_2_seed: seed2,
        feeder_matchup_1_id: null,
        feeder_matchup_2_id: null,
        winner_id: null,
        advances_to_matchup_id: `${region}_R32_${Math.ceil(slot / 2)}`,
        advances_to_slot: ((slot - 1) % 2) + 1,
        status: 'SCHEDULED'
      });
    }
    
    // Round of 32 (4 matchups per region)
    for (let slot = 1; slot <= 4; slot++) {
      matchups.push({
        id: `${region}_R32_${slot}`,
        region: region,
        round: 'R32',
        slot: slot,
        game_date: calculateR32Date(region),
        team_1_id: null,
        team_2_id: null,
        feeder_matchup_1_id: `${region}_R64_${(slot * 2) - 1}`,
        feeder_matchup_2_id: `${region}_R64_${slot * 2}`,
        winner_id: null,
        advances_to_matchup_id: `${region}_S16_${Math.ceil(slot / 2)}`,
        advances_to_slot: ((slot - 1) % 2) + 1,
        status: 'SCHEDULED'
      });
    }
    
    // Sweet 16 (2 matchups per region)
    for (let slot = 1; slot <= 2; slot++) {
      matchups.push({
        id: `${region}_S16_${slot}`,
        region: region,
        round: 'S16',
        slot: slot,
        game_date: calculateS16Date(region),
        team_1_id: null,
        team_2_id: null,
        feeder_matchup_1_id: `${region}_R32_${(slot * 2) - 1}`,
        feeder_matchup_2_id: `${region}_R32_${slot * 2}`,
        winner_id: null,
        advances_to_matchup_id: `${region}_E8_1`,
        advances_to_slot: slot,
        status: 'SCHEDULED'
      });
    }
    
    // Elite 8 (1 matchup per region)
    matchups.push({
      id: `${region}_E8_1`,
      region: region,
      round: 'E8',
      slot: 1,
      game_date: calculateE8Date(region),
      team_1_id: null,
      team_2_id: null,
      feeder_matchup_1_id: `${region}_S16_1`,
      feeder_matchup_2_id: `${region}_S16_2`,
      winner_id: null,
      advances_to_matchup_id: getFinalFourMatchup(region),
      advances_to_slot: getFinalFourSlot(region),
      status: 'SCHEDULED'
    });
  }
  
  // Final Four (2 matchups)
  matchups.push({
    id: 'F4_1',
    region: 'FINAL_FOUR',
    round: 'F4',
    slot: 1,
    game_date: getFinalFourDate(),
    team_1_id: null,
    team_2_id: null,
    feeder_matchup_1_id: 'SOUTH_E8_1',  // Adjust based on yearly pairings
    feeder_matchup_2_id: 'EAST_E8_1',
    winner_id: null,
    advances_to_matchup_id: 'CHIP_1',
    advances_to_slot: 1,
    status: 'SCHEDULED'
  });
  
  matchups.push({
    id: 'F4_2',
    region: 'FINAL_FOUR',
    round: 'F4',
    slot: 2,
    game_date: getFinalFourDate(),
    team_1_id: null,
    team_2_id: null,
    feeder_matchup_1_id: 'MIDWEST_E8_1',  // Adjust based on yearly pairings
    feeder_matchup_2_id: 'WEST_E8_1',
    winner_id: null,
    advances_to_matchup_id: 'CHIP_1',
    advances_to_slot: 2,
    status: 'SCHEDULED'
  });
  
  // Championship (1 matchup)
  matchups.push({
    id: 'CHIP_1',
    region: 'CHAMPIONSHIP',
    round: 'CHIP',
    slot: 1,
    game_date: getChampionshipDate(),
    team_1_id: null,
    team_2_id: null,
    feeder_matchup_1_id: 'F4_1',
    feeder_matchup_2_id: 'F4_2',
    winner_id: null,
    advances_to_matchup_id: null,
    advances_to_slot: null,
    status: 'SCHEDULED'
  });
  
  return matchups;
}
```

---

## Winner Propagation Logic

When a game result is recorded, the winner must automatically populate the next round's matchup.

### Database Trigger or Application Logic

```javascript
function propagateWinner(completedMatchupId, winnerId) {
  // Get the completed matchup
  const completedMatchup = getMatchup(completedMatchupId);
  
  // Mark the matchup as complete
  completedMatchup.winner_id = winnerId;
  completedMatchup.status = 'FINAL';
  saveMatchup(completedMatchup);
  
  // Propagate to next round if applicable
  if (completedMatchup.advances_to_matchup_id) {
    const nextMatchup = getMatchup(completedMatchup.advances_to_matchup_id);
    
    // Get the winner's seed for display purposes
    const winnerSeed = (completedMatchup.team_1_id === winnerId) 
      ? completedMatchup.team_1_seed 
      : completedMatchup.team_2_seed;
    
    if (completedMatchup.advances_to_slot === 1) {
      nextMatchup.team_1_id = winnerId;
      nextMatchup.team_1_seed = winnerSeed;
    } else {
      nextMatchup.team_2_id = winnerId;
      nextMatchup.team_2_seed = winnerSeed;
    }
    
    saveMatchup(nextMatchup);
    
    // Log for debugging
    console.log(`Winner ${winnerId} advanced from ${completedMatchupId} to ${nextMatchup.id} slot ${completedMatchup.advances_to_slot}`);
  }
}
```

### SQL Alternative (Trigger-Based)

```sql
-- Trigger to propagate winner when a matchup is updated
CREATE OR REPLACE FUNCTION propagate_winner()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act if winner_id was just set
  IF NEW.winner_id IS NOT NULL AND OLD.winner_id IS NULL THEN
    
    -- Determine winner's seed
    DECLARE
      winner_seed INT;
    BEGIN
      IF NEW.winner_id = NEW.team_1_id THEN
        winner_seed := NEW.team_1_seed;
      ELSE
        winner_seed := NEW.team_2_seed;
      END IF;
      
      -- Update the next matchup
      IF NEW.advances_to_slot = 1 THEN
        UPDATE matchups
        SET team_1_id = NEW.winner_id,
            team_1_seed = winner_seed
        WHERE id = NEW.advances_to_matchup_id;
      ELSE
        UPDATE matchups
        SET team_2_id = NEW.winner_id,
            team_2_seed = winner_seed
        WHERE id = NEW.advances_to_matchup_id;
      END IF;
    END;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER winner_propagation_trigger
AFTER UPDATE ON matchups
FOR EACH ROW
EXECUTE FUNCTION propagate_winner();
```

---

## Audit Questions for Code Review

Use these questions to compare the current implementation against this specification:

### Bracket Generation
1. Does the system auto-generate all 63 matchup records when bracket data is loaded?
2. Are the seed pairings (1v16, 8v9, etc.) correctly hardcoded or configured?
3. Is the `advances_to_matchup_id` and `advances_to_slot` correctly set for each matchup?
4. Are the `feeder_matchup_1_id` and `feeder_matchup_2_id` correctly set for R32+?

### Winner Propagation
5. When a winner is recorded, does it automatically populate the next matchup?
6. Is the correct slot (team_1 vs team_2) being populated in the next matchup?
7. Does the seed carry forward correctly for display purposes?

### ID Structure
8. Are matchup IDs unique and following a consistent pattern?
9. Can you easily query "all matchups in Round X" or "all matchups in Region Y"?
10. Are the feeder/advancement relationships stored and queryable?

### Edge Cases
11. What happens if a winner is set twice (correction scenario)?
12. What happens if you try to set a winner before both teams are populated?
13. Is there validation that the winner is actually one of the two teams in the matchup?

---

## Summary

The key to reliable bracket management is:

1. **Static structure** — The bracket tree (feeder relationships, advancement paths) is 100% predictable and should be generated automatically
2. **Dynamic population** — Only team assignments and winners change as the tournament progresses
3. **Single source of truth** — The `matchups` table contains all relationships; no separate bracket logic
4. **Automatic propagation** — When a winner is set, the system handles advancement without manual intervention

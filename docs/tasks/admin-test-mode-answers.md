# Answers to Architecture Questions — Admin Test Mode Redesign

## Q1: DB Trigger `enforce_pick_deadline()` uses `NOW()`

**Yes, modify the trigger.** The trigger currently does:

```sql
SELECT 1 FROM rounds WHERE id = NEW.round_id AND deadline_datetime < NOW()
```

Replace with:

```sql
CREATE OR REPLACE FUNCTION enforce_pick_deadline()
RETURNS TRIGGER AS $$
DECLARE
    v_effective_now TIMESTAMPTZ;
    v_test_mode BOOLEAN;
    v_sim_time TIMESTAMPTZ;
BEGIN
    -- Check if test mode is active
    SELECT is_test_mode, simulated_datetime 
    INTO v_test_mode, v_sim_time
    FROM admin_test_state 
    LIMIT 1;
    
    IF v_test_mode AND v_sim_time IS NOT NULL THEN
        v_effective_now := v_sim_time;
    ELSE
        v_effective_now := NOW();
    END IF;

    IF EXISTS (
        SELECT 1 FROM rounds 
        WHERE id = NEW.round_id AND deadline_datetime < v_effective_now
    ) THEN
        RAISE EXCEPTION 'Cannot submit pick after deadline';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Without this, picks will be rejected at the DB level even when the simulated clock says the deadline hasn't passed. This is a hard blocker for testing.

---

## Q2: RLS Policies Using `NOW()`

**Yes, update them.** There are two RLS policies on `picks` that use `NOW()`:

1. **Pick visibility policy** — `deadline_datetime < NOW()` controls when other players' picks become visible
2. **Pick insert policy** — `deadline_datetime > NOW()` controls when picks can be submitted

Both need the same pattern — check `admin_test_state` and use `simulated_datetime` when test mode is on. Create a reusable SQL function:

```sql
CREATE OR REPLACE FUNCTION effective_now()
RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_test_mode BOOLEAN;
    v_sim_time TIMESTAMPTZ;
BEGIN
    SELECT is_test_mode, simulated_datetime 
    INTO v_test_mode, v_sim_time
    FROM admin_test_state 
    LIMIT 1;
    
    IF v_test_mode AND v_sim_time IS NOT NULL THEN
        RETURN v_sim_time;
    END IF;
    RETURN NOW();
END;
$$ LANGUAGE plpgsql STABLE;
```

Then update both RLS policies and the trigger to use `effective_now()` instead of `NOW()`. This gives you one place to control the clock at the DB level.

---

## Q3: `set-round-state` Route — What Should It Do?

**It should update `admin_test_state` AND toggle `rounds.is_active`.** Here's why:

Looking at `status.ts`, the status derivation is primarily game-data-driven (it counts scheduled/in_progress/final games), but `rounds.is_active` is still referenced elsewhere in the codebase. The safe approach:

- **Primary action:** Update `admin_test_state` (set `target_round_id`, `phase`, `simulated_datetime`)
- **Secondary action:** Set `is_active = true` on the target round, `is_active = false` on all others
- **Do NOT manipulate `game_datetime`** (which is what the current version does)

The `is_active` flag acts as a hint for UI components that may use it directly rather than going through the full `getTournamentState()` call. Keep it in sync, but the simulated clock is the source of truth for deadline checks.

---

## Q4: Async `getEffectiveNow()` in `setInterval` Timers

**Option (a) — offset approach.** This is the right call. Here's the pattern:

```typescript
// On component mount:
const realNow = Date.now();
const effectiveNow = await getEffectiveNow();
const offset = effectiveNow.getTime() - realNow; // e.g., +37 days in ms

// In setInterval (runs every second, fully synchronous):
const tick = () => {
  const simulated = new Date(Date.now() + offset);
  setTimeRemaining(deadline.getTime() - simulated.getTime());
};
```

The offset stays constant for the session. If the admin changes the simulated time, the component re-mounts or you trigger a re-fetch of the offset. No async in the interval, no jank, clean countdown.

For the re-fetch: subscribe to `admin_test_state` changes via Supabase realtime, or just re-fetch when the user navigates to the page. Don't over-engineer it — admin is the one changing the clock, they can refresh.

---

## Q5: Parent Game Columns — Same Migration or Separate?

**Same migration (003_admin_test_state.sql).** The columns `parent_game_a_id`, `parent_game_b_id`, `future_game_id`, and `bracket_position` already exist on the `games` table — they were added by the `migration_round_day_mapping.sql` that was run earlier (you can see them in the CSV headers). No need to add them again.

The migration only needs to create:
- `admin_test_state` table
- `effective_now()` function
- Updated `enforce_pick_deadline()` trigger
- Updated RLS policies on `picks`

---

## Q6: 2025 Real Results Data

**It's not in the repo.** The data is in `2025_March_Madness_Results.xlsx` which lives in the outputs directory from a previous Claude session. 

Here are all 63 game results — hardcode this as a constant:

```typescript
// Key format: "HIGHER_SEED_ABBR_vs_LOWER_SEED_ABBR" (team1 vs team2 as seeded in DB)
// The seed script uses higher seed as team1 for all R64 games
export const REAL_2025_RESULTS: Record<string, { winner: string; winnerScore: number; loserScore: number }> = {
  // === R64 Day 1 (Mar 19) ===
  'HOU_vs_SIUE':  { winner: 'HOU',  winnerScore: 78, loserScore: 40 },
  'AUB_vs_ALST':  { winner: 'AUB',  winnerScore: 83, loserScore: 63 },
  'TENN_vs_WOF':  { winner: 'TENN', winnerScore: 77, loserScore: 62 },
  'SJU_vs_OMA':   { winner: 'SJU',  winnerScore: 83, loserScore: 53 },
  'WIS_vs_MONT':  { winner: 'WIS',  winnerScore: 85, loserScore: 66 },
  'TTU_vs_UNCW':  { winner: 'TTU',  winnerScore: 82, loserScore: 72 },
  'PUR_vs_HPU':   { winner: 'PUR',  winnerScore: 75, loserScore: 63 },
  'TAMU_vs_YALE': { winner: 'TAMU', winnerScore: 80, loserScore: 71 },
  'CLEM_vs_MCN':  { winner: 'MCN',  winnerScore: 69, loserScore: 67 },  // UPSET
  'MICH_vs_UCSD': { winner: 'MICH', winnerScore: 68, loserScore: 65 },
  'BYU_vs_VCU':   { winner: 'BYU',  winnerScore: 80, loserScore: 71 },
  'MIZ_vs_DRKE':  { winner: 'DRKE', winnerScore: 67, loserScore: 57 },  // UPSET
  'KU_vs_ARK':    { winner: 'ARK',  winnerScore: 79, loserScore: 72 },  // UPSET
  'UCLA_vs_USU':  { winner: 'UCLA', winnerScore: 72, loserScore: 47 },
  'LOU_vs_CREI':  { winner: 'CREI', winnerScore: 89, loserScore: 75 },  // UPSET
  'GONZ_vs_UGA':  { winner: 'GONZ', winnerScore: 89, loserScore: 68 },
  
  // === R64 Day 2 (Mar 20) ===
  'DUKE_vs_MSM':  { winner: 'DUKE', winnerScore: 93, loserScore: 49 },
  'FLA_vs_NORF':  { winner: 'FLA',  winnerScore: 95, loserScore: 69 },
  'ALA_vs_RMU':   { winner: 'ALA',  winnerScore: 90, loserScore: 81 },
  'MSU_vs_BRY':   { winner: 'MSU',  winnerScore: 87, loserScore: 62 },
  'ISU_vs_LIP':   { winner: 'ISU',  winnerScore: 82, loserScore: 55 },
  'UK_vs_TROY':   { winner: 'UK',   winnerScore: 76, loserScore: 57 },
  'MD_vs_GCU':    { winner: 'MD',   winnerScore: 81, loserScore: 49 },
  'ARIZ_vs_AKR':  { winner: 'ARIZ', winnerScore: 93, loserScore: 65 },
  'MEM_vs_CSU':   { winner: 'CSU',  winnerScore: 78, loserScore: 70 },  // UPSET
  'ORE_vs_LIB':   { winner: 'ORE',  winnerScore: 81, loserScore: 52 },
  'MISS_vs_UNC':  { winner: 'MISS', winnerScore: 71, loserScore: 64 },
  'ILL_vs_XAV':   { winner: 'ILL',  winnerScore: 86, loserScore: 73 },
  'SMC_vs_VAN':   { winner: 'SMC',  winnerScore: 59, loserScore: 56 },
  'MARQ_vs_UNM':  { winner: 'UNM',  winnerScore: 75, loserScore: 66 },  // UPSET
  'MSST_vs_BAY':  { winner: 'BAY',  winnerScore: 75, loserScore: 72 },  // UPSET
  'CONN_vs_OU':   { winner: 'CONN', winnerScore: 67, loserScore: 59 },
  
  // === R32 Day 1 (Mar 21) ===
  'AUB_vs_CREI':  { winner: 'AUB',  winnerScore: 82, loserScore: 70 },
  'HOU_vs_GONZ':  { winner: 'HOU',  winnerScore: 81, loserScore: 76 },
  'SJU_vs_ARK':   { winner: 'ARK',  winnerScore: 75, loserScore: 66 },  // UPSET
  'TENN_vs_UCLA': { winner: 'TENN', winnerScore: 67, loserScore: 58 },
  'TTU_vs_DRKE':  { winner: 'TTU',  winnerScore: 77, loserScore: 64 },
  'WIS_vs_BYU':   { winner: 'BYU',  winnerScore: 91, loserScore: 89 },  // UPSET
  'PUR_vs_MCN':   { winner: 'PUR',  winnerScore: 76, loserScore: 62 },
  'TAMU_vs_MICH': { winner: 'MICH', winnerScore: 91, loserScore: 79 },  // UPSET
  
  // === R32 Day 2 (Mar 22) ===
  'FLA_vs_CONN':  { winner: 'FLA',  winnerScore: 77, loserScore: 75 },
  'DUKE_vs_BAY':  { winner: 'DUKE', winnerScore: 89, loserScore: 66 },
  'ALA_vs_SMC':   { winner: 'ALA',  winnerScore: 80, loserScore: 66 },
  'MSU_vs_UNM':   { winner: 'MSU',  winnerScore: 71, loserScore: 63 },
  'UK_vs_ILL':    { winner: 'UK',   winnerScore: 84, loserScore: 75 },
  'ISU_vs_MISS':  { winner: 'MISS', winnerScore: 91, loserScore: 78 },  // UPSET
  'MD_vs_CSU':    { winner: 'MD',   winnerScore: 72, loserScore: 71 },
  'ARIZ_vs_ORE':  { winner: 'ARIZ', winnerScore: 87, loserScore: 83 },
  
  // === Sweet 16 Day 1 (Mar 26) ===
  'FLA_vs_MD':    { winner: 'FLA',  winnerScore: 87, loserScore: 71 },
  'DUKE_vs_ARIZ': { winner: 'DUKE', winnerScore: 100, loserScore: 93 },
  'ALA_vs_BYU':   { winner: 'ALA',  winnerScore: 113, loserScore: 88 },
  'TTU_vs_ARK':   { winner: 'TTU',  winnerScore: 85, loserScore: 83 },
  
  // === Sweet 16 Day 2 (Mar 27) ===
  'AUB_vs_MICH':  { winner: 'AUB',  winnerScore: 78, loserScore: 65 },
  'HOU_vs_PUR':   { winner: 'HOU',  winnerScore: 62, loserScore: 60 },
  'MSU_vs_MISS':  { winner: 'MSU',  winnerScore: 73, loserScore: 70 },
  'TENN_vs_UK':   { winner: 'TENN', winnerScore: 78, loserScore: 65 },
  
  // === Elite 8 Day 1 (Mar 28) ===
  'FLA_vs_TTU':   { winner: 'FLA',  winnerScore: 84, loserScore: 79 },
  'DUKE_vs_ALA':  { winner: 'DUKE', winnerScore: 85, loserScore: 65 },
  
  // === Elite 8 Day 2 (Mar 29) ===
  'HOU_vs_TENN':  { winner: 'HOU',  winnerScore: 69, loserScore: 50 },
  'AUB_vs_MSU':   { winner: 'AUB',  winnerScore: 70, loserScore: 64 },
  
  // === Final Four (Apr 4) ===
  'FLA_vs_AUB':   { winner: 'FLA',  winnerScore: 79, loserScore: 73 },
  'HOU_vs_DUKE':  { winner: 'HOU',  winnerScore: 70, loserScore: 67 },
  
  // === Championship (Apr 6) ===
  'FLA_vs_HOU':   { winner: 'FLA',  winnerScore: 65, loserScore: 63 },
};
```

Note: For R32+ games, the key format uses the higher-seeded team first (as team1), but in upsets the winner will be the lower seed. The cascade flow will create these games with actual team IDs, so the lookup key needs to be built from the two team abbreviations at game creation time.

---

## Q7: "Complete Next Game" — Order

**By `game_datetime` order** (earliest unfinished game first). This matches the real tournament flow — games tip off in time order, so results come in that order. Bracket position could work too, but datetime is more intuitive and matches what a user sees on TV.

```typescript
const nextGame = games
  .filter(g => g.status === 'scheduled' && g.round_id === targetRoundId)
  .sort((a, b) => new Date(a.game_datetime).getTime() - new Date(b.game_datetime).getTime())
  [0];
```

---

## Q8: Scope of `getEffectiveNow()` in Cron Routes

**Defer cron routes.** The "What NOT to Change" section is intentional. The cron routes (`sync-games`, `activate-rounds`, `process-results`) are for the LIVE tournament and should always use real `NOW()`. They'll never run during test mode (cron jobs aren't even scheduled yet per the project status).

Only replace `new Date()` / `NOW()` in:
- Client-side code (components, hooks, lib utilities)
- The admin test API routes themselves
- The DB trigger and RLS policies
- `status.ts` / `status-server.ts`

Do NOT touch:
- `src/app/api/cron/*` routes
- `src/lib/espn.ts`

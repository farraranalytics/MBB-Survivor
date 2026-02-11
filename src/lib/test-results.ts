// src/lib/test-results.ts
// Real 2025 NCAA Tournament results for admin test mode.
// Key format: "HIGHER_SEED_ABBR_vs_LOWER_SEED_ABBR"
// Used by complete-game and complete-round admin routes.

export interface GameResult {
  winner: string;
  winnerScore: number;
  loserScore: number;
}

export const REAL_2025_RESULTS: Record<string, GameResult> = {
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

/**
 * Look up real results for a game given two team abbreviations.
 * Tries both orderings (A_vs_B and B_vs_A).
 */
export function lookupRealResult(
  team1Abbr: string,
  team2Abbr: string
): GameResult | null {
  const key1 = `${team1Abbr}_vs_${team2Abbr}`;
  const key2 = `${team2Abbr}_vs_${team1Abbr}`;
  return REAL_2025_RESULTS[key1] || REAL_2025_RESULTS[key2] || null;
}

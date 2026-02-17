// The Odds API v4 client for NCAAB odds data (server-side only)

import type {
  OddsEvent,
  OddsBookmaker,
  OddsQuota,
  GameOdds,
  ScoreEvent,
} from '@/types/odds';

const ODDS_BASE_URL = 'https://api.the-odds-api.com/v4';
const SPORT = 'basketball_ncaab';

export class OddsApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'OddsApiError';
  }
}

// In-memory cache (same pattern as ESPN client)
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCachedData<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as T;
  }
  return null;
}

function setCachedData<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

function getApiKey(): string {
  const key = process.env.ODDS_API_KEY;
  if (!key) {
    throw new OddsApiError('ODDS_API_KEY environment variable is not set');
  }
  return key;
}

function extractQuota(headers: Headers): OddsQuota {
  const remaining = headers.get('x-requests-remaining');
  const used = headers.get('x-requests-used');
  return {
    remaining: remaining ? parseInt(remaining, 10) : null,
    used: used ? parseInt(used, 10) : null,
  };
}

/**
 * Validate the API key by hitting the free /sports endpoint.
 */
export async function validateApiKey(): Promise<{ valid: boolean; quota: OddsQuota }> {
  try {
    const apiKey = getApiKey();
    const response = await fetch(
      `${ODDS_BASE_URL}/sports/?apiKey=${apiKey}`,
      { next: { revalidate: 0 } }
    );

    const quota = extractQuota(response.headers);

    if (response.status === 401) {
      return { valid: false, quota };
    }

    if (!response.ok) {
      throw new OddsApiError(`Odds API returned ${response.status}`, response.status);
    }

    return { valid: true, quota };
  } catch (error) {
    if (error instanceof OddsApiError) throw error;
    throw new OddsApiError(
      `Failed to validate API key: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if basketball_ncaab is currently an active sport.
 */
export async function checkNcaabActive(): Promise<{ active: boolean; quota: OddsQuota }> {
  const apiKey = getApiKey();
  const response = await fetch(
    `${ODDS_BASE_URL}/sports/?apiKey=${apiKey}`,
    { next: { revalidate: 0 } }
  );

  const quota = extractQuota(response.headers);

  if (!response.ok) {
    throw new OddsApiError(`Odds API returned ${response.status}`, response.status);
  }

  const sports: { key: string; active: boolean }[] = await response.json();
  const ncaab = sports.find(s => s.key === SPORT);

  return { active: ncaab?.active ?? false, quota };
}

/**
 * Fetch NCAAB odds (moneyline + spreads) for upcoming/live games.
 * Quota cost: 2 (1 region x 2 markets)
 */
export async function fetchNcaabOdds(): Promise<{ events: OddsEvent[]; quota: OddsQuota }> {
  const cacheKey = 'ncaab-odds';
  const cached = getCachedData<{ events: OddsEvent[]; quota: OddsQuota }>(cacheKey);
  if (cached) return cached;

  const apiKey = getApiKey();
  const params = new URLSearchParams({
    apiKey,
    regions: 'us',
    markets: 'h2h,spreads',
    oddsFormat: 'american',
    dateFormat: 'iso',
  });

  const response = await fetch(
    `${ODDS_BASE_URL}/sports/${SPORT}/odds/?${params}`,
    { next: { revalidate: 0 } }
  );

  const quota = extractQuota(response.headers);

  if (!response.ok) {
    throw new OddsApiError(`Odds API returned ${response.status}`, response.status);
  }

  const events: OddsEvent[] = await response.json();
  const result = { events, quota };
  setCachedData(cacheKey, result);
  return result;
}

/**
 * Fetch NCAAB scores for live and recently completed games.
 * Quota cost: 1 (live only) or 2 (with daysFrom)
 */
export async function fetchNcaabScores(
  daysFrom?: number
): Promise<{ events: ScoreEvent[]; quota: OddsQuota }> {
  const cacheKey = `ncaab-scores-${daysFrom ?? 'live'}`;
  const cached = getCachedData<{ events: ScoreEvent[]; quota: OddsQuota }>(cacheKey);
  if (cached) return cached;

  const apiKey = getApiKey();
  const params = new URLSearchParams({
    apiKey,
    dateFormat: 'iso',
  });

  if (daysFrom !== undefined) {
    params.set('daysFrom', String(daysFrom));
  }

  const response = await fetch(
    `${ODDS_BASE_URL}/sports/${SPORT}/scores/?${params}`,
    { next: { revalidate: 0 } }
  );

  const quota = extractQuota(response.headers);

  if (!response.ok) {
    throw new OddsApiError(`Odds API returned ${response.status}`, response.status);
  }

  const events: ScoreEvent[] = await response.json();
  const result = { events, quota };
  setCachedData(cacheKey, result);
  return result;
}

/**
 * Extract consensus odds from bookmakers for a given event.
 * Averages moneyline and spread across all bookmakers.
 */
export function extractBestOdds(
  bookmakers: OddsBookmaker[],
  homeTeam: string,
  awayTeam: string
): GameOdds {
  const moneylines: { home: number[]; away: number[] } = { home: [], away: [] };
  const spreads: { home: number[]; away: number[] } = { home: [], away: [] };

  for (const bk of bookmakers) {
    for (const market of bk.markets) {
      for (const outcome of market.outcomes) {
        const isHome = outcome.name === homeTeam;
        const isAway = outcome.name === awayTeam;
        if (!isHome && !isAway) continue;

        if (market.key === 'h2h') {
          if (isHome) moneylines.home.push(outcome.price);
          if (isAway) moneylines.away.push(outcome.price);
        } else if (market.key === 'spreads' && outcome.point !== undefined) {
          if (isHome) spreads.home.push(outcome.point);
          if (isAway) spreads.away.push(outcome.point);
        }
      }
    }
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const homeML = avg(moneylines.home);
  const awayML = avg(moneylines.away);

  return {
    team1Moneyline: homeML !== null ? Math.round(homeML) : null,
    team2Moneyline: awayML !== null ? Math.round(awayML) : null,
    team1Spread: spreads.home.length > 0 ? Math.round(avg(spreads.home)! * 10) / 10 : null,
    team2Spread: spreads.away.length > 0 ? Math.round(avg(spreads.away)! * 10) / 10 : null,
    team1WinProbability: homeML !== null ? Math.round(americanToImpliedProbability(homeML) * 1000) / 1000 : null,
    team2WinProbability: awayML !== null ? Math.round(americanToImpliedProbability(awayML) * 1000) / 1000 : null,
    oddsUpdatedAt: new Date().toISOString(),
  };
}

/**
 * Convert American odds to implied probability (0-1).
 * -200 → 0.667, +150 → 0.4
 */
export function americanToImpliedProbability(odds: number): number {
  if (odds < 0) {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
  return 100 / (odds + 100);
}

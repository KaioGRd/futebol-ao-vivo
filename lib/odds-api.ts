/**
 * The Odds API Client — Multi-Sport Coverage
 * Docs: https://the-odds-api.com/liveapi/guides/v4/
 * Free tier: 500 requests/month
 * Get your key at: https://the-odds-api.com
 */

const BASE = 'https://api.the-odds-api.com/v4';

function getKey(): string {
  return process.env.ODDS_API_KEY ?? '';
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SportInfo {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

export interface OddsOutcome {
  name: string;
  price: number; // decimal odds
  point?: number; // for spreads/totals
}

export interface OddsMarket {
  key: 'h2h' | 'spreads' | 'totals' | string;
  last_update: string;
  outcomes: OddsOutcome[];
}

export interface OddsBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsMarket[];
}

export interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

// ─── Sports catalogue ─────────────────────────────────────────────────────────

export interface SportCategory {
  id: string;
  label: string;
  emoji: string;
  sport_keys: string[];
}

export const SPORT_CATEGORIES: SportCategory[] = [
  {
    id: 'futebol',
    label: 'Futebol',
    emoji: '⚽',
    sport_keys: [
      'soccer_brazil_campeonato',
      'soccer_epl',
      'soccer_spain_la_liga',
      'soccer_germany_bundesliga',
      'soccer_italy_serie_a',
      'soccer_france_ligue_one',
      'soccer_uefa_champs_league',
      'soccer_uefa_europa_league',
      'soccer_conmebol_copa_libertadores',
      'soccer_argentina_primera_division',
      'soccer_portugal_primeira_liga',
    ],
  },
  {
    id: 'basquete',
    label: 'Basquete',
    emoji: '🏀',
    sport_keys: ['basketball_nba', 'basketball_wnba', 'basketball_euroleague', 'basketball_nbl'],
  },
  {
    id: 'tenis',
    label: 'Tênis',
    emoji: '🎾',
    sport_keys: ['tennis_atp_french_open', 'tennis_atp_us_open', 'tennis_atp_wimbledon', 'tennis_wta_us_open'],
  },
  {
    id: 'mma',
    label: 'MMA / UFC',
    emoji: '🥊',
    sport_keys: ['mma_mixed_martial_arts'],
  },
  {
    id: 'futebol_americano',
    label: 'Futebol Americano',
    emoji: '🏈',
    sport_keys: ['americanfootball_nfl', 'americanfootball_ncaaf'],
  },
  {
    id: 'beisebol',
    label: 'Beisebol',
    emoji: '⚾',
    sport_keys: ['baseball_mlb'],
  },
  {
    id: 'hockey',
    label: 'Hóquei',
    emoji: '🏒',
    sport_keys: ['icehockey_nhl'],
  },
  {
    id: 'rugby',
    label: 'Rugby',
    emoji: '🏉',
    sport_keys: ['rugbyunion_six_nations', 'rugbyleague_nrl'],
  },
];

// Priority bookmakers (sharpest = best reference for true probability)
// Pinnacle is the gold standard — least margin, most accurate odds
export const PRIORITY_BOOKMAKERS = [
  'pinnacle',
  'betfair_ex_eu',
  'betfair',
  'williamhill',
  'bet365',
  'unibet_eu',
  'draftkings',
  'fanduel',
];

// ─── API functions ─────────────────────────────────────────────────────────────

export async function getSports(): Promise<SportInfo[]> {
  const key = getKey();
  if (!key) return [];

  try {
    const res = await fetch(`${BASE}/sports?apiKey=${key}&all=false`, {
      next: { revalidate: 3600 }, // cache 1 hour
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function getEventOdds(
  sportKey: string,
  options: {
    regions?: string;
    markets?: string;
    oddsFormat?: 'decimal' | 'american';
  } = {}
): Promise<OddsEvent[]> {
  const key = getKey();
  if (!key) return [];

  const {
    regions = 'eu,uk,au',
    markets = 'h2h',
    oddsFormat = 'decimal',
  } = options;

  try {
    const url = `${BASE}/sports/${sportKey}/odds?apiKey=${key}&regions=${regions}&markets=${markets}&oddsFormat=${oddsFormat}`;
    const res = await fetch(url, {
      next: { revalidate: 300 }, // cache 5 min
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function getMultipleSportsEvents(
  sportKeys: string[],
  options: { regions?: string; markets?: string } = {}
): Promise<OddsEvent[]> {
  const results = await Promise.allSettled(
    sportKeys.map(k => getEventOdds(k, options))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<OddsEvent[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());
}

/**
 * Get the best available odds for an event, prioritizing sharp bookmakers.
 * Returns the first bookmaker found in priority order, falling back to any available.
 */
export function getBestBookmakerOdds(
  event: OddsEvent,
  marketKey: string = 'h2h'
): { bookmaker: string; outcomes: OddsOutcome[] } | null {
  const allBookmakers = event.bookmakers;
  if (!allBookmakers || allBookmakers.length === 0) return null;

  // Try priority bookmakers first
  for (const bk of PRIORITY_BOOKMAKERS) {
    const found = allBookmakers.find(b => b.key === bk);
    if (found) {
      const market = found.markets.find(m => m.key === marketKey);
      if (market) return { bookmaker: found.title, outcomes: market.outcomes };
    }
  }

  // Fallback: first available bookmaker with this market
  for (const bk of allBookmakers) {
    const market = bk.markets.find(m => m.key === marketKey);
    if (market) return { bookmaker: bk.title, outcomes: market.outcomes };
  }

  return null;
}

/**
 * Get consensus odds: average price across all available bookmakers for each outcome.
 * This is a better "true" probability reference than any single bookmaker.
 */
export function getConsensusOdds(event: OddsEvent, marketKey: string = 'h2h'): OddsOutcome[] | null {
  const markets = event.bookmakers
    .map(b => b.markets.find(m => m.key === marketKey))
    .filter(Boolean) as OddsMarket[];

  if (markets.length === 0) return null;

  const firstMarket = markets[0];
  const outcomeNames = firstMarket.outcomes.map(o => o.name);

  return outcomeNames.map(name => {
    const prices = markets
      .map(m => m.outcomes.find(o => o.name === name)?.price)
      .filter((p): p is number => p !== undefined);

    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    return { name, price: parseFloat(avgPrice.toFixed(3)) };
  });
}

/**
 * Check if the API key is configured
 */
export function isApiConfigured(): boolean {
  return !!(process.env.ODDS_API_KEY);
}

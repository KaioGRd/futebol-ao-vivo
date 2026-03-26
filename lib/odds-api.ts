/**
 * The Odds API Client — Multi-Sport, Multi-Market Coverage
 * Docs: https://the-odds-api.com/liveapi/guides/v4/
 * Get your key at: https://the-odds-api.com
 *
 * Mercados suportados:
 *   h2h      → Resultado Final (1X2 / Moneyline)
 *   totals   → Total de Gols / Pontos (Over/Under)
 *   spreads  → Handicap / Spread
 *
 * Uso de quota:
 *   Por chamada = ceil(num_regions × num_markets / 2)
 *   Com eu,uk,au + h2h,totals = ~2 requests por esporte
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
  price: number;
  point?: number;
}

export interface OddsMarket {
  key: string;
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

export interface MarketConfig {
  key: string;
  label: string;
  description: string;
  emoji: string;
  sports: string[]; // quais esportes suportam este mercado
}

// ─── Catálogo de Mercados ─────────────────────────────────────────────────────

export const MARKET_CONFIGS: MarketConfig[] = [
  {
    key: 'h2h',
    label: 'Resultado Final',
    description: '1X2 — Quem vence a partida',
    emoji: '🏆',
    sports: ['soccer', 'basketball', 'tennis', 'mma', 'americanfootball', 'baseball', 'icehockey', 'rugby'],
  },
  {
    key: 'totals',
    label: 'Total (Over/Under)',
    description: 'Total de gols/pontos na partida',
    emoji: '🎯',
    sports: ['soccer', 'basketball', 'americanfootball', 'baseball', 'icehockey', 'tennis'],
  },
  {
    key: 'spreads',
    label: 'Handicap',
    description: 'Vantagem/desvantagem ajustada',
    emoji: '⚖️',
    sports: ['basketball', 'americanfootball', 'baseball', 'icehockey', 'soccer'],
  },
];

// ─── Categorias de Esportes ───────────────────────────────────────────────────

export interface SportCategory {
  id: string;
  label: string;
  emoji: string;
  sport_keys: string[];
  primary_markets: string[];  // mercados principais para este esporte
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
      'soccer_conmebol_copa_america',
      'soccer_argentina_primera_division',
      'soccer_portugal_primeira_liga',
    ],
    primary_markets: ['h2h', 'totals', 'spreads'],
  },
  {
    id: 'basquete',
    label: 'Basquete',
    emoji: '🏀',
    sport_keys: ['basketball_nba', 'basketball_wnba', 'basketball_euroleague', 'basketball_nbl'],
    primary_markets: ['h2h', 'spreads', 'totals'],
  },
  {
    id: 'tenis',
    label: 'Tênis',
    emoji: '🎾',
    sport_keys: [
      'tennis_atp_french_open',
      'tennis_atp_us_open',
      'tennis_atp_wimbledon',
      'tennis_wta_us_open',
      'tennis_atp_australian_open',
    ],
    primary_markets: ['h2h'],
  },
  {
    id: 'mma',
    label: 'MMA / UFC',
    emoji: '🥊',
    sport_keys: ['mma_mixed_martial_arts'],
    primary_markets: ['h2h'],
  },
  {
    id: 'futebol_americano',
    label: 'Futebol Americano',
    emoji: '🏈',
    sport_keys: ['americanfootball_nfl', 'americanfootball_ncaaf'],
    primary_markets: ['h2h', 'spreads', 'totals'],
  },
  {
    id: 'beisebol',
    label: 'Beisebol',
    emoji: '⚾',
    sport_keys: ['baseball_mlb'],
    primary_markets: ['h2h', 'totals'],
  },
  {
    id: 'hockey',
    label: 'Hóquei',
    emoji: '🏒',
    sport_keys: ['icehockey_nhl'],
    primary_markets: ['h2h', 'spreads', 'totals'],
  },
  {
    id: 'rugby',
    label: 'Rugby',
    emoji: '🏉',
    sport_keys: ['rugbyunion_six_nations', 'rugbyleague_nrl', 'rugbyunion_world_cup'],
    primary_markets: ['h2h', 'spreads'],
  },
];

// Bookmakers de referência em ordem de confiabilidade
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

// ─── API Functions ────────────────────────────────────────────────────────────

export async function getSports(): Promise<SportInfo[]> {
  const key = getKey();
  if (!key) return [];
  try {
    const res = await fetch(`${BASE}/sports?apiKey=${key}&all=false`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

/**
 * Busca eventos com múltiplos mercados para um esporte.
 * markets = array de market keys, ex: ['h2h', 'totals']
 */
export async function getEventOdds(
  sportKey: string,
  options: {
    regions?: string;
    markets?: string[];
    oddsFormat?: 'decimal' | 'american';
    cacheSeconds?: number;
  } = {}
): Promise<OddsEvent[]> {
  const key = getKey();
  if (!key) return [];

  const {
    regions = 'eu,uk,au',
    markets = ['h2h'],
    oddsFormat = 'decimal',
    cacheSeconds = 300,
  } = options;

  const marketsParam = markets.join(',');

  try {
    const url = `${BASE}/sports/${sportKey}/odds?apiKey=${key}&regions=${regions}&markets=${marketsParam}&oddsFormat=${oddsFormat}`;
    const res = await fetch(url, { next: { revalidate: cacheSeconds } });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

/**
 * Busca múltiplos esportes em paralelo e combina os resultados.
 */
export async function getMultipleSportsEvents(
  sportKeys: string[],
  options: { regions?: string; markets?: string[]; cacheSeconds?: number } = {}
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
 * Busca eventos para uma categoria inteira com os mercados adequados para aquele esporte.
 */
export async function getCategoryEvents(categoryId: string): Promise<OddsEvent[]> {
  const cat = SPORT_CATEGORIES.find(c => c.id === categoryId);
  if (!cat) return [];

  const sportKeys = cat.sport_keys.slice(0, 6);
  const markets = cat.primary_markets;

  return getMultipleSportsEvents(sportKeys, {
    regions: 'eu,uk,au',
    markets,
    cacheSeconds: 300,
  });
}

// ─── Helpers de Análise ───────────────────────────────────────────────────────

/**
 * Retorna os mercados disponíveis em um evento
 */
export function getAvailableMarkets(event: OddsEvent): string[] {
  const marketKeys = new Set<string>();
  for (const bk of event.bookmakers) {
    for (const mkt of bk.markets) {
      marketKeys.add(mkt.key);
    }
  }
  return Array.from(marketKeys);
}

/**
 * Retorna os outcomes de um mercado específico do melhor bookmaker disponível.
 */
export function getBestBookmakerOdds(
  event: OddsEvent,
  marketKey: string = 'h2h'
): { bookmaker: string; outcomes: OddsOutcome[] } | null {
  for (const bk of PRIORITY_BOOKMAKERS) {
    const found = event.bookmakers.find(b => b.key === bk);
    if (found) {
      const market = found.markets.find(m => m.key === marketKey);
      if (market && market.outcomes.length > 0) {
        return { bookmaker: found.title, outcomes: market.outcomes };
      }
    }
  }
  for (const bk of event.bookmakers) {
    const market = bk.markets.find(m => m.key === marketKey);
    if (market && market.outcomes.length > 0) {
      return { bookmaker: bk.title, outcomes: market.outcomes };
    }
  }
  return null;
}

/**
 * Retorna a odd média de consensus entre todos os bookmakers para um mercado.
 */
export function getConsensusOdds(event: OddsEvent, marketKey: string = 'h2h'): OddsOutcome[] | null {
  const markets = event.bookmakers
    .map(b => b.markets.find(m => m.key === marketKey))
    .filter(Boolean) as OddsMarket[];

  if (markets.length === 0) return null;

  const outcomeNames = markets[0].outcomes.map(o => o.name);
  return outcomeNames.map(name => {
    const prices = markets
      .map(m => m.outcomes.find(o => o.name === name)?.price)
      .filter((p): p is number => p !== undefined);
    return {
      name,
      price: parseFloat((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(3)),
    };
  });
}

/**
 * Configura label amigável para um outcome de totals (ex: "Over 2.5" → "Over 2.5 Gols")
 */
export function formatOutcomeName(outcome: OddsOutcome, sportKey: string): string {
  if (outcome.point !== undefined) {
    const sport = sportKey.split('_')[0];
    const unit = sport === 'soccer' ? 'gols' : sport === 'basketball' ? 'pts' : '';
    return `${outcome.name} ${outcome.point}${unit ? ' ' + unit : ''}`;
  }
  return outcome.name;
}

export function isApiConfigured(): boolean {
  return !!(process.env.ODDS_API_KEY);
}

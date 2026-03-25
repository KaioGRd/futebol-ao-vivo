const BASE = 'https://api.the-odds-api.com/v4';
const KEY = process.env.ODDS_API_KEY!;

export const ODDS_LEAGUES = [
  { key: 'soccer_epl', name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { key: 'soccer_spain_la_liga', name: 'La Liga', flag: '🇪🇸' },
  { key: 'soccer_germany_bundesliga', name: 'Bundesliga', flag: '🇩🇪' },
  { key: 'soccer_italy_serie_a', name: 'Serie A', flag: '🇮🇹' },
  { key: 'soccer_france_ligue_one', name: 'Ligue 1', flag: '🇫🇷' },
  { key: 'soccer_brazil_campeonato', name: 'Brasileirão', flag: '🇧🇷' },
  { key: 'soccer_uefa_champs_league', name: 'Champions League', flag: '⭐' },
  { key: 'soccer_conmebol_copa_libertadores', name: 'Libertadores', flag: '🏆' },
];

export interface Outcome {
  name: string;
  price: number;
}

export interface Market {
  key: string;
  outcomes: Outcome[];
}

export interface Bookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: Market[];
}

export interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
}

export interface ProcessedOdds {
  event: OddsEvent;
  league: { key: string; name: string; flag: string };
  consensus: {
    home: number;
    draw: number;
    away: number;
  };
  best: {
    home: { price: number; bookmaker: string };
    draw: { price: number; bookmaker: string };
    away: { price: number; bookmaker: string };
  };
  impliedProb: {
    home: number;
    draw: number;
    away: number;
    margin: number;
  };
  overUnder?: {
    over: number;
    under: number;
  };
  bookmakerCount: number;
}

export async function getOddsForLeague(sportKey: string): Promise<OddsEvent[]> {
  try {
    const url = `${BASE}/sports/${sportKey}/odds?apiKey=${KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getAllUpcomingOdds(): Promise<ProcessedOdds[]> {
  const results = await Promise.allSettled(
    ODDS_LEAGUES.map(l => getOddsForLeague(l.key).then(events => ({ league: l, events })))
  );

  const processed: ProcessedOdds[] = [];

  for (const result of results) {
    if (result.status === 'rejected' || !result.value) continue;
    const { league, events } = result.value;

    for (const event of events) {
      const p = processEvent(event, league);
      if (p) processed.push(p);
    }
  }

  return processed.sort((a, b) =>
    new Date(a.event.commence_time).getTime() - new Date(b.event.commence_time).getTime()
  );
}

function processEvent(
  event: OddsEvent,
  league: { key: string; name: string; flag: string }
): ProcessedOdds | null {
  if (!event.bookmakers.length) return null;

  // Collect h2h prices per outcome
  const homePrices: number[] = [];
  const drawPrices: number[] = [];
  const awayPrices: number[] = [];

  let bestHome = { price: 0, bookmaker: '' };
  let bestDraw = { price: 0, bookmaker: '' };
  let bestAway = { price: 0, bookmaker: '' };

  let overPrice = 0;
  let underPrice = 0;

  for (const bk of event.bookmakers) {
    const h2h = bk.markets.find(m => m.key === 'h2h');
    if (h2h) {
      const home = h2h.outcomes.find(o => o.name === event.home_team);
      const away = h2h.outcomes.find(o => o.name === event.away_team);
      const draw = h2h.outcomes.find(o => o.name === 'Draw');

      if (home) {
        homePrices.push(home.price);
        if (home.price > bestHome.price) bestHome = { price: home.price, bookmaker: bk.title };
      }
      if (draw) {
        drawPrices.push(draw.price);
        if (draw.price > bestDraw.price) bestDraw = { price: draw.price, bookmaker: bk.title };
      }
      if (away) {
        awayPrices.push(away.price);
        if (away.price > bestAway.price) bestAway = { price: away.price, bookmaker: bk.title };
      }
    }

    const totals = bk.markets.find(m => m.key === 'totals');
    if (totals && !overPrice) {
      const over = totals.outcomes.find(o => o.name === 'Over');
      const under = totals.outcomes.find(o => o.name === 'Under');
      if (over) overPrice = over.price;
      if (under) underPrice = under.price;
    }
  }

  if (!homePrices.length) return null;

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const consensus = {
    home: parseFloat(avg(homePrices).toFixed(2)),
    draw: parseFloat(avg(drawPrices).toFixed(2)),
    away: parseFloat(avg(awayPrices).toFixed(2)),
  };

  // Implied probability = 1/odd
  const rawHome = 1 / consensus.home;
  const rawDraw = drawPrices.length ? 1 / consensus.draw : 0;
  const rawAway = 1 / consensus.away;
  const total = rawHome + rawDraw + rawAway;

  const impliedProb = {
    home: parseFloat(((rawHome / total) * 100).toFixed(1)),
    draw: parseFloat(((rawDraw / total) * 100).toFixed(1)),
    away: parseFloat(((rawAway / total) * 100).toFixed(1)),
    margin: parseFloat(((total - 1) * 100).toFixed(2)),
  };

  return {
    event,
    league,
    consensus,
    best: {
      home: bestHome,
      draw: bestDraw,
      away: bestAway,
    },
    impliedProb,
    overUnder: overPrice ? { over: overPrice, under: underPrice } : undefined,
    bookmakerCount: event.bookmakers.length,
  };
}

export function valueRating(margin: number): { label: string; color: string } {
  if (margin < 3) return { label: 'Ótima margem', color: '#22c55e' };
  if (margin < 6) return { label: 'Boa margem', color: '#84cc16' };
  if (margin < 10) return { label: 'Margem média', color: '#f59e0b' };
  return { label: 'Margem alta', color: '#ef4444' };
}

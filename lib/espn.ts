import { Game, League, MatchDetail, Standing } from './types';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

export const LEAGUES: League[] = [
  { slug: 'eng.1', name: 'Premier League', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { slug: 'esp.1', name: 'La Liga', country: 'Espanha', flag: '🇪🇸' },
  { slug: 'ger.1', name: 'Bundesliga', country: 'Alemanha', flag: '🇩🇪' },
  { slug: 'ita.1', name: 'Serie A', country: 'Itália', flag: '🇮🇹' },
  { slug: 'fra.1', name: 'Ligue 1', country: 'França', flag: '🇫🇷' },
  { slug: 'bra.1', name: 'Brasileirão', country: 'Brasil', flag: '🇧🇷' },
  { slug: 'usa.1', name: 'MLS', country: 'EUA', flag: '🇺🇸' },
  { slug: 'uefa.champions', name: 'Champions League', country: 'Europa', flag: '⭐' },
  { slug: 'uefa.europa', name: 'Europa League', country: 'Europa', flag: '🏆' },
  { slug: 'uefa.euro', name: 'Eurocopa', country: 'Europa', flag: '🌍' },
  { slug: 'conmebol.libertadores', name: 'Libertadores', country: 'América do Sul', flag: '🏆' },
  { slug: 'arg.1', name: 'Liga Argentina', country: 'Argentina', flag: '🇦🇷' },
  { slug: 'por.1', name: 'Primeira Liga', country: 'Portugal', flag: '🇵🇹' },
];

export function getLeague(slug: string): League {
  return LEAGUES.find(l => l.slug === slug) ?? { slug, name: slug, country: '', flag: '⚽' };
}

function toDateParam(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseEvent(event: any, league: League): Game | null {
  const competition = event.competitions?.[0];
  if (!competition) return null;

  const competitors = competition.competitors ?? [];
  const home = competitors.find((c: any) => c.homeAway === 'home');
  const away = competitors.find((c: any) => c.homeAway === 'away');
  if (!home || !away) return null;

  const status = event.status?.type ?? {};

  return {
    id: event.id,
    league,
    name: event.name ?? '',
    date: event.date ?? competition.date ?? '',
    status: {
      state: status.state ?? 'pre',
      completed: status.completed ?? false,
      description: status.description ?? '',
      detail: status.detail ?? status.shortDetail ?? '',
      clock: event.status?.displayClock,
      period: event.status?.period,
    },
    home: {
      team: {
        id: home.team?.id ?? '',
        name: home.team?.displayName ?? '',
        shortName: home.team?.shortDisplayName ?? home.team?.abbreviation ?? '',
        logo: home.team?.logo ?? '',
      },
      score: home.score ?? '-',
      homeAway: 'home',
      winner: home.winner,
    },
    away: {
      team: {
        id: away.team?.id ?? '',
        name: away.team?.displayName ?? '',
        shortName: away.team?.shortDisplayName ?? away.team?.abbreviation ?? '',
        logo: away.team?.logo ?? '',
      },
      score: away.score ?? '-',
      homeAway: 'away',
      winner: away.winner,
    },
    venue: competition.venue?.fullName,
  };
}

async function fetchScoreboard(leagueSlug: string, dateParam?: string): Promise<Game[]> {
  try {
    const url = dateParam
      ? `${BASE}/${leagueSlug}/scoreboard?dates=${dateParam}`
      : `${BASE}/${leagueSlug}/scoreboard`;

    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return [];
    const data = await res.json();
    const league = getLeague(leagueSlug);
    return (data.events ?? []).map((e: any) => parseEvent(e, league)).filter(Boolean) as Game[];
  } catch {
    return [];
  }
}

export async function getTodayGames(): Promise<Game[]> {
  const today = toDateParam(new Date());
  const results = await Promise.all(LEAGUES.map(l => fetchScoreboard(l.slug, today)));
  const all = results.flat();
  return all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function getWeekGames(): Promise<Record<string, Game[]>> {
  const now = new Date();
  const days: Date[] = [];
  // Today + next 6 days
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push(d);
  }

  const byDay: Record<string, Game[]> = {};
  for (const day of days) {
    const key = day.toISOString().slice(0, 10);
    const dateParam = toDateParam(day);
    const results = await Promise.all(LEAGUES.map(l => fetchScoreboard(l.slug, dateParam)));
    byDay[key] = results.flat().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }
  return byDay;
}

export async function getLeagueGames(leagueSlug: string, dateParam?: string): Promise<Game[]> {
  return fetchScoreboard(leagueSlug, dateParam);
}

export async function getMatchDetail(leagueSlug: string, eventId: string): Promise<MatchDetail | null> {
  try {
    const [scoreboardRes, summaryRes] = await Promise.all([
      fetch(`${BASE}/${leagueSlug}/scoreboard?dates=`, { next: { revalidate: 30 } }),
      fetch(`${BASE}/${leagueSlug}/summary?event=${eventId}`, { next: { revalidate: 30 } }),
    ]);

    if (!summaryRes.ok) return null;
    const summary = await summaryRes.json();

    // Parse the game from header
    const headerComp = summary.header?.competitions?.[0];
    if (!headerComp) return null;

    const league = getLeague(leagueSlug);
    const game = parseEvent({ ...summary.header, competitions: [headerComp], id: eventId }, league);
    if (!game) return null;

    // Parse plays/events
    const plays = (summary.plays ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((p: any) => p.type?.id && ['57', '58', '93', '72', '70', '71'].includes(p.type.id))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => ({
        name: p.text ?? p.type?.text ?? '',
        clock: p.clock?.displayValue ?? '',
        period: p.period?.number ?? 1,
        type: { id: p.type?.id ?? '', text: p.type?.text ?? '' },
        team: p.team,
        athletesInvolved: p.athletesInvolved,
      }));

    // Parse statistics
    const boxscoreTeams = summary.boxscore?.teams ?? [];
    const homeStats = boxscoreTeams[0]?.statistics ?? [];
    const awayStats = boxscoreTeams[1]?.statistics ?? [];

    // Parse players
    const boxscorePlayers = summary.boxscore?.players ?? [];
    const homePlayers = boxscorePlayers[0]?.statistics?.[0]?.athletes ?? [];
    const awayPlayers = boxscorePlayers[1]?.statistics?.[0]?.athletes ?? [];

    return { game, plays, homeStats, awayStats, homePlayers, awayPlayers };
  } catch {
    return null;
  }
}

export async function getStandings(leagueSlug: string): Promise<Standing[]> {
  try {
    const res = await fetch(`${BASE}/${leagueSlug}/standings`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();

    const entries = data.standings?.entries ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return entries.map((entry: any) => {
      const stats = entry.stats ?? [];
      const get = (name: string) => parseInt(stats.find((s: any) => s.name === name)?.value ?? '0');
      return {
        team: {
          id: entry.team?.id ?? '',
          name: entry.team?.displayName ?? '',
          shortName: entry.team?.shortDisplayName ?? '',
          logo: entry.team?.logos?.[0]?.href ?? entry.team?.logo ?? '',
        },
        wins: get('wins'),
        losses: get('losses'),
        draws: get('ties'),
        points: get('points'),
        gamesPlayed: get('gamesPlayed'),
        goalsFor: get('pointsFor'),
        goalsAgainst: get('pointsAgainst'),
        goalDifference: get('pointDifferential'),
      };
    });
  } catch {
    return [];
  }
}

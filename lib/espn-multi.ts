/**
 * ESPN Live Data — Multi-Sport
 * Extensão do cliente ESPN para cobrir todos os esportes disponíveis
 * Endpoint público, sem necessidade de chave
 */

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SportKey =
  | 'soccer' | 'basketball/nba' | 'basketball/ncaab'
  | 'football/nfl' | 'baseball/mlb' | 'hockey/nhl'
  | 'mma/ufc' | 'tennis/atp' | 'basketball/wnba';

export interface LiveGameState {
  id: string;
  espnSport: SportKey;
  sportLabel: string;
  leagueKey: string;       // chave para cruzar com The Odds API
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  totalScore: number;
  timeElapsed: number;     // 0.0 → 1.0 (percentual do jogo concluído)
  periodLabel: string;     // "2º Tempo", "Q3", "3ª Entrada", etc.
  period: number;          // número do período
  clockDisplay: string;    // "35:20", "10:45", etc.
  isLive: boolean;
  isCompleted: boolean;
  commenceTime: string;    // ISO timestamp de início
  status: string;
  leagueName: string;
  venue?: string;
}

interface SportConfig {
  espnPath: SportKey;
  leagueKey: string;       // chave The Odds API (ex: 'basketball_nba')
  label: string;
  emoji: string;
  totalPeriods: number;    // número total de períodos no jogo
  periodMinutes: number;   // duração de cada período em minutos
  totalMinutes: number;    // duração total do jogo (para pace model)
  avgCombinedScore: number; // média de pontos combinados por jogo
  unit: string;            // "gols", "pontos", "runs", "gols"
}

export const SPORT_CONFIGS: SportConfig[] = [
  {
    espnPath: 'basketball/nba',
    leagueKey: 'basketball_nba',
    label: 'NBA',
    emoji: '🏀',
    totalPeriods: 4,
    periodMinutes: 12,
    totalMinutes: 48,
    avgCombinedScore: 228,
    unit: 'pontos',
  },
  {
    espnPath: 'basketball/ncaab',
    leagueKey: 'basketball_ncaab',
    label: 'NCAA Basketball',
    emoji: '🏀',
    totalPeriods: 2,
    periodMinutes: 20,
    totalMinutes: 40,
    avgCombinedScore: 143,
    unit: 'pontos',
  },
  {
    espnPath: 'basketball/wnba',
    leagueKey: 'basketball_wnba',
    label: 'WNBA',
    emoji: '🏀',
    totalPeriods: 4,
    periodMinutes: 10,
    totalMinutes: 40,
    avgCombinedScore: 160,
    unit: 'pontos',
  },
  {
    espnPath: 'football/nfl',
    leagueKey: 'americanfootball_nfl',
    label: 'NFL',
    emoji: '🏈',
    totalPeriods: 4,
    periodMinutes: 15,
    totalMinutes: 60,
    avgCombinedScore: 47,
    unit: 'pontos',
  },
  {
    espnPath: 'baseball/mlb',
    leagueKey: 'baseball_mlb',
    label: 'MLB',
    emoji: '⚾',
    totalPeriods: 9,
    periodMinutes: 0, // innings não têm tempo fixo
    totalMinutes: 0,
    avgCombinedScore: 9.1,
    unit: 'runs',
  },
  {
    espnPath: 'hockey/nhl',
    leagueKey: 'icehockey_nhl',
    label: 'NHL',
    emoji: '🏒',
    totalPeriods: 3,
    periodMinutes: 20,
    totalMinutes: 60,
    avgCombinedScore: 6.0,
    unit: 'gols',
  },
  {
    espnPath: 'mma/ufc',
    leagueKey: 'mma_mixed_martial_arts',
    label: 'UFC / MMA',
    emoji: '🥊',
    totalPeriods: 5,
    periodMinutes: 5,
    totalMinutes: 25,
    avgCombinedScore: 0,
    unit: 'rounds',
  },
];

// ─── Parser genérico de evento ESPN ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseESPNEvent(event: any, config: SportConfig): LiveGameState | null {
  const competition = event.competitions?.[0];
  if (!competition) return null;

  const competitors = competition.competitors ?? [];
  const home = competitors.find((c: { homeAway: string }) => c.homeAway === 'home');
  const away = competitors.find((c: { homeAway: string }) => c.homeAway === 'away');
  if (!home || !away) return null;

  const status = event.status?.type ?? {};
  const isLive = status.state === 'in';
  const isCompleted = status.completed ?? false;

  const homeScore = parseInt(home.score ?? '0', 10) || 0;
  const awayScore = parseInt(away.score ?? '0', 10) || 0;
  const period = event.status?.period ?? 1;
  const clockDisplay = event.status?.displayClock ?? '';

  // Calcular timeElapsed (0→1)
  let timeElapsed = 0;
  if (isCompleted) {
    timeElapsed = 1;
  } else if (isLive) {
    if (config.totalMinutes > 0) {
      // Sports com tempo (basquete, futebol americano, hóquei)
      const minutesPerPeriod = config.periodMinutes;
      const completedPeriods = Math.max(0, period - 1);
      const clockParts = clockDisplay.split(':');
      const remainingInPeriod = clockParts.length >= 2
        ? parseInt(clockParts[0], 10) + parseInt(clockParts[1], 10) / 60
        : minutesPerPeriod / 2;
      const elapsedInPeriod = minutesPerPeriod - remainingInPeriod;
      const totalElapsed = completedPeriods * minutesPerPeriod + elapsedInPeriod;
      timeElapsed = Math.min(totalElapsed / config.totalMinutes, 0.99);
    } else {
      // Baseball: base no inning
      timeElapsed = Math.min((period - 1) / config.totalPeriods, 0.99);
    }
  }

  // Label de período
  const periodLabel = getPeriodLabel(period, config, clockDisplay);

  return {
    id: event.id,
    espnSport: config.espnPath,
    sportLabel: config.label,
    leagueKey: config.leagueKey,
    homeTeam: home.team?.displayName ?? home.team?.name ?? '',
    awayTeam: away.team?.displayName ?? away.team?.name ?? '',
    homeScore,
    awayScore,
    totalScore: homeScore + awayScore,
    timeElapsed,
    periodLabel,
    period,
    clockDisplay,
    isLive,
    isCompleted,
    commenceTime: event.date ?? competition.date ?? '',
    status: status.description ?? status.detail ?? '',
    leagueName: config.label,
    venue: competition.venue?.fullName,
  };
}

function getPeriodLabel(period: number, config: SportConfig, clock: string): string {
  if (config.leagueKey.startsWith('basketball')) {
    const labels = ['', '1º Quarto', '2º Quarto', '3º Quarto', '4º Quarto', 'Prorrogação'];
    return `${labels[period] ?? `Q${period}`}${clock ? ' ' + clock : ''}`;
  }
  if (config.leagueKey === 'americanfootball_nfl') {
    const labels = ['', '1º Quarto', '2º Quarto', '3º Quarto', '4º Quarto', 'Prorrogação'];
    return `${labels[period] ?? `Q${period}`}${clock ? ' ' + clock : ''}`;
  }
  if (config.leagueKey === 'icehockey_nhl') {
    const labels = ['', '1º Período', '2º Período', '3º Período', 'Prorrogação'];
    return `${labels[period] ?? `P${period}`}${clock ? ' ' + clock : ''}`;
  }
  if (config.leagueKey === 'baseball_mlb') {
    return `${period}ª Entrada`;
  }
  if (config.leagueKey === 'mma_mixed_martial_arts') {
    return `Round ${period}${clock ? ' ' + clock : ''}`;
  }
  return `Período ${period}${clock ? ' ' + clock : ''}`;
}

// ─── Fetch por esporte ────────────────────────────────────────────────────────

async function fetchESPNSport(config: SportConfig): Promise<LiveGameState[]> {
  try {
    const url = `${ESPN}/${config.espnPath}/scoreboard`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return [];
    const data = await res.json();
    const events = data.events ?? [];
    return events
      .map((e: unknown) => parseESPNEvent(e, config))
      .filter(Boolean) as LiveGameState[];
  } catch {
    return [];
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Busca jogos ao vivo de todos os esportes suportados em paralelo
 */
export async function getAllLiveGames(): Promise<LiveGameState[]> {
  const results = await Promise.allSettled(
    SPORT_CONFIGS.map(cfg => fetchESPNSport(cfg))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<LiveGameState[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .filter(g => g.isLive || !g.isCompleted); // só ao vivo ou próximos
}

/**
 * Busca jogos de esportes específicos
 */
export async function getLiveGamesByLeague(leagueKeys: string[]): Promise<LiveGameState[]> {
  const configs = SPORT_CONFIGS.filter(c => leagueKeys.includes(c.leagueKey));
  const results = await Promise.allSettled(configs.map(cfg => fetchESPNSport(cfg)));
  return results
    .filter((r): r is PromiseFulfilledResult<LiveGameState[]> => r.status === 'fulfilled')
    .flatMap(r => r.value);
}

/**
 * Busca apenas jogos ao vivo (excluindo pré-jogo)
 */
export async function getOnlyLiveGames(): Promise<LiveGameState[]> {
  const all = await getAllLiveGames();
  return all.filter(g => g.isLive);
}

export function getSportConfig(leagueKey: string): SportConfig | undefined {
  return SPORT_CONFIGS.find(c => c.leagueKey === leagueKey);
}

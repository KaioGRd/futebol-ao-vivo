import { NextRequest, NextResponse } from 'next/server';
import { getAllLiveGames, getOnlyLiveGames } from '@/lib/espn-multi';
import { getMultipleSportsEvents, SPORT_CATEGORIES } from '@/lib/odds-api';
import { analyzeInPlay, matchEventToOdds } from '@/lib/inplay';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const liveOnly = searchParams.get('live') === 'true';
  const category = searchParams.get('category');

  // Buscar jogos ESPN
  const games = liveOnly ? await getOnlyLiveGames() : await getAllLiveGames();

  // Filtrar por categoria se especificado
  const filteredGames = category
    ? games.filter(g => {
        const cat = SPORT_CATEGORIES.find(c => c.id === category);
        return cat ? cat.sport_keys.some(k => g.leagueKey.includes(k.split('_')[0])) : true;
      })
    : games;

  // Buscar odds para cruzamento
  const allLeagueKeys = [...new Set(filteredGames.map(g => g.leagueKey))];
  const oddsSportKeys = SPORT_CATEGORIES.flatMap(c => c.sport_keys)
    .filter(k => allLeagueKeys.some(lk => k.includes(lk.split('_')[0])));

  const oddsEvents = oddsSportKeys.length > 0
    ? await getMultipleSportsEvents(oddsSportKeys.slice(0, 8), {
        regions: 'eu,uk,au',
        markets: ['h2h', 'totals'],
        cacheSeconds: 60,
      })
    : [];

  // Analisar cada jogo
  const analyses = filteredGames.map(game => {
    const matchedOdds = matchEventToOdds(game, oddsEvents);
    return analyzeInPlay(game, matchedOdds);
  });

  // Serializar com segurança
  return NextResponse.json(analyses);
}

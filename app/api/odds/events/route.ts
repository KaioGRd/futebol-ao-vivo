import { NextRequest, NextResponse } from 'next/server';
import { getCategoryEvents, getEventOdds, SPORT_CATEGORIES } from '@/lib/odds-api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') ?? 'futebol';
  const sport = searchParams.get('sport');
  const marketsParam = searchParams.get('markets');

  // Modo de esporte único com mercados customizados
  if (sport) {
    const markets = marketsParam ? marketsParam.split(',') : ['h2h', 'totals'];
    const events = await getEventOdds(sport, {
      regions: 'eu,uk,au',
      markets,
      cacheSeconds: 300,
    });
    return NextResponse.json(events);
  }

  // Modo de categoria (usa os mercados padrão da categoria)
  const catConfig = SPORT_CATEGORIES.find(c => c.id === category);
  if (!catConfig) {
    return NextResponse.json({ error: 'Unknown category' }, { status: 400 });
  }

  const events = await getCategoryEvents(category);
  return NextResponse.json(events);
}

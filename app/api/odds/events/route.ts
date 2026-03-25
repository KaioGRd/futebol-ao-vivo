import { NextRequest, NextResponse } from 'next/server';
import { getEventOdds, getMultipleSportsEvents, SPORT_CATEGORIES } from '@/lib/odds-api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') ?? 'futebol';
  const sport = searchParams.get('sport'); // single sport key override

  // Single sport mode
  if (sport) {
    const events = await getEventOdds(sport, { regions: 'eu,uk,au', markets: 'h2h' });
    return NextResponse.json(events);
  }

  // Category mode: fetch all sports in the category
  const cat = SPORT_CATEGORIES.find(c => c.id === category);
  if (!cat) {
    return NextResponse.json({ error: 'Unknown category' }, { status: 400 });
  }

  // Limit concurrent requests to avoid rate limiting
  const sportKeys = cat.sport_keys.slice(0, 6); // max 6 sports per request
  const events = await getMultipleSportsEvents(sportKeys, {
    regions: 'eu,uk,au',
    markets: 'h2h',
  });

  return NextResponse.json(events);
}

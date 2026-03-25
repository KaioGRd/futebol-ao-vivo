import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sport: string }> }
) {
  const { sport } = await params;
  const key = process.env.ODDS_API_KEY;
  if (!key) return NextResponse.json({ error: 'No API key' }, { status: 500 });

  const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${key}&regions=eu&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch odds' }, { status: 500 });
  }
}

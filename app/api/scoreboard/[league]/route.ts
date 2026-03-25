import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ league: string }> }
) {
  const { league } = await params;
  const { searchParams } = new URL(request.url);
  const dates = searchParams.get('dates') ?? '';

  const url = dates
    ? `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${dates}`
    : `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

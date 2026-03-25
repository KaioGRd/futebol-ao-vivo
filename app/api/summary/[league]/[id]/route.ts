import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ league: string; id: string }> }
) {
  const { league, id } = await params;
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/summary?event=${id}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

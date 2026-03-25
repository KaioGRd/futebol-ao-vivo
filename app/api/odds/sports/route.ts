import { NextResponse } from 'next/server';
import { getSports } from '@/lib/odds-api';

export async function GET() {
  const sports = await getSports();
  return NextResponse.json(sports);
}

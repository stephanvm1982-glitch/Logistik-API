import { NextRequest, NextResponse } from 'next/server';
import { getShipments } from '@/lib/api-client';

export async function GET(request: NextRequest) {
  try {
    const data = await getShipments();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

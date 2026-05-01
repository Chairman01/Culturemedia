import { NextRequest, NextResponse } from 'next/server';

const APC_BASE = 'https://purchasing.alberta.ca/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, payload } = body;

    const url = `${APC_BASE}/${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://purchasing.alberta.ca/search',
        'Origin': 'https://purchasing.alberta.ca',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `APC API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: 'Proxy error', details: String(err) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const refNum = searchParams.get('ref');

    if (!refNum) {
      return NextResponse.json({ error: 'ref param required' }, { status: 400 });
    }

    // Extract year and number from ref like AB-2026-03416
    const parts = refNum.split('-');
    const year = parts[1];
    const num = parts[2];

    const url = `${APC_BASE}/opportunity/public/${year}/${parseInt(num)}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://purchasing.alberta.ca/search',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `APC error: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

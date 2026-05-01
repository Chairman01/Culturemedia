import { NextRequest, NextResponse } from 'next/server';

const APC_BASE = 'https://purchasing.alberta.ca/api';

const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://purchasing.alberta.ca/search',
  'Origin': 'https://purchasing.alberta.ca',
};

// POST /api/apc — search APC for opportunities
// Body: { query: string, offset?: number }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query: string = body.query || '';
    const offset: number = body.offset || 0;

    // This is the exact payload format that works with the APC API
    const payload = {
      filter: {
        textPhrases: query ? [query] : [],
        statuses: [],
        categories: [],
        postingTypes: [],
        solicitation: { types: [], noticeTypes: [] },
        regions: [],
        organizations: [],
        unspscCodes: [],
        postDateRange: '',
        closeDateRange: '',
        deliveryRegion: '',
      },
      limit: 100,
      offset,
      sortOptions: [{ field: 'PostDateTime', direction: 'desc' }],
    };

    const res = await fetch(`${APC_BASE}/opportunity/search`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `APC returned ${res.status}`, detail: text.slice(0, 200) },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET /api/apc?ref=AB-2026-XXXXX — get detail + interested supplier count
export async function GET(request: NextRequest) {
  try {
    const ref = new URL(request.url).searchParams.get('ref');
    if (!ref) return NextResponse.json({ error: 'ref required' }, { status: 400 });

    const parts = ref.split('-'); // ["AB", "2026", "03416"]
    if (parts.length < 3) return NextResponse.json({ error: 'invalid ref' }, { status: 400 });

    const year = parts[1];
    const num = parseInt(parts[2], 10);

    const res = await fetch(`${APC_BASE}/opportunity/public/${year}/${num}`, {
      headers: { ...HEADERS, 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      return NextResponse.json({ interestedCount: 0, error: `APC ${res.status}` });
    }

    const data = await res.json();

    // Normalise the interested supplier count — APC uses different field names
    const count =
      data.interestedSuppliers?.length ??
      data.supplierCount ??
      data.interested_count ??
      data.expressedInterestCount ??
      0;

    return NextResponse.json({ ...data, interestedCount: count });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

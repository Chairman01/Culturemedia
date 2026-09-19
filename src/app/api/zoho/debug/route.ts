import { NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';

// GET /api/zoho/debug — connection diagnostic. Signed-in only, and it never
// echoes any part of a secret or token: "set" / "MISSING" is all it says.
export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  const redirectUri = process.env.ZOHO_REDIRECT_URI;

  const envCheck = {
    ZOHO_CLIENT_ID: clientId ? 'set' : 'MISSING',
    ZOHO_CLIENT_SECRET: clientSecret ? 'set' : 'MISSING',
    ZOHO_REFRESH_TOKEN: refreshToken ? 'set' : 'MISSING or empty',
    ZOHO_REDIRECT_URI: redirectUri || 'MISSING',
  };

  if (!refreshToken || !clientId || !clientSecret) {
    return NextResponse.json({ ok: false, step: 'env_check', envCheck });
  }

  // Step 1: Get access token
  let accessToken: string | null = null;
  let tokenError: unknown = null;

  try {
    const res = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });
    const data = await res.json();
    if (data.access_token) {
      accessToken = data.access_token;
    } else {
      // Zoho's error body (e.g. { error: 'invalid_code' }) carries no secrets.
      tokenError = data;
    }
  } catch (e) {
    tokenError = String(e);
  }

  if (!accessToken) {
    return NextResponse.json({ ok: false, step: 'token_refresh_failed', envCheck, tokenError });
  }

  // Step 2: Call Zoho Mail accounts API with the FULL token
  let accountsStatus: number | null = null;
  let accountsBody: unknown = null;

  try {
    const res = await fetch('https://mail.zoho.com/api/accounts', {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    accountsStatus = res.status;
    accountsBody = await res.json();
  } catch (e) {
    accountsBody = String(e);
  }

  return NextResponse.json({
    ok: accountsStatus === 200,
    step: accountsStatus === 200 ? 'all_good' : 'mail_api_failed',
    envCheck,
    tokenObtained: true,
    accountsStatus,
    accountsBody,
  });
}

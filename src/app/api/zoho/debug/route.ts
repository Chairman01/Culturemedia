import { NextResponse } from 'next/server';

// GET /api/zoho/debug — diagnose Zoho connection without exposing secrets
export async function GET() {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  const redirectUri = process.env.ZOHO_REDIRECT_URI;

  const envCheck = {
    ZOHO_CLIENT_ID: clientId ? `set (${clientId.slice(0, 8)}...)` : 'MISSING',
    ZOHO_CLIENT_SECRET: clientSecret ? `set (${clientSecret.slice(0, 6)}...)` : 'MISSING',
    ZOHO_REFRESH_TOKEN: refreshToken ? `set (${refreshToken.slice(0, 12)}...)` : 'MISSING or empty',
    ZOHO_REDIRECT_URI: redirectUri || 'MISSING',
  };

  if (!refreshToken || !clientId || !clientSecret) {
    return NextResponse.json({ ok: false, step: 'env_check', envCheck });
  }

  // Try to get an access token
  let accessToken: string | null = null;
  let tokenError: string | null = null;

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
      accessToken = `obtained (${(data.access_token as string).slice(0, 10)}...)`;
    } else {
      tokenError = JSON.stringify(data);
    }
  } catch (e) {
    tokenError = String(e);
  }

  if (!accessToken) {
    return NextResponse.json({ ok: false, step: 'token_refresh', envCheck, tokenError });
  }

  // Try to hit Zoho Mail accounts API
  let mailCheck: string | null = null;
  try {
    const res = await fetch('https://mail.zoho.com/api/accounts', {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken.split('(')[1]?.split('...')[0] || ''}` },
    });
    mailCheck = `status ${res.status}`;
  } catch (e) {
    mailCheck = `error: ${e}`;
  }

  return NextResponse.json({ ok: true, step: 'all_good', envCheck, accessToken, mailCheck });
}

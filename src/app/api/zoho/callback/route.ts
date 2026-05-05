import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const TOKEN_FILE = path.join(process.cwd(), '.zoho-tokens.json');

interface ZohoTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export function loadTokens(): ZohoTokens | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveTokens(tokens: ZohoTokens) {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf-8');
  } catch {
    // On Vercel (read-only FS) this will fail silently — that's OK,
    // production uses ZOHO_REFRESH_TOKEN env var instead
  }
}

// GET /api/zoho/callback?code=...
// Called by Zoho after user authorizes.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard?zoho_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const redirectUri = process.env.ZOHO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: 'Zoho credentials not configured in environment variables' },
      { status: 500 }
    );
  }

  try {
    const tokenRes = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    const data = await tokenRes.json();

    if (!tokenRes.ok || !data.access_token) {
      console.error('Zoho token exchange failed:', data);
      return NextResponse.redirect(
        new URL(`/dashboard?zoho_error=${encodeURIComponent(data.error || 'token_exchange_failed')}`, request.url)
      );
    }

    const tokens: ZohoTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    };

    // Save locally (works in dev, silently fails on Vercel — that's expected)
    saveTokens(tokens);

    // Show the refresh token so user can add it to Vercel env vars
    const refreshToken = data.refresh_token as string;
    const isVercel = process.env.VERCEL === '1';

    if (isVercel || !refreshToken) {
      // On Vercel, file storage won't persist — show the token for manual copy
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head>
  <title>Zoho Connected</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; max-width: 600px; width: 100%; }
    h1 { color: #4ade80; margin: 0 0 8px; font-size: 22px; }
    p { color: #94a3b8; margin: 0 0 20px; font-size: 14px; line-height: 1.6; }
    .token-box { background: #0f172a; border: 1px solid #475569; border-radius: 8px; padding: 14px 16px; font-family: monospace; font-size: 13px; color: #7dd3fc; word-break: break-all; margin: 12px 0; }
    .step { background: #1e3a5f; border-left: 3px solid #3b82f6; border-radius: 0 8px 8px 0; padding: 12px 16px; margin: 12px 0; font-size: 13px; line-height: 1.6; }
    .step strong { color: #93c5fd; display: block; margin-bottom: 4px; }
    button { background: #3b82f6; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 8px; }
    button:active { background: #2563eb; }
    a { display: inline-block; margin-top: 20px; color: #4ade80; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>✅ Zoho Mail Authorized</h1>
    <p>Copy the refresh token below and add it to your Vercel environment variables — then email sync will work from any device, always.</p>

    <div class="step">
      <strong>Step 1 — Copy your refresh token:</strong>
      <div class="token-box" id="rt">${refreshToken}</div>
      <button onclick="navigator.clipboard.writeText('${refreshToken}').then(()=>this.textContent='Copied!')">Copy token</button>
    </div>

    <div class="step">
      <strong>Step 2 — Add to Vercel:</strong>
      Go to <strong>vercel.com → your project → Settings → Environment Variables</strong><br>
      Add a new variable: <code style="color:#fbbf24">ZOHO_REFRESH_TOKEN</code> = (paste token)<br>
      Set it for <strong>Production</strong> environment. Then redeploy.
    </div>

    <div class="step">
      <strong>Step 3 — Done!</strong>
      After redeploying, "Sync from Zoho" will work on culturemedia.ca from any device.
    </div>

    <a href="/dashboard?zoho_connected=1">← Back to dashboard</a>
  </div>
</body>
</html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Local dev: token saved to file, just redirect back
    return NextResponse.redirect(
      new URL('/dashboard?zoho_connected=1', request.url)
    );
  } catch (err) {
    console.error('Zoho callback error:', err);
    return NextResponse.redirect(
      new URL('/dashboard?zoho_error=server_error', request.url)
    );
  }
}

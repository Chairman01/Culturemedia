import { NextResponse } from 'next/server';

// GET /api/zoho/connect
// Redirects the user to the Zoho OAuth authorization page
export async function GET() {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const redirectUri = process.env.ZOHO_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Zoho credentials not configured. Set ZOHO_CLIENT_ID and ZOHO_REDIRECT_URI in .env.local' },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'ZohoMail.messages.READ,ZohoMail.accounts.READ',
    redirect_uri: redirectUri,
    access_type: 'offline',   // request refresh token
    prompt: 'consent',        // always show consent to ensure refresh token is issued
  });

  const zohoAuthUrl = `https://accounts.zoho.com/oauth/v2/auth?${params.toString()}`;

  return NextResponse.redirect(zohoAuthUrl);
}

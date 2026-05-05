import { NextResponse } from 'next/server';
import { loadTokens, saveTokens } from '../callback/route';

interface ZohoMessage {
  messageId: string;
  subject: string;
  fromAddress: string;
  toAddress: string;
  sentDateInGMT: string;
  status: string;
  folderId: string;
}

// Personal / generic domains to skip when auto-creating leads
const SKIP_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.ca', 'hotmail.com',
  'outlook.com', 'live.com', 'icloud.com', 'me.com', 'mac.com',
  'zoho.com', 'protonmail.com', 'aol.com', 'msn.com', 'shaw.ca',
  'telus.net', 'rogers.com', 'bell.net', 'videotron.ca',
]);

// Extract a clean company name from an email domain
function domainToCompany(email: string): string {
  const domain = (email.split('@')[1] || '').toLowerCase();
  const base = domain.split('.')[0]; // e.g. "culturemedia" from "culturemedia.ca"
  return base
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase()); // title case
}

// Parse display name and address from strings like: "John Smith <john@example.com>" or "john@example.com"
function parseEmailAddress(raw: string): { name: string; address: string } {
  const match = raw.match(/^"?([^"<]+?)"?\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim(), address: match[2].trim().toLowerCase() };
  }
  return { name: '', address: raw.trim().toLowerCase() };
}

// Refresh access token using a refresh token
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

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
    if (!res.ok || !data.access_token) return null;
    return data.access_token as string;
  } catch {
    return null;
  }
}

// Get a valid access token — works in both local dev and Vercel production
async function getValidToken(): Promise<string | null> {
  // Production mode: ZOHO_REFRESH_TOKEN is set as a Vercel env var
  const envRefreshToken = process.env.ZOHO_REFRESH_TOKEN;
  if (envRefreshToken) {
    return await refreshAccessToken(envRefreshToken);
  }

  // Local dev mode: use .zoho-tokens.json file
  const tokens = loadTokens();
  if (!tokens) return null;

  if (Date.now() < tokens.expires_at - 5 * 60 * 1000) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) return null;
  const newAccess = await refreshAccessToken(tokens.refresh_token);
  if (!newAccess) return null;

  saveTokens({ ...tokens, access_token: newAccess, expires_at: Date.now() + 55 * 60 * 1000 });
  return newAccess;
}

// GET /api/zoho/mail — returns { connected, emails }
export async function GET() {
  const token = await getValidToken();
  if (!token) {
    return NextResponse.json({ connected: false, emails: [] });
  }

  try {
    const accountsRes = await fetch('https://mail.zoho.com/api/accounts', {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    if (!accountsRes.ok) {
      return NextResponse.json({ connected: false, emails: [] });
    }

    const accountsData = await accountsRes.json();
    const accounts: Array<{ accountId: string }> = accountsData.data || [];
    if (accounts.length === 0) {
      return NextResponse.json({ connected: true, emails: [] });
    }

    const accountId = accounts[0].accountId;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const [sentRes, inboxRes] = await Promise.all([
      fetch(`https://mail.zoho.com/api/accounts/${accountId}/messages/view?folderId=sent&limit=200&sortBy=date&sortOrder=desc`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      }),
      fetch(`https://mail.zoho.com/api/accounts/${accountId}/messages/view?folderId=inbox&limit=200&sortBy=date&sortOrder=desc`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      }),
    ]);

    const [sentData, inboxData] = await Promise.all([sentRes.json(), inboxRes.json()]);

    const sentMessages: ZohoMessage[] = (sentData.data || []).filter(
      (m: ZohoMessage) => new Date(m.sentDateInGMT).getTime() >= thirtyDaysAgo
    );
    const inboxMessages: ZohoMessage[] = (inboxData.data || []).filter(
      (m: ZohoMessage) => new Date(m.sentDateInGMT).getTime() >= thirtyDaysAgo
    );

    const emails = [
      ...sentMessages.map((m) => ({ id: m.messageId, subject: m.subject, from: m.fromAddress, to: m.toAddress, date: m.sentDateInGMT, direction: 'sent' as const })),
      ...inboxMessages.map((m) => ({ id: m.messageId, subject: m.subject, from: m.fromAddress, to: m.toAddress, date: m.sentDateInGMT, direction: 'received' as const })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ connected: true, emails });
  } catch (err) {
    console.error('Zoho mail fetch error:', err);
    return NextResponse.json({ connected: false, emails: [], error: 'fetch_failed' });
  }
}

// POST /api/zoho/mail
// Body: { leads: Array<{id, company, email?, stage}> }
// Returns: {
//   connected,
//   updates: Array<{leadId, newStage, lastContact, activity}>,   ← update existing leads
//   newLeads: Array<{email, company, contact, subject, date}>    ← auto-create these
// }
export async function POST(request: Request) {
  const token = await getValidToken();
  if (!token) {
    return NextResponse.json({ connected: false, updates: [], newLeads: [] });
  }

  const { leads } = await request.json();
  const existingLeads: Array<{ id: string; company: string; email?: string; stage: string }> =
    Array.isArray(leads) ? leads : [];

  try {
    const mailRes = await fetch(`${new URL(request.url).origin}/api/zoho/mail`);
    const mailData = await mailRes.json();

    if (!mailData.connected) {
      return NextResponse.json({ connected: false, updates: [], newLeads: [] });
    }

    const emails: Array<{
      id: string; subject: string; from: string; to: string;
      date: string; direction: 'sent' | 'received';
    }> = mailData.emails;

    // ── 1. Update existing leads ─────────────────────────────────────────────
    const updates: Array<{ leadId: string; newStage: string | null; lastContact: string; activity: string }> = [];

    for (const lead of existingLeads) {
      const { id: leadId, company, email: leadEmail, stage } = lead;

      const relatedEmails = emails.filter((e) => {
        const companyLower = (company || '').toLowerCase();
        const emailDomain = leadEmail ? leadEmail.split('@')[1]?.toLowerCase() : null;
        const fromLower = e.from.toLowerCase();
        const toLower = e.to.toLowerCase();
        const subjectLower = (e.subject || '').toLowerCase();

        const domainMatch = emailDomain
          ? fromLower.includes(emailDomain) || toLower.includes(emailDomain)
          : false;
        const nameMatch = companyLower.length > 3 && subjectLower.includes(companyLower);
        return domainMatch || nameMatch;
      });

      if (relatedEmails.length === 0) continue;

      const latest = relatedEmails[0];
      const lastContact = new Date(latest.date).toISOString();
      let activity = 'Emailed';
      let newStage: string | null = null;

      if (latest.direction === 'received') {
        activity = 'Replied';
        if (stage === 'reviewing' || stage === 'pitched') newStage = 'active';
      } else {
        activity = 'Emailed';
        if (stage === 'reviewing') newStage = 'pitched';
      }

      updates.push({ leadId, newStage, lastContact, activity });
    }

    // ── 2. Detect new leads from sent emails ─────────────────────────────────
    // Only look at emails Adam sent (direction: 'sent')
    const sentEmails = emails.filter((e) => e.direction === 'sent');

    // Build a set of all domains + companies already in the pipeline
    const existingDomains = new Set<string>();
    const existingCompanyWords = new Set<string>();
    for (const lead of existingLeads) {
      if (lead.email) {
        const domain = lead.email.split('@')[1]?.toLowerCase();
        if (domain) existingDomains.add(domain);
      }
      // Add significant words from company name for fuzzy matching
      (lead.company || '').toLowerCase().split(/\s+/).forEach((w) => {
        if (w.length > 3) existingCompanyWords.add(w);
      });
    }

    // Track domains we've already created a new lead for in this sync (no dupes)
    const seenDomains = new Set<string>();
    const newLeads: Array<{ email: string; company: string; contact: string; subject: string; date: string }> = [];

    for (const email of sentEmails) {
      // Skip replies
      const subject = (email.subject || '').trim();
      if (/^re:/i.test(subject) || /^fwd?:/i.test(subject)) continue;

      const { name: contactName, address: toAddress } = parseEmailAddress(email.to);
      const toDomain = toAddress.split('@')[1]?.toLowerCase() || '';

      // Skip personal/generic domains
      if (!toDomain || SKIP_DOMAINS.has(toDomain)) continue;

      // Skip if already in pipeline
      if (existingDomains.has(toDomain)) continue;

      // Skip if company name words already in pipeline
      const companyFromDomain = domainToCompany(toAddress);
      const domainWords = toDomain.split('.')[0].toLowerCase().split(/[-_]/);
      if (domainWords.some((w) => w.length > 3 && existingCompanyWords.has(w))) continue;

      // Skip domains we've already queued in this sync
      if (seenDomains.has(toDomain)) continue;
      seenDomains.add(toDomain);

      newLeads.push({
        email: toAddress,
        company: companyFromDomain,
        contact: contactName,
        subject,
        date: new Date(email.date).toISOString(),
      });
    }

    return NextResponse.json({ connected: true, updates, newLeads });
  } catch (err) {
    console.error('Zoho mail match error:', err);
    return NextResponse.json({ connected: false, updates: [], newLeads: [], error: 'match_failed' });
  }
}

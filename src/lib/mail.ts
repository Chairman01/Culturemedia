// What a message is, and what it means for the business.
//
// Both mailboxes (Zoho and Gmail) are read into the same MailMessage shape, then
// every message goes through classify(). The rules are deliberately plain and
// ordered, so when one gets something wrong you can see which rule fired (`why`)
// and fix that rule. No next/* or server imports: the Inbox page uses the types.

export type Mailbox = 'zoho' | 'gmail';
export type Folder = 'inbox' | 'spam' | 'sent';

export interface MailMessage {
  id: string;
  mailbox: Mailbox;
  folder: Folder;
  fromName: string;
  fromAddress: string;
  to: string[];
  subject: string;
  /** First few hundred characters of the body, when the server gave us any. */
  summary: string;
  /** ISO timestamp the message arrived or was sent. */
  at: string;
  unread: boolean;
  /** The message carries bulk-mail headers (List-Unsubscribe, List-Id, Precedence: bulk). */
  bulk?: boolean;
}

export type MailKind =
  | 'lead_reply' // someone in the CRM wrote to you
  | 'stop' //       someone in the CRM asked you to stop emailing
  | 'inquiry' //    a stranger asking about advertising / partnerships
  | 'money' //      payment, e-transfer, invoice, receipt
  | 'bounce' //     an email you sent could not be delivered
  | 'other' //      a person, but nothing the rules recognise
  | 'noise'; //     newsletters, notifications, automated senders

export interface Classified extends MailMessage {
  kind: MailKind;
  /** Which rule decided, in words — shown on hover so a wrong call is explainable. */
  why: string;
  leadId: string | null;
  leadCompany: string | null;
  /** A guess at the company from the address, for "Add as lead". */
  companyGuess: string;
}

/** Free-mail domains: a sender here is a person, not a company we can name. */
export const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.ca', 'hotmail.com', 'hotmail.ca', 'outlook.com',
  'live.com', 'live.ca', 'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'proton.me', 'aol.com',
  'msn.com', 'shaw.ca', 'telus.net', 'rogers.com', 'bell.net', 'videotron.ca', 'sasktel.net',
]);

const BOUNCE_FROM = /mailer-daemon|postmaster@|mail delivery (sub)?system/i;
const BOUNCE_SUBJECT =
  /undeliver|delivery status notification|delivery (has )?failed|failure notice|returned mail|could not be delivered|address not found|message not delivered/i;

const STOP =
  /\bunsubscribe\b|remove me\b|take me off|stop (emailing|contacting|sending|messaging)|do not (email|contact)|don'?t (email|contact) (me|us)|no more emails/i;

// Never a person: these local parts are noise whatever the message says.
const AUTOMATED_LOCAL =
  /^(no-?reply|do-?not-?reply|donotreply|notifications?|notify|newsletter|news|updates?|mailer|bounces?|alerts?|digest|marketing|promo(tions)?|deals|offers)\b/i;
// Usually a system, sometimes a small business's shared inbox — so these only
// count as noise when the message is not asking about advertising.
const SHARED_LOCAL = /^(team|support|billing|receipts?|invoices?|accounts?|security|admin|system)\b/i;
const AUTOMATED_DOMAIN =
  /(^|\.)(resend\.com|sendgrid\.(net|com)|mailchimpapp\.com|mcsv\.net|klaviyo\.com|constantcontact\.com|hubspot(email)?\.(com|net)|beehiiv\.com|eventbrite\.(ca|com)|lu\.ma|typeform\.com|figma\.com|loom\.com|atlassian\.(com|net)|cloudflare\.com|namecheap\.com|waveapps\.com|hootsuite\.com|later\.com|buffer\.com|semrush\.com|ahrefs\.com|producthunt\.com|facebookmail\.com|linkedin\.com|instagram\.com|twitter\.com|x\.com|tiktok\.com|youtube\.com|google\.com|accounts\.google\.com|apple\.com|amazon\.(ca|com)|paypal\.(ca|com)|intuit\.com|stripe\.com|shopify\.com|canva\.com|mailchimp\.com|substack\.com|medium\.com|vercel\.com|github\.com|supabase\.(com|io)|zoho\.com|zohomail\.com|mediavine\.com|godaddy\.com|wix\.com|squarespace\.com|meta\.com|calendly\.com|zoom\.us|dropbox\.com|slack\.com|notion\.so|openai\.com|anthropic\.com)$/i;

// The sending domain starts with a label only bulk mail uses: updates.resend.com,
// news.example.com, em1234.brand.com.
const BULK_SUBDOMAIN =
  /^(updates?|news|newsletters?|e|em\d*|email|emails|mailer|mailing|marketing|notifications?|notify|send|sender|bounces?|campaigns?|click|engage|announce(ments)?|events|community|digest|promo|offers)\./i;
// Wording only a mailing platform adds. Kept narrow on purpose: "you're invited"
// and "join us" are how a local business announces a grand opening, and that is
// a lead. Only tested on strangers: a lead who writes "unsubscribe" is handled
// above as a stop request.
const BULK_TEXT =
  /\bunsubscribe\b|view (this )?(email )?in (your |a )?browser|you are receiving this|you received this (email|message) because|manage (your )?(email )?preferences|update your preferences|no longer wish to receive|email preferences|all rights reserved/i;

const MONEY =
  /e-?transfer|interac|payment (received|sent|confirmation|of)|you('ve| have) (received|been paid)|sent you (money|\$)|deposit(ed)?\b|invoice\b|receipt\b|remittance|payout|paid\b/i;

const INQUIRY =
  /advertis|sponsor|partnership|partner (with|up)|collab|be featured|feature (us|our|my)|featuring|get featured|promot(e|ion|ing)|\brates?\b|rate card|media kit|pricing|how much|\bquote\b|packages?\b|work with you|work together|shout-?out|post about|cover(age)? (of )?(our|my)|write about|story idea|press release|grand opening|opening soon|new (restaurant|location|business)|influencer|giveaway|\bevent\b|tickets?\b|inquir|enquir|interested in/i;

export interface LeadRef {
  id: string;
  company: string;
  email: string | null;
}

export function companyFromAddress(address: string): string {
  const domain = address.split('@')[1] || '';
  if (!domain || PERSONAL_DOMAINS.has(domain)) return '';
  const name = domain.split('.')[0] || '';
  return name ? name[0].toUpperCase() + name.slice(1) : '';
}

const domainOf = (address: string) => (address.split('@')[1] || '').toLowerCase();

/** Look-ups built once per sync: exact address, then company domain. */
export function indexLeads(leads: LeadRef[]) {
  const byEmail = new Map<string, LeadRef>();
  const byDomain = new Map<string, LeadRef>();
  for (const lead of leads) {
    const email = (lead.email || '').toLowerCase().trim();
    if (!email) continue;
    byEmail.set(email, lead);
    const domain = domainOf(email);
    if (domain && !PERSONAL_DOMAINS.has(domain) && !byDomain.has(domain)) byDomain.set(domain, lead);
  }
  return { byEmail, byDomain };
}

export function classify(m: MailMessage, index: ReturnType<typeof indexLeads>): Classified {
  const from = m.fromAddress.toLowerCase();
  const text = `${m.subject}\n${m.summary}`;
  const local = from.split('@')[0] || '';
  const domain = domainOf(from);

  const exact = index.byEmail.get(from) || null;
  const sameCompany = exact ? null : index.byDomain.get(domain) || null;
  const lead = exact || sameCompany;

  const done = (kind: MailKind, why: string): Classified => ({
    ...m,
    kind,
    why,
    leadId: lead?.id ?? null,
    leadCompany: lead?.company ?? null,
    companyGuess: companyFromAddress(from),
  });

  if (BOUNCE_FROM.test(`${m.fromName} ${from}`) || BOUNCE_SUBJECT.test(m.subject)) {
    return done('bounce', 'Looks like a delivery failure notice');
  }

  if (lead) {
    if (STOP.test(text)) return done('stop', `${lead.company} asked not to be emailed`);
    return done(
      'lead_reply',
      exact ? `From ${lead.company}, who is in your leads` : `Same company domain as ${lead.company}`,
    );
  }

  const asksAboutAds = INQUIRY.test(text);
  const automated =
    AUTOMATED_LOCAL.test(local) ||
    AUTOMATED_DOMAIN.test(domain) ||
    BULK_SUBDOMAIN.test(domain) ||
    Boolean(m.bulk) ||
    BULK_TEXT.test(text) ||
    (SHARED_LOCAL.test(local) && !asksAboutAds);

  // Money first: payment notices come from automated senders and still matter.
  if (MONEY.test(text) && (automated || /interac|e-?transfer/i.test(text))) {
    return done('money', 'Mentions a payment, e-transfer, invoice or receipt');
  }
  if (automated) {
    return done(
      'noise',
      m.bulk || BULK_TEXT.test(text) || BULK_SUBDOMAIN.test(domain)
        ? 'Sent in bulk (a newsletter, invitation or product update), not written to you'
        : 'Automated sender (no-reply, newsletter or a platform notification)',
    );
  }

  if (asksAboutAds) return done('inquiry', 'A person asking about advertising, features, rates or an event');
  if (MONEY.test(text)) return done('money', 'Mentions a payment, invoice or receipt');
  return done('other', 'From a person, but nothing the rules recognise');
}

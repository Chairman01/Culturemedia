// What Culture Media sells, in one place.
//
// Packages live in code rather than a database table on purpose: a price or a
// wording change shows up in a diff and ships with a deploy, the same way the
// email sequences do. The prices below are STARTING POINTS drawn from what
// comparable local publishers charge — change them here when you settle yours.

export interface AudienceStats {
  /** Visitors in the last full month, e.g. "162,000". */
  visitors: string;
  pageviews: string;
  subscribers: string;
}

export interface PackageDef {
  key: string;
  kind: 'one_time' | 'retainer';
  name: string;
  price: string;
  term: string;
  bestFor: string;
  includes: string[];
  /** The one to steer people to: shown with a dark border. */
  anchor?: boolean;
  /** Paste-ready paragraph for an email or proposal. */
  pitch: (a: AudienceStats) => string;
}

export const PACKAGES: PackageDef[] = [
  {
    key: 'spotlight',
    kind: 'one_time',
    name: 'Spotlight',
    price: '$350',
    term: 'one week',
    bestFor: 'An event with a date, a small budget, a first try.',
    includes: [
      'Sponsor block in one newsletter',
      'One Instagram story with your link',
      'Link-in-bio placement for a week',
    ],
    pitch: (a) =>
      `Spotlight — $350. Your event or offer in front of our ${a.subscribers} newsletter subscribers and our Instagram audience for one week: a sponsor block in the newsletter, a story with your link, and a link-in-bio placement. Good for anything with a date on it.`,
  },
  {
    key: 'feature',
    kind: 'one_time',
    name: 'Feature Story',
    price: '$750',
    term: 'published permanently',
    bestFor: 'An opening, a new location, a launch, a story worth telling.',
    includes: [
      'One full feature, written by our writer',
      'Stays on the site and in Google permanently',
      'Newsletter mention and one Instagram post',
      'Results note after 30 days',
    ],
    pitch: (a) =>
      `Feature Story — $750. One full feature on your business, written by our writer and published permanently on Culture Alberta, which about ${a.visitors} people read each month. It goes out in our newsletter and on Instagram, it keeps showing up in Google long after a paid ad stops, and we send you the numbers after 30 days. Clearly labelled as a partner feature.`,
  },
  {
    key: 'launch',
    kind: 'one_time',
    name: 'Launch Bundle',
    price: '$1,950',
    term: '3 features over 90 days',
    bestFor: 'A season, a launch or a campaign. The one to lead with.',
    anchor: true,
    includes: [
      'Three features across 90 days (before, during, after)',
      'Newsletter and Instagram with each one',
      'One week featured on the homepage',
      'Full results report at day 90',
      'Saves $300 on three single features',
    ],
    pitch: (a) =>
      `Launch Bundle — $1,950. Three features over 90 days, so people hear about you more than once: one to announce, one while it is happening, one to keep it going. Each goes out in the newsletter and on Instagram, you get a week on our homepage, and a full results report at day 90. Culture Alberta reaches about ${a.visitors} readers a month (${a.pageviews} pageviews). It works out to $650 a feature instead of $750.`,
  },
  {
    key: 'always_on',
    kind: 'retainer',
    name: 'Always-On Partner',
    price: '$1,200 / month',
    term: '3-month minimum',
    bestFor: 'A business that wants to stay top of mind all year.',
    includes: [
      'One feature every month',
      'A newsletter placement every month',
      'Two Instagram posts every month',
      'Monthly results note',
    ],
    pitch: (a) =>
      `Always-On Partner — $1,200 a month, three-month minimum. A new feature every month, a newsletter placement and two Instagram posts, with a short results note each month. One feature is a moment; a year of them is how ${a.visitors} monthly readers come to think of you first.`,
  },
  {
    key: 'category',
    kind: 'retainer',
    name: 'Category Sponsor',
    price: '$2,500 / month',
    term: '6-month term · one sponsor per section',
    bestFor: 'Institutions: tourism, developers, credit unions, colleges, BIAs.',
    anchor: true,
    includes: [
      '“Presented by” on every article in one section',
      'Exclusive: no competitor in that section',
      'One feature every month',
      'Presenting sponsor of one newsletter a month',
      'Quarterly report for your board',
    ],
    pitch: (a) =>
      `Category Sponsor — $2,500 a month on a six-month term. You become the presenting sponsor of one whole section of Culture Alberta (for example Food & Drink, Things To Do or Real Estate): “Presented by” on every article in it, one feature a month, and presenting sponsor of a newsletter each month. It is exclusive — one sponsor per section, so no competitor appears beside you — and you get a quarterly report you can take to your board. The site reaches about ${a.visitors} readers and ${a.pageviews} pageviews a month.`,
  },
  {
    key: 'social',
    kind: 'retainer',
    name: 'Done-For-You Social',
    price: '$1,500 / month',
    term: '3-month minimum',
    bestFor: 'A business that needs its own channels run, not just coverage.',
    includes: [
      'Culture Media runs your Instagram and Facebook',
      'Twelve posts a month, one shoot a month',
      'Monthly report and planning call',
    ],
    pitch: () =>
      `Done-For-You Social — $1,500 a month, three-month minimum. Culture Media runs your Instagram and Facebook for you: twelve posts a month, one content shoot a month, and a monthly report and planning call. It is the same team and the same eye that built Culture Alberta's audience, working on yours.`,
  },
];

/** Ways to reach $5,000 a month in retainers — the target on the scorecard. */
export const ROADS_TO_TARGET = [
  { mix: '2 Category Sponsors', total: '$5,000' },
  { mix: '1 Category Sponsor + 2 Always-On Partners', total: '$4,900' },
  { mix: '4 Always-On Partners', total: '$4,800' },
];

export const SELLING_RULES: { rule: string; why: string }[] = [
  {
    rule: 'Always show three options and recommend the middle one.',
    why: 'People compare the options to each other instead of to “nothing”. For a local business show Spotlight, Feature Story and Launch Bundle, and recommend the bundle.',
  },
  {
    rule: 'Sell bundles, not single posts.',
    why: 'Small publishers do best selling sponsored stories in packages of three to five at one fixed price. One post is a moment; three is a campaign, and it is a bigger sale for the same conversation.',
  },
  {
    rule: 'Never lower the price. Change the package.',
    why: 'If $1,950 is too much, offer the Feature Story at $750 — do not offer the bundle for $1,500. A discount teaches them your prices are not real.',
  },
  {
    rule: 'The one-time feature is the way in; the results note is the way up.',
    why: 'Thirty days after a feature runs, send the numbers and offer the next step up. That single habit is what turns one-off buyers into retainers, and the renewal emails start by themselves 45 days before a term ends.',
  },
  {
    rule: 'Exclusivity is the thing institutions pay for.',
    why: 'One sponsor per section means you can honestly say “if you do not take Food & Drink, someone else can”. That is the difference between a $750 sale and a $15,000 one.',
  },
  {
    rule: 'Label partner content clearly, every time.',
    why: 'Readers trust it more, not less, and it keeps you on the right side of advertising rules and ad-network policies.',
  },
  {
    rule: 'Get paid before you publish.',
    why: 'Half to book the date and half on publish for one-time work; retainers billed monthly, in advance.',
  },
];

export const OUTREACH_FACTS: string[] = [
  'About 58% of all replies come from the first email and another 20% from the second. The follow-ups matter, but the first line matters most — make it about them.',
  'Three to five emails in total is the sweet spot. Your sequences are four, which is right.',
  'Small, hand-picked lists get roughly 5.8% replies; big blasts get about 2.1%. One well-chosen business a day beats fifty scraped ones.',
  'Expect around 1 reply in 20. That is normal, and it is why the daily habit matters more than any one email.',
];

export const EMAIL_RULES: string[] = [
  'Only email a business address that is published on their own website (with no “do not contact” note), or someone who contacted you first, or someone who agreed. Record which one on the lead — without it, nothing sends.',
  'What you send has to be relevant to their business. A feature offer to a restaurant owner is; the same email to their accountant is not.',
  'Every email must say who you are, carry your mailing address, and have a working unsubscribe. The sequences add all three automatically.',
  'An unsubscribe has to be honoured within 10 business days. Here it is immediate, and an unsubscribed lead can never be put back on a sequence.',
];

export const SOURCES: { label: string; href: string }[] = [
  { label: 'Broadstreet — pricing sponsored content for hyperlocals', href: 'https://broadstreetads.com/price-sponsored-content/' },
  { label: 'Newsletrix — newsletter sponsorship pricing, 2026', href: 'https://newsletrix.com/blog/newsletter-sponsorship-pricing-guide' },
  { label: 'Lenfest Institute — sponsorships toolkit', href: 'https://www.lenfestinstitute.org/solutions-resources/beyond-print-toolkit-sponsorships/' },
  { label: 'Instantly — cold email benchmark report 2026', href: 'https://instantly.ai/cold-email-benchmark-report-2026' },
  { label: 'Belkins — B2B cold email response rates', href: 'https://belkins.io/blog/cold-email-response-rates' },
  { label: 'CRTC — CASL guidance on implied consent', href: 'https://crtc.gc.ca/eng/com500/guide.htm' },
];

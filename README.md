This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Environment variables

The marketing pages need nothing. The signed-in areas need these set in Vercel
(Production, Preview and Development) and in `.env.local` for local work:

| Variable | Used by | Notes |
| --- | --- | --- |
| `DASHBOARD_USER` | `/admin/*`, `/api/admin/*` | Sign-in name. **Required** — with it unset nobody can sign in. |
| `DASHBOARD_PASSWORD` | same | Sign-in password. **Required** for the same reason. |
| `SUPABASE_URL` | every `/admin` page except Bids | Culture Alberta Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | same | Service-role key. Server-side only — never prefix it with `NEXT_PUBLIC_`. |
| `ZOHO_CLIENT_ID` · `ZOHO_CLIENT_SECRET` · `ZOHO_REFRESH_TOKEN` · `ZOHO_REDIRECT_URI` | Inbox, mail sync | Read-only Zoho Mail. A token minted before `ZohoMail.folders.READ` was requested reads the Inbox only; reconnect from the Inbox page to add Spam and Sent. |
| `GMAIL_USER` · `GMAIL_APP_PASSWORD` | Inbox, mail sync | The Gmail address and a Google app password. Opened read-only over IMAP. Optional — without them Gmail simply shows as not connected. |

> **Do not keep a working copy of this repo inside OneDrive.** OneDrive rolls files back to
> older versions and drops `name(1).tsx` conflict copies while you work, which silently undoes
> edits. Clone it somewhere like `C:\Users\<you>\dev\`.

## Admin area

Everything signed-in lives under `/admin` (sign in at `/admin/login`), in one sidebar layout:

| Page | What it is |
| --- | --- |
| `/admin` | **Today** — replies to answer, emails to approve, add a lead, the week's outreach, the money |
| `/admin/leads` | Every lead and client; open one to edit it, move its stage, start its emails, log calls |
| `/admin/inbox` | Replies waiting on you, drafted emails waiting for approval, and mail from Zoho **and** Gmail (inbox + spam) sorted into inquiries, payments, bounces, "please remove me" and the rest |
| `/admin/packages` | What is for sale (`src/lib/packages.ts`), copy-ready pitches, the selling playbook |
| `/admin/revenue` | What came in, what it cost and what was kept, in USD or CAD, year over year: invoices (`public.revenue_invoices`), monthly running costs (`public.revenue_expenses`) and Mediavine months. Conversion uses the scorecard's live rates, then the Bank of Canada monthly averages in `src/lib/fx-history.ts` for older months |
| `/admin/scorecard` | The same all-revenue band (it follows the page's USD/CAD switch), then Culture Alberta KPIs from `admin_kpi_scorecard()` |
| `/admin/bids` | Alberta Purchasing Connection tenders (data in the browser's localStorage) |
| `/admin/setup` · `/admin/sync` | APC bookmarklet install and the popup it posts to (deliberately not behind sign-in) |

The CRM tables (`leads`, `lead_events`, `lead_drafts`) are shared with the Culture Alberta
repo, whose engine drafts follow-up emails each morning, sends them through Zoho on **Approve &
send**, and spots replies. This admin reads and edits leads; it never sends email. The rules in
`src/lib/crm-admin.ts` mirror that repo's `PATCH /api/admin/leads` — keep them in step.

**Mail sync** (`src/lib/mail-sync.ts`, run when Today or Inbox opens) reads both mailboxes and
records only what a mailbox proves: a lead wrote to you (same effect as that repo's
`recordReply()`), or you wrote to a lead (`last_contacted_at`, New → Contacted). It uses each
message's own timestamp, so it is idempotent and answering from your mail client clears a lead
from "replies to answer". Everything else the classifier finds (`src/lib/mail.ts`) is a
suggestion on the page. It never sends, deletes, moves or marks mail.

Old `/dashboard/*`, `/admin/pipeline` and `/admin/sales` URLs redirect to their new homes.

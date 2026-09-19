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
| `SUPABASE_URL` | `/admin/scorecard`, `/admin/sales` | Culture Alberta Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | same | Service-role key. Server-side only — never prefix it with `NEXT_PUBLIC_`. |

## Admin area

Everything signed-in lives under `/admin` (sign in at `/admin/login`):

| Page | What it is |
| --- | --- |
| `/admin` | Hub linking the pages below |
| `/admin/scorecard` | Culture Alberta KPIs, from `admin_kpi_scorecard()` |
| `/admin/sales` | Culture Alberta partnerships CRM, from `admin_sales_dashboard()` |
| `/admin/pipeline` | The agency's APC listings, outreach leads and Zoho sync (data in the browser's localStorage) |
| `/admin/setup` | Installs the APC sync bookmarklet |
| `/admin/sync` | Popup the bookmarklet posts listings to — deliberately not behind sign-in |

The old `/dashboard/*` URLs redirect to their `/admin/*` equivalents.

`SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security. It is read only in
`src/lib/supabase-admin.ts`, which is marked `server-only`, and the admin pages
pass Supabase's JSON — never the key — to the browser.

// US dollar in Canadian dollars, by month.
//
// The scorecard carries live Bank of Canada rates from May 2026 on; invoices go
// back to 2021. These are the Bank of Canada's published monthly averages
// (Valet series FXMUSDCAD, fetched 2026-09-20), so an old invoice converts at
// the rate of the month it was paid rather than at today's. Where both exist
// the live rate wins — they agree to four decimals for every overlapping month.

import type { Fx } from './admin-types';

const BOC_MONTHLY_USDCAD: Record<string, number> = {
  '2021-01': 1.2724, '2021-02': 1.2699, '2021-03': 1.2574, '2021-04': 1.2496, '2021-05': 1.2126, '2021-06': 1.2219,
  '2021-07': 1.2529, '2021-08': 1.2603, '2021-09': 1.2671, '2021-10': 1.2437, '2021-11': 1.257, '2021-12': 1.2794,
  '2022-01': 1.2616, '2022-02': 1.2716, '2022-03': 1.2658, '2022-04': 1.2628, '2022-05': 1.2852, '2022-06': 1.2814,
  '2022-07': 1.2942, '2022-08': 1.2922, '2022-09': 1.3319, '2022-10': 1.37, '2022-11': 1.3449, '2022-12': 1.3592,
  '2023-01': 1.3422, '2023-02': 1.345, '2023-03': 1.3682, '2023-04': 1.3485, '2023-05': 1.352, '2023-06': 1.3288,
  '2023-07': 1.3215, '2023-08': 1.3485, '2023-09': 1.3535, '2023-10': 1.3717, '2023-11': 1.3709, '2023-12': 1.3431,
  '2024-01': 1.3425, '2024-02': 1.3501, '2024-03': 1.3539, '2024-04': 1.3674, '2024-05': 1.367, '2024-06': 1.3707,
  '2024-07': 1.3712, '2024-08': 1.3652, '2024-09': 1.3546, '2024-10': 1.3755, '2024-11': 1.3975, '2024-12': 1.424,
  '2025-01': 1.439, '2025-02': 1.4301, '2025-03': 1.4359, '2025-04': 1.3988, '2025-05': 1.386, '2025-06': 1.3674,
  '2025-07': 1.3691, '2025-08': 1.3802, '2025-09': 1.3833, '2025-10': 1.3992, '2025-11': 1.4055, '2025-12': 1.3802,
  '2026-01': 1.3778, '2026-02': 1.3651, '2026-03': 1.3717, '2026-04': 1.3751, '2026-05': 1.3723, '2026-06': 1.404,
  '2026-07': 1.4107, '2026-08': 1.3898,
};

const positive = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * CAD per USD for a YYYY-MM month: the scorecard's live rate, then the Bank of
 * Canada history, then the latest known rate. `exact` is false for that last
 * resort, so a page can say its conversion is approximate.
 */
export function monthRate(fx: Fx | null | undefined, month: string): { rate: number; exact: boolean } {
  const live = positive(fx?.monthly?.[month]);
  if (live) return { rate: live, exact: true };
  const published = BOC_MONTHLY_USDCAD[month];
  if (published) return { rate: published, exact: true };
  return { rate: positive(fx?.latest?.rate) ?? 1.39, exact: false };
}

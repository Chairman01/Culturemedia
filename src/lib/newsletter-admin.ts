// Server-side reads for the Newsletter page (service role only).
//
// Both calls go to SQL functions that do the counting in the database, so the
// page never pulls a hundred thousand event rows into Node. Nothing here
// writes, and the Resend API key is not needed: the events were posted to the
// Culture Alberta site by Resend's webhook as they happened.

import 'server-only';

import type { IssueDetail, NewsletterData } from './newsletter';
import { callRpc, type AdminResult } from './supabase-admin';

/** Everything on /admin/newsletter: members, issues, kinds, who clicks. */
export function fetchNewsletterDashboard(): Promise<AdminResult<NewsletterData>> {
  return callRpc<NewsletterData>('admin_newsletter_dashboard');
}

/** One issue in full, by its subject line: links, clickers, openers, bounces. */
export function fetchNewsletterIssue(subject: string): Promise<AdminResult<IssueDetail>> {
  return callRpc<IssueDetail>('admin_newsletter_issue', { p_subject: subject });
}

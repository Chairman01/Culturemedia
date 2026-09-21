// The Inbox keeps its last mail check for the browser session, so coming back to
// the page does not read both mailboxes again. Three pages share it (Inbox, Today,
// Leads), so the rules live here.
//
// VERSION is the important part: a saved check is a snapshot of whatever the
// server sent at the time. When a release adds something to each email — a link
// that opens it, a new flag — an old snapshot does not have it, and the page
// would quietly keep showing the old rows for up to an hour. Bump VERSION in any
// change that adds to or reshapes what /api/admin/inbox/sync returns, and every
// saved check from before it is ignored.

export const INBOX_CACHE_KEY = 'cm-admin-inbox';
export const INBOX_CACHE_VERSION = 3;
export const INBOX_FRESH_MS = 60 * 60 * 1000;

export interface SavedCheck<T> {
  v: number;
  at: number;
  data: T;
}

/** The saved check, or null when there is none, it is unreadable, or it predates this release. */
export function readSavedCheck<T>(): SavedCheck<T> | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(INBOX_CACHE_KEY) || 'null') as SavedCheck<T> | null;
    return saved && saved.v === INBOX_CACHE_VERSION && typeof saved.at === 'number' && saved.data ? saved : null;
  } catch {
    return null;
  }
}

export function saveCheck<T>(data: T, at: number): void {
  try {
    sessionStorage.setItem(INBOX_CACHE_KEY, JSON.stringify({ v: INBOX_CACHE_VERSION, at, data }));
  } catch {
    /* storage full or blocked: the page still works, it just checks again next time */
  }
}

'use client';

import { useEffect, useRef } from 'react';

/**
 * Re-runs `refresh` when you come back to the tab, so a page left open all day
 * is never showing this morning's numbers. At most once a minute.
 */
export function useRefreshOnFocus(refresh: () => void, minGapMs = 60_000) {
  const saved = useRef(refresh);
  useEffect(() => {
    saved.current = refresh;
  }, [refresh]);

  useEffect(() => {
    // The page was fresh when it mounted; start the clock from there.
    let last = Date.now();
    const wake = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - last < minGapMs) return;
      last = Date.now();
      saved.current();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
    };
  }, [minGapMs]);
}

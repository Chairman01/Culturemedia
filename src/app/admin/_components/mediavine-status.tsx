'use client';

// One line under "Data through": whether Mediavine is connected, when its
// figures were last pulled, and a button to pull them now. The pull itself also
// happens in the background from any admin page (see the shell).

import { useCallback, useEffect, useState } from 'react';

import { day } from './format';

interface Status {
  configured: boolean;
  lastSynced: string | null;
  through: string | null;
  stale: boolean;
}

/** Fired by the shell when a background update wrote new figures. */
export const MEDIAVINE_SYNCED = 'cm:mediavine-synced';

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export function MediavineStatus({ onSynced }: { onSynced?: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = useCallback(() => {
    fetch('/api/admin/mediavine', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.data && setStatus(d.data as Status))
      .catch(() => {});
  }, []);

  useEffect(() => {
    read();
    const synced = () => {
      read();
      onSynced?.();
    };
    window.addEventListener(MEDIAVINE_SYNCED, synced);
    return () => window.removeEventListener(MEDIAVINE_SYNCED, synced);
  }, [read, onSynced]);

  const update = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/mediavine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await res.json().catch(() => null);
      if (d?.status) setStatus(d.status as Status);
      if (!res.ok || !d?.data?.ok) setError(d?.data?.error || d?.error || 'The Mediavine update did not finish. Try again.');
      else onSynced?.();
    } catch {
      setError('Could not reach the site. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;
  if (!status.configured) {
    return <p className="fresh mv-line">Mediavine is not connected yet, so its figures only change when an export is loaded.</p>;
  }
  return (
    <p className="fresh mv-line" aria-live="polite">
      Mediavine updates by itself
      {status.through ? ` · figures through ${day(status.through)}` : ''}
      {status.lastSynced ? ` · last checked ${ago(status.lastSynced)}` : ' · not checked yet'}{' '}
      <button type="button" className="linkish" onClick={update} disabled={busy}>
        {busy ? 'Updating…' : 'Update now'}
      </button>
      {error && <span className="old"> {error}</span>}
    </p>
  );
}

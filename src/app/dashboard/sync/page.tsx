'use client';

import { useEffect, useState } from 'react';

export default function SyncPage() {
  const [status, setStatus] = useState<'waiting' | 'progress' | 'done' | 'error'>('waiting');
  const [count, setCount] = useState(0);
  const [progress, setProgress] = useState('');
  const [debug, setDebug] = useState('');

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.includes('purchasing.alberta.ca')) return;

      const { type, listings, syncedAt, progressMsg, debugInfo } = event.data || {};

      // Progress update from bookmarklet
      if (type === 'APC_PROGRESS') {
        setStatus('progress');
        setProgress(progressMsg || '');
        setCount(listings?.length || 0);
        return;
      }

      // Final data
      if (type === 'APC_SYNC') {
        if (debugInfo) setDebug(debugInfo);
        if (!Array.isArray(listings) || listings.length === 0) {
          setStatus('error');
          setDebug(debugInfo || 'No listings received. The API may have changed format.');
          return;
        }
        setCount(listings.length);
        try {
          localStorage.setItem('apc_listings', JSON.stringify(listings));
          localStorage.setItem('apc_synced_at', syncedAt || new Date().toISOString());
          setStatus('done');
          setTimeout(() => { window.location.href = '/dashboard'; }, 1800);
        } catch {
          setStatus('error');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div style={{
      minHeight: '100vh', background: '#0f0f1a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#e2e8f0', padding: 20,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400, width: '100%' }}>
        {status === 'waiting' && (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Waiting for APC sync...</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Click the APC Sync bookmark while on purchasing.alberta.ca
            </div>
          </>
        )}
        {status === 'progress' && (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔄</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Scanning APC...</div>
            <div style={{ fontSize: 13, color: '#3b82f6', marginBottom: 4 }}>{progress}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{count} listings found so far</div>
          </>
        )}
        {status === 'done' && (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{count} listings synced!</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Redirecting to dashboard...</div>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Sync returned 0 results</div>
            {debug && (
              <div style={{
                fontSize: 11, color: '#94a3b8', background: '#1e1e2e',
                border: '1px solid #2a2a3e', borderRadius: 8, padding: 12,
                marginBottom: 12, textAlign: 'left', wordBreak: 'break-all',
              }}>
                {debug}
              </div>
            )}
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
              The APC API may have changed. Try the bookmark again, or contact support.
            </p>
            <a href="/dashboard/setup" style={{ color: '#3b82f6', fontSize: 13 }}>← Back to setup</a>
          </>
        )}
      </div>
    </div>
  );
}

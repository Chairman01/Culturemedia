'use client';

import { useEffect, useState } from 'react';

// This page receives APC data sent via postMessage from the bookmarklet running on purchasing.alberta.ca
// It stores the data in localStorage and redirects back to the dashboard

export default function SyncPage() {
  const [status, setStatus] = useState<'waiting' | 'receiving' | 'done' | 'error'>('waiting');
  const [count, setCount] = useState(0);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from purchasing.alberta.ca
      if (!event.origin.includes('purchasing.alberta.ca')) return;

      const { type, listings, syncedAt } = event.data || {};
      if (type !== 'APC_SYNC' || !Array.isArray(listings)) return;

      setStatus('receiving');
      setCount(listings.length);

      try {
        localStorage.setItem('apc_listings', JSON.stringify(listings));
        localStorage.setItem('apc_synced_at', syncedAt || new Date().toISOString());
        setStatus('done');

        // Close this window and redirect to dashboard after a moment
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1500);
      } catch {
        setStatus('error');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#e2e8f0',
    }}>
      <div style={{ textAlign: 'center', padding: 40 }}>
        {status === 'waiting' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Waiting for APC data...</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              Go to purchasing.alberta.ca and click your APC Sync bookmark
            </div>
          </>
        )}
        {status === 'receiving' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📥</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Receiving {count} listings...</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Saving to your dashboard</div>
          </>
        )}
        {status === 'done' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{count} listings synced</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Redirecting to dashboard...</div>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Sync failed</div>
            <a href="/dashboard/setup" style={{ color: '#3b82f6', fontSize: 13 }}>Try again</a>
          </>
        )}
      </div>
    </div>
  );
}

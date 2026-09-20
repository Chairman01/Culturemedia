'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AdminShell } from '../_components/shell';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/dashboard-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.push('/admin');
        return;
      }
      // 503 means DASHBOARD_USER / DASHBOARD_PASSWORD are not set on the
      // server; say so rather than pretending the password was wrong.
      const body = await res.json().catch(() => ({}));
      setError(res.status === 401 ? 'Invalid username or password' : body.error || 'Something went wrong. Try again.');
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell bare>
      <div className="login">
        <section className="card" aria-labelledby="login-h">
          <p className="eyebrow">Culture Media</p>
          <h1 id="login-h">Admin sign-in</h1>
          <form className="form" onSubmit={handleSubmit} noValidate>
            <label className="wide">
              Username
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                autoFocus
                disabled={loading}
              />
            </label>
            <label className="wide">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </label>
            {error && (
              <p className="banner wide" data-tone="crit" role="alert">
                {error}
              </p>
            )}
            <div className="actions">
              <button type="submit" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </div>
          </form>
          <p className="links">
            <Link href="/">← culturemedia.ca</Link>
          </p>
        </section>
      </div>
    </AdminShell>
  );
}

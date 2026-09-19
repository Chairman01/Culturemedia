'use client';

// Every lead and client in one table. Click a company to open it.

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import {
  DEAL_LABEL,
  SEQUENCE_LABEL,
  STAGE_LABEL,
  awaitingReply,
  isOpen,
  needsOf,
  type LeadRow,
} from '@/lib/crm';
import { AddLeadForm } from '../_components/add-lead';
import { day, money, num } from '../_components/format';
import { AdminShell, PageHead } from '../_components/shell';
import { Banner, Seg } from '../_components/ui';

type Filter = 'open' | 'blocked' | 'won' | 'all';

export default function LeadsView({
  initial,
  initialError,
  today,
  openAdd,
  initialFilter,
}: {
  initial: LeadRow[];
  initialError: string | null;
  today: string;
  openAdd: boolean;
  initialFilter: Filter;
}) {
  const [leads, setLeads] = useState<LeadRow[]>(initial);
  const [error, setError] = useState<string | null>(initialError);
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(openAdd);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/leads', { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || `Couldn't load leads (${res.status}).`);
        return;
      }
      setLeads(body.data as LeadRow[]);
      setError(null);
    } catch {
      setError("Couldn't reach the server.");
    }
  }, []);

  const counts = useMemo(
    () => ({
      open: leads.filter(isOpen).length,
      blocked: leads.filter((l) => needsOf(l).length > 0).length,
      won: leads.filter((l) => l.stage === 'won').length,
      all: leads.length,
    }),
    [leads],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads
      .filter((l) =>
        filter === 'all'
          ? true
          : filter === 'won'
            ? l.stage === 'won'
            : filter === 'blocked'
              ? needsOf(l).length > 0
              : isOpen(l),
      )
      .filter(
        (l) =>
          !q ||
          [l.company, l.contact_name, l.email, l.city, l.category]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
      );
  }, [leads, filter, query]);

  return (
    <AdminShell>
      <PageHead
        title="Leads"
        help="Everyone you could sell to, and everyone who has bought. Click a company to update it, log a call or start its emails."
      >
        <button type="button" className="btn" onClick={() => setAdding((a) => !a)}>
          <Plus size={16} aria-hidden="true" />
          {adding ? 'Close' : 'Add a lead'}
        </button>
      </PageHead>

      <Banner tone="crit">{error}</Banner>

      {adding && (
        <section className="card" aria-labelledby="add-h" style={{ marginBottom: 12 }}>
          <h2 id="add-h">Add a lead or client</h2>
          <AddLeadForm onAdded={load} />
        </section>
      )}

      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search company, person, city…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search leads"
        />
        <span className="grow" />
        <Seg
          label="Which leads"
          value={filter}
          onChange={setFilter}
          options={[
            { k: 'open', label: `Open ${counts.open}` },
            { k: 'blocked', label: `Needs fixing ${counts.blocked}`, title: 'Missing an email, a permission or a sequence' },
            { k: 'won', label: `Clients ${counts.won}` },
            { k: 'all', label: `All ${counts.all}` },
          ]}
        />
      </div>

      <section className="card">
        <div className="tw" style={{ marginTop: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Stage</th>
                <th>Buying</th>
                <th>Value</th>
                <th>Emails</th>
                <th>Last contact</th>
                <th>Next step</th>
                <th>Needs</th>
              </tr>
            </thead>
            <tbody>
              {shown.length ? (
                shown.map((lead) => <Row key={lead.id} lead={lead} today={today} />)
              ) : (
                <tr>
                  <td colSpan={8} className="l muted">
                    {leads.length
                      ? 'Nothing matches.'
                      : 'No leads yet. Add your first one — one a weekday is the whole plan.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}

function Row({ lead, today }: { lead: LeadRow; today: string }) {
  const needs = needsOf(lead);
  const term = num(lead.term_months);
  const value = num(lead.deal_value);
  const valueText = value === null ? '—' : term ? `${money(value / term)}/mo × ${term}` : money(value);
  const who = [lead.contact_name, lead.email].filter(Boolean).join(' · ');
  const overdue = Boolean(lead.next_action_on && lead.next_action_on < today && isOpen(lead));

  return (
    <tr>
      <td className="co">
        <Link href={`/admin/leads/${lead.id}`}>
          <b>{lead.company}</b>
          <span>{who || lead.city || ''}</span>
        </Link>
      </td>
      <td className="l">
        <span className={`pill ${lead.stage}`}>{STAGE_LABEL[lead.stage] || lead.stage}</span>
        {awaitingReply(lead) && <span className="chip warn" style={{ marginLeft: 6 }}>Replied</span>}
      </td>
      <td className="l">{DEAL_LABEL[lead.deal_type || ''] || '—'}</td>
      <td>{valueText}</td>
      <td className="l">
        {lead.sequence_key ? (
          `${SEQUENCE_LABEL[lead.sequence_key] || lead.sequence_key} · step ${lead.sequence_step + 1}`
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td>{day(lead.last_contacted_at)}</td>
      <td style={overdue ? { color: 'var(--crit)', fontWeight: 700 } : undefined}>
        {lead.next_action_on ? day(lead.next_action_on) : '—'}
      </td>
      <td className="l">
        {needs.length ? (
          <span className="flag">{needs.join(' · ')}</span>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
    </tr>
  );
}

'use client';

// Every lead and client in one table. Click a company to open it.

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import {
  DEAL_LABEL,
  SEQUENCE_LABEL,
  STAGE_LABEL,
  goingCold,
  isCustomer,
  isOpen,
  needsOf,
  type LeadRow,
} from '@/lib/crm';
import { GROUP_ORDER, GROUP_TITLE, standingOf, type Standing, type StandingGroup } from '@/lib/standing';
import { AddLeadForm } from '../_components/add-lead';
import { day, money, num } from '../_components/format';
import { AdminShell, PageHead } from '../_components/shell';
import { Banner, Seg } from '../_components/ui';

type Filter = 'open' | 'blocked' | 'won' | 'cold' | 'all';

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
  const [checking, setChecking] = useState(false);

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
      won: leads.filter(isCustomer).length,
      cold: leads.filter((l) => goingCold(l, today)).length,
      all: leads.length,
    }),
    [leads, today],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads
      .filter((l) =>
        filter === 'all'
          ? true
          : filter === 'won'
            ? isCustomer(l)
            : filter === 'cold'
              ? goingCold(l, today)
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
  }, [leads, filter, query, today]);

  // The same leads, in piles by whose move it is, most pressing first.
  const grouped = useMemo(() => {
    const piles: Record<StandingGroup, { lead: LeadRow; standing: Standing }[]> = {
      move: [],
      fresh: [],
      waiting: [],
      customer: [],
      closed: [],
    };
    for (const lead of shown) {
      const standing = standingOf(lead, today);
      piles[standing.group].push({ lead, standing });
    }
    for (const pile of Object.values(piles)) pile.sort((a, b) => a.standing.rank - b.standing.rank);
    return piles;
  }, [shown, today]);

  // Who wrote last comes from the mailboxes. Read them now, then reload the leads.
  const updateFromMail = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const res = await fetch('/api/admin/inbox/sync', { method: 'POST', cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError("Couldn't check your mailboxes. Try again in a minute.");
        return;
      }
      try {
        if (body?.data) {
          sessionStorage.setItem('cm-admin-inbox', JSON.stringify({ at: Date.now(), data: { ...body.data, report: null } }));
        }
      } catch {
        /* storage blocked: the Inbox just checks again itself */
      }
      await load();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <AdminShell>
      <PageHead
        title="Leads"
        help="Everyone you could sell to, and everyone who has bought — sorted by whose move it is. Each line says who wrote last. Click a company to update it, log a call or start its emails."
      >
        <button
          type="button"
          className="btn ghost"
          onClick={updateFromMail}
          disabled={checking}
          title="Read Zoho and Gmail now, so 'who wrote last' is up to the minute"
        >
          {checking ? 'Checking mail…' : 'Update from mail'}
        </button>
        <button type="button" className="btn" onClick={() => setAdding((a) => !a)}>
          <Plus size={16} aria-hidden="true" />
          {adding ? 'Close' : 'Add a lead'}
        </button>
      </PageHead>

      <Banner tone="crit">{error}</Banner>

      {adding && (
        <section className="card" aria-labelledby="add-h" style={{ marginBottom: 12 }}>
          <h2 id="add-h">Add a lead or client</h2>
          <AddLeadForm onAdded={updateFromMail} />
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
            { k: 'won', label: `Customers ${counts.won}`, title: 'Everyone who has paid you' },
            { k: 'cold', label: `Going cold ${counts.cold}`, title: 'Customers with no check-in booked and no contact in six months' },
            { k: 'all', label: `All ${counts.all}` },
          ]}
        />
      </div>

      {shown.length ? (
        GROUP_ORDER.map((group) => {
          const rows = grouped[group];
          if (!rows.length) return null;
          return (
            <section key={group} className="card lgroup" aria-label={GROUP_TITLE[group].title}>
              <h2>
                {GROUP_TITLE[group].title} <small>{rows.length}</small>
              </h2>
              <p className="cnote">{GROUP_TITLE[group].help}</p>
              {rows.map(({ lead, standing }) => (
                <Row key={lead.id} lead={lead} standing={standing} today={today} />
              ))}
            </section>
          );
        })
      ) : (
        <section className="card">
          <p className="empty-note">
            {leads.length ? 'Nothing matches.' : 'No leads yet. Add your first one — one a weekday is the whole plan.'}
          </p>
        </section>
      )}
    </AdminShell>
  );
}

function Row({ lead, standing, today }: { lead: LeadRow; standing: Standing; today: string }) {
  const needs = needsOf(lead);
  const term = num(lead.term_months);
  const value = num(lead.deal_value);
  const valueText = value === null ? null : term ? `${money(value / term)}/mo × ${term}` : money(value);
  const who = [lead.contact_name, lead.email].filter(Boolean).join(' · ');
  const overdue = Boolean(lead.next_action_on && lead.next_action_on < today && isOpen(lead));

  return (
    <Link className="lrow" href={`/admin/leads/${lead.id}`}>
      <span className="top">
        <b>{lead.company}</b>
        <span className={`chip ${standing.tone}`}>{standing.label}</span>
      </span>
      {(who || lead.city) && <span className="who">{who || lead.city}</span>}
      {/* The one line that answers "where are we with them?" */}
      <span className="stands">{standing.text}</span>
      <span className="facts">
        <span className={`pill ${lead.stage}`}>{STAGE_LABEL[lead.stage] || lead.stage}</span>
        {lead.deal_type && <span>{DEAL_LABEL[lead.deal_type] || lead.deal_type}</span>}
        {valueText && <span className="num">{valueText}</span>}
        {lead.sequence_key && (
          <span>
            Emails: {SEQUENCE_LABEL[lead.sequence_key] || lead.sequence_key} · step {lead.sequence_step + 1}
          </span>
        )}
        {lead.next_action_on && (
          <span className={overdue ? 'over' : undefined}>
            Next step {overdue ? 'was due ' : ''}
            {day(lead.next_action_on)}
          </span>
        )}
        {needs.length > 0 && <span className="flag">Needs {needs.join(' · ')}</span>}
        {!needs.length && goingCold(lead, today) && <span className="flag">Needs a check-in date</span>}
      </span>
    </Link>
  );
}

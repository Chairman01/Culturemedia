'use client';

import { useState, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Posting {
  referenceNumber: string;
  title: string;
  organization: string;
  closingDate: string;
  postDate: string;
  status: string;
  category?: string;
  estimatedValue?: number;
  interestedCount?: number | null; // null = not loaded yet
  description?: string;
  url: string;
  tab: 'culturemedia' | 'consulting' | 'easymoney' | 'china' | 'all';
  score: number;
}

interface PipelineLead {
  id: string;
  title: string;
  org: string;
  stage: 'reviewing' | 'pitched' | 'active' | 'won' | 'lost';
  value: string;
  notes: string;
  url: string;
  addedAt: string;
  closingDate?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PIPELINE_KEY = 'cm_pipeline_v2';

const STAGES: { key: PipelineLead['stage']; label: string; color: string }[] = [
  { key: 'reviewing', label: 'Reviewing', color: '#3b82f6' },
  { key: 'pitched', label: 'Pitched', color: '#f59e0b' },
  { key: 'active', label: 'Active Work', color: '#8b5cf6' },
  { key: 'won', label: 'Won', color: '#10b981' },
  { key: 'lost', label: 'Lost', color: '#6b7280' },
];

// Keywords that classify a posting into a tab
const CULTURE_MEDIA_KW = [
  'marketing', 'social media', 'advertising', 'creative', 'branding', 'brand',
  'design', 'graphic', 'video', 'photography', 'photo', 'content', 'digital',
  'communications', 'public relations', 'pr ', 'media buy', 'campaign',
  'website', 'web design', 'copywriting', 'newsletter', 'email marketing',
  'paid media', 'seo', 'ppc', 'influencer', 'storytelling',
];

const CONSULTING_KW = [
  'consulting', 'strategy', 'strategic', 'business case', 'feasibility',
  'assessment', 'review', 'analysis', 'research', 'study', 'plan',
  'economic development', 'operational review', 'program evaluation',
  'stakeholder', 'engagement', 'facilitation', 'workshop',
];

// Service contracts — low barrier, no special license
const EASY_MONEY_KW = [
  'cleaning', 'janitorial', 'custodial', 'grounds', 'landscaping', 'lawn',
  'snow removal', 'catering', 'coffee', 'food service', 'vending',
  'security guard', 'security service', 'staffing', 'recruitment',
  'training', 'professional development', 'printing', 'courier',
  'translation', 'interpretation', 'survey', 'data entry', 'administrative',
  'photography service', 'event', 'signage', 'waste', 'pest control',
  'moving', 'shredding', 'laundry', 'window cleaning',
];

// Product/supply contracts — China supplier connection relevant
const CHINA_KW = [
  'furniture', 'office furniture', 'equipment', 'supplies', 'office supplies',
  'uniform', 'apparel', 'workwear', 'clothing', 'protective equipment',
  'ppe', 'hardware', 'tools', 'storage', 'shelving', 'flooring',
  'appliance', 'electronics', 'computers', 'laptops', 'monitors',
  'toner', 'cartridge', 'consumables', 'materials', 'goods',
  'purchase of', 'supply of', 'provision of', 'procurement of',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Handles .NET /Date(ms)/ format, ISO strings, and plain timestamps */
function parseApcDate(dateStr: string | number | undefined | null): Date | null {
  if (!dateStr && dateStr !== 0) return null;
  if (typeof dateStr === 'number') return new Date(dateStr);
  // .NET JSON date: /Date(1747353600000)/ or /Date(1747353600000-0600)/
  const netMatch = String(dateStr).match(/\/Date\((-?\d+)([+-]\d{4})?\)\//);
  if (netMatch) return new Date(parseInt(netMatch[1]));
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function classifyPosting(title: string, desc: string): Posting['tab'] {
  const text = (title + ' ' + desc).toLowerCase();
  if (CULTURE_MEDIA_KW.some((k) => text.includes(k))) return 'culturemedia';
  if (CONSULTING_KW.some((k) => text.includes(k))) return 'consulting';
  if (EASY_MONEY_KW.some((k) => text.includes(k))) return 'easymoney';
  if (CHINA_KW.some((k) => text.includes(k))) return 'china';
  return 'all';
}

/** Only show listings that are still open and not expired */
function isActive(p: Posting): boolean {
  const status = (p.status || '').toUpperCase();
  if (['CLOSED', 'AWARDED', 'CANCELLED', 'EXPIRED', 'AWARDED/CLOSED'].includes(status)) return false;
  const closeDate = parseApcDate(p.closingDate);
  if (closeDate && closeDate.getTime() < Date.now()) return false;
  return true;
}

function scorePosting(posting: Posting): number {
  let score = 50;
  const tab = posting.tab;
  if (tab === 'culturemedia') score += 20;
  if (tab === 'consulting') score += 15;
  if (tab === 'easymoney') score += 10;
  const count = posting.interestedCount;
  if (count === 0) score += 30;
  else if (count === 1) score += 20;
  else if (count === 2) score += 10;
  else if (count !== null && count !== undefined && count > 5) score -= 15;
  const parsed = parseApcDate(posting.closingDate);
  if (parsed) {
    const d = Math.floor((parsed.getTime() - Date.now()) / 86400000);
    if (d > 0 && d <= 14) score += 5;
  }
  return Math.min(100, Math.max(0, score));
}

function daysLeft(dateStr: string): string {
  const parsed = parseApcDate(dateStr);
  if (!parsed) return 'Unknown date';
  const d = Math.floor((parsed.getTime() - Date.now()) / 86400000);
  if (d < 0) return 'Closed';
  if (d === 0) return 'Today';
  if (d === 1) return '1 day left';
  return `${d} days left`;
}

function fmtDate(dateStr: string): string {
  const parsed = parseApcDate(dateStr);
  if (!parsed) return '—';
  return parsed.toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ─── Load from localStorage (synced via bookmarklet) ─────────────────────────

const APC_STORAGE_KEY = 'apc_listings';
const APC_SYNCED_AT_KEY = 'apc_synced_at';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapStoredPosting(item: any): Posting {
  const ref = item.ref || item.referenceNumber || item.reference_number || item.id || '';
  const title = item.title || item.shortTitle || item.opportunityTitle || item.name || '';
  const desc = item.description || item.summary || '';
  const tab = classifyPosting(title, desc);
  const posting: Posting = {
    referenceNumber: ref,
    title,
    organization: item.org || item.organization || item.buyerOrganization || '',
    closingDate: item.closingDate || item.closing_date || '',
    postDate: item.postDate || item.post_date || '',
    status: item.status || 'OPEN',
    interestedCount: null,
    description: desc,
    url: `https://purchasing.alberta.ca/posting/${ref}`,
    tab,
    score: 0,
  };
  posting.score = scorePosting(posting);
  return posting;
}

function loadPostingsFromStorage(): { postings: Posting[]; syncedAt: string | null } {
  try {
    const raw = localStorage.getItem(APC_STORAGE_KEY);
    const syncedAt = localStorage.getItem(APC_SYNCED_AT_KEY);
    if (!raw) return { postings: [], syncedAt: null };
    const items = JSON.parse(raw);
    const postings = items
      .map(mapStoredPosting)
      .filter((p: Posting) => p.referenceNumber && p.title);
    return { postings, syncedAt };
  } catch {
    return { postings: [], syncedAt: null };
  }
}

async function fetchInterestedCount(ref: string): Promise<number> {
  const res = await fetch(`/api/apc?ref=${encodeURIComponent(ref)}`);
  if (!res.ok) return 0;
  const data = await res.json();
  return data.interestedCount ?? data.interestedSuppliers?.length ?? data.supplierCount ?? 0;
}

// ─── Pipeline helpers ─────────────────────────────────────────────────────────

function loadPipeline(): PipelineLead[] {
  try {
    return JSON.parse(localStorage.getItem(PIPELINE_KEY) || '[]');
  } catch {
    return [];
  }
}

function savePipeline(leads: PipelineLead[]) {
  localStorage.setItem(PIPELINE_KEY, JSON.stringify(leads));
}

// ─── Components ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#6b7280';
  return (
    <span style={{
      background: color, color: '#fff', borderRadius: 9999,
      padding: '2px 8px', fontSize: 11, fontWeight: 700,
    }}>
      {score}
    </span>
  );
}

function PostingCard({
  posting,
  onAddToPipeline,
}: {
  posting: Posting;
  onAddToPipeline: (p: Posting) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [count, setCount] = useState<number | null>(posting.interestedCount ?? null);
  const [loadingCount, setLoadingCount] = useState(false);

  const loadCount = async () => {
    if (count !== null) return;
    setLoadingCount(true);
    const n = await fetchInterestedCount(posting.referenceNumber);
    setCount(n);
    setLoadingCount(false);
  };

  const urgency = daysLeft(posting.closingDate);
  const urgent = urgency !== 'Closed' && parseInt(urgency) <= 7;

  return (
    <div style={{
      background: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: 10,
      marginBottom: 10, overflow: 'hidden',
    }}>
      <div
        style={{ padding: '12px 14px', cursor: 'pointer' }}
        onClick={() => { setExpanded(!expanded); if (!expanded) loadCount(); }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#e2e8f0', lineHeight: 1.4 }}>
              {posting.title}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
              {posting.organization}
            </div>
          </div>
          <ScoreBadge score={posting.score} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: urgent ? '#f87171' : '#94a3b8' }}>
            {urgency !== 'Closed' ? `Closes ${fmtDate(posting.closingDate)} · ` : ''}{urgency}
          </span>
          {count !== null && (
            <span style={{
              fontSize: 11, background: count === 0 ? '#065f46' : count <= 2 ? '#1e3a5f' : '#3f3f46',
              color: count === 0 ? '#6ee7b7' : count <= 2 ? '#93c5fd' : '#a1a1aa',
              borderRadius: 4, padding: '1px 6px',
            }}>
              {count === 0 ? 'No applicants yet' : `${count} interested`}
            </span>
          )}
          {count === null && (
            <button
              onClick={(e) => { e.stopPropagation(); loadCount(); }}
              style={{
                fontSize: 11, background: '#2a2a3e', color: '#94a3b8',
                border: 'none', borderRadius: 4, padding: '1px 6px', cursor: 'pointer',
              }}
            >
              {loadingCount ? 'Loading...' : 'Check applicants'}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid #2a2a3e' }}>
          {posting.description && (
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 10, lineHeight: 1.6 }}>
              {posting.description.slice(0, 400)}{posting.description.length > 400 ? '...' : ''}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <a
              href={posting.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12, color: '#3b82f6', textDecoration: 'none',
                border: '1px solid #3b82f6', borderRadius: 6, padding: '4px 10px',
              }}
            >
              View on APC ↗
            </a>
            <button
              onClick={() => onAddToPipeline(posting)}
              style={{
                fontSize: 12, color: '#10b981', background: 'none',
                border: '1px solid #10b981', borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
              }}
            >
              + Add to Pipeline
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PipelineBoard({ leads, onChange }: { leads: PipelineLead[]; onChange: (l: PipelineLead[]) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');

  const moveStage = (id: string, stage: PipelineLead['stage']) => {
    const updated = leads.map((l) => l.id === id ? { ...l, stage } : l);
    onChange(updated);
  };

  const removeLead = (id: string) => {
    onChange(leads.filter((l) => l.id !== id));
  };

  const saveNotes = (id: string) => {
    const updated = leads.map((l) => l.id === id ? { ...l, notes: editNotes } : l);
    onChange(updated);
    setEditingId(null);
  };

  const totalValue = leads
    .filter((l) => l.stage !== 'lost')
    .reduce((sum, l) => sum + (parseFloat(l.value) || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: '#94a3b8' }}>
          {leads.filter((l) => l.stage !== 'lost').length} active leads
        </div>
        <div style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>
          Pipeline value: ${totalValue.toLocaleString()}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage.key);
          return (
            <div key={stage.key} style={{ background: '#1e1e2e', borderRadius: 10, padding: 12 }}>
              <div style={{
                fontWeight: 700, fontSize: 12, color: stage.color,
                borderBottom: `2px solid ${stage.color}`, paddingBottom: 6, marginBottom: 10,
                textTransform: 'uppercase', letterSpacing: 1,
              }}>
                {stage.label} ({stageLeads.length})
              </div>

              {stageLeads.length === 0 && (
                <div style={{ fontSize: 12, color: '#4b5563', textAlign: 'center', padding: '20px 0' }}>
                  No leads
                </div>
              )}

              {stageLeads.map((lead) => (
                <div key={lead.id} style={{
                  background: '#13131f', border: '1px solid #2a2a3e',
                  borderRadius: 8, padding: 10, marginBottom: 8,
                }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#e2e8f0', lineHeight: 1.4 }}>
                    {lead.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{lead.org}</div>
                  {lead.closingDate && (
                    <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 3 }}>
                      {daysLeft(lead.closingDate)}
                    </div>
                  )}

                  {editingId === lead.id ? (
                    <div style={{ marginTop: 8 }}>
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Notes..."
                        style={{
                          width: '100%', background: '#1e1e2e', color: '#e2e8f0',
                          border: '1px solid #3b82f6', borderRadius: 4, padding: 6,
                          fontSize: 11, resize: 'vertical', minHeight: 60,
                          boxSizing: 'border-box',
                        }}
                      />
                      <button onClick={() => saveNotes(lead.id)} style={{
                        marginTop: 4, fontSize: 11, background: '#3b82f6', color: '#fff',
                        border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
                      }}>
                        Save
                      </button>
                    </div>
                  ) : (
                    lead.notes && (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, fontStyle: 'italic' }}>
                        {lead.notes}
                      </div>
                    )
                  )}

                  <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                    <a href={lead.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 10, color: '#3b82f6', textDecoration: 'none' }}>
                      APC ↗
                    </a>
                    <button
                      onClick={() => { setEditingId(lead.id); setEditNotes(lead.notes); }}
                      style={{ fontSize: 10, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Edit note
                    </button>
                    <button
                      onClick={() => removeLead(lead.id)}
                      style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Remove
                    </button>
                  </div>

                  <select
                    value={lead.stage}
                    onChange={(e) => moveStage(lead.id, e.target.value as PipelineLead['stage'])}
                    style={{
                      marginTop: 8, width: '100%', background: '#2a2a3e', color: '#e2e8f0',
                      border: '1px solid #3b3b4e', borderRadius: 4, padding: '3px 6px', fontSize: 11,
                    }}
                  >
                    {STAGES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type MainTab = 'pipeline' | 'culturemedia' | 'consulting' | 'easymoney' | 'china' | 'zero' | 'all';

const TAB_CONFIG: { key: MainTab; label: string; desc: string }[] = [
  { key: 'pipeline', label: 'Sales Pipeline', desc: 'Track your deals' },
  { key: 'culturemedia', label: 'Culture Media', desc: 'Marketing & creative' },
  { key: 'consulting', label: 'Consulting', desc: 'Strategy & advisory' },
  { key: 'easymoney', label: 'Easy Money', desc: 'Service contracts' },
  { key: 'china', label: 'China Connection', desc: 'Supply & product contracts' },
  { key: 'zero', label: '0 Competition', desc: 'No applicants yet' },
  { key: 'all', label: 'All Active', desc: 'All open listings' },
];


export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<MainTab>('pipeline');
  const [postings, setPostings] = useState<Posting[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<PipelineLead[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'closing' | 'newest' | 'applicants'>('score');
  const [filterLowComp, setFilterLowComp] = useState(false);

  useEffect(() => {
    setPipeline(loadPipeline());
    const { postings: stored, syncedAt: sa } = loadPostingsFromStorage();
    setPostings(stored);
    setSyncedAt(sa);
  }, []);

  const handlePipelineChange = (leads: PipelineLead[]) => {
    setPipeline(leads);
    savePipeline(leads);
  };

  const addToPipeline = (posting: Posting) => {
    const exists = pipeline.find((l) => l.id === posting.referenceNumber);
    if (exists) {
      alert('Already in pipeline');
      return;
    }
    const lead: PipelineLead = {
      id: posting.referenceNumber,
      title: posting.title,
      org: posting.organization,
      stage: 'reviewing',
      value: '',
      notes: '',
      url: posting.url,
      addedAt: new Date().toISOString(),
      closingDate: posting.closingDate,
    };
    const updated = [lead, ...pipeline];
    handlePipelineChange(updated);
  };

  const reloadFromStorage = () => {
    const { postings: stored, syncedAt: sa } = loadPostingsFromStorage();
    setPostings(stored);
    setSyncedAt(sa);
  };

  const filteredPostings = (tab: MainTab) => {
    // Always start with active-only listings
    let list = postings.filter(isActive);
    if (tab === 'zero') {
      list = list.filter((p) => p.interestedCount === 0);
    } else if (tab !== 'all') {
      list = list.filter((p) => p.tab === tab);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (p) => p.title.toLowerCase().includes(s) || p.organization.toLowerCase().includes(s)
      );
    }
    if (filterLowComp) {
      list = list.filter((p) => p.interestedCount !== null && p.interestedCount !== undefined && p.interestedCount <= 2);
    }
    return list.sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score;
      if (sortBy === 'closing') return (parseApcDate(a.closingDate)?.getTime() ?? 0) - (parseApcDate(b.closingDate)?.getTime() ?? 0);
      if (sortBy === 'newest') return (parseApcDate(b.postDate)?.getTime() ?? 0) - (parseApcDate(a.postDate)?.getTime() ?? 0);
      if (sortBy === 'applicants') {
        const ca = a.interestedCount ?? 999;
        const cb = b.interestedCount ?? 999;
        return ca - cb;
      }
      return 0;
    });
  };

  const tabPostings = activeTab !== 'pipeline' ? filteredPostings(activeTab) : [];
  const hasData = postings.length > 0;

  function fmtSyncTime(iso: string | null): string {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) + ' at ' +
      d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f0f1a', color: '#e2e8f0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Header */}
      <div style={{
        background: '#13131f', borderBottom: '1px solid #2a2a3e',
        padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>Culture Media</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Sales Dashboard · APC Lead Scanner</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {pipeline.filter((l) => l.stage !== 'lost').length > 0 && (
            <div style={{ fontSize: 12, color: '#10b981', background: '#065f46', borderRadius: 6, padding: '4px 10px' }}>
              {pipeline.filter((l) => l.stage !== 'lost').length} active deals
            </div>
          )}
          <a href="/" style={{ fontSize: 12, color: '#64748b', textDecoration: 'none' }}>← Site</a>
          <button
            onClick={async () => {
              await fetch('/api/dashboard-auth', { method: 'DELETE' });
              window.location.href = '/dashboard/login';
            }}
            style={{
              fontSize: 12, color: '#94a3b8', background: '#1e1e2e',
              border: '1px solid #2a2a3e', borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: '12px 24px',
        borderBottom: '1px solid #2a2a3e', background: '#13131f',
        overflowX: 'auto',
      }}>
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: activeTab === tab.key ? '#3b82f6' : '#1e1e2e',
              color: activeTab === tab.key ? '#fff' : '#94a3b8',
              fontWeight: activeTab === tab.key ? 700 : 400,
              fontSize: 13, whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
            {tab.key !== 'pipeline' && (() => {
              const active = postings.filter(isActive);
              const n = tab.key === 'all' ? active.length
                : tab.key === 'zero' ? active.filter(p => p.interestedCount === 0).length
                : active.filter(p => p.tab === tab.key).length;
              return n > 0 ? (
                <span style={{
                  marginLeft: 6, fontSize: 10, background: tab.key === 'zero' ? '#065f46' : 'rgba(255,255,255,0.2)',
                  borderRadius: 9999, padding: '1px 6px',
                }}>
                  {n}
                </span>
              ) : null;
            })()}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>

        {/* Pipeline Tab */}
        {activeTab === 'pipeline' && (
          <PipelineBoard leads={pipeline} onChange={handlePipelineChange} />
        )}

        {/* APC Tabs */}
        {activeTab !== 'pipeline' && (
          <div>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <a
                href="/dashboard/setup"
                style={{
                  background: hasData ? '#1e1e2e' : '#3b82f6',
                  color: hasData ? '#94a3b8' : '#fff',
                  border: hasData ? '1px solid #2a2a3e' : 'none',
                  borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                  fontSize: 13, textDecoration: 'none', fontWeight: hasData ? 400 : 700,
                }}
              >
                {hasData ? '↻ Re-sync APC' : '⚡ Sync APC Listings'}
              </a>
              {hasData && (
                <button
                  onClick={reloadFromStorage}
                  style={{
                    background: '#1e1e2e', color: '#64748b', border: '1px solid #2a2a3e',
                    borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12,
                  }}
                >
                  Reload
                </button>
              )}
              {syncedAt && (
                <span style={{ fontSize: 12, color: '#4b5563' }}>
                  Last synced: {fmtSyncTime(syncedAt)} · {postings.length} listings
                </span>
              )}

              <input
                type="text"
                placeholder="Search by title or org..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  background: '#1e1e2e', color: '#e2e8f0', border: '1px solid #2a2a3e',
                  borderRadius: 8, padding: '6px 12px', fontSize: 13, flex: 1, minWidth: 200,
                }}
              />

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                style={{
                  background: '#1e1e2e', color: '#e2e8f0', border: '1px solid #2a2a3e',
                  borderRadius: 8, padding: '6px 10px', fontSize: 13,
                }}
              >
                <option value="score">Sort: Best match</option>
                <option value="closing">Sort: Closing soon</option>
                <option value="newest">Sort: Newest</option>
                <option value="applicants">Sort: Fewest applicants</option>
              </select>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#94a3b8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={filterLowComp}
                  onChange={(e) => setFilterLowComp(e.target.checked)}
                  style={{ accentColor: '#3b82f6' }}
                />
                Low competition only (0–2 applicants)
              </label>
            </div>

            {/* Tab description */}
            {activeTab === 'culturemedia' && (
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                Marketing, social media, branding, design, video, communications, and digital contracts. These match Culture Media&apos;s core services.
              </p>
            )}
            {activeTab === 'consulting' && (
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                Strategy, business cases, feasibility studies, program reviews, stakeholder engagement. Winnable with a registered consulting firm.
              </p>
            )}
            {activeTab === 'easymoney' && (
              <div style={{
                background: '#13131f', border: '1px solid #2a2a3e',
                borderRadius: 10, padding: '12px 16px', marginBottom: 16,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#10b981', marginBottom: 6 }}>
                  Easy Money — Service Contracts
                </div>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
                  Cleaning, grounds, catering, security, staffing, training, printing, translation, and events.
                  Register a company + get WCB + liability insurance (~$800–2K/yr) and you can bid.
                  Low barrier, often ignored by big nationals.{' '}
                  <strong style={{ color: '#e2e8f0' }}>Sort by &ldquo;Fewest applicants&rdquo; to find the lowest competition ones.</strong>
                </p>
              </div>
            )}
            {activeTab === 'china' && (
              <div style={{
                background: 'linear-gradient(135deg, #1a2744 0%, #13131f 100%)',
                border: '1px solid #f59e0b',
                borderRadius: 10, padding: '12px 16px', marginBottom: 16,
                display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>
                <div style={{ fontSize: 24, flexShrink: 0 }}>🇨🇳</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#fbbf24', marginBottom: 6 }}>
                    China Connection — Supply &amp; Product Contracts
                  </div>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
                    Furniture, equipment, uniforms, office supplies, electronics, and goods contracts —
                    your China supplier gives you a <strong style={{ color: '#e2e8f0' }}>real cost advantage</strong> over local competitors.
                    Source at wholesale, mark up 30–50% on landed cost.{' '}
                    <strong style={{ color: '#e2e8f0' }}>Steps:</strong> incorporate a supply company,
                    get CRA business number + import account, quote the municipality, deliver.
                  </p>
                </div>
              </div>
            )}
            {activeTab === 'zero' && (
              <div style={{
                background: '#13131f', border: '1px solid #065f46',
                borderRadius: 10, padding: '12px 16px', marginBottom: 16,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#10b981', marginBottom: 6 }}>
                  0 Competition — No Applicants Yet
                </div>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
                  These listings have been checked and currently show <strong style={{ color: '#e2e8f0' }}>zero interested suppliers</strong>.
                  You would be the first to bid — highest chance of winning.
                  Click &ldquo;Check applicants&rdquo; on any listing in other tabs to populate this list.
                </p>
              </div>
            )}

            {/* Listings */}
            {!hasData && (
              <div style={{
                textAlign: 'center', padding: '60px 24px',
                background: '#13131f', borderRadius: 12, border: '1px dashed #2a2a3e',
              }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
                  No listings yet
                </div>
                <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
                  Sync APC listings from your browser using the one-click bookmarklet. Takes about 30 seconds and finds 300–500+ open contracts.
                </p>
                <a href="/dashboard/setup" style={{
                  display: 'inline-block', background: '#3b82f6', color: '#fff',
                  borderRadius: 8, padding: '10px 24px', fontWeight: 700,
                  fontSize: 14, textDecoration: 'none',
                }}>
                  Set up APC Sync →
                </a>
              </div>
            )}

            {hasData && tabPostings.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#4b5563' }}>
                No listings in this category
              </div>
            )}

            <div style={{ columns: '2 400px', gap: 12 }}>
              {tabPostings.map((p) => (
                <div key={p.referenceNumber} style={{ breakInside: 'avoid', marginBottom: 0 }}>
                  <PostingCard posting={p} onAddToPipeline={addToPipeline} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

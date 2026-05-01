'use client';

import { useState, useEffect, useCallback } from 'react';

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
  tab: 'culturemedia' | 'consulting' | 'easymoney' | 'all';
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

const EASY_MONEY_KW = [
  'cleaning', 'janitorial', 'custodial', 'grounds', 'landscaping', 'lawn',
  'snow removal', 'catering', 'coffee', 'food service', 'vending',
  'security guard', 'security service', 'staffing', 'recruitment',
  'training', 'professional development', 'printing', 'courier',
  'translation', 'interpretation', 'survey', 'data entry', 'administrative',
  'photography service', 'event', 'signage',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyPosting(title: string, desc: string): Posting['tab'] {
  const text = (title + ' ' + desc).toLowerCase();
  if (CULTURE_MEDIA_KW.some((k) => text.includes(k))) return 'culturemedia';
  if (CONSULTING_KW.some((k) => text.includes(k))) return 'consulting';
  if (EASY_MONEY_KW.some((k) => text.includes(k))) return 'easymoney';
  return 'all';
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
  const daysLeft = Math.floor(
    (new Date(posting.closingDate).getTime() - Date.now()) / 86400000
  );
  if (daysLeft > 0 && daysLeft <= 14) score += 5;
  return Math.min(100, Math.max(0, score));
}

function daysLeft(dateStr: string): string {
  const d = Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (d < 0) return 'Closed';
  if (d === 0) return 'Today';
  if (d === 1) return '1 day left';
  return `${d} days left`;
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ─── API calls ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPosting(item: any): Posting {
  const ref = item.referenceNumber || item.reference_number || item.id || '';
  const title = item.title || item.opportunityTitle || item.name || '';
  const desc = item.description || item.summary || item.shortDescription || '';
  const tab = classifyPosting(title, desc);
  const posting: Posting = {
    referenceNumber: ref,
    title,
    organization: item.organization || item.buyerOrganization || item.orgName || '',
    closingDate: item.closingDate || item.closing_date || item.closingDateTime || '',
    postDate: item.postDate || item.post_date || item.postDateTime || '',
    status: item.status || 'OPEN',
    estimatedValue: item.estimatedValue || item.contract_value,
    interestedCount: null,
    description: desc,
    url: `https://purchasing.alberta.ca/posting/${ref}`,
    tab,
    score: 0,
  };
  posting.score = scorePosting(posting);
  return posting;
}

async function fetchApcSearch(query: string, offset = 0): Promise<Posting[]> {
  const res = await fetch('/api/apc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, offset }),
  });

  if (!res.ok) return [];
  const data = await res.json();

  // APC returns results under various keys depending on version
  const raw: unknown[] =
    data.opportunities ||
    data.results ||
    data.items ||
    data.postings ||
    data.data ||
    [];

  return (raw as Record<string, unknown>[]).map(mapPosting).filter((p) => p.referenceNumber && p.title);
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

type MainTab = 'pipeline' | 'culturemedia' | 'consulting' | 'easymoney' | 'all';

const TAB_CONFIG: { key: MainTab; label: string; desc: string }[] = [
  { key: 'pipeline', label: 'Sales Pipeline', desc: 'Track your deals' },
  { key: 'culturemedia', label: 'Culture Media', desc: 'Marketing & creative' },
  { key: 'consulting', label: 'Consulting', desc: 'Strategy & advisory' },
  { key: 'easymoney', label: 'Easy Money', desc: 'Start a company & win' },
  { key: 'all', label: 'All Listings', desc: 'Everything on APC' },
];

const SEARCH_QUERIES = [
  'marketing', 'communications', 'social media', 'design', 'consulting',
  'strategy', 'research', 'training', 'cleaning', 'grounds', 'security',
  'catering', 'photography', 'video', 'printing', 'survey', 'events',
  'translation', 'administrative', 'staffing', 'branding', 'advertising',
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<MainTab>('pipeline');
  const [postings, setPostings] = useState<Posting[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [pipeline, setPipeline] = useState<PipelineLead[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'closing' | 'newest' | 'applicants'>('score');
  const [filterLowComp, setFilterLowComp] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    setPipeline(loadPipeline());
  }, []);

  // Auto-load APC listings on first mount
  useEffect(() => {
    loadAllPostings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    alert(`Added "${posting.title}" to pipeline`);
  };

  const loadAllPostings = useCallback(async (force = false) => {
    if (loading) return;
    if (hasLoaded && !force) return;
    setLoading(true);
    setLoadProgress(0);
    if (force) setPostings([]);
    const seen = new Set<string>();
    const results: Posting[] = [];

    for (let i = 0; i < SEARCH_QUERIES.length; i++) {
      const q = SEARCH_QUERIES[i];
      try {
        const items = await fetchApcSearch(q);
        for (const item of items) {
          if (item.referenceNumber && !seen.has(item.referenceNumber)) {
            seen.add(item.referenceNumber);
            results.push(item);
          }
        }
      } catch {
        // skip failed queries
      }
      setLoadProgress(Math.round(((i + 1) / SEARCH_QUERIES.length) * 100));
      setPostings([...results]);
    }

    setLoading(false);
    setHasLoaded(true);
  }, [loading, hasLoaded]);

  const filteredPostings = (tab: MainTab) => {
    let list = tab === 'all' ? postings : postings.filter((p) => p.tab === tab);
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
      if (sortBy === 'closing') return new Date(a.closingDate).getTime() - new Date(b.closingDate).getTime();
      if (sortBy === 'newest') return new Date(b.postDate).getTime() - new Date(a.postDate).getTime();
      if (sortBy === 'applicants') {
        const ca = a.interestedCount ?? 999;
        const cb = b.interestedCount ?? 999;
        return ca - cb;
      }
      return 0;
    });
  };

  const tabPostings = activeTab !== 'pipeline' ? filteredPostings(activeTab) : [];

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
            {tab.key !== 'pipeline' && postings.filter((p) => tab.key === 'all' || p.tab === tab.key).length > 0 && (
              <span style={{
                marginLeft: 6, fontSize: 10, background: 'rgba(255,255,255,0.2)',
                borderRadius: 9999, padding: '1px 6px',
              }}>
                {tab.key === 'all' ? postings.length : postings.filter((p) => p.tab === tab.key).length}
              </span>
            )}
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
              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>
                    Scanning APC... {loadProgress}%
                  </div>
                  <div style={{
                    width: 120, height: 6, background: '#2a2a3e', borderRadius: 3,
                  }}>
                    <div style={{
                      width: `${loadProgress}%`, height: '100%',
                      background: '#3b82f6', borderRadius: 3, transition: 'width 0.3s',
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{postings.length} found</span>
                </div>
              )}

              {hasLoaded && (
                <button
                  onClick={() => loadAllPostings(true)}
                  style={{
                    background: '#1e1e2e', color: '#94a3b8', border: '1px solid #2a2a3e',
                    borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13,
                  }}
                >
                  Refresh
                </button>
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
                Strategy, business cases, feasibility studies, program reviews, stakeholder engagement. Winnable with an MBA and a registered consulting firm.
              </p>
            )}
            {activeTab === 'easymoney' && (
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                Contracts you could win by starting a new company — cleaning, grounds, catering, security, training, printing, and similar. Low barrier to entry, often low competition from large nationals.
              </p>
            )}

            {/* Listings */}
            {!hasLoaded && !loading && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#4b5563' }}>
                Loading Alberta purchasing opportunities...
              </div>
            )}

            {tabPostings.length === 0 && (hasLoaded || loading) && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#4b5563' }}>
                {loading ? 'Loading...' : 'No matching listings found'}
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

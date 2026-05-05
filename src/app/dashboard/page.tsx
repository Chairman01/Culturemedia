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
  // Core creative services
  'photography', 'videography', 'video production', 'photo', 'video',
  // Digital & social
  'digital marketing', 'social media', 'social media management', 'online marketing',
  // Marketing & advertising
  'marketing', 'advertising', 'media buy', 'paid media', 'media placement',
  'media relations', 'media campaign', 'media services',
  // Communications
  'communications', 'communications plan', 'communications strategy', 'communications services',
  'public relations', 'pr services', 'media relations',
  // Content & creative
  'content creation', 'content strategy', 'content development', 'copywriting',
  'brand', 'branding', 'creative services', 'creative direction',
  // Campaigns & channels
  'campaign', 'email marketing', 'newsletter', 'seo', 'ppc', 'digital strategy',
  'influencer', 'storytelling', 'graphic design',
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
  const status = String(p.status || '').toUpperCase();
  if (['CLOSED', 'AWARDED', 'CANCELLED', 'EXPIRED', 'AWARDED/CLOSED', 'CLOSED TO SUBMISSIONS', 'AWARD'].includes(status)) return false;
  const closeDate = parseApcDate(p.closingDate);
  if (closeDate && closeDate.getTime() < Date.now()) return false;
  // No closing date — fall back to post date: hide listings posted >120 days ago
  if (!closeDate) {
    const postDate = parseApcDate(p.postDate);
    if (postDate && postDate.getTime() < Date.now() - 120 * 86400000) return false;
  }
  return true;
}

function scorePosting(posting: Posting): number {
  let score = 35; // base
  const t = posting.title.toLowerCase();
  const org = (posting.organization || '').toLowerCase();
  const tab = posting.tab;

  // ── Tab relevance ──
  if (tab === 'culturemedia') score += 12;
  if (tab === 'consulting')   score += 8;
  if (tab === 'easymoney')    score += 10;
  if (tab === 'china')        score += 10;

  // ── Contract format (biggest differentiator) ──
  if (/\brfq\b|request for quote|request for quotation/.test(t)) score += 22; // easiest format
  if (/\brfso\b|standing offer|standing agreement/.test(t))      score += 15; // recurring revenue
  if (/\bacan\b/.test(t))                                         score -= 20; // pre-selected
  if (/\brfp\b|request for proposal/.test(t))                    score += 2;  // standard

  // ── Work simplicity signals ──
  if (/\bsupply of\b|\bpurchase of\b|\bprovision of\b|\bprocurement of\b/.test(t)) score += 12;
  if (/\bannual\b|\bongoing\b|\brecurring\b|\bmaintenance\b/.test(t)) score += 7;
  if (/\bbasic\b|\bstandard\b|\broutine\b/.test(t))               score += 5;

  // ── Complexity penalty ──
  if (/\bintegrated\b|\benterprise\b|\bplatform\b|\bsystem\b|\binfrastructure\b/.test(t)) score -= 8;
  if (/\bstrategy\b.*\bdigital\b|\btransformation\b/.test(t))    score -= 5;

  // ── Organization size / type ──
  // Small municipalities = less competition from big nationals
  if (/\b(town of|village of|county of|md of|municipal district of|summer village|city of [a-z]+ \(small\))\b/.test(org)) score += 16;
  if (/\bcounty\b|\bmunicipality\b|\btown\b|\bvillage\b|\bmd of\b/.test(org)) score += 10;
  if (/\bcity of\b/.test(org)) score += 4;
  if (/\balberta health\b|\bahs\b|\buniversity\b|\bgovernment of alberta\b/.test(org)) score -= 6;
  if (/\bschool\b|\bschool division\b|\bschool board\b/.test(org)) score += 6;

  // ── Competition (when count is loaded) ──
  const count = posting.interestedCount;
  if (count === 0)                                                score += 30;
  else if (count === 1)                                           score += 20;
  else if (count === 2)                                           score += 12;
  else if (count === 3)                                           score += 5;
  else if (count !== null && count !== undefined && count > 5)   score -= 15;

  // ── Timing ──
  const parsed = parseApcDate(posting.closingDate);
  if (parsed) {
    const d = Math.floor((parsed.getTime() - Date.now()) / 86400000);
    if (d >= 21)      score += 8;  // plenty of time to prepare
    else if (d >= 7)  score += 4;  // manageable
    else              score -= 5;  // too rushed
  }

  return Math.min(100, Math.max(0, score));
}

/** Auto-generates a short "why this is a good opportunity" blurb */
function generateInsight(posting: Posting): string {
  const t = posting.title.toLowerCase();
  const org = (posting.organization || '').toLowerCase();
  const tips: string[] = [];

  // ── Culture Media specific matches ──
  if (posting.tab === 'culturemedia') {
    if (/\bvideography\b|\bvideo production\b/.test(t)) {
      tips.push('Video production contract — direct match for Culture Media\'s capabilities');
    } else if (/\bphotography\b|\bphoto\b/.test(t)) {
      tips.push('Photography contract — Culture Media can deliver professional creative content');
    } else if (/\bdigital marketing\b|\bsocial media\b/.test(t)) {
      tips.push('Digital/social marketing — aligns with Culture Media\'s core expertise');
    } else if (/\bcommunications\b/.test(t)) {
      tips.push('Communications contract — Culture Media delivers strategic messaging & content');
    } else if (/\bmedia buy\b|\bpaid media\b|\badvertising\b/.test(t)) {
      tips.push('Paid media contract — Culture Media can plan & execute the campaign');
    } else if (/\bbranding\b|\bbrand\b/.test(t)) {
      tips.push('Branding contract — creative identity work in Culture Media\'s wheelhouse');
    } else if (/\bmarketing\b/.test(t)) {
      tips.push('Marketing contract — a natural fit for Culture Media\'s services');
    }
  }

  // Contract format
  if (/\brfq\b|request for quote|request for quotation/.test(t)) {
    tips.push('RFQ format — just submit a price, no full proposal needed');
  } else if (/\brfso\b|standing offer|standing agreement/.test(t)) {
    tips.push('Standing offer = recurring revenue over 1–3 years');
  } else if (/\bacan\b/.test(t)) {
    tips.push('ACAN — supplier likely pre-selected, low chance of winning');
  }

  // Work type (non-culture-media)
  if (posting.tab !== 'culturemedia') {
    if (/\bsupply of\b|\bpurchase of\b|\bprovision of\b/.test(t)) {
      tips.push('Supply/purchase contract — source the product and deliver');
    } else if (/\bcleaning\b|\bjanitorial\b|\bcustodial\b/.test(t)) {
      tips.push('Cleaning contract — company + WCB + insurance = you can bid');
    } else if (/\btraining\b|\bworkshop\b/.test(t)) {
      tips.push('Training contract — deliver content, no complex deliverables');
    } else if (/\btranslation\b|\binterpretation\b/.test(t)) {
      tips.push('Translation contract — subcontract to certified translators easily');
    } else if (/\bprinting\b|\bsignage\b/.test(t)) {
      tips.push('Print/signage — broker it, you don\'t need to own equipment');
    }
  }

  // Org size
  if (/\b(town of|village of|md of|municipal district|summer village)\b/.test(org)) {
    tips.push('Small municipality — large contractors usually skip these');
  } else if (/\bcounty\b|\btown\b|\bvillage\b/.test(org)) {
    tips.push('Small/mid municipality — less competition than major city');
  } else if (/\bschool\b/.test(org)) {
    tips.push('School board — steady, predictable client');
  } else if (/\balberta health\b|\bahs\b/.test(org)) {
    tips.push('AHS contract — high scrutiny, expect strong competition');
  }

  // Recurring / annual
  if (/\bannual\b|\brecurring\b|\bongoing\b/.test(t) && !tips.some(x => x.includes('recurring'))) {
    tips.push('Recurring/annual contract — wins keep paying year after year');
  }

  // Competition
  if (posting.interestedCount === 0) {
    tips.push('Zero suppliers registered — you would be the only bidder');
  } else if (posting.interestedCount === 1) {
    tips.push('Only 1 competitor registered so far');
  } else if (posting.interestedCount === 2) {
    tips.push('Only 2 competitors — still very winnable');
  }

  // Timing
  const closeDate = parseApcDate(posting.closingDate);
  if (closeDate) {
    const days = Math.floor((closeDate.getTime() - Date.now()) / 86400000);
    if (days >= 28) tips.push(`${days} days to prepare — enough time for a strong bid`);
    else if (days <= 5) tips.push(`Only ${days} day${days === 1 ? '' : 's'} left — act now`);
  }

  return tips.slice(0, 2).join(' · ');
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
    status: String(item.status || 'OPEN'),
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
    const seen = new Set<string>();
    const postings = items
      .map(mapStoredPosting)
      .filter((p: Posting) => {
        if (!p.referenceNumber || !p.title) return false;
        if (seen.has(p.referenceNumber)) return false;
        seen.add(p.referenceNumber);
        return true;
      });
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
  const color = score >= 75 ? '#10b981' : score >= 55 ? '#f59e0b' : '#ef4444';
  const label = score >= 75 ? 'Hot' : score >= 55 ? 'Good' : 'Tough';
  return (
    <span style={{
      background: color, color: '#fff', borderRadius: 6,
      padding: '2px 8px', fontSize: 11, fontWeight: 700,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minWidth: 38, textAlign: 'center', flexShrink: 0,
    }}>
      <span>{score}</span>
      <span style={{ fontSize: 9, opacity: 0.85, letterSpacing: 0.3 }}>{label}</span>
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
  const scoreColor = posting.score >= 75 ? '#10b981' : posting.score >= 55 ? '#f59e0b' : '#ef4444';

  const insight = generateInsight(posting);
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderLeft: `4px solid ${scoreColor}`,
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div
        style={{ padding: '14px 16px', cursor: 'pointer', flex: 1 }}
        onClick={() => { setExpanded(!expanded); if (!expanded) loadCount(); }}
      >
        {/* Header row: title + score badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a', lineHeight: 1.4 }}>
              {posting.title}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, fontWeight: 500 }}>
              {posting.organization}
            </div>
          </div>
          <ScoreBadge score={posting.score} />
        </div>

        {/* Insight line */}
        {insight && (
          <div style={{
            fontSize: 12, color: '#059669', marginTop: 8,
            background: '#f0fdf4', borderRadius: 6,
            padding: '5px 9px', lineHeight: 1.5,
            borderLeft: '3px solid #10b981',
          }}>
            💡 {insight}
          </div>
        )}

        {/* Meta row: closing date + competition */}
        <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            fontSize: 11, color: urgent ? '#dc2626' : '#64748b',
            background: urgent ? '#fef2f2' : '#f1f5f9',
            borderRadius: 5, padding: '3px 8px',
            border: `1px solid ${urgent ? '#fecaca' : '#e2e8f0'}`,
            fontWeight: urgent ? 600 : 400,
          }}>
            📅 {urgency !== 'Closed' ? `${fmtDate(posting.closingDate)} · ` : ''}{urgency}
          </span>
          {count !== null && (
            <span style={{
              fontSize: 11, borderRadius: 5, padding: '3px 8px', border: '1px solid',
              background: count === 0 ? '#f0fdf4' : count <= 2 ? '#eff6ff' : '#f8fafc',
              color: count === 0 ? '#16a34a' : count <= 2 ? '#2563eb' : '#64748b',
              borderColor: count === 0 ? '#bbf7d0' : count <= 2 ? '#bfdbfe' : '#e2e8f0',
              fontWeight: count === 0 ? 600 : 400,
            }}>
              {count === 0 ? '🏆 No applicants yet' : `👥 ${count} interested`}
            </span>
          )}
          {count === null && (
            <button
              onClick={(e) => { e.stopPropagation(); loadCount(); }}
              style={{
                fontSize: 11, background: '#f8fafc', color: '#64748b',
                border: '1px solid #e2e8f0', borderRadius: 5, padding: '3px 8px', cursor: 'pointer',
              }}
            >
              {loadingCount ? '⏳ Loading...' : 'Check applicants'}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '10px 14px 14px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
          {posting.description && (
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 0, marginBottom: 10, lineHeight: 1.6 }}>
              {posting.description.slice(0, 400)}{posting.description.length > 400 ? '...' : ''}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={posting.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12, color: '#2563eb', textDecoration: 'none',
                border: '1px solid #bfdbfe', borderRadius: 6, padding: '5px 12px',
                background: '#eff6ff', fontWeight: 500,
              }}
            >
              View on APC ↗
            </a>
            <button
              onClick={() => onAddToPipeline(posting)}
              style={{
                fontSize: 12, color: '#fff', background: '#000',
                border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontWeight: 600,
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
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 20px', minWidth: 140 }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Active Leads</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{leads.filter(l => l.stage !== 'lost').length}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 20px', minWidth: 140 }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Pipeline Value</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>${totalValue.toLocaleString()}</div>
        </div>
        {STAGES.filter(s => s.key !== 'lost').map(s => (
          <div key={s.key} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 20px', minWidth: 100 }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{leads.filter(l => l.stage === s.key).length}</div>
          </div>
        ))}
      </div>

      {/* Kanban board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage.key);
          return (
            <div key={stage.key} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
              <div style={{
                fontWeight: 700, fontSize: 11, color: stage.color,
                borderBottom: `2px solid ${stage.color}`, paddingBottom: 6, marginBottom: 10,
                textTransform: 'uppercase', letterSpacing: 1,
              }}>
                {stage.label} ({stageLeads.length})
              </div>

              {stageLeads.length === 0 && (
                <div style={{ fontSize: 12, color: '#cbd5e1', textAlign: 'center', padding: '20px 0' }}>
                  No leads
                </div>
              )}

              {stageLeads.map((lead) => (
                <div key={lead.id} style={{
                  background: '#fff', border: '1px solid #e2e8f0',
                  borderRadius: 8, padding: 10, marginBottom: 8,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a', lineHeight: 1.4 }}>
                    {lead.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{lead.org}</div>
                  {lead.closingDate && (
                    <div style={{
                      fontSize: 11, marginTop: 4,
                      color: '#d97706', background: '#fffbeb',
                      borderRadius: 4, padding: '1px 6px', display: 'inline-block',
                    }}>
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
                          width: '100%', background: '#fff', color: '#0f172a',
                          border: '1px solid #94a3b8', borderRadius: 4, padding: 6,
                          fontSize: 11, resize: 'vertical', minHeight: 60,
                          boxSizing: 'border-box',
                        }}
                      />
                      <button onClick={() => saveNotes(lead.id)} style={{
                        marginTop: 4, fontSize: 11, background: '#000', color: '#fff',
                        border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontWeight: 600,
                      }}>
                        Save
                      </button>
                    </div>
                  ) : (
                    lead.notes && (
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, fontStyle: 'italic', lineHeight: 1.4 }}>
                        {lead.notes}
                      </div>
                    )
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                    <a href={lead.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
                      APC ↗
                    </a>
                    <button
                      onClick={() => { setEditingId(lead.id); setEditNotes(lead.notes); }}
                      style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Note
                    </button>
                    <button
                      onClick={() => removeLead(lead.id)}
                      style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Remove
                    </button>
                  </div>

                  <select
                    value={lead.stage}
                    onChange={(e) => moveStage(lead.id, e.target.value as PipelineLead['stage'])}
                    style={{
                      marginTop: 8, width: '100%', background: '#fff', color: '#0f172a',
                      border: '1px solid #e2e8f0', borderRadius: 4, padding: '4px 6px', fontSize: 11,
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

  const NAV_ICONS: Record<MainTab, string> = {
    pipeline: '📊', culturemedia: '✨', consulting: '💼',
    easymoney: '💰', china: '🇨🇳', zero: '🎯', all: '📋',
  };

  const getTabCount = (key: MainTab) => {
    const active = postings.filter(isActive);
    if (key === 'pipeline') return pipeline.filter(l => l.stage !== 'lost').length;
    if (key === 'all') return active.length;
    if (key === 'zero') return active.filter(p => p.interestedCount === 0).length;
    return active.filter(p => p.tab === key).length;
  };

  const currentTabConfig = TAB_CONFIG.find(t => t.key === activeTab);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* ── SIDEBAR ── */}
      <div style={{
        width: 220, background: '#111', color: '#fff', flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 100, overflowY: 'auto',
      }}>
        {/* Brand */}
        <div style={{ padding: '22px 18px 14px' }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', letterSpacing: -0.3 }}>Culture Media</div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Sales Dashboard</div>
        </div>

        <div style={{ height: 1, background: '#222', margin: '0 14px' }} />

        {/* Pipeline section */}
        <div style={{ padding: '10px 8px 4px' }}>
          <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, padding: '4px 10px 6px' }}>Pipeline</div>
          {TAB_CONFIG.filter(t => t.key === 'pipeline').map(tab => {
            const n = getTabCount(tab.key);
            const on = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '8px 10px', marginBottom: 2,
                background: on ? '#fff' : 'transparent',
                color: on ? '#000' : '#aaa',
                border: 'none', borderRadius: 7, cursor: 'pointer',
                fontSize: 13, fontWeight: on ? 700 : 400, textAlign: 'left',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{NAV_ICONS[tab.key]}</span>{tab.label}
                </span>
                {n > 0 && <span style={{ fontSize: 10, background: on ? '#000' : '#333', color: on ? '#fff' : '#888', borderRadius: 9999, padding: '1px 6px' }}>{n}</span>}
              </button>
            );
          })}
        </div>

        {/* APC Leads section */}
        <div style={{ padding: '4px 8px' }}>
          <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, padding: '4px 10px 6px' }}>APC Leads</div>
          {TAB_CONFIG.filter(t => t.key !== 'pipeline').map(tab => {
            const n = getTabCount(tab.key);
            const on = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '8px 10px', marginBottom: 2,
                background: on ? '#fff' : 'transparent',
                color: on ? '#000' : '#aaa',
                border: 'none', borderRadius: 7, cursor: 'pointer',
                fontSize: 13, fontWeight: on ? 700 : 400, textAlign: 'left',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{NAV_ICONS[tab.key]}</span>{tab.label}
                </span>
                {n > 0 && (
                  <span style={{
                    fontSize: 10, borderRadius: 9999, padding: '1px 6px',
                    background: on ? (tab.key === 'zero' ? '#16a34a' : '#000') : '#333',
                    color: on ? '#fff' : (tab.key === 'zero' ? '#4ade80' : '#888'),
                  }}>{n}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sync */}
        <div style={{ padding: '4px 8px' }}>
          <div style={{ height: 1, background: '#222', margin: '8px 6px 10px' }} />
          <a href="/dashboard/setup" style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
            background: hasData ? 'transparent' : '#1d4ed8',
            color: hasData ? '#aaa' : '#fff',
            borderRadius: 7, textDecoration: 'none', fontSize: 13, marginBottom: 2,
          }}>
            <span>⚡</span>{hasData ? 'Re-sync APC' : 'Sync APC'}
          </a>
          {syncedAt && (
            <div style={{ fontSize: 10, color: '#444', padding: '2px 10px 6px', lineHeight: 1.5 }}>
              {fmtSyncTime(syncedAt)}<br />{postings.length} total listings
            </div>
          )}
        </div>

        {/* Bottom */}
        <div style={{ marginTop: 'auto', padding: '8px 8px 16px', borderTop: '1px solid #222' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', color: '#666', textDecoration: 'none', fontSize: 13, borderRadius: 7 }}>
            ← View Site
          </a>
          <button
            onClick={async () => { await fetch('/api/dashboard-auth', { method: 'DELETE' }); window.location.href = '/dashboard/login'; }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', color: '#666', background: 'none', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, textAlign: 'left' }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ marginLeft: 220, flex: 1, background: '#f8fafc', minHeight: '100vh' }}>

        {/* Top bar */}
        <div style={{
          background: '#fff', borderBottom: '1px solid #e2e8f0',
          padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {currentTabConfig?.label}
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>
              {activeTab !== 'pipeline'
                ? `${tabPostings.length} active listing${tabPostings.length !== 1 ? 's' : ''} · ${currentTabConfig?.desc}`
                : `${pipeline.filter(l => l.stage !== 'lost').length} active deals · Welcome back, Adam`
              }
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {hasData && activeTab !== 'pipeline' && (
              <button onClick={reloadFromStorage} style={{
                fontSize: 13, color: '#64748b', background: '#fff',
                border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 16px', cursor: 'pointer',
              }}>
                Refresh
              </button>
            )}
            {pipeline.filter(l => l.stage !== 'lost').length > 0 && activeTab !== 'pipeline' && (
              <button onClick={() => setActiveTab('pipeline')} style={{
                fontSize: 13, color: '#fff', background: '#000',
                border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontWeight: 700,
              }}>
                View Pipeline ({pipeline.filter(l => l.stage !== 'lost').length})
              </button>
            )}
          </div>
        </div>

        {/* Page content */}
        <div style={{ padding: '24px 32px' }}>

          {/* ── Pipeline ── */}
          {activeTab === 'pipeline' && (
            <PipelineBoard leads={pipeline} onChange={handlePipelineChange} />
          )}

          {/* ── APC Lead tabs ── */}
          {activeTab !== 'pipeline' && (
            <div>
              {/* Info banners */}
              {activeTab === 'easymoney' && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', marginBottom: 16, borderLeft: '4px solid #16a34a' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#15803d', marginBottom: 4 }}>Easy Money — Service Contracts</div>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
                    Cleaning, grounds, catering, security, staffing, training, printing, and events. Register a company + WCB + liability insurance (~$800–2K/yr) and you can bid. <strong style={{ color: '#0f172a' }}>Sort by &ldquo;Fewest applicants&rdquo;</strong> to find the easiest wins.
                  </p>
                </div>
              )}
              {activeTab === 'china' && (
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12 }}>
                  <div style={{ fontSize: 22, flexShrink: 0 }}>🇨🇳</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e', marginBottom: 4 }}>China Connection — Supply &amp; Product Contracts</div>
                    <p style={{ fontSize: 12, color: '#78350f', margin: 0, lineHeight: 1.6 }}>
                      Furniture, equipment, uniforms, electronics, and goods — your supplier gives you a <strong>real cost advantage</strong>. Source at wholesale, mark up 30–50% on landed cost. Steps: incorporate a supply company, get CRA business number + import account, quote the municipality, deliver.
                    </p>
                  </div>
                </div>
              )}
              {activeTab === 'zero' && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#15803d', marginBottom: 4 }}>0 Competition — No Applicants Yet</div>
                  <p style={{ fontSize: 12, color: '#166534', margin: 0, lineHeight: 1.6 }}>
                    These listings have <strong>zero interested suppliers</strong> — you would be the only bidder. Click &ldquo;Check applicants&rdquo; on any card in other tabs to populate this list.
                  </p>
                </div>
              )}

              {/* Toolbar */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Search listings..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0',
                    borderRadius: 8, padding: '7px 12px', fontSize: 13, flex: 1, minWidth: 200,
                  }}
                />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 10px', fontSize: 13 }}
                >
                  <option value="score">Best match</option>
                  <option value="closing">Closing soon</option>
                  <option value="newest">Newest</option>
                  <option value="applicants">Fewest applicants</option>
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', cursor: 'pointer', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 12px' }}>
                  <input type="checkbox" checked={filterLowComp} onChange={(e) => setFilterLowComp(e.target.checked)} style={{ accentColor: '#000' }} />
                  Low competition only
                </label>
              </div>

              {/* No data state */}
              {!hasData && (
                <div style={{ textAlign: 'center', padding: '60px 24px', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>No listings yet</div>
                  <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
                    Sync APC listings using the one-click bookmarklet. Finds 300–500+ open government contracts in ~30 seconds.
                  </p>
                  <a href="/dashboard/setup" style={{ display: 'inline-block', background: '#000', color: '#fff', borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                    Set up APC Sync →
                  </a>
                </div>
              )}

              {hasData && tabPostings.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', color: '#94a3b8' }}>
                  No listings in this category{activeTab === 'zero' ? ' — check applicants on other listings first' : ''}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 10 }}>
                {tabPostings.map((p) => (
                  <PostingCard key={p.referenceNumber} posting={p} onAddToPipeline={addToPipeline} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

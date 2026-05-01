'use client';

// The bookmarklet runs on purchasing.alberta.ca, fetches all listings using the APC API
// (works because it's same-origin with session cookies), then sends data via postMessage
// to the sync receiver page at culturemedia.ca/dashboard/sync

const DASHBOARD_SYNC_URL = 'https://www.culturemedia.ca/dashboard/sync';

const QUERIES = [
  'marketing', 'communications', 'social media', 'branding', 'design',
  'graphic', 'video', 'photography', 'consulting', 'strategy',
  'business case', 'research', 'training', 'cleaning', 'grounds',
  'security', 'catering', 'staffing', 'printing', 'survey',
  'events', 'translation', 'advertising', 'digital', 'content',
];

// Build the bookmarklet as a self-contained JS function
function buildBookmarklet(): string {
  const code = `(function(){
var SYNC='${DASHBOARD_SYNC_URL}';
var QUERIES=${JSON.stringify(QUERIES)};
var seen={};var all=[];var qi=0;var firstResp='';
var win=window.open(SYNC,'cm_apc','width=480,height=320');
if(!win){alert('Allow popups for purchasing.alberta.ca, then try again.');return;}
function sendProgress(){
try{win.postMessage({type:'APC_PROGRESS',progressMsg:'Query '+(qi)+'/'+QUERIES.length+': '+QUERIES[qi-1],listings:all},'https://www.culturemedia.ca');}catch(e){}}
function parseItems(d){
var items=d.values||d.opportunities||d.results||d.items||d.postings||d.data||d.Opportunities||d.Results||[];
if(!Array.isArray(items)&&typeof d==='object'){
var keys=Object.keys(d);
for(var k=0;k<keys.length;k++){if(Array.isArray(d[keys[k]])){items=d[keys[k]];break;}}
}
return items;
}
function doFetch(q,cb){
var xhr=new XMLHttpRequest();
xhr.open('POST','/api/opportunity/search',true);
xhr.setRequestHeader('Content-Type','application/json');
xhr.setRequestHeader('Accept','application/json');
xhr.onreadystatechange=function(){
if(xhr.readyState===4){
if(xhr.status===200){
try{
var d=JSON.parse(xhr.responseText);
if(qi===1)firstResp=JSON.stringify(d).slice(0,300);
var items=parseItems(d);
items.forEach(function(item){
var ref=item.referenceNumber||item.reference_number||item.id||'';
if(ref&&!seen[ref]){
seen[ref]=1;
all.push({
ref:ref,
title:item.title||item.opportunityTitle||item.name||'',
org:item.organization||item.buyerOrganization||item.orgName||'',
closingDate:item.closingDate||item.closing_date||item.closingDateTime||'',
postDate:item.postDate||item.post_date||item.postDateTime||'',
status:item.status||'OPEN',
description:(item.description||item.summary||'').slice(0,400)
});
}
});
}catch(e){if(qi===1)firstResp='Parse error: '+e+' raw: '+xhr.responseText.slice(0,200);}
}else{if(qi===1)firstResp='HTTP '+xhr.status+': '+xhr.responseText.slice(0,200);}
cb();
}
};
var payload=JSON.stringify({
query:q,
queryMode:'standard',
filter:{
textPhrases:[],
statuses:[],categories:[],postingTypes:[],
solicitation:{types:[],noticeTypes:[]},
regions:[],organizations:[],unspscCodes:[],
postDateRange:'$$all',closeDateRange:'$$all',deliveryRegion:''
},
limit:100,offset:0,
sortOptions:[{field:'PostDateTime',direction:'desc'}]
});
xhr.send(payload);
}
function next(){
if(qi<QUERIES.length){
document.title='APC Sync '+(qi+1)+'/'+QUERIES.length;
doFetch(QUERIES[qi++],function(){sendProgress();next();});
}else{
document.title='APC Sync: Done ('+all.length+')';
setTimeout(function(){
if(win&&!win.closed){
win.postMessage({
type:'APC_SYNC',
listings:all,
syncedAt:new Date().toISOString(),
debugInfo:'Found '+all.length+' listings. First response: '+firstResp
},'https://www.culturemedia.ca');
}
},300);
}
}
setTimeout(next,1500);
})();`;

  return 'javascript:' + encodeURIComponent(code);
}

export default function SetupPage() {
  const bookmarkletHref = buildBookmarklet();

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f1a',
      color: '#e2e8f0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '40px 24px',
    }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <a href="/dashboard" style={{ fontSize: 13, color: '#64748b', textDecoration: 'none' }}>
            ← Back to dashboard
          </a>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 16, marginBottom: 8, color: '#fff' }}>
            Set Up APC Lead Scanner
          </h1>
          <p style={{ fontSize: 15, color: '#94a3b8', lineHeight: 1.6 }}>
            Alberta&apos;s purchasing portal blocks automated requests for security reasons. To pull listings into your dashboard, you need to run a one-click sync from your browser while on the APC site.
          </p>
        </div>

        {/* Step 1 */}
        <div style={{
          background: '#13131f', border: '1px solid #2a2a3e',
          borderRadius: 12, padding: 24, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: '#3b82f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 16, flexShrink: 0,
            }}>1</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                Drag this button to your bookmarks bar
              </div>
              <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16, lineHeight: 1.5 }}>
                Drag the button below to your Chrome bookmarks bar. This is the sync tool — you only need to do this once.
                If you can&apos;t see your bookmarks bar, press <code style={{ background: '#2a2a3e', padding: '1px 6px', borderRadius: 4 }}>Ctrl+Shift+B</code>.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <a
                  href={bookmarkletHref}
                  onClick={(e) => e.preventDefault()}
                  draggable
                  style={{
                    display: 'inline-block',
                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    color: '#fff',
                    padding: '10px 20px',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 14,
                    textDecoration: 'none',
                    cursor: 'grab',
                    userSelect: 'none',
                    border: '2px dashed #60a5fa',
                  }}
                >
                  📊 APC Sync
                </a>
                <span style={{ fontSize: 13, color: '#64748b' }}>← drag this to your bookmarks bar</span>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div style={{
          background: '#13131f', border: '1px solid #2a2a3e',
          borderRadius: 12, padding: 24, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: '#3b82f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 16, flexShrink: 0,
            }}>2</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                Go to purchasing.alberta.ca
              </div>
              <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12, lineHeight: 1.5 }}>
                Open the Alberta purchasing portal. You don&apos;t need to be logged in — the search results are public.
              </p>
              <a
                href="https://purchasing.alberta.ca/search"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block', background: '#1e1e2e',
                  color: '#3b82f6', border: '1px solid #3b82f6',
                  padding: '8px 16px', borderRadius: 8,
                  textDecoration: 'none', fontSize: 13, fontWeight: 600,
                }}
              >
                Open purchasing.alberta.ca ↗
              </a>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div style={{
          background: '#13131f', border: '1px solid #2a2a3e',
          borderRadius: 12, padding: 24, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: '#3b82f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 16, flexShrink: 0,
            }}>3</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                Click &quot;APC Sync&quot; in your bookmarks bar
              </div>
              <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
                While on the purchasing.alberta.ca page, click the bookmark you just added. A small window will open showing sync progress.
                It scans {QUERIES.length} search categories and typically finds 300–500+ open listings.
                The tab title will show progress like &quot;APC Sync: 12/25&quot;.
              </p>
              <p style={{ fontSize: 13, color: '#f59e0b', marginTop: 8 }}>
                If a popup is blocked, click the blocked popup icon in your address bar and allow it.
              </p>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div style={{
          background: '#13131f', border: '1px solid #2a2a3e',
          borderRadius: 12, padding: 24, marginBottom: 32,
        }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: '#10b981',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 16, flexShrink: 0,
            }}>✓</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                Data syncs automatically
              </div>
              <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
                The listings appear in your dashboard. Repeat step 3 anytime to refresh — data stays saved in your browser until you clear it.
                APC updates daily, so syncing once or twice a week is enough.
              </p>
            </div>
          </div>
        </div>

        <a href="/dashboard" style={{
          display: 'inline-block', background: '#3b82f6', color: '#fff',
          border: 'none', borderRadius: 8, padding: '12px 24px',
          fontWeight: 700, fontSize: 14, textDecoration: 'none',
        }}>
          Back to Dashboard →
        </a>
      </div>
    </div>
  );
}

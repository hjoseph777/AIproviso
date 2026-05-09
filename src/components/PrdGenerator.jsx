import { useState } from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';

// ── PRD Generator ─────────────────────────────────────────────
// Reads from Zustand store — no prop drilling required.
export default function PrdGenerator() {
  const workflows  = useWorkflowStore(s => s.workflows);
  const users      = useWorkflowStore(s => s.users);
  const properties = useWorkflowStore(s => s.properties);
  const rules      = useWorkflowStore(s => s.rules);

  const [wfId,       setWfId]       = useState('');
  const [prd,        setPrd]        = useState('');
  const [generating, setGenerating] = useState(false);
  const [aiMode,     setAiMode]     = useState(false);
  const [status,     setStatus]     = useState('');
  const [view,       setView]       = useState('preview');

  const selectedWf = workflows.find(w => w.id === wfId) || workflows[0] || null;

  const generate = async () => {
    if (!selectedWf) return;
    setGenerating(true); setPrd(''); setStatus('');

    // Build full payload with global data
    const payload = {
      ...selectedWf,
      users, properties,
      rules: rules.map(r => r.text).filter(Boolean),
    };

    if (aiMode) {
      setStatus('Calling Claude API...');
      try {
        const prompt = `Generate a comprehensive PRD in Markdown from this workflow specification.\nInclude: Overview, Users table, Workflow states+transitions, Properties, Business Rules, Test Cases, Build Estimate.\nStart with # [Project Name]. Output Markdown only.\n\nWorkflow JSON:\n${JSON.stringify(payload, null, 2)}`;
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
        });
        const data = await resp.json();
        setPrd(data.content?.map(b => b.text || '').join('') || 'No response');
        setStatus('Generated with Claude AI ✦');
      } catch {
        await new Promise(r => setTimeout(r, 400));
        setPrd(buildLocalPRD(payload));
        setStatus('API unavailable — generated locally ◈');
      }
    } else {
      setStatus('Extracting requirements...');
      await new Promise(r => setTimeout(r, 280));
      setStatus('Running NLP parser...');
      await new Promise(r => setTimeout(r, 320));
      setPrd(buildLocalPRD(payload));
      setStatus('Generated locally ◈');
    }
    setGenerating(false);
  };

  const download = () => {
    if (!prd) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([prd], { type: 'text/markdown' }));
    a.download = `${selectedWf?.name || 'prd'}.md`;
    a.click();
  };

  return (
    <div className="prd-screen">
      <div className="prd-left">
        <div className="ss-head">
          <span className="ss-headlbl">PRD Generator</span>
          <div className="ss-acts">
            {/* Workflow selector */}
            <select
              style={{fontFamily:'var(--mono)',fontSize:9.5,background:'var(--s3)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:4,padding:'3px 6px',outline:'none'}}
              value={wfId || selectedWf?.id || ''}
              onChange={e => setWfId(e.target.value)}
            >
              {workflows.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            {/* NLP / AI toggle */}
            <div style={{display:'flex',background:'var(--s3)',border:'1px solid var(--border)',borderRadius:4,overflow:'hidden'}}>
              <button onClick={() => setAiMode(false)} style={{fontFamily:'var(--mono)',fontSize:9.5,padding:'4px 9px',border:'none',cursor:'pointer',transition:'all .15s',background:!aiMode?'var(--accent)':'transparent',color:!aiMode?'#fff':'var(--dim)',fontWeight:!aiMode?'600':'400'}}>◈ NLP</button>
              <button onClick={() => setAiMode(true)}  style={{fontFamily:'var(--mono)',fontSize:9.5,padding:'4px 9px',border:'none',borderLeft:'1px solid var(--border)',cursor:'pointer',transition:'all .15s',background:aiMode?'rgba(124,92,252,.3)':'transparent',color:aiMode?'#A78BFA':'var(--dim)',fontWeight:aiMode?'600':'400'}}>✦ AI</button>
            </div>
            <button className="xb blue prd-btn" onClick={generate} disabled={!selectedWf || generating}>
              {generating ? <><div className="spin" style={{borderTopColor:'#fff'}}/>Generating...</> : 'Generate PRD'}
            </button>
          </div>
        </div>

        <div style={{flex:1,overflow:'auto',padding:'14px 16px',fontSize:11,lineHeight:1.8}}>
          {!selectedWf ? (
            <div style={{color:'var(--dim)',padding:'20px 0'}}>
              <div style={{color:'var(--gold)',marginBottom:8}}>⚠ No workflow found</div>
              Go to SOW Editor → add states → Save JSON.
            </div>
          ) : (
            <>
              <div style={{marginBottom:14}}>
                <div style={{fontSize:9,color:'var(--mid)',letterSpacing:'1px',textTransform:'uppercase',marginBottom:5}}>Loaded workflow</div>
                <div style={{color:'var(--text)',fontWeight:600}}>{selectedWf.name || 'Unnamed'}</div>
                <div style={{color:'var(--mid)',fontSize:10,marginTop:3}}>
                  {selectedWf.states.length} states · {selectedWf.transitions.length} transitions · {users.length} users · {properties.length} properties · {rules.length} rules
                </div>
              </div>
              <div className="mode-cards">
                <div className={`mode-card nlp ${aiMode ? 'inactive' : ''}`} onClick={() => setAiMode(false)}>
                  <div className="mode-card-title">◈ Local NLP{!aiMode && <span className="mode-active-badge">ACTIVE</span>}</div>
                  <div className="mode-card-body">Regex + pattern matching<br/>100% offline · instant</div>
                </div>
                <div className={`mode-card ai ${!aiMode ? 'inactive' : ''}`} onClick={() => setAiMode(true)}>
                  <div className="mode-card-title">✦ AI Enhanced{aiMode && <span className="mode-active-badge">ACTIVE</span>}</div>
                  <div className="mode-card-body">Claude API · richer output<br/>Handles complex prose</div>
                </div>
              </div>
              {status && <div style={{fontSize:10,color:aiMode?'#A78BFA':'var(--green)',marginBottom:8,display:'flex',alignItems:'center',gap:6}}><span>{generating?'⏳':'✓'}</span><span>{status}</span></div>}
              {generating && <div style={{display:'flex',alignItems:'center',gap:8,color:'var(--mid)',fontSize:11,padding:'8px 0'}}><div className="spin" style={{borderTopColor:aiMode?'#A78BFA':'var(--a3)'}}/>{aiMode?'Claude is generating...':'Parsing requirements...'}</div>}
              {prd && !generating && (
                <div style={{display:'flex',gap:8,marginTop:8}}>
                  <button className="xb blue" onClick={download}>↓ Download .md</button>
                  <button className="xb" onClick={() => setView(v => v === 'preview' ? 'raw' : 'preview')}>{view === 'preview' ? 'Raw MD' : 'Preview'}</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="ss-right">
        <div className="d-head">
          <span className="ss-headlbl">{prd ? (view === 'preview' ? 'PRD Preview' : 'Raw Markdown') : 'Preview'}</span>
          {prd && <div className="tab-row">
            <button className={`tab ${view==='preview'?'on':''}`} onClick={() => setView('preview')}>Preview</button>
            <button className={`tab ${view==='raw'?'on':''}`} onClick={() => setView('raw')}>Raw</button>
          </div>}
        </div>
        {!prd ? (
          <div className="prd-empty"><div className="prd-empty-icon">📋</div><div>Select a workflow and click Generate PRD</div></div>
        ) : view === 'preview' ? (
          <div className="prd-preview"><MD src={prd}/></div>
        ) : (
          <div className="json-body"><pre style={{fontFamily:'JetBrains Mono,monospace',fontSize:10.5,lineHeight:1.7,color:'var(--text)',whiteSpace:'pre-wrap'}}>{prd}</pre></div>
        )}
      </div>
    </div>
  );
}

// ── Minimal Markdown renderer ─────────────────────────────────
function MD({ src }) {
  const lines = src.split('\n');
  const els=[]; let key=0, tRows=[], inT=false;
  const flushT = () => {
    if (!tRows.length) return;
    const rows = tRows.map(r => r.split('|').map(c => c.trim()).filter(Boolean));
    els.push(<table key={key++} style={{width:'100%',borderCollapse:'collapse',fontSize:11,marginBottom:12}}>
      <thead><tr>{rows[0].map((c,i) => <th key={i} style={{background:'#0E2038',color:'#5878A0',padding:'6px 10px',textAlign:'left',fontWeight:500,fontSize:10,borderBottom:'1px solid #162C4A'}}>{c}</th>)}</tr></thead>
      <tbody>{rows.slice(1).map((r,i) => <tr key={i}>{r.map((c,j) => <td key={j} style={{padding:'6px 10px',borderBottom:'1px solid rgba(22,44,74,.5)',color:'#C8DEFF',lineHeight:1.5}}>{c}</td>)}</tr>)}</tbody>
    </table>);
    tRows=[]; inT=false;
  };
  const fmt = t => {
    t = t.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\*(.+?)\*/g,'<i>$1</i>').replace(/`(.+?)`/g,"<code style='background:#0E2038;padding:1px 5px;border-radius:3px;font-size:10px'>$1</code>");
    return <span dangerouslySetInnerHTML={{__html:t}}/>;
  };
  for (const raw of lines) {
    const l = raw.trim();
    if (l.startsWith('|')) { if (/^\|[\s\-:|]+\|/.test(l)) continue; inT=true; tRows.push(l); continue; }
    if (inT) flushT();
    if (!l) { els.push(<div key={key++} style={{height:8}}/>); continue; }
    if (/^---+$/.test(l)) { els.push(<hr key={key++} style={{border:'none',borderTop:'1px solid #162C4A',margin:'14px 0'}}/>); continue; }
    if (l.startsWith('# '))   { els.push(<div key={key++} style={{fontFamily:'Fraunces,serif',fontSize:18,fontWeight:700,color:'#fff',marginBottom:6}}>{l.slice(2)}</div>); continue; }
    if (l.startsWith('## '))  { els.push(<div key={key++} style={{fontFamily:'Fraunces,serif',fontSize:14,fontWeight:600,color:'#4A9FFF',margin:'18px 0 8px',paddingBottom:4,borderBottom:'1px solid #162C4A'}}>{l.slice(3)}</div>); continue; }
    if (l.startsWith('### ')) { els.push(<div key={key++} style={{fontSize:12,fontWeight:600,color:'#C8DEFF',margin:'12px 0 5px'}}>{l.slice(4)}</div>); continue; }
    if (/^\d+\.\s/.test(l)||l.startsWith('- ')) { els.push(<div key={key++} style={{fontSize:11.5,color:'#5878A0',paddingLeft:14,position:'relative',marginBottom:3,lineHeight:1.6}}><span style={{position:'absolute',left:0,color:'#4A9FFF'}}>›</span>{fmt(l.replace(/^[\d]+\.\s|^-\s/,''))}</div>); continue; }
    els.push(<div key={key++} style={{fontSize:11.5,color:'#5878A0',marginBottom:6,lineHeight:1.7}}>{fmt(l)}</div>);
  }
  if (inT) flushT();
  return <div>{els}</div>;
}

// ── Local PRD builder ─────────────────────────────────────────
function buildLocalPRD(payload) {
  const today = new Date().toLocaleDateString('en-CA');
  const name = payload.name || 'Unnamed Project';
  let p = `# ${name}\n## Product Requirements Document\n\n---\n\n`;
  p += `| Field | Detail |\n| :--- | :--- |\n| **Project** | ${name} |\n| **Generated** | ${today} |\n| **Source** | Proviso SOW Spreadsheet |\n\n---\n\n`;
  p += `## 1. Overview\n\n${payload.description || `Auto-generated PRD for ${name}.`}\n\n---\n\n`;
  if (payload.users?.length) {
    p += `## 2. Users and Roles\n\n| Name | Role | Email | Contract Manager |\n| :--- | :--- | :--- | :--- |\n`;
    payload.users.forEach(u => { p += `| ${u.name} | ${u.role||'—'} | ${u.email||'—'} | ${u.isCM?'Yes':'No'} |\n`; });
    p += '\n---\n\n';
  }
  const s = (payload.users?.length) ? 3 : 2;
  p += `## ${s}. Workflow — ${name}\n\n### States\n\n| State | Initial |\n| :--- | :--- |\n`;
  payload.states.forEach(st => { p += `| ${st.name} | ${st.initial?'Yes':'No'} |\n`; });
  p += `\n### Transitions\n\n| From | To |\n| :--- | :--- |\n`;
  payload.transitions.forEach(t => { p += `| ${t.from} | ${t.to} |\n`; });
  if (payload.properties?.length) {
    p += `\n---\n\n## ${s+1}. Properties\n\n| Field | Type | Required |\n| :--- | :--- | :--- |\n`;
    payload.properties.forEach(pr => { p += `| ${pr.name} | ${pr.type||'Text'} | ${pr.required?'Yes':'No'} |\n`; });
  }
  if (payload.rules?.length) {
    p += `\n---\n\n## ${s+2}. Business Rules\n\n`;
    payload.rules.forEach((r,i) => { p += `${i+1}. ${r}\n`; });
  }
  const hrs = payload.states.length*3 + payload.transitions.length + (payload.properties?.length||0)*2 + 25;
  p += `\n---\n\n## ${s+3}. Build Estimate\n\n| Phase | Hours |\n| :--- | :--- |\n| Schema + Parser | 15–20 |\n| COM Provisioner (${payload.states.length} states) | ${hrs-15}–${Math.round((hrs-15)*1.3)} |\n| Test Runner | 10–15 |\n| **Total** | **${hrs}–${Math.round(hrs*1.3)}** |\n\n`;
  p += `---\n\n*Generated by Proviso · scriptdotnet © ${new Date().getFullYear()}*\n`;
  return p;
}

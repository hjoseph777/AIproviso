import { useState, useRef } from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';

const delay = ms => new Promise(r => setTimeout(r, ms));
const mkId  = () => Math.random().toString(36).slice(2,9);

// ── Claude extraction system prompt ──────────────────────────────
const AI_SYSTEM = `You are a workflow extraction engine. Given any SOW, specification, or description text, extract a workflow definition and return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "workflow": {
    "name": "string",
    "states": [ { "name": "string", "initial": true|false } ],
    "transitions": [ { "from": "string", "to": "string", "conditions": "string or null", "permissions": "string or null" } ]
  },
  "users": [ { "name": "string", "role": "string", "email": "string", "isCM": true|false } ],
  "properties": [ { "name": "string", "type": "Text|Decimal|Date|Boolean|Lookup", "required": true|false } ],
  "rules": [ { "text": "string" } ]
}
Rules: Exactly one state must have initial:true. State names in transitions must exactly match state names in the states array. Extract ALL business rules as separate rule objects. If a field is unknown, use null. Return only the JSON object.`;

export default function PrdGenerator() {
  const importWorkflow = useWorkflowStore(s => s.importWorkflow);
  const [source, setSource] = useState('nlp');
  // NLP
  const [nlpText, setNlpText]   = useState('');
  // AI
  const [aiText,  setAiText]    = useState('');
  const [aiKey,   setAiKey]     = useState('');
  const [aiModel, setAiModel]   = useState('claude-sonnet-4-5');
  // Cacoo
  const [cacooId,  setCacooId]  = useState('');
  const [cacooKey, setCacooKey] = useState('');
  // Shared
  const [parsed,  setParsed]    = useState(null);
  const [log,     setLog]       = useState([]);
  const [busy,    setBusy]      = useState(false);
  const [open,    setOpen]      = useState({states:true,transitions:false,users:false,props:false,rules:false});
  const [prd,     setPrd]       = useState('');
  const [view,    setView]      = useState('guide');

  const addLog = (msg, t='info') => setLog(p=>[...p,{msg,t,ts:new Date().toLocaleTimeString('en-CA',{hour12:false})}]);
  const tog = k => setOpen(o=>({...o,[k]:!o[k]}));

  /* ── NLP Parser ── */
  const parseTable = (text, header) => {
    const idx = text.search(new RegExp(`###\\s+${header}[^\\n]*\\n`,'im'));
    if (idx===-1) return [];
    const rows=[]; let sep=false;
    for (const ln of text.slice(idx).split('\n').slice(1)) {
      const l=ln.trim();
      if (!l.startsWith('|')) break;
      if (/^\|[\s\-:|]+\|/.test(l)){sep=true;continue;}
      if (!sep) continue;
      rows.push(l.split('|').map(c=>c.trim()).filter(Boolean));
    }
    return rows;
  };

  const runNLP = async () => {
    if (!nlpText.trim()) return;
    setBusy(true); setLog([]); setParsed(null);
    addLog('Layer 1: document structure…','info'); await delay(250);
    addLog('Layer 2: regex table extraction…','info'); await delay(300);

    const nm = nlpText.match(/^##\s+Workflow[:\s]+(.+)/im)||nlpText.match(/^#\s+(.+)/m);
    const name = nm ? nm[1].trim() : 'Extracted Workflow';

    const states = parseTable(nlpText,'States')
      .filter(r=>r[0]&&!/state.*name/i.test(r[0]))
      .map(r=>({id:mkId(),name:r[0],initial:/yes/i.test(r[1]||'')}));

    const transitions = parseTable(nlpText,'Transitions')
      .filter(r=>r[0]&&!/^from$/i.test(r[0]))
      .map(r=>({id:mkId(),from:r[0],to:r[1]||'',conditions:r[2]&&r[2]!=='—'?r[2]:null,permissions:r[3]&&r[3]!=='—'?r[3]:null}));

    const users = parseTable(nlpText,'Users')
      .filter(r=>r[0]&&!/^name$/i.test(r[0]))
      .map(r=>({id:mkId(),name:r[0],role:r[1]||'',email:r[2]||'',isCM:/yes/i.test(r[3]||'')}));

    const properties = parseTable(nlpText,'Properties')
      .filter(r=>r[0]&&!/field.*name/i.test(r[0]))
      .map(r=>({id:mkId(),name:r[0],type:r[1]||'Text',required:/yes/i.test(r[2]||'')}));

    const rm = nlpText.match(/###\s+(?:Business\s+)?Rules[^\n]*\n([\s\S]+?)(?=\n##|$)/im);
    const rules = rm ? (rm[1].match(/^(?:\d+\.\s*|-\s*)(.+)/gm)||[])
      .map(i=>({id:mkId(),text:i.replace(/^[\d.]+\s*|-\s*/,'').trim()})).filter(r=>r.text) : [];

    addLog('Layer 3: prose rules scan…','info'); await delay(300);

    if (states.length) {
      addLog(`States: ${states.length} [1.00]`,'ok');
      addLog(`Transitions: ${transitions.length} [1.00]`,'ok');
      if (users.length)      addLog(`Users: ${users.length} [1.00]`,'ok');
      if (properties.length) addLog(`Properties: ${properties.length} [1.00]`,'ok');
      if (rules.length)      addLog(`Rules: ${rules.length} [0.85]`,'ok');
      const bad = transitions.filter(t=>!states.find(s=>s.name===t.from)||!states.find(s=>s.name===t.to)).length;
      if (bad) addLog(`${bad} transition(s) reference unknown states`,'warn');
      setParsed({name, workflow:{name,states,transitions}, users, properties, rules});
      setOpen({states:true,transitions:true,users:!!users.length,props:!!properties.length,rules:!!rules.length});
      setView('json');
    } else {
      addLog('No ### States table found — check your Markdown format','error');
    }
    setBusy(false);
  };

  const loadIntoStore = () => {
    if (!parsed) return;
    importWorkflow(parsed);
    addLog('Loaded into SOW Editor — switch to tab 1 to review','ok');
  };

  /* ── AI (Claude) extractor ── */
  const runAI = async () => {
    if (!aiText.trim()) return;
    if (!aiKey.trim()) { addLog('Paste your Claude API key first','error'); return; }
    setBusy(true); setLog([]); setParsed(null);
    addLog('Sending SOW to Claude for extraction…','info');
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': aiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: aiModel,
          max_tokens: 4096,
          system: AI_SYSTEM,
          messages: [{ role: 'user', content: aiText.trim() }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const raw = data.content?.[0]?.text || '';
      addLog('Response received — parsing JSON…','info');
      // Strip markdown code fences if Claude wrapped the JSON
      const clean = raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
      const obj = JSON.parse(clean);
      if (!obj.workflow?.states?.length) throw new Error('No states found in Claude response');
      // Assign IDs
      const wf = {
        name: obj.workflow.name || 'AI Extracted Workflow',
        states:      (obj.workflow.states      || []).map(s => ({id:mkId(),...s})),
        transitions: (obj.workflow.transitions || []).map(t => ({id:mkId(),...t})),
      };
      const users      = (obj.users      || []).map(u => ({id:mkId(),...u}));
      const properties = (obj.properties  || []).map(p => ({id:mkId(),...p}));
      const rules      = (obj.rules       || []).map(r => ({id:mkId(),...r}));
      addLog(`States: ${wf.states.length} · Transitions: ${wf.transitions.length}`,'ok');
      if (users.length)      addLog(`Users: ${users.length}`,'ok');
      if (properties.length) addLog(`Properties: ${properties.length}`,'ok');
      if (rules.length)      addLog(`Rules: ${rules.length}`,'ok');
      const bad = wf.transitions.filter(t => !wf.states.find(s=>s.name===t.from)||!wf.states.find(s=>s.name===t.to)).length;
      if (bad) addLog(`${bad} transition(s) reference unknown states`,'warn');
      const result = { name: wf.name, workflow: wf, users, properties, rules };
      setParsed(result);
      setOpen({states:true,transitions:true,users:!!users.length,props:!!properties.length,rules:!!rules.length});
      setView('json');
    } catch(e) {
      addLog(`Error: ${e.message}`,'error');
    }
    setBusy(false);
  };

  /* ── Cacoo fetcher ── */
  const runCacoo = async () => {
    if (!cacooId.trim()) { addLog('Enter a Cacoo Diagram ID','error'); return; }
    setBusy(true); setLog([]); setParsed(null);
    addLog(`Fetching diagram ${cacooId}…`,'info');
    try {
      const res = await fetch(
        `http://localhost:5000/api/cacoo-fetch?diagramId=${encodeURIComponent(cacooId)}&apiKey=${encodeURIComponent(cacooKey)}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      const obj = await res.json();
      addLog('Diagram data received','info');
      if (!obj.workflow?.states?.length) throw new Error('Backend returned no states — check diagram ID');
      const wf = {
        name: obj.workflow.name || `Cacoo: ${cacooId}`,
        states:      (obj.workflow.states      || []).map(s => ({id:mkId(),...s})),
        transitions: (obj.workflow.transitions || []).map(t => ({id:mkId(),...t})),
      };
      const users      = (obj.users      || []).map(u => ({id:mkId(),...u}));
      const properties = (obj.properties  || []).map(p => ({id:mkId(),...p}));
      const rules      = (obj.rules       || []).map(r => ({id:mkId(),...r}));
      addLog(`States: ${wf.states.length} · Transitions: ${wf.transitions.length}`,'ok');
      const result = { name: wf.name, workflow: wf, users, properties, rules };
      setParsed(result);
      setOpen({states:true,transitions:true,users:!!users.length,props:!!properties.length,rules:!!rules.length});
      setView('json');
    } catch(e) {
      if (e.name === 'TimeoutError' || e.message.includes('fetch')) {
        addLog('Cannot reach backend — is `python backend/app.py` running on :5000?','error');
      } else {
        addLog(`Error: ${e.message}`,'error');
      }
    }
    setBusy(false);
  };

  const genPrd = () => {
    if (!parsed) return;
    const {name, workflow:{states,transitions}, users, properties, rules} = parsed;
    const d = new Date().toLocaleDateString('en-CA');
    let p = `# ${name}\n## Product Requirements Document\n\n---\n\n`;
    p += `| Field | Detail |\n|:---|:---|\n| **Project** | ${name} |\n| **Date** | ${d} |\n| **Source** | Proviso NLP |\n\n---\n\n`;
    p += `## 1. Workflow States\n\n| State | Initial |\n|:---|:---|\n`;
    states.forEach(s=>{p+=`| ${s.name} | ${s.initial?'Yes':'No'} |\n`;});
    p += `\n## 2. Transitions\n\n| From | To | Condition | Permission |\n|:---|:---|:---|:---|\n`;
    transitions.forEach(t=>{p+=`| ${t.from} | ${t.to} | ${t.conditions||'—'} | ${t.permissions||'—'} |\n`;});
    if (users.length){p+=`\n---\n\n## 3. Users\n\n| Name | Role | CM |\n|:---|:---|:---|\n`;users.forEach(u=>{p+=`| ${u.name} | ${u.role||'—'} | ${u.isCM?'Yes':'No'} |\n`;});}
    if (properties.length){p+=`\n---\n\n## 4. Properties\n\n| Field | Type | Required |\n|:---|:---|:---|\n`;properties.forEach(pr=>{p+=`| ${pr.name} | ${pr.type} | ${pr.required?'Yes':'No'} |\n`;});}
    if (rules.length){p+=`\n---\n\n## 5. Business Rules\n\n`;rules.forEach((r,i)=>{p+=`${i+1}. ${r.text||r}\n`;});}
    const hrs=states.length*3+transitions.length+25;
    p+=`\n---\n\n## 6. Build Estimate\n\n| Phase | Hours |\n|:---|:---|\n| Schema + Parser | 15–20 |\n| COM Provisioner | ${hrs-15}–${Math.round((hrs-15)*1.3)} |\n| Testing | 10–15 |\n| **Total** | **${hrs}–${Math.round(hrs*1.3)}** |\n\n---\n\n*Proviso · ${new Date().getFullYear()}*\n`;
    setPrd(p); setView('prd');
  };

  /* ── Section row renderer ── */
  const Section = ({id, icon, label, items, cols}) => (
    <div className="sow-section">
      <div className="sow-section-hd" onClick={()=>tog(id)}>
        <span className="sow-sec-icon">{icon}</span>
        <span className="sow-sec-lbl">{label}</span>
        <span className="sow-sec-count">{items.length} rows</span>
        <span className="sow-sec-chev">{open[id]?'▾':'▸'}</span>
      </div>
      {open[id] && items.length > 0 && (
        <div className="sow-sec-body">
          <table className="sow-mini-table">
            <thead><tr>{cols.map(c=><th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {items.map((row,i)=>(
                <tr key={i}>{cols.map(c=>{
                  const v = row[c.toLowerCase().replace(/\s/g,'_')]
                         ?? row[c.toLowerCase()]
                         ?? (c==='Initial'?row.initial?.toString():'')
                         ?? (c==='CM'?row.isCM?.toString():'')
                         ?? '';
                  return <td key={c}>{String(v)}</td>;
                })}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open[id] && items.length===0 && (
        <div className="sow-sec-empty">No {label.toLowerCase()} extracted yet</div>
      )}
    </div>
  );

  const SOURCES = [
    {id:'nlp',   lbl:'◈ NLP',   color:'var(--accent)'},
    {id:'ai',    lbl:'✦ AI',    color:'#A78BFA'},
    {id:'cacoo', lbl:'⬡ Cacoo', color:'var(--green)'},
  ];

  return (
    <div className="prd-screen">
      {/* ── LEFT ── */}
      <div className="prd-left">

        {/* Header */}
        <div className="ss-head">
          <span className="ss-headlbl">SOW Import</span>
          <div style={{display:'flex',gap:4}}>
            {SOURCES.map(s=>(
              <button key={s.id} onClick={()=>{setSource(s.id);setLog([]);setParsed(null);}}
                style={{fontFamily:'var(--mono)',fontSize:9.5,padding:'4px 11px',borderRadius:4,
                  border:`1px solid ${source===s.id?s.color:'var(--border)'}`,cursor:'pointer',
                  background:source===s.id?'rgba(255,255,255,.05)':'transparent',
                  color:source===s.id?s.color:'var(--dim)',fontWeight:source===s.id?'600':'400',
                  transition:'all .15s'}}>
                {s.lbl}
              </button>
            ))}
          </div>
        </div>

        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'auto',gap:0}}>

          {/* Source input panel */}
          <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)'}}>
            {source==='nlp' && (
              <>
                <div style={{fontSize:9,color:'var(--mid)',letterSpacing:'1px',textTransform:'uppercase',marginBottom:6}}>
                  Paste Markdown SOW — tables auto-populate sections below
                </div>
                <textarea value={nlpText} onChange={e=>setNlpText(e.target.value)}
                  placeholder={'## Workflow: Contract Lifecycle\n\n### States\n| State Name | Initial |\n| Draft | Yes |\n| Under Review | No |\n\n### Transitions\n| From | To | Condition | Permission |\n| Draft | Under Review | | Contract Managers |\n\n### Business Rules\n- Only Contract Managers can create contracts'}
                  style={{width:'100%',height:130,resize:'none',boxSizing:'border-box',
                    background:'var(--bg)',border:'1px solid var(--border)',borderRadius:4,
                    padding:'8px 10px',fontFamily:'var(--mono)',fontSize:10,color:'var(--text)',
                    outline:'none',lineHeight:1.7}}/>
                <button className="xb blue" onClick={runNLP}
                  disabled={!nlpText.trim()||busy}
                  style={{marginTop:8,width:'100%',padding:'8px 0',fontSize:11}}>
                  {busy?<>Parsing…</>:'◈ Parse with NLP'}
                </button>
              </>
            )}
            {source==='ai' && (
              <>
                <div style={{fontSize:9,color:'var(--mid)',letterSpacing:'1px',textTransform:'uppercase',marginBottom:8}}>
                  Paste any SOW text — Claude extracts the workflow schema
                </div>
                {/* API key */}
                <div style={{display:'flex',gap:6,marginBottom:8}}>
                  <input
                    type="password"
                    value={aiKey}
                    onChange={e=>setAiKey(e.target.value)}
                    placeholder="sk-ant-… (Claude API key)"
                    style={{flex:1,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:4,
                      padding:'6px 10px',fontFamily:'var(--mono)',fontSize:10,color:'var(--text)',outline:'none'}}
                  />
                  <select
                    value={aiModel}
                    onChange={e=>setAiModel(e.target.value)}
                    style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:4,
                      padding:'4px 8px',fontFamily:'var(--mono)',fontSize:9.5,color:'var(--text)',outline:'none',cursor:'pointer'}}
                  >
                    <option value="claude-sonnet-4-5">Sonnet 4.5</option>
                    <option value="claude-opus-4-5">Opus 4.5</option>
                    <option value="claude-haiku-3-5">Haiku 3.5</option>
                  </select>
                </div>
                {/* SOW textarea */}
                <textarea
                  value={aiText}
                  onChange={e=>setAiText(e.target.value)}
                  placeholder={'Paste any SOW, requirements doc, or plain-text workflow description here.\n\nExample:\n"The Contract Lifecycle starts in Draft. A Contract Manager submits it for review..."'}
                  style={{width:'100%',height:120,resize:'none',boxSizing:'border-box',
                    background:'var(--bg)',border:'1px solid var(--border)',borderRadius:4,
                    padding:'8px 10px',fontFamily:'var(--mono)',fontSize:10,color:'var(--text)',
                    outline:'none',lineHeight:1.7}}
                />
                <button
                  className="xb"
                  onClick={runAI}
                  disabled={!aiText.trim()||!aiKey.trim()||busy}
                  style={{marginTop:8,width:'100%',padding:'8px 0',fontSize:11,
                    background:'rgba(124,92,252,.15)',border:'1px solid rgba(124,92,252,.4)',
                    color:'#A78BFA'}}
                >
                  {busy?<>Extracting…</>:'✦ Extract with Claude'}
                </button>
              </>
            )}
            {source==='cacoo' && (
              <>
                <div style={{fontSize:9,color:'var(--mid)',letterSpacing:'1px',textTransform:'uppercase',marginBottom:8}}>
                  Fetch a Cacoo diagram via the local backend proxy
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <input
                    value={cacooId}
                    onChange={e=>setCacooId(e.target.value)}
                    placeholder="Cacoo Diagram ID  (e.g. AbCdEf12)"
                    style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:4,
                      padding:'7px 10px',fontFamily:'var(--mono)',fontSize:10,color:'var(--text)',outline:'none'}}
                  />
                  <input
                    type="password"
                    value={cacooKey}
                    onChange={e=>setCacooKey(e.target.value)}
                    placeholder="Cacoo API Key  (optional for public diagrams)"
                    style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:4,
                      padding:'7px 10px',fontFamily:'var(--mono)',fontSize:10,color:'var(--text)',outline:'none'}}
                  />
                </div>
                <button
                  className="xb green"
                  onClick={runCacoo}
                  disabled={!cacooId.trim()||busy}
                  style={{marginTop:8,width:'100%',padding:'8px 0',fontSize:11}}
                >
                  {busy?<>Fetching…</>:'⬡ Fetch from Cacoo'}
                </button>
                <div style={{marginTop:8,fontSize:9,color:'var(--dim)',lineHeight:1.8}}>
                  Requires <code style={{color:'var(--a3)'}}>python backend/app.py</code> running on <code style={{color:'var(--a3)'}}>localhost:5000</code>
                </div>
              </>
            )}
          </div>

          {/* Log */}
          {log.length>0 && (
            <div className="log" style={{margin:'0 16px 0',maxHeight:90}}>
              {log.map((l,i)=>(
                <div key={i} className="ll">
                  <span className="lt">{l.ts}</span>
                  <span className={l.t==='ok'?'lok':l.t==='warn'?'lwarn':l.t==='error'?'lerr':'linf'}>{l.msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* Template sections */}
          <div style={{padding:'8px 0'}}>
            <div style={{padding:'8px 16px 4px',fontSize:9,color:'var(--dim)',letterSpacing:'1px',textTransform:'uppercase'}}>
              Workflow Template
            </div>

            {parsed && (
              <div style={{padding:'6px 16px'}}>
                <div style={{fontSize:10,color:'var(--mid)'}}>PROJECT NAME</div>
                <div style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--text)',fontWeight:600,marginTop:2}}>
                  {parsed.name}
                </div>
              </div>
            )}

            <Section id="states"      icon="○" label="States"          items={parsed?.workflow?.states||[]}     cols={['Name','Initial']}/>
            <Section id="transitions" icon="→" label="Transitions"     items={parsed?.workflow?.transitions||[]} cols={['From','To','Conditions','Permissions']}/>
            <Section id="users"       icon="i" label="Users"           items={parsed?.users||[]}                cols={['Name','Role','Email','CM']}/>
            <Section id="props"       icon="=" label="Properties"      items={parsed?.properties||[]}           cols={['Name','Type','Required']}/>
            <Section id="rules"       icon="§" label="Business Rules"  items={parsed?.rules||[]}                cols={['Text']}/>
          </div>

          {/* Actions */}
          {parsed && (
            <div style={{padding:'12px 16px',display:'flex',gap:8,borderTop:'1px solid var(--border)'}}>
              <button className="xb blue" style={{flex:1,padding:'8px 0'}} onClick={loadIntoStore}>
                → Load into SOW Editor
              </button>
              <button className="xb" style={{flex:1,padding:'8px 0',background:'rgba(0,200,112,.12)',
                border:'1px solid rgba(0,200,112,.3)',color:'var(--green)'}} onClick={genPrd}>
                ↓ Generate PRD
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className="ss-right">
        <div className="d-head">
          <span className="ss-headlbl">{view==='prd'?'PRD Preview':view==='json'?'Extracted JSON':'Guide'}</span>
          <div className="tab-row">
            {[['guide','Guide'],['json','JSON'],['prd','PRD']].map(([id,lbl])=>(
              <button key={id} className={`tab ${view===id?'on':''}`} onClick={()=>setView(id)}>{lbl}</button>
            ))}
            {prd && <button className="xb" style={{marginLeft:6,fontSize:9.5}} onClick={()=>{
              const a=document.createElement('a');
              a.href=URL.createObjectURL(new Blob([prd],{type:'text/markdown'}));
              a.download=`${parsed?.name||'prd'}.md`;a.click();}}>↓ .md</button>}
          </div>
        </div>

        <div style={{flex:1,overflow:'auto',padding:'18px 20px'}}>
          {view==='guide' && <Guide source={source}/>}
          {view==='json' && parsed && (
            <pre style={{fontFamily:'var(--mono)',fontSize:10,lineHeight:1.7,color:'var(--text)',whiteSpace:'pre-wrap'}}>
              {JSON.stringify(parsed.workflow,null,2)}
            </pre>
          )}
          {view==='json' && !parsed && <Empty icon="⬡" msg="Parse a SOW to see extracted JSON"/>}
          {view==='prd'  && prd  && <MD src={prd}/>}
          {view==='prd'  && !prd && <Empty icon="📋" msg="Generate PRD after parsing"/>}
        </div>
      </div>
    </div>
  );
}

/* ── Guide panel ── */
function Guide({source}) {
  if (source==='nlp') return (
    <div>
      <div style={{fontFamily:'Fraunces,serif',fontSize:16,fontWeight:700,color:'#fff',marginBottom:4}}>◈ NLP Parser</div>
      <div style={{fontSize:11,color:'var(--mid)',marginBottom:16}}>Paste a Markdown SOW — tables extract automatically · 100% offline · free</div>
      <pre style={{fontSize:10,background:'var(--s3)',border:'1px solid var(--border)',borderRadius:6,
        padding:14,lineHeight:1.9,color:'var(--text)',whiteSpace:'pre-wrap',marginBottom:12}}>{
`## Workflow: Contract Lifecycle

### States
| State Name      | Initial |
| :-------------- | :------ |
| Draft           | Yes     |
| Under Review    | No      |
| Approved        | No      |

### Transitions
| From         | To           | Condition       | Permission        |
| :----------- | :----------- | :-------------- | :---------------- |
| Draft        | Under Review |                 | Contract Managers |
| Under Review | Approved     | All reviewed    | Automatic         |

### Users
| Name       | Role | Email         | CM  |
| Bill Ward  | CEO  | bill@acme.com | Yes |

### Properties
| Field Name     | Type    | Required |
| Contract Value | Decimal | Yes      |

### Business Rules
- Only Contract Managers can create contracts
- Contracts over €50,000 require Executive approval`}
      </pre>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
        {[['Tables','1.00 confidence','States, Transitions, Users, Properties'],
          ['Prose','0.85 confidence','Business Rules list items'],
          ['Name','Auto-detected','## Workflow: or # heading']].map(([t,c,d])=>(
          <div key={t} style={{background:'var(--s3)',border:'1px solid var(--border)',borderRadius:6,padding:10}}>
            <div style={{color:'var(--a3)',fontWeight:600,fontSize:10,marginBottom:3}}>{t}</div>
            <div style={{color:'var(--green)',fontSize:9,marginBottom:3}}>{c}</div>
            <div style={{color:'var(--dim)',fontSize:9}}>{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
  if (source==='ai') return (
    <div>
      <div style={{fontFamily:'Fraunces,serif',fontSize:16,fontWeight:700,color:'#fff',marginBottom:4}}>✦ Claude AI Extraction</div>
      <div style={{fontSize:11,color:'var(--mid)',marginBottom:16}}>Paste any free-text SOW — Claude extracts the full workflow schema automatically</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
        {[['API Key','sk-ant-… — get yours at console.anthropic.com','var(--purple)'],
          ['Model','Sonnet 4.5 recommended — fastest + most accurate','#A78BFA'],
          ['Input','Any text: SOW, email thread, PDF paste, requirements','var(--a3)'],
          ['Output','States · Transitions · Users · Properties · Rules','var(--green)']
        ].map(([t,d,c])=>(
          <div key={t} style={{background:'var(--s3)',border:'1px solid var(--border)',borderRadius:6,padding:10}}>
            <div style={{color:c,fontWeight:600,fontSize:10,marginBottom:3}}>{t}</div>
            <div style={{color:'var(--dim)',fontSize:9,lineHeight:1.6}}>{d}</div>
          </div>
        ))}
      </div>
      <div style={{background:'rgba(124,92,252,.08)',border:'1px solid rgba(124,92,252,.25)',borderRadius:6,padding:12,fontSize:10,color:'var(--mid)',lineHeight:1.8}}>
        <b style={{color:'#A78BFA'}}>System prompt:</b> Claude is instructed to return only a JSON object — no prose, no markdown fences. If it hallucinates extra text, the parser strips code fences automatically.
      </div>
    </div>
  );
  return (
    <div>
      <div style={{fontFamily:'Fraunces,serif',fontSize:16,fontWeight:700,color:'#fff',marginBottom:4}}>⬡ Cacoo Integration</div>
      <div style={{fontSize:11,color:'var(--mid)',marginBottom:16}}>Pull workflow diagrams directly from Cacoo via the local Python proxy</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
        {[['Diagram ID','Found in the Cacoo URL: /diagrams/AbCdEf12','var(--green)'],
          ['API Key','From Cacoo Account → API Tokens (optional for public)','var(--a3)'],
          ['Backend','Start with: python backend/app.py','var(--gold)'],
          ['Output','Shapes → States · Arrows → Transitions','var(--green)']
        ].map(([t,d,c])=>(
          <div key={t} style={{background:'var(--s3)',border:'1px solid var(--border)',borderRadius:6,padding:10}}>
            <div style={{color:c,fontWeight:600,fontSize:10,marginBottom:3}}>{t}</div>
            <div style={{color:'var(--dim)',fontSize:9,lineHeight:1.6}}>{d}</div>
          </div>
        ))}
      </div>
      <div style={{background:'rgba(0,200,112,.06)',border:'1px solid rgba(0,200,112,.2)',borderRadius:6,padding:12,fontSize:10,color:'var(--mid)',lineHeight:1.8}}>
        The backend at <code style={{color:'var(--a3)'}}>localhost:5000/api/cacoo-fetch</code> calls the Cacoo REST API and maps shape labels to states and connector labels to transitions. If the backend is not running, you will see a friendly error in the log.
      </div>
    </div>
  );
}

const Empty = ({icon,msg}) => (
  <div className="prd-empty"><div className="prd-empty-icon">{icon}</div><div>{msg}</div></div>
);

/* ── Markdown renderer ── */
function MD({src}) {
  const lines=src.split('\n');const els=[];let key=0,tRows=[],inT=false;
  const flushT=()=>{if(!tRows.length)return;const rows=tRows.map(r=>r.split('|').map(c=>c.trim()).filter(Boolean));els.push(<table key={key++} style={{width:'100%',borderCollapse:'collapse',fontSize:11,marginBottom:12}}><thead><tr>{rows[0].map((c,i)=><th key={i} style={{background:'#0E2038',color:'#5878A0',padding:'6px 10px',textAlign:'left',fontWeight:500,fontSize:10,borderBottom:'1px solid #162C4A'}}>{c}</th>)}</tr></thead><tbody>{rows.slice(1).map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j} style={{padding:'6px 10px',borderBottom:'1px solid rgba(22,44,74,.5)',color:'#C8DEFF',lineHeight:1.5}}>{c}</td>)}</tr>)}</tbody></table>);tRows=[];inT=false;};
  const fmt=t=>{t=t.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\*(.+?)\*/g,'<i>$1</i>').replace(/`(.+?)`/g,"<code style='background:#0E2038;padding:1px 5px;border-radius:3px;font-size:10px'>$1</code>");return <span dangerouslySetInnerHTML={{__html:t}}/>;};
  for(const raw of lines){const l=raw.trim();if(l.startsWith('|')){if(/^\|[\s\-:|]+\|/.test(l))continue;inT=true;tRows.push(l);continue;}if(inT)flushT();if(!l){els.push(<div key={key++} style={{height:8}}/>);continue;}if(/^---+$/.test(l)){els.push(<hr key={key++} style={{border:'none',borderTop:'1px solid #162C4A',margin:'14px 0'}}/>);continue;}if(l.startsWith('# ')){els.push(<div key={key++} style={{fontFamily:'Fraunces,serif',fontSize:18,fontWeight:700,color:'#fff',marginBottom:6}}>{l.slice(2)}</div>);continue;}if(l.startsWith('## ')){els.push(<div key={key++} style={{fontFamily:'Fraunces,serif',fontSize:14,fontWeight:600,color:'#4A9FFF',margin:'18px 0 8px',paddingBottom:4,borderBottom:'1px solid #162C4A'}}>{l.slice(3)}</div>);continue;}if(l.startsWith('### ')){els.push(<div key={key++} style={{fontSize:12,fontWeight:600,color:'#C8DEFF',margin:'12px 0 5px'}}>{l.slice(4)}</div>);continue;}if(/^\d+\.\s/.test(l)||l.startsWith('- ')){els.push(<div key={key++} style={{fontSize:11.5,color:'#5878A0',paddingLeft:14,position:'relative',marginBottom:3,lineHeight:1.6}}><span style={{position:'absolute',left:0,color:'#4A9FFF'}}>›</span>{fmt(l.replace(/^[\d]+\.\s|^-\s/,''))}</div>);continue;}els.push(<div key={key++} style={{fontSize:11.5,color:'#5878A0',marginBottom:6,lineHeight:1.7}}>{fmt(l)}</div>);}
  if(inT)flushT();return <div>{els}</div>;
}

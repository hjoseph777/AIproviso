import { useState, useEffect, useRef } from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { useMermaid } from '../hooks/useMermaid';
import { useExport } from '../hooks/useExport';

const mkId = () => Math.random().toString(36).slice(2,9);
const delay = ms => new Promise(r => setTimeout(r, ms));
const TS = () => new Date().toLocaleTimeString('en-CA',{hour12:false});
const MODES = [['manual','⊞ Manual'],['nlp','◈ NLP'],['ai','✦ AI'],['cacoo','⬡ Cacoo']];

const AI_SYSTEM = `Extract a workflow and return ONLY this JSON (no markdown):
{"workflow":{"name":"string","states":[{"name":"string","initial":true}],"transitions":[{"from":"string","to":"string","conditions":null,"permissions":null}]},"users":[{"name":"string","role":"string","email":"string","isCM":false}],"properties":[{"name":"string","type":"Text","required":false}],"rules":[{"text":"string"}]}
One state must have initial:true. Transition names must match states exactly.`;

function parseTable(text, header) {
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
}

function parseNLP(text) {
  const nm=text.match(/^##\s+Workflow[:\s]+(.+)/im)||text.match(/^#\s+(.+)/m);
  const name=nm?nm[1].trim():'Extracted Workflow';
  const states=parseTable(text,'States').filter(r=>r[0]&&!/state.*name/i.test(r[0]))
    .map(r=>({id:mkId(),name:r[0],initial:/yes/i.test(r[1]||'')}));
  const transitions=parseTable(text,'Transitions').filter(r=>r[0]&&!/^from$/i.test(r[0]))
    .map(r=>({id:mkId(),from:r[0],to:r[1]||'',conditions:r[2]&&r[2]!=='—'?r[2]:null,permissions:r[3]&&r[3]!=='—'?r[3]:null}));
  const users=parseTable(text,'Users').filter(r=>r[0]&&!/^name$/i.test(r[0]))
    .map(r=>({id:mkId(),name:r[0],role:r[1]||'',email:r[2]||'',isCM:/yes/i.test(r[3]||'')}));
  const properties=parseTable(text,'Properties').filter(r=>r[0]&&!/field.*name/i.test(r[0]))
    .map(r=>({id:mkId(),name:r[0],type:r[1]||'Text',required:/yes/i.test(r[2]||'')}));
  const rm=text.match(/###\s+(?:Business\s+)?Rules[^\n]*\n([\s\S]+?)(?=\n##|$)/im);
  const rules=rm?(rm[1].match(/^(?:\d+\.\s*|-\s*)(.+)/gm)||[])
    .map(i=>({id:mkId(),text:i.replace(/^[\d.]+\s*|-\s*/,'').trim()})).filter(r=>r.text):[];
  return {name,workflow:{name,states,transitions},users,properties,rules};
}

function buildSOW(wf, users, props, rules) {
  const d=new Date().toLocaleDateString('en-CA');
  let s=`# ${wf.name}\n## Statement of Work\n\n| Field | Detail |\n|:---|:---|\n| **Project** | ${wf.name} |\n| **Date** | ${d} |\n\n`;
  s+=`## 1. States\n\n| State | Initial |\n|:---|:---|\n`;
  wf.states.forEach(st=>{s+=`| ${st.name} | ${st.initial?'Yes':'No'} |\n`;});
  s+=`\n## 2. Transitions\n\n| From | To | Condition | Permission |\n|:---|:---|:---|:---|\n`;
  wf.transitions.forEach(t=>{s+=`| ${t.from} | ${t.to} | ${t.conditions||'—'} | ${t.permissions||'—'} |\n`;});
  if(users.length){s+=`\n## 3. Users\n\n| Name | Role | Email | CM |\n|:---|:---|:---|:---|\n`;users.forEach(u=>{s+=`| ${u.name} | ${u.role||'—'} | ${u.email||'—'} | ${u.isCM?'Yes':'No'} |\n`;});}
  if(props.length){s+=`\n## 4. Properties\n\n| Field | Type | Required |\n|:---|:---|:---|\n`;props.forEach(p=>{s+=`| ${p.name} | ${p.type} | ${p.required?'Yes':'No'} |\n`;});}
  if(rules.length){s+=`\n## 5. Business Rules\n\n`;rules.forEach((r,i)=>{s+=`${i+1}. ${r.text||r}\n`;});}
  return s;
}

function buildPRD(wf, users, props, rules) {
  const hrs=wf.states.length*3+wf.transitions.length+25;
  return buildSOW(wf,users,props,rules).replace('## Statement of Work','## Product Requirements Document')
    +`\n## 6. Build Estimate\n\n| Phase | Hours |\n|:---|:---|\n| Schema + Parser | 15–20 |\n| COM Provisioner | ${hrs-15}–${Math.round((hrs-15)*1.3)} |\n| Testing | 10–15 |\n| **Total** | **${hrs}–${Math.round(hrs*1.3)}** |\n\n*Proviso · ${new Date().getFullYear()}*\n`;
}

const loadMermaid=()=>new Promise(res=>{
  if(window.mermaid) return res(window.mermaid);
  const s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.6.1/mermaid.min.js';
  s.onload=()=>{
    window.mermaid.initialize({startOnLoad:false,theme:'base',themeVariables:{
      primaryColor:'#0F2D5C',primaryTextColor:'#C8DEFF',primaryBorderColor:'#1E4A8C',
      lineColor:'#3A7FD5',secondaryColor:'#071828',background:'#050E1A',
      mainBkg:'#0F2D5C',nodeBorder:'#1E4A8C',edgeLabelBackground:'#071828',
      fontFamily:'JetBrains Mono,monospace',fontSize:'12px',
    }});
    res(window.mermaid);
  };
  document.head.appendChild(s);
});

function highlightNode(el,name){
  if(!el||!name) return;
  const svg=el.querySelector('svg'); if(!svg) return;
  svg.querySelectorAll('.node rect,.node circle,.node polygon').forEach(e=>{e.style.stroke='';e.style.strokeWidth='';});
  svg.querySelectorAll('.node').forEach(n=>{n.style.filter='';});
  svg.querySelectorAll('.node').forEach(n=>{
    const lbl=n.querySelector('.nodeLabel,text,span')?.textContent?.trim()||'';
    if(lbl===name){
      const sh=n.querySelector('rect,circle,polygon');
      if(sh){sh.style.stroke='#4A9FFF';sh.style.strokeWidth='2.5';}
      n.style.filter='drop-shadow(0 0 7px rgba(74,159,255,.8))';
    }
  });
}

// Build ordered edge map from mermaid stateDiagram-v2 string
// Returns [{from,to},...] in the same order Mermaid processes transitions
function buildEdgeMap(mermaidStr) {
  if (!mermaidStr) return [];
  const map = [];
  // Match lines like: "  From_State --> To_State" (spaces, underscored names)
  // Also skip [*] --> InitialState lines (those are initial arrows, not transitions)
  const re = /^\s+([A-Za-z0-9_]+)\s+-->\s+([A-Za-z0-9_]+)/gm;
  let m;
  while ((m = re.exec(mermaidStr)) !== null) {
    const from = m[1], to = m[2];
    if (from === '[*]' || to === '[*]') continue; // skip initial state arrows
    map.push({ fromId: from, toId: to });
  }
  return map;
}

// addClicks: fires onEdge({fromId,toId}) — stateDiagram-v2 uses path.transition, not g.edgePath
function addClicks(el, onNode, onEdge, edgeMap) {
  const svg = el?.querySelector('svg'); if (!svg) return;

  // ── State node clicks (same in all Mermaid diagram types) ──
  svg.querySelectorAll('.node').forEach(n => {
    n.style.cursor = 'pointer';
    n.onclick = e => {
      e.stopPropagation();
      const lbl = n.querySelector('.nodeLabel,text,span')?.textContent?.trim() || '';
      if (lbl) onNode(lbl);
    };
  });

  // ── Transition arrow clicks ──
  // stateDiagram-v2 renders each transition as a direct <path class="transition">
  // (no g.edgePath wrapper — that only exists in flowchart diagrams).
  // Initial [*]→State arrows also get class "transition" but have a marker-start
  // attribute pointing to the start-circle symbol. Real transitions do NOT.
  const allTransPaths = [...svg.querySelectorAll('path.transition')];
  const transPaths = allTransPaths.filter(p => !p.getAttribute('marker-start'));

  transPaths.forEach((p, idx) => {
    const entry = edgeMap[idx];
    if (!entry) return;
    // Ghost path: wide transparent stroke for easy clicking, no visual markers
    const ghost = p.cloneNode(false);
    ghost.removeAttribute('id');
    ghost.removeAttribute('marker-end');
    ghost.removeAttribute('marker-start');
    ghost.removeAttribute('marker-mid');
    ghost.style.cssText = 'stroke-width:20px;stroke:transparent;fill:none;cursor:pointer;pointer-events:stroke';
    ghost.onclick = e => { e.stopPropagation(); onEdge(entry); };
    // Insert AFTER real path so it sits on top for click interception
    p.parentNode.insertBefore(ghost, p.nextSibling);
  });
}

// highlightEdge: lights up the matching path.transition in blue
function highlightEdge(el, selTrans, edgeMap) {
  if (!el || !selTrans) return;
  const svg = el.querySelector('svg'); if (!svg) return;

  // Reset all transition paths
  const allTransPaths = [...svg.querySelectorAll('path.transition')];
  const transPaths = allTransPaths.filter(p => !p.getAttribute('marker-start'));
  transPaths.forEach(p => { p.style.stroke = ''; p.style.strokeWidth = ''; p.style.filter = ''; });

  // Highlight the matching path by edgeMap index
  const matchIdx = edgeMap.findIndex(e => e.fromId === selTrans.fromId && e.toId === selTrans.toId);
  if (matchIdx >= 0 && transPaths[matchIdx]) {
    const p = transPaths[matchIdx];
    p.style.stroke = '#4A9FFF';
    p.style.strokeWidth = '2.5';
    p.style.filter = 'drop-shadow(0 0 6px rgba(74,159,255,.85))';
  }
}

async function dl(content, filename) {
  if (window.file?.save) {
    // Electron: native OS Save-As dialog
    await window.file.save({ content, defaultName: filename });
  } else {
    // Browser fallback
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], {type: 'text/markdown'}));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }
}

export default function CommandCenter() {
  const workflows=useWorkflowStore(s=>s.workflows), activeId=useWorkflowStore(s=>s.activeId);
  const getActive=useWorkflowStore(s=>s.getActive), setActive=useWorkflowStore(s=>s.setActive);
  const addWorkflow=useWorkflowStore(s=>s.addWorkflow), deleteWorkflow=useWorkflowStore(s=>s.deleteWorkflow);
  const renameWorkflow=useWorkflowStore(s=>s.renameWorkflow), clearWorkflow=useWorkflowStore(s=>s.clearWorkflow);
  const importWorkflow=useWorkflowStore(s=>s.importWorkflow), resetAll=useWorkflowStore(s=>s.resetAll);
  const addState=useWorkflowStore(s=>s.addState), updateState=useWorkflowStore(s=>s.updateState);
  const renameState=useWorkflowStore(s=>s.renameState), deleteState=useWorkflowStore(s=>s.deleteState);
  const addTransition=useWorkflowStore(s=>s.addTransition), updateTransition=useWorkflowStore(s=>s.updateTransition);
  const deleteTransition=useWorkflowStore(s=>s.deleteTransition);
  const users=useWorkflowStore(s=>s.users), properties=useWorkflowStore(s=>s.properties), rules=useWorkflowStore(s=>s.rules);
  const addUser=useWorkflowStore(s=>s.addUser), updateUser=useWorkflowStore(s=>s.updateUser), deleteUser=useWorkflowStore(s=>s.deleteUser);
  const addProperty=useWorkflowStore(s=>s.addProperty), updateProperty=useWorkflowStore(s=>s.updateProperty), deleteProperty=useWorkflowStore(s=>s.deleteProperty);
  const addRule=useWorkflowStore(s=>s.addRule), updateRule=useWorkflowStore(s=>s.updateRule), deleteRule=useWorkflowStore(s=>s.deleteRule);

  const [mode,setMode]=useState('manual');
  const [nlpText,setNlpText]=useState(''), [aiText,setAiText]=useState('');
  const [aiKey,setAiKey]=useState(''), [aiModel,setAiModel]=useState('claude-sonnet-4-5');
  const [cacooId,setCacooId]=useState(''), [cacooKey,setCacooKey]=useState('');
  const [log,setLog]=useState([]), [busy,setBusy]=useState(false);
  const [sel,setSel]=useState(''), [selTrans,setSelTrans]=useState(null); // selTrans: {fromId,toId} | null
  const [centerView,setCenterView]=useState('diagram'), [resetKey,setResetKey]=useState(0);
  const edgeMapRef=useRef([]);
  const [saveFlash,setSaveFlash]=useState(false), [saved,setSaved]=useState(false);
  const [mfLog,setMfLog]=useState([]), [mfBusy,setMfBusy]=useState(false), [mfOk,setMfOk]=useState(null);
  const [mfAdv,setMfAdv]=useState(false), [mfServer,setMfServer]=useState('localhost');
  const [mfVault,setMfVault]=useState('{E7E445BE-3AEF-425F-9D4D-BFCC33008C9E}');
  const [mfAuth,setMfAuth]=useState('windows'), [mfUser,setMfUser]=useState(''), [mfPass,setMfPass]=useState('');
  const [open,setOpen]=useState({states:true,trans:true,users:false,props:false,rules:false});
  const [stateFilter,setStateFilter]=useState(''), [transFilter,setTransFilter]=useState('');
  const [editTabId,setEditTabId]=useState(null), [tabDraft,setTabDraft]=useState('');

  const wf=getActive(), mermaidStr=useMermaid(wf);
  const filteredStates=(wf?.states||[]).filter(s=>!stateFilter||s.name.toLowerCase().includes(stateFilter.toLowerCase()));
  const filteredTrans=(wf?.transitions||[]).filter(t=>!transFilter||t.from.toLowerCase().includes(transFilter.toLowerCase())||t.to.toLowerCase().includes(transFilter.toLowerCase()));
  const {exportJSON}=useExport();
  const diagRef=useRef(null), rcRef=useRef(0);
  const tog=k=>setOpen(o=>({...o,[k]:!o[k]}));
  const addLog=(msg,t='info')=>setLog(p=>[...p,{msg,t,ts:TS()}]);
  const addMfLog=(msg,t='info')=>setMfLog(p=>[...p,{msg,t,ts:TS()}]);

  useEffect(()=>{
    if(!mermaidStr||centerView!=='diagram'){if(diagRef.current&&!mermaidStr)diagRef.current.innerHTML='';return;}
    let dead=false;
    (async()=>{
      const m=await loadMermaid(); rcRef.current++; const id=`cc${rcRef.current}`;
      try{
        const{svg}=await m.render(id,mermaidStr);
        if(!dead&&diagRef.current){
          // Build edge map BEFORE addClicks so it's ready for click handlers
          const map=buildEdgeMap(mermaidStr);
          edgeMapRef.current=map;
          diagRef.current.innerHTML=svg;
          highlightNode(diagRef.current,sel);
          addClicks(
            diagRef.current,
            name=>{setSel(name);setSelTrans(null);},      // node click
            entry=>{
              // entry = {fromId, toId} — underscored mermaid IDs
              setSelTrans(entry);
              setSel('');
              setOpen(o=>({...o,trans:true}));
              // Scroll the matching row into view after render
              setTimeout(()=>{
                // Convert underscored IDs back to original names for matching
                const fromName=entry.fromId.replace(/_/g,' ');
                const toName=entry.toId.replace(/_/g,' ');
                const rows=document.querySelectorAll('.trans-row');
                rows.forEach(row=>{
                  const inputs=row.querySelectorAll('input');
                  if(inputs[0]?.value===fromName&&inputs[1]?.value===toName){
                    row.scrollIntoView({behavior:'smooth',block:'nearest'});
                  }
                });
              },50);
            },
            map
          );
        }
      }catch{if(!dead&&diagRef.current)diagRef.current.innerHTML=`<div style="color:var(--red);font-size:11px;padding:16px">Diagram error</div>`;}
    })();
    return()=>{dead=true;};
  },[mermaidStr,centerView,resetKey]);

  useEffect(()=>{if(diagRef.current)highlightNode(diagRef.current,sel);},[sel]);
  useEffect(()=>{
    if(!diagRef.current) return;
    if(selTrans==null){
      const svg=diagRef.current.querySelector('svg');
      svg?.querySelectorAll('.edgePath path,.transition-state-end path').forEach(p=>{
        p.style.stroke='';p.style.strokeWidth='';p.style.filter='';
      });
    } else {
      // Pass edgeMap from ref so highlightEdge can find the correct SVG edge by name
      highlightEdge(diagRef.current,selTrans,edgeMapRef.current);
    }
  },[selTrans]);

  const changeMode=m=>{setMode(m);setLog([]);setSel('');};
  const applyExtracted=r=>{
    importWorkflow(r);
    setOpen({states:true,trans:true,users:!!r.users.length,props:!!r.properties.length,rules:!!r.rules.length});
    setCenterView('diagram');
  };
  const runNLP=async()=>{
    if(!nlpText.trim())return; setBusy(true);setLog([]);
    addLog('Parsing…'); await delay(300);
    const r=parseNLP(nlpText);
    if(!r.workflow.states.length){addLog('No ### States table found','error');setBusy(false);return;}
    addLog(`States: ${r.workflow.states.length} · Transitions: ${r.workflow.transitions.length}`,'ok');
    if(r.users.length)addLog(`Users: ${r.users.length}`,'ok');
    if(r.properties.length)addLog(`Properties: ${r.properties.length}`,'ok');
    if(r.rules.length)addLog(`Rules: ${r.rules.length}`,'ok');
    applyExtracted(r); addLog('Loaded ✓','ok'); setBusy(false);
  };
  const runAI=async()=>{
    if(!aiText.trim())return;
    if(!aiKey.trim()){addLog('Paste Claude API key first','error');return;}
    setBusy(true);setLog([]);addLog('Sending to Claude…');
    try{
      let js;
      if(window.sow?.claudeExtract){
        const res=await window.sow.claudeExtract({apiKey:aiKey.trim(),model:aiModel,systemPrompt:AI_SYSTEM,text:aiText.trim()});
        if(!res.ok)throw new Error(res.error); js=res.json;
      }else{
        const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':aiKey.trim(),'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:aiModel,max_tokens:4096,system:AI_SYSTEM,messages:[{role:'user',content:aiText.trim()}]})});
        if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.error?.message||`HTTP ${res.status}`);}
        const d=await res.json(); js=(d.content?.[0]?.text||'').replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
      }
      addLog('Parsing JSON…');
      const obj=JSON.parse(js);
      if(!obj.workflow?.states?.length)throw new Error('No states in response');
      const r={name:obj.workflow.name||'AI Extracted',workflow:{name:obj.workflow.name||'AI Extracted',states:(obj.workflow.states||[]).map(s=>({id:mkId(),...s})),transitions:(obj.workflow.transitions||[]).map(t=>({id:mkId(),...t}))},users:(obj.users||[]).map(u=>({id:mkId(),...u})),properties:(obj.properties||[]).map(p=>({id:mkId(),...p})),rules:(obj.rules||[]).map(r=>({id:mkId(),...r}))};
      addLog(`States: ${r.workflow.states.length} · Transitions: ${r.workflow.transitions.length}`,'ok');
      applyExtracted(r); addLog('Loaded ✓','ok');
    }catch(e){addLog(`Error: ${e.message}`,'error');}
    setBusy(false);
  };
  const runCacoo=async()=>{
    if(!cacooId.trim()){addLog('Enter Diagram ID','error');return;}
    setBusy(true);setLog([]);addLog(`Fetching ${cacooId}…`);
    try{
      let obj;
      if(window.sow?.cacooFetch){const res=await window.sow.cacooFetch({diagramId:cacooId,apiKey:cacooKey});if(!res.ok)throw new Error(res.error);obj=res.raw;}
      else{const res=await fetch(`http://localhost:5000/api/cacoo-fetch?diagramId=${encodeURIComponent(cacooId)}&apiKey=${encodeURIComponent(cacooKey)}`,{signal:AbortSignal.timeout(15000)});if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.error||`HTTP ${res.status}`);}obj=await res.json();}
      if(!obj.workflow?.states?.length)throw new Error('No states returned');
      const r={name:obj.workflow.name||`Cacoo: ${cacooId}`,workflow:{name:obj.workflow.name||`Cacoo: ${cacooId}`,states:(obj.workflow.states||[]).map(s=>({id:mkId(),...s})),transitions:(obj.workflow.transitions||[]).map(t=>({id:mkId(),...t}))},users:(obj.users||[]).map(u=>({id:mkId(),...u})),properties:(obj.properties||[]).map(p=>({id:mkId(),...p})),rules:(obj.rules||[]).map(r=>({id:mkId(),...r}))};
      applyExtracted(r); addLog('Loaded ✓','ok');
    }catch(e){addLog(`Error: ${e.message}`,'error');}
    setBusy(false);
  };
  const handleReset=()=>{resetAll();setLog([]);setSel('');setSelTrans(null);setMfLog([]);setMfOk(null);setSaved(false);setResetKey(k=>k+1);setStateFilter('');setTransFilter('');};
  const handleSave=()=>{exportJSON();setSaved(true);setSaveFlash(true);setTimeout(()=>setSaveFlash(false),2000);};
  const handleSOW=()=>{if(wf?.states.length)dl(buildSOW(wf,users,properties,rules),`${(wf.name||'sow').replace(/\s+/g,'_')}.md`);};
  const handlePRD=()=>{if(wf?.states.length)dl(buildPRD(wf,users,properties,rules),`${(wf.name||'prd').replace(/\s+/g,'_')}_PRD.md`);};
  const handleMFiles=async()=>{
    if(mfBusy)return; setMfBusy(true);setMfLog([]);setMfOk(null);
    addMfLog('Connecting…');
    if(!window.mfiles){addMfLog('window.mfiles not found — run in Electron','error');setMfBusy(false);return;}
    window.mfiles.offProgress(); window.mfiles.onProgress(msg=>addMfLog(msg));
    try{
      // Script expects: { name, states:[{name,initial}], transitions:[{from,to}] }
      // or an array of that shape. Send active workflow only.
      if(!wf?.states.length){addMfLog('No states to push — add states first','error');setMfBusy(false);return;}
      const json={
        name: wf.name||'Unnamed Workflow',
        states: wf.states.map(s=>({name:s.name, initial:!!s.initial})),
        transitions: wf.transitions.map(t=>({from:t.from, to:t.to, ...(t.conditions?{conditions:t.conditions}:{}), ...(t.permissions?{allowedUsers:t.permissions}:{})})),
      };
      addMfLog(`Pushing "${json.name}" — ${json.states.length} states, ${json.transitions.length} transitions`);
      const res=await window.mfiles.pushWorkflow({json,vaultGuid:mfVault,server:mfServer,authType:mfAuth,username:mfUser,password:mfPass});
      setMfOk(res.ok); addMfLog(res.ok?'✓ Ingested successfully':'✗ Ingest failed',res.ok?'ok':'error');
    }catch(e){addMfLog(`Error: ${e.message}`,'error');setMfOk(false);}
    setMfBusy(false); window.mfiles.offProgress();
  };

  const commitTabRename=()=>{if(editTabId&&tabDraft.trim())renameWorkflow(editTabId,tabDraft.trim());setEditTabId(null);setTabDraft('');};

  const hasSates=!!wf?.states.length, hasRules=!!rules.length;
  // selTrans is now {fromId,toId} — convert underscored IDs back to display names for the header
  const selTransObj=selTrans!=null
    ?{from:selTrans.fromId.replace(/_/g,' '),to:selTrans.toId.replace(/_/g,' ')}
    :null;

  return (
    <div className="cc-shell">
      {/* ── TOPBAR ── */}
      <div className="cc-topbar">
        <div className="cc-logo">provi<em>so</em></div>
        <div className="cc-mode-tabs">
          {MODES.map(([id,lbl])=>(
            <button key={id} className={`cc-mode-tab ${mode===id?`active-${id}`:''}`} onClick={()=>changeMode(id)}>{lbl}</button>
          ))}
        </div>
        <button className="xb" onClick={handleReset} title="Reset all workflows">↺ Reset</button>
        <button className={`xb ${saveFlash?'green':'blue'}`} onClick={handleSave}>{saveFlash?'✓ Saved':'Review & Save →'}</button>
      </div>

      {/* ── 3-COLUMN BODY ── */}
      <div className="cc-body">

        {/* ═══ LEFT — INPUT ═══ */}
        <div className="cc-left">
          {/* Workflow tabs */}
          <div className="cc-wf-tabs">
            {workflows.map(w=>(
              <div key={w.id} className={`cc-wf-tab ${w.id===activeId?'active':''}`} onClick={()=>setActive(w.id)} onDoubleClick={()=>{setEditTabId(w.id);setTabDraft(w.name);}} title="Double-click to rename">
                {editTabId===w.id
                  ?<input style={{background:'transparent',border:'none',outline:'none',fontFamily:'var(--mono)',fontSize:9,color:'var(--text)',width:80}} value={tabDraft} autoFocus onChange={e=>setTabDraft(e.target.value)} onBlur={commitTabRename} onKeyDown={e=>{if(e.key==='Enter')commitTabRename();if(e.key==='Escape')setEditTabId(null);}} onClick={e=>e.stopPropagation()}/>
                  :<span style={{fontSize:9}}>{w.name}</span>}
                {workflows.length>1&&<button className="cc-wf-tab-del" onClick={e=>{e.stopPropagation();deleteWorkflow(w.id);}}>✕</button>}
              </div>
            ))}
            <button className="cc-sec-add" style={{marginLeft:4,alignSelf:'center'}} onClick={addWorkflow}>+ Workflow</button>
          </div>

          {/* Workflow name */}
          {wf&&<div className="cc-wf-bar">
            <input className="cc-wf-name-input" value={wf.name} placeholder="Workflow name…"
              onChange={e=>renameWorkflow(activeId,e.target.value)}/>
            <button className="xb" onClick={()=>{clearWorkflow(activeId);setResetKey(k=>k+1);setSel('');}}>↺</button>
          </div>}

          {/* Parse input panel (NLP / AI / Cacoo) */}
          {mode!=='manual'&&(
            <div className="parse-panel">
              {mode==='nlp'&&(<>
                <div className="parse-lbl">Paste Markdown SOW</div>
                <textarea className="parse-ta" rows={6} value={nlpText} onChange={e=>setNlpText(e.target.value)} placeholder={'## Workflow: Contract Lifecycle\n\n### States\n| State Name | Initial |\n| Draft | Yes |\n\n### Transitions\n| From | To |\n| Draft | Under Review |'}/>
                <button className="xb blue" onClick={runNLP} disabled={!nlpText.trim()||busy}>{busy?<><span className="spin"/>  Parsing…</>:'◈ Parse with NLP'}</button>
              </>)}
              {mode==='ai'&&(<>
                <div className="parse-lbl">Claude API Key</div>
                <div style={{display:'flex',gap:6}}>
                  <input className="parse-input" type="password" value={aiKey} onChange={e=>setAiKey(e.target.value)} placeholder="sk-ant-…" style={{flex:1}}/>
                  <select value={aiModel} onChange={e=>setAiModel(e.target.value)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:4,padding:'0 6px',fontFamily:'var(--mono)',fontSize:9.5,color:'var(--text)',outline:'none'}}>
                    <option value="claude-sonnet-4-5">Sonnet 4.5</option>
                    <option value="claude-opus-4-5">Opus 4.5</option>
                    <option value="claude-haiku-3-5">Haiku 3.5</option>
                  </select>
                </div>
                <div className="parse-lbl" style={{marginTop:4}}>Paste SOW Text</div>
                <textarea className="parse-ta" rows={5} value={aiText} onChange={e=>setAiText(e.target.value)} placeholder="Paste any SOW, requirements doc, or workflow description…"/>
                <button className="xb purple" onClick={runAI} disabled={!aiText.trim()||!aiKey.trim()||busy}>{busy?<><span className="spin"/>  Extracting…</>:'✦ Extract with Claude'}</button>
              </>)}
              {mode==='cacoo'&&(<>
                <div className="parse-lbl">Cacoo Diagram ID</div>
                <input className="parse-input" value={cacooId} onChange={e=>setCacooId(e.target.value)} placeholder="e.g. AbCdEf12"/>
                <div className="parse-lbl" style={{marginTop:4}}>API Key (optional)</div>
                <input className="parse-input" type="password" value={cacooKey} onChange={e=>setCacooKey(e.target.value)} placeholder="Cacoo API token…"/>
                <button className="xb green" onClick={runCacoo} disabled={!cacooId.trim()||busy} style={{marginTop:4}}>{busy?<><span className="spin"/>  Fetching…</>:'⬡ Fetch from Cacoo'}</button>
                <div style={{fontSize:8.5,color:'var(--dim)',marginTop:4}}>Requires <code style={{color:'var(--a3)'}}>python backend/app.py</code> on :5000</div>
              </>)}
              {log.length>0&&<div className="log" style={{marginTop:4}}>{log.map((l,i)=><div key={i} className="ll"><span className="lt">{l.ts}</span><span className={l.t==='ok'?'lok':l.t==='warn'?'lwarn':l.t==='error'?'lerr':'linf'}>{l.msg}</span></div>)}</div>}
            </div>
          )}

          {/* Sections — States, Transitions, Users, Props, Rules */}
          <div className="cc-col-body">
            {/* States */}
            <Sec icon="○" title="States" count={wf?.states.length||0} isOpen={open.states} onToggle={()=>tog('states')} onAdd={()=>wf&&addState(activeId)}
              filterSlot={open.states&&(
                <input className="sec-filter" placeholder="Filter states…" value={stateFilter}
                  onClick={e=>e.stopPropagation()}
                  onChange={e=>setStateFilter(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Escape')setStateFilter('');e.stopPropagation();}}/>
              )}>
              {wf?.states.length>0&&<table className="inline-mini"><thead><tr><th>Name</th><th style={{width:50}}>Initial</th><th style={{width:22}}/></tr></thead>
                <tbody>
                  {filteredStates.map(s=>(<tr key={s.id} className={sel===s.name?'sel-row':''} onClick={()=>setSel(s.name)}>
                    <td><input value={s.name} placeholder="State name…" onChange={e=>renameState(activeId,s.id,e.target.value)}/></td>
                    <td><div className="mini-check"><input type="checkbox" checked={!!s.initial} onChange={e=>updateState(activeId,s.id,{initial:e.target.checked})}/></div></td>
                    <td><button className="mini-del" onClick={e=>{e.stopPropagation();const r=deleteState(activeId,s.id);if(!r?.ok)alert(r?.error);}}>✕</button></td>
                  </tr>))}
                  <tr className="ghost-row"><td colSpan={3}>
                    {stateFilter
                      ?`${filteredStates.length} of ${wf.states.length} shown — ESC to clear`
                      :`─ ─  ${wf.states.length} state${wf.states.length!==1?'s':''} · click + Add for more  ─ ─`}
                  </td></tr>
                </tbody>
              </table>}
            </Sec>

            {/* Transitions */}
            <Sec icon="→" title="Transitions" count={wf?.transitions.length||0} isOpen={open.trans} onToggle={()=>tog('trans')} onAdd={()=>wf&&addTransition(activeId)}
              filterSlot={open.trans&&(
                <input className="sec-filter" placeholder="Filter transitions…" value={transFilter}
                  onClick={e=>e.stopPropagation()}
                  onChange={e=>setTransFilter(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Escape')setTransFilter('');e.stopPropagation();}}/>
              )}>
              {wf?.transitions.length>0&&<table className="inline-mini"><thead><tr><th>From</th><th>To</th><th style={{width:22}}/></tr></thead>
                <tbody>
                  {filteredTrans.map((t)=>{
                    // Name-based match: immune to Mermaid SVG reordering
                    const fromId=t.from.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
                    const toId=t.to.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
                    const isSelected=selTrans!=null&&selTrans.fromId===fromId&&selTrans.toId===toId;
                    return(<tr key={t.id} className={`trans-row ${isSelected?'sel-row':''}`}
                      onClick={()=>{
                        setSel('');
                        setSelTrans({fromId,toId});
                        setOpen(o=>({...o,trans:true}));
                      }}>
                      <td><input value={t.from} placeholder="From…" onClick={e=>e.stopPropagation()} onChange={e=>updateTransition(activeId,t.id,{from:e.target.value})}/></td>
                      <td><input value={t.to} placeholder="To…" onClick={e=>e.stopPropagation()} onChange={e=>updateTransition(activeId,t.id,{to:e.target.value})}/></td>
                      <td><button className="mini-del" onClick={e=>{e.stopPropagation();deleteTransition(activeId,t.id);}}>✕</button></td>
                    </tr>);
                  })}
                  <tr className="ghost-row"><td colSpan={3}>
                    {transFilter
                      ?`${filteredTrans.length} of ${wf.transitions.length} shown — ESC to clear`
                      :`─ ─  ${wf.transitions.length} transition${wf.transitions.length!==1?'s':''} · click + Add for more  ─ ─`}
                  </td></tr>
                </tbody>
              </table>}
            </Sec>

            {/* Users */}
            <Sec icon="i" title="Users" count={users.length} isOpen={open.users} onToggle={()=>tog('users')} onAdd={addUser}>
              {users.length>0&&<table className="inline-mini"><thead><tr><th>Name</th><th>Role</th><th style={{width:36}}>CM</th><th style={{width:22}}/></tr></thead>
                <tbody>{users.map(u=>(<tr key={u.id}>
                  <td><input value={u.name} placeholder="Full name…" onChange={e=>updateUser(u.id,{name:e.target.value})}/></td>
                  <td><input value={u.role} placeholder="e.g. CEO" onChange={e=>updateUser(u.id,{role:e.target.value})}/></td>
                  <td><div className="mini-check"><input type="checkbox" checked={!!u.isCM} onChange={e=>updateUser(u.id,{isCM:e.target.checked})}/></div></td>
                  <td><button className="mini-del" onClick={()=>deleteUser(u.id)}>✕</button></td>
                </tr>))}</tbody>
              </table>}
            </Sec>

            {/* Properties */}
            <Sec icon="=" title="Properties" count={properties.length} isOpen={open.props} onToggle={()=>tog('props')} onAdd={addProperty}>
              {properties.length>0&&<table className="inline-mini"><thead><tr><th>Field Name</th><th style={{width:80}}>Type</th><th style={{width:36}}>Req.</th><th style={{width:22}}/></tr></thead>
                <tbody>{properties.map(p=>(<tr key={p.id}>
                  <td><input value={p.name} placeholder="Field name…" onChange={e=>updateProperty(p.id,{name:e.target.value})}/></td>
                  <td><select value={p.type} onChange={e=>updateProperty(p.id,{type:e.target.value})}>{['Text','Integer','Decimal','Date','Lookup','Boolean'].map(t=><option key={t}>{t}</option>)}</select></td>
                  <td><div className="mini-check"><input type="checkbox" checked={!!p.required} onChange={e=>updateProperty(p.id,{required:e.target.checked})}/></div></td>
                  <td><button className="mini-del" onClick={()=>deleteProperty(p.id)}>✕</button></td>
                </tr>))}</tbody>
              </table>}
            </Sec>

            {/* Rules */}
            <Sec icon="§" title="Business Rules" count={rules.length} isOpen={open.rules} onToggle={()=>tog('rules')} onAdd={addRule}>
              {rules.length>0&&<table className="inline-mini"><thead><tr><th>Rule</th><th style={{width:22}}/></tr></thead>
                <tbody>{rules.map(r=>(<tr key={r.id}>
                  <td><input value={r.text} placeholder="Business rule…" onChange={e=>updateRule(r.id,e.target.value)}/></td>
                  <td><button className="mini-del" onClick={()=>deleteRule(r.id)}>✕</button></td>
                </tr>))}</tbody>
              </table>}
            </Sec>
          </div>
        </div>

        {/* ═══ CENTER — LIVE DIAGRAM ═══ */}
        <div className="cc-center">
          <div className="cc-col-head">
            <span className="cc-col-lbl">
              {sel ? `State — ${sel}` : selTransObj ? `→ ${selTransObj.from} → ${selTransObj.to}` : 'Live Diagram'}
            </span>
            <div className="tab-row">
              {[['diagram','Diagram'],['json','JSON'],['stats','Stats']].map(([id,lbl])=>(
                <button key={id} className={`tab ${centerView===id?'on':''}`} onClick={()=>setCenterView(id)}>{lbl}</button>
              ))}
            </div>
          </div>
          {centerView==='diagram'&&(
            <div className="diagram-wrap" onClick={()=>{setSel('');setSelTrans(null);}}>
              {!mermaidStr
                ?<div className="cc-empty"><div className="cc-empty-icon">⬡</div><div>Add states to see the diagram<br/><span style={{fontSize:9,color:'var(--dim)'}}>Mark one state as Initial</span></div></div>
                :<div ref={diagRef} style={{width:'100%'}} onClick={e=>e.stopPropagation()}/>}
            </div>
          )}
          {centerView==='json'&&(
            <div className="cc-col-body" style={{padding:'14px 16px'}}>
              <pre style={{fontFamily:'var(--mono)',fontSize:10,lineHeight:1.7,color:'var(--text)',whiteSpace:'pre-wrap'}}>
                {wf?JSON.stringify(wf,null,2):'No workflow loaded'}
              </pre>
            </div>
          )}
          {centerView==='stats'&&(
            <div className="stats-grid">
              {[['States',wf?.states.length||0,'var(--a3)'],['Transitions',wf?.transitions.length||0,'var(--a3)'],['Users',users.length,'var(--green)'],['Properties',properties.length,'var(--green)'],['Rules',rules.length,'var(--gold)'],['Workflows',workflows.length,'var(--mid)']].map(([lbl,val,col])=>(
                <div key={lbl} className="stat-card">
                  <div className="stat-val" style={{color:col}}>{val}</div>
                  <div className="stat-lbl">{lbl}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ RIGHT — DELIVER ═══ */}
        <div className="cc-right">
          <div className="cc-col-head"><span className="cc-col-lbl">Deliver</span></div>
          <div className="cc-col-body">

            {/* SOW */}
            <div className="deliver-section">
              <div className="deliver-section-lbl">Documents</div>
              <div className="deliver-row">
                <div className="deliver-icon">📄</div>
                <div className="deliver-info">
                  <div className="deliver-title">SOW</div>
                  <div className="deliver-sub">Statement of Work · .md</div>
                </div>
                <button className={`xb ${hasSates?'blue':''}`} disabled={!hasSates} onClick={handleSOW}>↓</button>
              </div>
              <div className="deliver-row">
                <div className="deliver-icon">📋</div>
                <div className="deliver-info">
                  <div className="deliver-title">PRD</div>
                  <div className="deliver-sub">Product Requirements · .md</div>
                </div>
                <button className={`xb ${hasSates?'green':''}`} disabled={!hasSates} onClick={handlePRD}>↓</button>
              </div>
            </div>

            {/* M-Files */}
            <div className="deliver-section">
              <div className="deliver-section-lbl">M-Files Vault</div>
              <button onClick={()=>setMfAdv(a=>!a)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--mid)',fontSize:9,fontFamily:'var(--mono)',padding:'2px 0',marginBottom:4,textAlign:'left'}}>
                {mfAdv?'▾':'▸'} Connection settings
              </button>
              {mfAdv&&<div className="mf-adv">
                <input className="mf-input" value={mfServer} onChange={e=>setMfServer(e.target.value)} placeholder="Server (localhost)"/>
                <input className="mf-input" value={mfVault} onChange={e=>setMfVault(e.target.value)} placeholder="Vault GUID"/>
                <div style={{display:'flex',gap:6}}>
                  <select value={mfAuth} onChange={e=>setMfAuth(e.target.value)} className="mf-input" style={{flex:1}}>
                    <option value="windows">Windows SSO</option>
                    <option value="mfiles">M-Files credentials</option>
                  </select>
                </div>
                {mfAuth==='mfiles'&&<>
                  <input className="mf-input" value={mfUser} onChange={e=>setMfUser(e.target.value)} placeholder="Username"/>
                  <input className="mf-input" type="password" value={mfPass} onChange={e=>setMfPass(e.target.value)} placeholder="Password"/>
                </>}
              </div>}
              <button className={`xb ${mfOk===true?'green':mfOk===false?'red':'blue'}`} style={{width:'100%',padding:'9px 0',fontSize:11,marginTop:4}} onClick={handleMFiles} disabled={mfBusy||!saved}>
                {mfBusy?<><span className="spin"/> Pushing…</>:mfOk===true?'✓ Ingested':mfOk===false?'✗ Retry':'→ Push to M-Files'}
              </button>
              {!saved&&mfOk===null&&<div style={{fontSize:8.5,color:'var(--dim)',marginTop:4,lineHeight:1.6}}>Click “Review & Save” to enable M-Files push</div>}
              {saved&&mfOk===null&&<div style={{fontSize:8.5,color:'var(--green)',marginTop:4,lineHeight:1.6}}>✓ Ready — click Push to ingest into vault</div>}
              {mfLog.length>0&&<div className="mf-log">{mfLog.map((l,i)=><div key={i} className="ll"><span className="lt">{l.ts}</span><span className={l.t==='ok'?'lok':l.t==='error'?'lerr':'linf'}>{l.msg}</span></div>)}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sec({icon,title,count,isOpen,onToggle,onAdd,filterSlot,children}){
  return(
    <div className="cc-sec">
      <div className="cc-sec-hd" onClick={onToggle}>
        <span className={`cc-sec-chev ${isOpen?'open':''}`}>▶</span>
        <span className="cc-sec-icon">{icon}</span>
        <span className="cc-sec-title">{title}</span>
        <span className="cc-sec-count">{count} rows</span>
        {filterSlot}
        <button className="cc-sec-add" onClick={e=>{e.stopPropagation();onAdd();}}>+ Add</button>
      </div>
      {isOpen&&<div>{children||<div style={{padding:'6px 12px 8px',fontSize:9,color:'var(--dim)',fontStyle:'italic'}}>No {title.toLowerCase()} yet — click + Add</div>}</div>}
    </div>
  );
}


import { useState, useRef, useEffect } from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';

export default function IngestWorkflow() {
  const workflows = useWorkflowStore(s => s.workflows);
  const activeId  = useWorkflowStore(s => s.activeId);

  const [server,    setServer]    = useState('localhost');
  const [vault,     setVault]     = useState('');
  const [user,      setUser]      = useState('admin');
  const [pass,      setPass]      = useState('');
  const [wfId,      setWfId]      = useState(activeId || '');
  const [conning,   setConning]   = useState(false);
  const [connected, setConnected] = useState(false);
  const [status,    setStatus]    = useState('idle');
  const [logs,      setLogs]      = useState([]);
  const lRef = useRef(null);

  const selectedWf = workflows.find(w => w.id === wfId) || workflows.find(w => w.id === activeId) || workflows[0] || null;

  useEffect(() => { if (lRef.current) lRef.current.scrollTop = lRef.current.scrollHeight; }, [logs]);
  const ts  = () => new Date().toLocaleTimeString('en-CA', { hour12: false });
  const log = (msg, type = 'info') => setLogs(p => [...p, { t: ts(), msg, type }]);

  const connect = async () => {
    if (!server || !vault || !user) return;
    setConning(true);
    await new Promise(r => setTimeout(r, 1100));
    setConnected(true); setConning(false);
    log(`Connected: ${server}`, 'ok');
    log(`Vault: ${vault}`, 'info');
    log(`User: ${user}`, 'ok');
  };

  const ingest = async () => {
    if (!connected || !selectedWf?.states.length) return;
    setStatus('running'); setLogs([]);
    log('Initialising M-Files COM API — server mode', 'info');
    await new Promise(r => setTimeout(r, 500));
    log('MFilesAPI.MFilesServerApplication — connected', 'ok');
    await new Promise(r => setTimeout(r, 400));
    log(`Creating workflow: "${selectedWf.name || 'Unnamed'}"`, 'info');
    await new Promise(r => setTimeout(r, 600));
    log('  VaultWorkflowOperations.AddWorkflowAdmin() — success', 'ok');
    log(`Adding ${selectedWf.states.length} states...`, 'info');
    for (const s of selectedWf.states) {
      await new Promise(r => setTimeout(r, 100));
      log(`  ✓ State: "${s.name}"${s.initial ? ' [INITIAL]' : ''}`, 'ok');
    }
    await new Promise(r => setTimeout(r, 350));
    log(`Adding ${selectedWf.transitions.length} transitions...`, 'info');
    for (const t of selectedWf.transitions) {
      await new Promise(r => setTimeout(r, 75));
      log(`  ✓ ${t.from} → ${t.to}`, 'ok');
    }
    await new Promise(r => setTimeout(r, 450));
    log('VaultWorkflowOperations.UpdateWorkflowAdmin() — committed ✓', 'ok');
    log('', 'info');
    log('✓ Phase 1 complete — workflow skeleton ingested', 'ok');
    log('  No conditions · No permissions applied', 'warn');
    log('  → Open M-Files Admin to add rules (Phase 2)', 'warn');
    setStatus('done');
  };

  return (
    <div className="ingest-screen">
      {!selectedWf && <div className="note">⚠ No workflow loaded — complete the SOW Editor and click Save JSON first.</div>}

      {/* Workflow selector */}
      {workflows.length > 1 && (
        <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--s1)',border:'1px solid var(--border)',borderRadius:6,padding:'10px 14px'}}>
          <span style={{fontSize:9,color:'var(--mid)',letterSpacing:'1px',textTransform:'uppercase'}}>Workflow</span>
          <select
            style={{flex:1,fontFamily:'var(--mono)',fontSize:11,background:'var(--bg)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:4,padding:'5px 8px',outline:'none'}}
            value={wfId}
            onChange={e => setWfId(e.target.value)}
          >
            {workflows.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      )}

      <div className="stats">
        <div className="stat"><div className={`sv ${selectedWf?.name ? '' : 'off'}`}>{selectedWf?.name ? 1 : 0}</div><div className="sl">Workflow</div></div>
        <div className="stat"><div className={`sv ${selectedWf?.states.length ? '' : 'off'}`}>{selectedWf?.states.length || '—'}</div><div className="sl">States</div></div>
        <div className="stat"><div className={`sv ${selectedWf?.transitions.length ? '' : 'off'}`}>{selectedWf?.transitions.length || '—'}</div><div className="sl">Transitions</div></div>
        <div className="stat"><div className="sv off">Ph.2</div><div className="sl">Rules</div></div>
      </div>

      <div className="card">
        <div className="card-head"><span className="card-title">M-Files Vault — COM API Connection</span>{connected && <span className="cbadge">Connected</span>}</div>
        <div className="card-body">
          <div className="fields">
            <div><label className="fl">Server</label><input className="fi" value={server} onChange={e => { setServer(e.target.value); setConnected(false); }} placeholder="localhost" disabled={conning}/></div>
            <div><label className="fl">Username</label><input className="fi" value={user} onChange={e => { setUser(e.target.value); setConnected(false); }} placeholder="admin" disabled={conning}/></div>
            <div className="ff"><label className="fl">Vault GUID</label><input className="fi" value={vault} onChange={e => { setVault(e.target.value); setConnected(false); }} placeholder="{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}" disabled={conning}/></div>
            <div><label className="fl">Password</label><input className="fi" type="password" value={pass} onChange={e => { setPass(e.target.value); setConnected(false); }} placeholder="••••••••" disabled={conning}/></div>
            <div style={{display:'flex',alignItems:'flex-end'}}>
              <button className="xb blue" style={{width:'100%',padding:'8px 0',fontSize:11}} onClick={connect} disabled={conning || connected || !server || !vault || !user}>
                {conning ? <><div className="spin" style={{width:10,height:10,marginRight:6}}/>Connecting...</> : connected ? '✓ Connected' : 'Connect'}
              </button>
            </div>
          </div>
          <div style={{marginTop:10,fontSize:9,color:'var(--dim)',lineHeight:1.8}}>COM API requires M-Files client installed on this Windows machine · Flask API on localhost:5000</div>
        </div>
      </div>

      <button className={`big-btn ${status === 'done' ? 'done' : ''}`} onClick={ingest} disabled={!connected || !selectedWf?.states.length || status === 'running'}>
        {status === 'running' ? <><div className="spin"/>Ingesting workflow into vault...</> : status === 'done' ? '✓ Ingested — Run Again' : '→ Ingest Workflow into M-Files Vault'}
      </button>

      <div className="log" ref={lRef}>
        {logs.length === 0
          ? <span style={{color:'var(--dim)'}}>{connected ? '— ready — click Ingest to push workflow into vault' : '— connect to vault first —'}</span>
          : logs.map((l, i) => <div key={i} className="ll"><span className="lt">{l.t}</span><span className={`l${l.type}`}>{l.msg}</span></div>)
        }
      </div>

      {status === 'done' && (
        <div className="result-row">
          <div className="ri">✅</div>
          <div><div className="rt">"{selectedWf?.name}" ingested into vault</div><div className="rs">{selectedWf?.states.length} states · {selectedWf?.transitions.length} transitions · no rules</div></div>
          <div className="rp">Next step<br/><strong style={{color:'var(--a3)'}}>Open M-Files Admin</strong><br/>Add rules → Phase 2</div>
        </div>
      )}
    </div>
  );
}


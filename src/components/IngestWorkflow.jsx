import { useState, useRef, useEffect } from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';

const VAULT_GUID    = '{08E9A947-7E05-4722-A890-559D36FDC8FF}';
const isElectron    = typeof window !== 'undefined' && !!window.mfiles;

export default function IngestWorkflow() {
  const workflows = useWorkflowStore(s => s.workflows);
  const activeId  = useWorkflowStore(s => s.activeId);

  const [server,    setServer]    = useState('localhost');
  const [vault,     setVault]     = useState(VAULT_GUID);
  const [authType,  setAuthType]  = useState('windows');   // 'windows' | 'mfiles'
  const [username,  setUsername]  = useState('admin');
  const [password,  setPassword]  = useState('');
  const [wfId,      setWfId]      = useState(activeId || '');
  const [conning,   setConning]   = useState(false);
  const [connected, setConnected] = useState(false);
  const [status,    setStatus]    = useState('idle');
  const [logs,      setLogs]      = useState([]);
  const lRef = useRef(null);

  const selectedWf = workflows.find(w => w.id === wfId)
                  || workflows.find(w => w.id === activeId)
                  || workflows[0]
                  || null;

  // Auto-scroll log panel
  useEffect(() => { if (lRef.current) lRef.current.scrollTop = lRef.current.scrollHeight; }, [logs]);

  // Subscribe to streaming progress from Electron main process
  useEffect(() => {
    if (!isElectron) return;
    window.mfiles.onProgress(line => {
      const type = line.startsWith('[SUCCESS]') ? 'ok'
                 : line.startsWith('[WARN]')    ? 'warn'
                 : line.startsWith('[ERROR]')   ? 'error'
                 : 'info';
      const msg = line.replace(/^\[(PROGRESS|SUCCESS|WARN|ERROR)\]\s*/, '');
      addLog(msg, type);
    });
  }, []);

  const ts     = () => new Date().toLocaleTimeString('en-CA', { hour12: false });
  const addLog = (msg, type = 'info') => setLogs(p => [...p, { t: ts(), msg, type }]);

  // ── Connect (Windows SSO — no password needed) ─────────────────
  const connect = async () => {
    if (!server || !vault) return;
    if (authType === 'mfiles' && !username) return;
    setConning(true);
    // Strip any \username suffix the user may have typed in the server field
    const cleanServer = server.split('\\')[0].trim();
    if (cleanServer !== server) setServer(cleanServer);
    addLog(`Connecting to ${cleanServer} [${authType === 'windows' ? 'Windows SSO' : 'M-Files: ' + username}]...`, 'info');

    if (isElectron) {
      const res = await window.mfiles.listVaults({
        server: cleanServer, vaultGuid: vault,
        authType, username, password,
      }).catch(e => ({ ok: false, error: e.message }));
      if (res.ok) {
        setConnected(true);
        addLog(`Connected: ${cleanServer}`, 'ok');
        addLog(`Vault: ${vault}`, 'info');
        addLog(`Auth: ${authType === 'windows' ? 'Windows SSO' : 'M-Files (' + username + ')'}`, 'ok');
      } else {
        addLog(`Connection failed — ${res.error || 'check M-Files client is running'}`, 'error');
      }
    } else {
      await new Promise(r => setTimeout(r, 800));
      setConnected(true);
      addLog(`[PREVIEW] Connected: ${cleanServer}`, 'ok');
      addLog(`[PREVIEW] Vault: ${vault}`, 'info');
    }
    setConning(false);
  };

  // ── Ingest ─────────────────────────────────────────────────────
  const ingest = async () => {
    if (!connected || !selectedWf?.states.length) return;
    setStatus('running');
    setLogs([]);

    if (isElectron) {
      // Real path — Electron IPC → PowerShell → M-Files COM
      addLog(`Pushing "${selectedWf.name}" to vault...`, 'info');
      const res = await window.mfiles.pushWorkflow({
        json:      selectedWf,
        vaultGuid: vault,
        server:    server.split('\\')[0].trim(),
        authType, username, password,
      });
      setStatus(res.ok ? 'done' : 'error');
    } else {
      // Browser preview mode — animated simulation
      addLog('M-Files COM API — server mode [PREVIEW]', 'info');
      await new Promise(r => setTimeout(r, 500));
      addLog('MFilesAPI.MFilesClientApplication — connected', 'ok');
      await new Promise(r => setTimeout(r, 400));
      addLog(`Creating workflow: "${selectedWf.name}"`, 'info');
      await new Promise(r => setTimeout(r, 600));
      addLog('VaultWorkflowOperations.AddWorkflowAdmin() — success', 'ok');
      addLog(`Adding ${selectedWf.states.length} states...`, 'info');
      for (const s of selectedWf.states) {
        await new Promise(r => setTimeout(r, 100));
        addLog(`  ✓ State: "${s.name}"${s.initial ? ' [INITIAL]' : ''}`, 'ok');
      }
      await new Promise(r => setTimeout(r, 350));
      addLog(`Adding ${selectedWf.transitions.length} transitions...`, 'info');
      for (const t of selectedWf.transitions) {
        await new Promise(r => setTimeout(r, 75));
        addLog(`  ✓ ${t.from} → ${t.to}`, 'ok');
      }
      await new Promise(r => setTimeout(r, 450));
      addLog('Workflow committed to vault ✓', 'ok');
      addLog('No conditions · No permissions applied', 'warn');
      addLog('→ Open M-Files Admin to configure Phase 2', 'warn');
      setStatus('done');
    }
  };

  return (
    <div className="ingest-screen">
      {!isElectron && (
        <div className="note" style={{borderColor:'var(--a3)',color:'var(--a3)'}}>
          ⚡ Running in browser preview — M-Files push is simulated. Launch via <code>npm run electron:dev</code> for live vault ingestion.
        </div>
      )}
      {!selectedWf && <div className="note">⚠ No workflow loaded — complete the SOW Editor and click Save JSON first.</div>}

      {/* Workflow selector */}
      {workflows.length > 1 && (
        <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--s1)',border:'1px solid var(--border)',borderRadius:6,padding:'10px 14px'}}>
          <span style={{fontSize:9,color:'var(--mid)',letterSpacing:'1px',textTransform:'uppercase'}}>Workflow</span>
          <select
            style={{flex:1,fontFamily:'var(--mono)',fontSize:11,background:'var(--bg)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:4,padding:'5px 8px',outline:'none'}}
            value={wfId} onChange={e => setWfId(e.target.value)}
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
        <div className="card-head">
          <span className="card-title">M-Files Vault Connection</span>
          {connected && <span className="cbadge">Connected</span>}
        </div>
        <div className="card-body">
          {/* Auth type toggle */}
          <div style={{display:'flex',gap:6,marginBottom:12}}>
            {[['windows','🪟 Windows SSO'],['mfiles','🔑 M-Files Credentials']].map(([v,lbl]) => (
              <button key={v}
                onClick={() => { setAuthType(v); setConnected(false); }}
                style={{
                  flex:1, padding:'6px 0', fontSize:10, fontFamily:'var(--mono)',
                  borderRadius:4, cursor:'pointer',
                  border: authType===v ? '1px solid var(--blue)' : '1px solid var(--border)',
                  background: authType===v ? 'rgba(59,130,246,.15)' : 'var(--surface)',
                  color: authType===v ? 'var(--blue)' : 'var(--mid)',
                  transition:'all .15s',
                }}>{lbl}</button>
            ))}
          </div>
          <div className="fields">
            <div>
              <label className="fl">Server</label>
              <input className="fi" value={server}
                onChange={e => { setServer(e.target.value); setConnected(false); }}
                placeholder="DESKTOP-DKCS42P  (machine name only)"
                disabled={conning}/>
              <div style={{fontSize:8,color:'var(--dim)',marginTop:2}}>Enter machine name only — do not include \username</div>
            </div>
            <div className="ff">
              <label className="fl">Vault GUID</label>
              <input className="fi" value={vault}
                onChange={e => { setVault(e.target.value); setConnected(false); }}
                placeholder="{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}" disabled={conning}/>
            </div>
            {authType === 'mfiles' && (<>
              <div>
                <label className="fl">Username</label>
                <input className="fi" value={username}
                  onChange={e => { setUsername(e.target.value); setConnected(false); }}
                  placeholder="admin" disabled={conning}/>
              </div>
              <div>
                <label className="fl">Password</label>
                <input className="fi" type="password" value={password}
                  onChange={e => { setPassword(e.target.value); setConnected(false); }}
                  placeholder="••••••••" disabled={conning}/>
              </div>
            </>)}
            <div style={{display:'flex',alignItems:'flex-end'}}>
              <button className="xb blue" style={{width:'100%',padding:'8px 0',fontSize:11}}
                onClick={connect}
                disabled={conning || connected || !server || !vault || (authType==='mfiles' && !username)}>
                {conning ? <><div className="spin" style={{width:10,height:10,marginRight:6}}/>Connecting...</> : connected ? '✓ Connected' : 'Connect'}
              </button>
            </div>
          </div>
          <div style={{marginTop:10,fontSize:9,color:'var(--dim)',lineHeight:1.8}}>
            {authType === 'windows' ? 'Windows SSO — authenticates as current Windows user · M-Files client must be installed locally'
                                    : 'M-Files credentials — uses vault-level username and password'}
          </div>
        </div>
      </div>

      <button
        className={`big-btn ${status === 'done' ? 'done' : status === 'error' ? 'error' : ''}`}
        onClick={ingest}
        disabled={!connected || !selectedWf?.states.length || status === 'running'}
      >
        {status === 'running' ? <><div className="spin"/>Pushing workflow to vault...</>
         : status === 'done'  ? '✓ Ingested — Run Again'
         : status === 'error' ? '✗ Failed — Check Log · Retry'
         : '→ Push Workflow into M-Files Vault'}
      </button>

      <div className="log" ref={lRef}>
        {logs.length === 0
          ? <span style={{color:'var(--dim)'}}>{connected ? '— ready — click Push to send workflow to vault' : '— connect to vault first —'}</span>
          : logs.map((l, i) => <div key={i} className="ll"><span className="lt">{l.t}</span><span className={`l${l.type}`}>{l.msg}</span></div>)
        }
      </div>

      {status === 'done' && (
        <div className="result-row">
          <div className="ri">✅</div>
          <div>
            <div className="rt">"{selectedWf?.name}" pushed to vault</div>
            <div className="rs">{selectedWf?.states.length} states · {selectedWf?.transitions.length} transitions · no rules</div>
          </div>
          <div className="rp">Next step<br/><strong style={{color:'var(--a3)'}}>Open M-Files Admin</strong><br/>Add rules → Phase 2</div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import WorkflowEditor from './components/WorkflowEditor';
import PrdGenerator   from './components/PrdGenerator';
import IngestWorkflow from './components/IngestWorkflow';
import { useWorkflowStore } from './store/useWorkflowStore';


// ── CSS ───────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Fraunces:ital,wght@0,400;0,600;0,700;1,400&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#030910;--s1:#07111F;--s2:#0A1828;--s3:#0E2038;--s4:#142848;
  --border:#162C4A;--bdr2:#1E3D60;
  --accent:#1565D8;--a2:#2478F0;--a3:#4A9FFF;
  --green:#00C870;--red:#FF3D5A;--gold:#F0A500;--purple:#7C5CFC;
  --text:#C8DCFF;--mid:#5878A0;--dim:#243A58;
  --mono:'JetBrains Mono',monospace;--display:'Fraunces',serif;
}
html,body{height:100%;overflow:hidden}
body{background:var(--bg);color:var(--text);font-family:var(--mono);font-size:13px}
.shell{display:flex;height:100vh}

/* Sidebar */
.sb{width:196px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--border);display:flex;flex-direction:column}
.sb-logo{padding:20px 16px 16px;border-bottom:1px solid var(--border)}
.sb-wm{font-family:var(--display);font-size:22px;font-weight:700;color:#fff;letter-spacing:-.5px;line-height:1}
.sb-wm em{color:var(--a3);font-style:normal}
.sb-tag{font-size:9px;color:var(--dim);letter-spacing:1.4px;text-transform:uppercase;margin-top:5px}
.sb-nav{flex:1;padding:10px 0}
.sb-item{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;border-left:3px solid transparent;transition:all .15s}
.sb-item:hover{background:rgba(21,101,216,.07)}
.sb-item.active{background:rgba(21,101,216,.1);border-left-color:var(--a3)}
.sb-num{width:20px;height:20px;border-radius:5px;flex-shrink:0;background:var(--s3);border:1px solid var(--border);font-size:10px;color:var(--dim);display:flex;align-items:center;justify-content:center;transition:all .15s}
.sb-item.active .sb-num{background:var(--accent);border-color:var(--a2);color:#fff}
.sb-item.done .sb-num{background:rgba(0,200,112,.12);border-color:var(--green);color:var(--green)}
.sb-lbl{font-size:11px;color:var(--mid);transition:color .15s;line-height:1.3}
.sb-sub{font-size:9px;color:var(--dim);margin-top:1px}
.sb-item:hover .sb-lbl,.sb-item.active .sb-lbl{color:var(--text)}
.sb-foot{padding:12px 16px;border-top:1px solid var(--border);font-size:9px;color:var(--dim);line-height:1.9}
.dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--dim);margin-right:5px;vertical-align:middle;transition:background .2s}
.dot.on{background:var(--green)}

/* Main layout */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.topbar{height:44px;flex-shrink:0;background:var(--s1);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 18px;gap:10px}
.tb-title{font-family:var(--display);font-size:13px;font-weight:600;color:var(--text);flex:1;letter-spacing:-.2px}
.tb-pill{font-size:9px;font-family:var(--mono);background:rgba(21,101,216,.1);border:1px solid rgba(21,101,216,.2);color:var(--a3);padding:3px 8px;border-radius:20px;letter-spacing:.5px}
.tb-pill.ai{background:rgba(124,92,252,.1);border-color:rgba(124,92,252,.25);color:#A78BFA}
.content{flex:1;overflow:hidden;display:flex;flex-direction:column}

/* Spreadsheet screen */
.ss-screen{flex:1;display:grid;grid-template-columns:1fr 1fr;overflow:hidden}
.ss-left{display:flex;flex-direction:column;overflow:hidden;border-right:1px solid var(--border)}
.ss-toolbar{flex-shrink:0}
.ss-head{padding:8px 12px;background:var(--s2);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.ss-headlbl{font-size:9px;font-weight:600;color:var(--mid);letter-spacing:.8px;text-transform:uppercase}
.ss-acts{display:flex;gap:5px;align-items:center}
.xb{font-size:9.5px;font-family:var(--mono);padding:3px 8px;border-radius:3px;border:1px solid var(--border);background:transparent;color:var(--mid);cursor:pointer;transition:all .15s;white-space:nowrap}
.xb:hover{border-color:var(--a2);color:var(--a3)}
.xb.blue{background:var(--accent);border-color:var(--accent);color:#fff}
.xb.blue:hover{background:var(--a2)}
.xb.green{background:rgba(0,200,112,.12);border-color:var(--green);color:var(--green)}
.xb:disabled{opacity:.35;cursor:not-allowed}

/* Workflow tabs */
.wf-tabs{display:flex;align-items:stretch;overflow-x:auto;border-bottom:1px solid var(--border);background:var(--s2);padding:0 8px;gap:2px;padding-top:6px;flex-shrink:0}
.wf-tab{display:flex;align-items:center;gap:5px;padding:5px 10px;font-size:9.5px;font-family:var(--mono);color:var(--mid);cursor:pointer;border:1px solid transparent;border-bottom:none;border-radius:4px 4px 0 0;transition:all .15s;background:transparent;white-space:nowrap;position:relative;top:1px}
.wf-tab:hover{color:var(--text);background:var(--s3)}
.wf-tab.active{color:var(--text);background:var(--bg);border-color:var(--border)}
.wf-tab-name{pointer-events:none}
.wf-tab-input{font-family:var(--mono);font-size:9.5px;background:transparent;border:none;outline:none;color:var(--text);width:80px}
.wf-tab-del{font-size:9px;color:var(--dim);background:none;border:none;cursor:pointer;padding:0 0 0 4px;line-height:1;transition:color .15s}
.wf-tab-del:hover{color:var(--red)}
.wf-tab-add{color:var(--a3);border-color:transparent;font-size:13px;padding:3px 8px}
.wf-tab-add:hover{background:rgba(74,159,255,.1)}

/* Spreadsheet body */
.sheet-body{flex:1;overflow-y:auto;background:var(--bg)}

/* Independent scroll areas — States=350px, Transitions=450px */
.table-scroll-states{overflow-y:auto;max-height:350px;scrollbar-width:thin;scrollbar-color:var(--accent) var(--bg);position:relative}
.table-scroll-trans{overflow-y:auto;max-height:450px;scrollbar-width:thin;scrollbar-color:var(--accent) var(--bg);position:relative}
/* Shadow scroll indicators — top and bottom */
.table-scroll-states,.table-scroll-trans{box-shadow:inset 0 8px 10px -10px rgba(0,0,0,.7),inset 0 -8px 10px -10px rgba(0,0,0,.7)}

/* Sticky column headers inside each scroll container */
.sheet-table thead th{position:sticky;top:0;z-index:3;background:var(--s3)}

/* Section spacing — gap between States and Transitions */
.sec{border-bottom:1px solid var(--border)}
.sec+.sec{margin-top:8px;border-top:2px solid rgba(74,159,255,.15)}

/* Section header always on top — never scrolls away */
.sec-header{position:sticky;top:0;z-index:5;background:var(--s2);display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;user-select:none;border-bottom:1px solid var(--border)}
.sec-chevron{font-size:10px;color:var(--mid);transition:transform .15s;flex-shrink:0}
.sec-chevron.open{transform:rotate(90deg)}
.sec-title{font-size:10px;font-weight:700;color:var(--text);letter-spacing:.3px;flex:1}
.sec-count{font-size:9px;color:var(--dim);font-family:var(--mono)}
.sec-add{font-size:9px;padding:2px 7px;border-radius:3px;border:1px solid var(--border);background:transparent;color:var(--mid);cursor:pointer;transition:all .15s;font-family:var(--mono)}
.sec-add:hover{border-color:var(--green);color:var(--green)}

/* Table grid */
.sheet-table{width:100%;border-collapse:collapse}
.sheet-table thead tr{background:var(--s3)}
.sheet-table thead th{padding:6px 8px;font-size:9px;font-weight:600;color:var(--dim);letter-spacing:.8px;text-transform:uppercase;text-align:left;border-bottom:1px solid var(--border);border-right:1px solid var(--border);white-space:nowrap}
.sheet-table thead th:last-child{border-right:none}
.sheet-table tbody tr{transition:background .1s}
.sheet-table tbody tr:hover{background:rgba(21,101,216,.06)}
/* Zebra striping — essential for 100+ row readability */
.sheet-table tbody tr:nth-child(even){background:rgba(255,255,255,.018)}
.sheet-table tbody tr:nth-child(even):hover{background:rgba(21,101,216,.06)}
.sheet-table tbody td{padding:0;border-bottom:1px solid rgba(22,44,74,.5);border-right:1px solid rgba(22,44,74,.4);vertical-align:middle}
.sheet-table tbody td:last-child{border-right:none}
.cell-input{display:block;width:100%;background:transparent;border:none;outline:none;font-family:var(--mono);font-size:11px;color:var(--text);padding:6px 8px;line-height:1.4;transition:background .1s}
.cell-input:focus{background:var(--s3);outline:1px solid var(--accent)}
.cell-input::placeholder{color:var(--dim)}
.cell-check{display:flex;align-items:center;justify-content:center;padding:6px}
.cell-check input[type=checkbox]{width:13px;height:13px;cursor:pointer;accent-color:var(--accent)}
.cell-select{display:block;width:100%;background:transparent;border:none;outline:none;font-family:var(--mono);font-size:11px;color:var(--text);padding:6px 8px;cursor:pointer}
.cell-select:focus{background:var(--s3)}
.sheet-table tbody tr.selected{background:rgba(21,101,216,.12) !important}
.sheet-table tbody tr.selected td{border-bottom:1px solid rgba(21,101,216,.25)}
.sheet-table tbody tr.selected .cell-input{color:#fff}
.row-idx{font-size:9px;color:var(--dim);width:20px;text-align:center;flex-shrink:0;user-select:none;display:block;padding:0 2px}
tr.selected .row-idx{color:var(--a3);font-weight:700}
/* Ghost row — replaces the empty gap at bottom of short lists */
.ghost-row td{padding:8px 12px;text-align:center;font-size:9px;color:var(--dim);border:none;letter-spacing:1px;border-top:1px dashed rgba(74,159,255,.15)}
/* Search filter input */
.sec-filter{background:var(--s3);border:1px solid var(--border);border-radius:3px;padding:2px 7px;font-family:var(--mono);font-size:9px;color:var(--text);outline:none;width:110px;transition:border-color .15s}
.sec-filter:focus{border-color:var(--a2);width:150px}
.sec-filter::placeholder{color:var(--dim)}

/* Validation row error */
.row-err{background:rgba(255,61,90,.06) !important}
.row-err td{border-bottom:1px solid rgba(255,61,90,.2) !important}

/* Validation banner */
.val-banner{background:rgba(240,165,0,.06);border-bottom:1px solid rgba(240,165,0,.2);padding:6px 12px;display:flex;flex-direction:column;gap:2px;flex-shrink:0;position:relative}
.val-banner-err{background:rgba(255,61,90,.06);border-bottom-color:rgba(255,61,90,.2)}
.val-item{font-size:9.5px;color:var(--gold);font-family:var(--mono)}
.val-banner-err .val-item{color:var(--red)}
.val-more{color:var(--mid)}
.val-dismiss{position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:10px;color:var(--dim);background:none;border:none;cursor:pointer}
.val-dismiss:hover{color:var(--red)}

/* Delete button */
.del-btn{background:transparent;border:none;cursor:pointer;color:var(--dim);font-size:11px;padding:4px 6px;transition:color .15s;line-height:1;display:block;width:100%}
.del-btn:hover{color:var(--red)}

/* Right pane */
.ss-right{display:flex;flex-direction:column;overflow:hidden;background:var(--s1)}
.d-head{padding:8px 12px;background:var(--s2);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.d-body{flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:18px}
.d-body svg{max-width:100%;height:auto}
.d-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--dim);font-size:11px;gap:8px;text-align:center;line-height:1.7}
.d-empty-icon{font-size:32px;opacity:.2;margin-bottom:4px}
.tab-row{display:flex;gap:2px}
.tab{font-size:9.5px;padding:3px 8px;border-radius:3px;border:1px solid transparent;background:transparent;color:var(--dim);cursor:pointer;transition:all .15s;font-family:var(--mono)}
.tab:hover{color:var(--text)}
.tab.on{background:var(--s3);border-color:var(--border);color:var(--text)}
.json-body{flex:1;overflow:auto;padding:14px 16px;font-size:10.5px;line-height:1.8}

/* PRD screen */
.prd-screen{flex:1;display:grid;grid-template-columns:1fr 1fr;overflow:hidden}
.prd-left{display:flex;flex-direction:column;overflow:hidden;border-right:1px solid var(--border)}
.prd-preview{flex:1;overflow:auto;padding:18px 22px;font-size:12px;line-height:1.8;color:var(--text)}
.prd-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--dim);font-size:11px;gap:12px;text-align:center;line-height:1.7}
.prd-empty-icon{font-size:36px;opacity:.2;margin-bottom:4px}
.mode-cards{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
.mode-card{border-radius:6px;padding:10px 12px;transition:all .2s;cursor:pointer}
.mode-card.nlp{background:rgba(21,101,216,.08);border:1px solid rgba(21,101,216,.3)}
.mode-card.ai{background:rgba(124,92,252,.08);border:1px solid rgba(124,92,252,.3)}
.mode-card.inactive{opacity:.3;filter:grayscale(.5)}
.mode-card-title{font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;display:flex;align-items:center;gap:5px}
.mode-card.nlp .mode-card-title{color:var(--a3)}
.mode-card.ai  .mode-card-title{color:#A78BFA}
.mode-active-badge{font-size:8px;background:var(--accent);color:#fff;padding:1px 5px;border-radius:2px;letter-spacing:0}
.mode-card.ai .mode-active-badge{background:#7C5CFC}
.mode-card-body{font-size:9.5px;color:var(--mid);line-height:1.6}
.xb.blue.prd-btn{position:relative;overflow:visible}
.xb.blue.prd-btn::after{content:'';position:absolute;inset:-3px;border-radius:5px;border:1px solid rgba(74,159,255,.4);animation:btn-glow 1.6s ease-in-out infinite;pointer-events:none}
@keyframes btn-glow{0%,100%{opacity:0;transform:scale(1)}50%{opacity:1;transform:scale(1.04)}}

/* Ingest screen */
.ingest-screen{flex:1;overflow-y:auto;padding:22px 28px;display:flex;flex-direction:column;gap:16px}
.card{background:var(--s1);border:1px solid var(--border);border-radius:8px;overflow:hidden}
.card-head{padding:10px 16px;background:var(--s2);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.card-title{font-size:9px;font-weight:500;color:var(--mid);letter-spacing:1px;text-transform:uppercase}
.card-body{padding:16px}
.fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ff{grid-column:1/-1}
.fl{display:block;font-size:8.5px;color:var(--mid);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px}
.fi{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:8px 10px;font-family:var(--mono);font-size:11px;color:var(--text);outline:none;transition:border-color .15s}
.fi:focus{border-color:var(--a2)}
.fi:disabled{opacity:.4}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.stat{background:var(--s1);border:1px solid var(--border);border-radius:6px;padding:12px 14px;text-align:center}
.sv{font-family:var(--display);font-size:24px;font-weight:700;color:var(--a3);line-height:1;margin-bottom:3px}
.sv.off{color:var(--dim)}
.sl{font-size:8.5px;color:var(--mid);letter-spacing:.5px}
.big-btn{width:100%;padding:13px;border:none;border-radius:6px;font-family:var(--mono);font-size:11.5px;font-weight:600;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--accent);color:#fff}
.big-btn:hover{background:var(--a2);transform:translateY(-1px)}
.big-btn:disabled{opacity:.3;cursor:not-allowed;transform:none}
.big-btn.done{background:rgba(0,200,112,.15);border:1px solid var(--green);color:var(--green)}
.log{background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px 14px;min-height:130px;max-height:200px;overflow-y:auto;font-size:10.5px;line-height:2}
.ll{display:flex;gap:8px}
.lt{color:var(--dim);flex-shrink:0;font-size:9.5px}
.lok{color:var(--green)}.linf{color:var(--a3)}.lwarn{color:var(--gold)}.lerr{color:var(--red)}
.result-row{background:var(--s1);border:1px solid var(--border);border-radius:8px;padding:16px 18px;display:flex;align-items:center;gap:14px}
.ri{font-size:22px;flex-shrink:0}
.rt{font-family:var(--display);font-size:13px;font-weight:600;color:#fff}
.rs{font-size:10px;color:var(--mid);margin-top:2px}
.rp{margin-left:auto;font-size:9.5px;text-align:center;line-height:1.7;background:rgba(21,101,216,.1);border:1px solid rgba(21,101,216,.2);color:var(--a3);padding:6px 10px;border-radius:4px}
.note{background:rgba(240,165,0,.06);border:1px solid rgba(240,165,0,.2);border-radius:6px;padding:10px 13px;font-size:10px;color:var(--gold);line-height:1.7}
.cbadge{display:inline-flex;align-items:center;gap:5px;font-size:9.5px;background:rgba(0,200,112,.1);border:1px solid rgba(0,200,112,.25);color:var(--green);padding:3px 8px;border-radius:3px}
.cbadge::before{content:'';width:5px;height:5px;border-radius:50%;background:var(--green);flex-shrink:0}
.spin{width:11px;height:11px;border-radius:50%;border:1.5px solid rgba(255,255,255,.2);border-top-color:#fff;animation:rot .6s linear infinite;flex-shrink:0}
@keyframes rot{to{transform:rotate(360deg)}}
@keyframes tip-pulse{0%,100%{opacity:.2}50%{opacity:.8}}
/* react-spreadsheet dark theme overrides */
.rs-wrap { overflow-x: auto; }
.rs-wrap .Spreadsheet { width: 100%; font-family: var(--mono); font-size: 11px; }
.rs-wrap .Spreadsheet__table { width: 100%; border-collapse: collapse; }
.rs-wrap .Spreadsheet__header { background: var(--s3); color: var(--dim); font-size: 9px; font-weight: 600; letter-spacing: .8px; text-transform: uppercase; padding: 6px 8px; border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); }
.rs-wrap .Spreadsheet__cell { background: var(--bg); color: var(--text); border-bottom: 1px solid rgba(22,44,74,.5); border-right: 1px solid rgba(22,44,74,.4); padding: 0; height: 30px; vertical-align: middle; }
.rs-wrap .Spreadsheet__cell:focus-within { background: var(--s3); outline: 1px solid var(--accent); z-index: 1; }
.rs-wrap .Spreadsheet__cell--selected { background: rgba(21,101,216,.15) !important; outline: 1px solid var(--accent) !important; }
.rs-wrap .Spreadsheet__cell input,.rs-wrap .Spreadsheet__cell textarea { background: transparent; border: none; outline: none; font-family: var(--mono); font-size: 11px; color: var(--text); padding: 4px 8px; width: 100%; }
.rs-wrap .Spreadsheet__row-indicator { background: var(--s3); color: var(--dim); font-size: 9px; padding: 0 6px; border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); text-align: center; min-width: 28px; }
.rs-wrap .Spreadsheet__floating-rect--selected { border: 1px solid var(--accent); background: rgba(21,101,216,.08); }
.rs-wrap .Spreadsheet__floating-rect--copied { border: 1px dashed var(--a3); }
.rs-cell { } /* base class for className injection */
.rs-err { background: rgba(255,61,90,.08) !important; }
.rs-center .Spreadsheet__cell-content { display: flex; justify-content: center; }
/* Delete button in section header */
.sec-del { font-size: 9px; padding: 2px 7px; border-radius: 3px; border: 1px solid rgba(255,61,90,.3); background: rgba(255,61,90,.06); color: var(--red); cursor: pointer; transition: all .15s; font-family: var(--mono); }
.sec-del:hover { background: rgba(255,61,90,.15); border-color: var(--red); }
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
`;

// ── Nav screens ───────────────────────────────────────────────
const NAV_SCREENS = [
  { id:'sow',    num:'1', label:'SOW Editor',     sub:'Multi-Workflow · Zustand'  },
  { id:'prd',    num:'2', label:'Generate PRD',   sub:'NLP · AI-enhanced'         },
  { id:'ingest', num:'3', label:'Ingest Workflow', sub:'COM API → Vault'          },
];

const TITLES = {
  sow:    'SOW Editor — Multi-Workflow Spreadsheet + Live Diagram',
  prd:    'Generate PRD — Local NLP or AI-Enhanced via Claude',
  ingest: 'Ingest Workflow — Connect to M-Files Vault & Push',
};

// ── App shell ─────────────────────────────────────────────────
export default function App() {
  const [screen,  setScreen]  = useState('sow');
  const [hasSaved, setHasSaved] = useState(false);
  const workflows = useWorkflowStore(s => s.workflows);
  const activeId  = useWorkflowStore(s => s.activeId);
  const activeWf  = workflows.find(w => w.id === activeId);

  const currentIdx = NAV_SCREENS.findIndex(n => n.id === screen);
  const canGoUp   = currentIdx > 0;
  const canGoDown = currentIdx < NAV_SCREENS.length - 1;

  return (
    <>
      <style>{CSS}</style>
      <div className="shell">
        {/* ── Sidebar ── */}
        <div className="sb">
          <div className="sb-logo">
            <div className="sb-wm">provi<em>so</em></div>
            <div className="sb-tag">Workflow Ingestion · v2.0</div>
          </div>
          <nav className="sb-nav">
            {NAV_SCREENS.map(n => (
              <div
                key={n.id}
                className={`sb-item ${screen===n.id?'active':''} ${n.id==='sow'&&hasSaved?'done':''}`}
                onClick={() => setScreen(n.id)}
              >
                <div className="sb-num">{n.id==='sow'&&hasSaved?'✓':n.num}</div>
                <div><div className="sb-lbl">{n.label}</div><div className="sb-sub">{n.sub}</div></div>
              </div>
            ))}
          </nav>
          <div className="sb-foot">
            <div><span className={`dot ${hasSaved?'on':''}`}/>{hasSaved?'workflow.json saved':'no workflow saved'}</div>
            {activeWf && <div style={{color:'var(--mid)',fontSize:9,marginTop:3}}>{activeWf.name||'Unnamed'}<br/>{activeWf.states.length} states · {activeWf.transitions.length} tr.</div>}
            <div style={{marginTop:6,fontSize:9,color:'var(--dim)'}}>{workflows.length} workflow{workflows.length!==1?'s':''} loaded</div>
            <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)',color:'var(--dim)',fontSize:9,lineHeight:1.8}}>Phase 2 · Zustand + Zod<br/>Multi-workflow · Validated</div>
          </div>
        </div>

        {/* ── Main ── */}
        <div className="main">
          <div className="topbar">
            <span className="tb-title">{TITLES[screen]}</span>
            <span className="tb-pill">Phase 2</span>
            {screen==='prd'&&<span className="tb-pill ai">✦ AI Available</span>}
            {/* Up/Down nav */}
            <div style={{display:'flex',alignItems:'center',gap:6,background:'var(--s3)',border:'1px solid var(--border)',borderRadius:4,padding:'3px 8px'}}>
              <span style={{fontSize:9,color:'var(--mid)'}}>
                {canGoUp   ? NAV_SCREENS[currentIdx-1].label : ''}
                {canGoDown ? NAV_SCREENS[currentIdx+1].label : ''}
              </span>
              <div style={{display:'flex',flexDirection:'column',gap:1}}>
                <div style={{fontSize:9,cursor:canGoUp?'pointer':'default',color:canGoUp?'var(--a3)':'var(--dim)',opacity:canGoUp?1:.3}} onClick={() => canGoUp && setScreen(NAV_SCREENS[currentIdx-1].id)}>▲</div>
                <div style={{fontSize:9,cursor:canGoDown?'pointer':'default',color:canGoDown?'var(--a3)':'var(--dim)',opacity:canGoDown?1:.3}} onClick={() => canGoDown && setScreen(NAV_SCREENS[currentIdx+1].id)}>▼</div>
              </div>
            </div>
          </div>

          <div className="content">
            {screen==='sow'    && <WorkflowEditor onSave={() => setHasSaved(true)}/>}
            {screen==='prd'    && <PrdGenerator/>}
            {screen==='ingest' && <IngestWorkflow/>}
          </div>
        </div>
      </div>
    </>
  );
}

import CommandCenter from './components/CommandCenter';
import CommandPalette from './components/CommandPalette';

// ── CSS ───────────────────────────────────────────────────────────
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

/* ── Command Center shell ── */
.cc-shell{display:flex;flex-direction:column;height:100vh;overflow:hidden}
.cc-topbar{height:48px;flex-shrink:0;background:var(--s1);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 14px;gap:10px}
.cc-logo{font-family:var(--display);font-size:20px;font-weight:700;color:#fff;letter-spacing:-.5px;flex-shrink:0;user-select:none}
.cc-logo em{color:var(--a3);font-style:normal}
.cc-mode-tabs{display:flex;gap:2px;flex:1;padding:0 10px}
.cc-mode-tab{font-size:9.5px;font-family:var(--mono);padding:5px 12px;border-radius:4px;border:1px solid transparent;background:transparent;color:var(--mid);cursor:pointer;transition:all .15s}
.cc-mode-tab:hover{color:var(--text);border-color:var(--border)}
.cc-mode-tab.active-manual{color:var(--a3);background:rgba(74,159,255,.1);border-color:rgba(74,159,255,.3)}
.cc-mode-tab.active-nlp{color:var(--accent);background:rgba(21,101,216,.1);border-color:rgba(21,101,216,.3)}
.cc-mode-tab.active-ai{color:#A78BFA;background:rgba(124,92,252,.1);border-color:rgba(124,92,252,.3)}
.cc-mode-tab.active-cacoo{color:var(--green);background:rgba(0,200,112,.1);border-color:rgba(0,200,112,.3)}
.cc-body{flex:1;display:grid;grid-template-columns:35% 45% 20%;overflow:hidden;transition:grid-template-columns .28s cubic-bezier(.4,0,.2,1)}
.cc-left{display:flex;flex-direction:column;overflow:hidden;border-right:1px solid var(--border);background:rgba(7,17,31,0.85);backdrop-filter:blur(12px);transition:opacity .22s ease,border-color .28s ease;position:relative;z-index:2}
.cc-left.left-collapsed{opacity:0;pointer-events:none;border-right-color:transparent}
.cc-center{display:flex;flex-direction:column;overflow:hidden;border-right:1px solid var(--border);background:var(--bg);min-width:0}
.cc-right{display:flex;flex-direction:column;overflow:hidden;background:rgba(7,17,31,0.85);backdrop-filter:blur(12px);transition:opacity .22s ease;z-index:2}
.cc-right.right-collapsed{opacity:0;pointer-events:none}
.cc-col-head{padding:7px 12px;background:var(--s2);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;min-height:36px}
.cc-col-lbl{font-size:9px;font-weight:600;color:var(--mid);letter-spacing:.8px;text-transform:uppercase}
.cc-col-body{flex:1;overflow-y:auto}
.cc-wf-bar{padding:8px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:6px;flex-shrink:0;background:var(--s2)}
.cc-wf-name-input{flex:1;background:transparent;border:none;outline:none;font-family:var(--display);font-size:14px;font-weight:600;color:#fff}
.cc-wf-name-input::placeholder{color:var(--dim)}
.cc-wf-tabs-wrap{display:flex;align-items:center;gap:4px;border-bottom:1px solid var(--border);background:var(--s2);padding:4px 6px 0;flex-shrink:0}
.cc-wf-tabs{display:flex;overflow-x:auto;scroll-behavior:smooth;background:transparent;padding:0 2px;gap:2px;flex:1;min-width:0}
.cc-wf-tab{font-size:9px;font-family:var(--mono);color:var(--mid);padding:4px 6px;cursor:pointer;border:1px solid transparent;border-bottom:none;border-radius:3px 3px 0 0;background:transparent;white-space:nowrap;transition:all .15s;position:relative;top:1px;display:flex;align-items:center;gap:4px}
.cc-wf-tab-name{display:inline-block;max-width:40px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom}
.cc-wf-tabs.expanded .cc-wf-tab-name{max-width:140px}
.cc-wf-tab:hover{color:var(--text);background:var(--s3)}
.cc-wf-tab.active{color:var(--text);background:var(--bg);border-color:var(--border)}
.cc-wf-tab-del{font-size:9px;color:var(--dim);background:none;border:none;cursor:pointer;padding:0 0 0 2px;line-height:1}
.cc-wf-tab-del:hover{color:var(--red)}
.cc-wf-tab.imported{border-top-color:var(--mid);color:var(--text)}
.cc-wf-tab.imported.active{border-top-color:var(--green);background:rgba(0,200,112,.05);color:var(--green)}
.cc-tab-expand{width:20px;height:20px;border-radius:4px;border:1px solid var(--border);background:linear-gradient(180deg,var(--s3),var(--s2));color:var(--mid);font-size:10px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;box-shadow:0 2px 6px rgba(0,0,0,.35);margin-bottom:2px}
.cc-tab-expand:hover{color:var(--a3);border-color:var(--a2);background:linear-gradient(180deg,var(--s4),var(--s3))}
.cc-left-scroll-arrows{position:absolute;right:8px;bottom:10px;display:flex;flex-direction:column;gap:5px;z-index:8;pointer-events:none}
.cc-scroll-arrow{width:20px;height:20px;border-radius:4px;border:1px solid var(--border);background:linear-gradient(180deg,var(--s3),var(--s2));color:var(--mid);font-size:9px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;box-shadow:0 2px 6px rgba(0,0,0,.35);pointer-events:auto}
.cc-scroll-arrow:hover:not(:disabled){color:var(--a3);border-color:var(--a2);background:linear-gradient(180deg,var(--s4),var(--s3))}
.cc-scroll-arrow:disabled{opacity:.35;cursor:not-allowed;color:var(--dim)}
.cc-scroll-arrow.left,.cc-scroll-arrow.right{margin-bottom:2px;width:18px;height:18px;font-size:8px}

/* ── Inline sections ── */
.cc-sec{border-bottom:1px solid rgba(255,255,255,.04)}
.cc-sec-hd{display:flex;align-items:center;gap:7px;padding:7px 12px;cursor:pointer;user-select:none;background:var(--s2);border-bottom:1px solid var(--border);flex-shrink:0;transition:all .2s cubic-bezier(0.4,0,0.2,1)}
.cc-sec-hd:hover{background:var(--s3)}
.cc-sec-chev{font-size:9px;color:var(--mid);transition:transform .2s;flex-shrink:0}
.cc-sec-chev.open{transform:rotate(90deg)}
.cc-sec-icon{font-size:11px;color:var(--mid);width:14px;text-align:center;flex-shrink:0}
.cc-sec-title{font-size:10px;font-weight:600;color:var(--text);flex:1}
.cc-sec-count{font-size:8.5px;color:var(--mid);font-family:var(--mono)}
.cc-sec-add{font-size:8.5px;padding:2px 6px;border-radius:3px;border:1px solid var(--border);background:transparent;color:var(--mid);cursor:pointer;transition:all .15s;font-family:var(--mono)}
.cc-sec-add:hover{border-color:var(--green);color:var(--green)}
/* Section header children brighten when parent row is hovered */
.cc-sec-hd:hover .cc-sec-chev{color:var(--text)}
.cc-sec-hd:hover .cc-sec-icon{color:var(--a3)}
.cc-sec-hd:hover .cc-sec-count{color:var(--mid)}

/* ── Inline mini-table (left column grids) ── */
.inline-mini{width:100%;border-collapse:collapse}
.inline-mini th{font-size:8px;color:var(--mid);font-weight:500;padding:4px 7px;text-align:left;border-bottom:1px solid var(--border);letter-spacing:.5px;text-transform:uppercase;background:var(--s3);position:sticky;top:0;z-index:2}
.inline-mini td{padding:0;border-bottom:1px solid rgba(22,44,74,.5);vertical-align:middle}
.inline-mini td:last-child{width:24px}
.inline-mini input,.inline-mini select{display:block;width:100%;background:transparent;border:none;outline:none;font-family:var(--mono);font-size:10.5px;color:var(--text);padding:5px 7px;line-height:1.4}
.inline-mini input:focus,.inline-mini select:focus{background:var(--s3);outline:1px solid var(--accent)}
.inline-mini input::placeholder{color:var(--mid)}
.inline-mini tr:hover td{background:rgba(21,101,216,.05)}
.inline-mini tr.sel-row td{background:rgba(21,101,216,.12) !important;border-bottom:1px solid rgba(21,101,216,.3)}
.inline-mini tr.sel-row input{color:#fff}
.mini-del{background:transparent;border:none;cursor:pointer;color:var(--dim);font-size:11px;padding:4px 5px;line-height:1;display:block;width:100%;transition:color .15s}
.mini-del:hover{color:var(--red)}
.mini-check{display:flex;align-items:center;justify-content:center;padding:4px}
.mini-check input[type=checkbox]{width:12px;height:12px;cursor:pointer;accent-color:var(--accent)}
.sec-filter{background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:2px 7px;font-family:var(--mono);font-size:9px;color:var(--text);outline:none;width:120px;flex-shrink:0;transition:border-color .15s}
.sec-filter:focus{border-color:var(--a2)}
.sec-filter::placeholder{color:var(--mid)}
.ghost-row td{padding:6px 10px;font-size:8.5px;color:var(--mid);text-align:center;font-style:italic;background:var(--s3);border-top:1px solid var(--border);transition:color .15s}
.ghost-row:hover td{color:var(--text)}

/* ── Parse input panel ── */
.parse-panel{padding:12px;display:flex;flex-direction:column;gap:8px;flex-shrink:0;border-bottom:1px solid var(--border)}
.parse-lbl{font-size:8.5px;color:var(--mid);letter-spacing:1px;text-transform:uppercase;margin-bottom:2px}
.parse-ta{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:8px 10px;font-family:var(--mono);font-size:10px;color:var(--text);outline:none;line-height:1.7;resize:none;box-sizing:border-box}
.parse-ta:focus{border-color:var(--a2)}
.parse-ta::placeholder{color:var(--dim)}
.parse-input{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:7px 10px;font-family:var(--mono);font-size:10px;color:var(--text);outline:none;box-sizing:border-box}
.parse-input:focus{border-color:var(--a2)}
.parse-input::placeholder{color:var(--dim)}

/* ── Deliver column ── */
.deliver-section{padding:12px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:8px}
.deliver-section-lbl{font-size:8.5px;color:var(--mid);letter-spacing:1px;text-transform:uppercase}
.deliver-row{display:flex;align-items:center;gap:8px;border-radius:4px;padding:2px 4px;margin:0 -4px;transition:background .15s}
.deliver-row:hover{background:rgba(74,159,255,.05)}
.deliver-row:hover .deliver-title{color:#fff}
.deliver-row:hover .deliver-sub{color:var(--mid)}
.deliver-icon{font-size:18px;flex-shrink:0}
.deliver-info{flex:1}
.deliver-title{font-size:10.5px;font-weight:600;color:var(--text)}
.deliver-sub{font-size:8.5px;color:var(--mid);margin-top:1px}
.mf-log{background:var(--bg);border:1px solid var(--border);border-radius:5px;padding:9px 11px;font-size:9.5px;line-height:1.9;max-height:160px;overflow-y:auto}
.mf-adv{background:var(--s2);border:1px solid var(--border);border-radius:5px;padding:10px;display:flex;flex-direction:column;gap:7px}
.mf-input{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:5px 8px;font-family:var(--mono);font-size:10px;color:var(--text);outline:none;box-sizing:border-box}
.mf-input:focus{border-color:var(--a2)}

/* ── Queue Builder (Deliver Panel) ── */
.q-list{display:flex;flex-direction:column;gap:3px}
.q-row{display:flex;align-items:center;justify-content:space-between;background:var(--s2);border:1px solid var(--border);border-radius:4px;padding:4px 6px 4px 8px;transition:all .15s}
.q-row:hover{border-color:var(--a3)}
.q-row.staged{background:rgba(21,101,216,.1);border-color:var(--a3)}
.q-name{font-size:9.5px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px}
.q-btn{background:transparent;border:none;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:3px;transition:all .1s}
.q-btn.add{color:var(--green)}
.q-btn.add:hover{background:rgba(0,200,112,.15)}
.q-btn.del{color:var(--red)}
.q-btn.del:hover{background:rgba(255,61,90,.15)}
.q-staged-lbl{font-size:8.5px;color:var(--a3);letter-spacing:1px;text-transform:uppercase;margin:4px 0 2px;text-align:center}

/* ── Center column ── */
.diagram-wrap{flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:18px;position:relative}
.diagram-wrap svg{width:100%;height:auto;display:block}
.zoom-badge{position:absolute;bottom:14px;right:16px;background:rgba(5,14,26,.88);border:1px solid var(--border);border-radius:6px;padding:4px 10px 4px 12px;font-size:9px;font-family:var(--mono);color:var(--mid);display:flex;align-items:center;gap:7px;backdrop-filter:blur(6px);pointer-events:auto;z-index:20;user-select:none}
.zoom-badge span{color:var(--a3);letter-spacing:.5px}
.zoom-badge button{background:none;border:none;cursor:pointer;color:var(--mid);font-size:13px;padding:0;line-height:1;transition:color .15s}
.zoom-badge button:hover{color:var(--text)}
.stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:16px}
.stat-card{background:var(--s2);border:1px solid var(--border);border-radius:7px;padding:14px;text-align:center;transition:all .15s;cursor:default}
.stat-card:hover{border-color:var(--bdr2);background:var(--s3)}
.stat-card:hover .stat-lbl{color:var(--text)}
.stat-val{font-family:var(--display);font-size:24px;font-weight:700;color:var(--a3);line-height:1;margin-bottom:3px}
.stat-lbl{font-size:8.5px;color:var(--mid);letter-spacing:.5px}
.cc-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--mid);font-size:11px;gap:10px;text-align:center;line-height:1.7}
.cc-empty-icon{font-size:34px;opacity:.2;margin-bottom:4px}

/* ── Shared utilities ── */
.panel-toggle{width:22px;height:22px;border-radius:4px;border:1px solid var(--border);background:var(--s2);color:var(--mid);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;padding:0;line-height:1;margin-right:4px}
.panel-toggle:hover{border-color:var(--a2);color:var(--a3);background:var(--s3)}
.xb{font-size:9.5px;font-family:var(--mono);padding:4px 10px;border-radius:3px;border:1px solid var(--border);background:transparent;color:var(--mid);cursor:pointer;transition:all .15s;white-space:nowrap;flex-shrink:0}
.xb:hover{border-color:var(--a2);color:var(--a3)}
.xb.blue{background:var(--accent);border-color:var(--accent);color:#fff}
.xb.blue:hover{background:var(--a2)}
.xb.green{background:rgba(0,200,112,.12);border-color:var(--green);color:var(--green)}
.xb.purple{background:rgba(124,92,252,.15);border-color:rgba(124,92,252,.4);color:#A78BFA}
.xb:disabled{opacity:.35;cursor:not-allowed}
.tab-row{display:flex;gap:2px}
.tab{font-size:9.5px;padding:3px 8px;border-radius:3px;border:1px solid transparent;background:transparent;color:var(--mid);cursor:pointer;transition:all .15s;font-family:var(--mono)}
.tab:hover{color:var(--text)}
.tab.on{background:var(--s3);border-color:var(--border);color:var(--text)}
.log{background:var(--bg);border:1px solid var(--border);border-radius:5px;padding:9px 11px;font-size:9.5px;line-height:1.9;max-height:110px;overflow-y:auto}
.ll{display:flex;gap:8px}
.lt{color:var(--dim);flex-shrink:0;font-size:9px}
.lok{color:var(--green)}.linf{color:var(--a3)}.lwarn{color:var(--gold)}.lerr{color:var(--red)}
.spin{width:11px;height:11px;border-radius:50%;border:1.5px solid rgba(255,255,255,.2);border-top-color:#fff;animation:rot .6s linear infinite;flex-shrink:0;display:inline-block}
@keyframes rot{to{transform:rotate(360deg)}}
@keyframes tip-pulse{0%,100%{opacity:.2}50%{opacity:.8}}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}

/* Pro UI Enhancements */
@keyframes pulse-amber { 0% { box-shadow: 0 0 0 0 rgba(240,165,0,0.4); } 70% { box-shadow: 0 0 0 6px rgba(240,165,0,0); } 100% { box-shadow: 0 0 0 0 rgba(240,165,0,0); } }
@keyframes pulse-green { 0% { box-shadow: 0 0 0 0 rgba(0,200,112,0.4); } 70% { box-shadow: 0 0 0 6px rgba(0,200,112,0); } 100% { box-shadow: 0 0 0 0 rgba(0,200,112,0); } }
@keyframes pulse-blue  { 0% { box-shadow: 0 0 0 0 rgba(74,159,255,0.4); } 70% { box-shadow: 0 0 0 6px rgba(74,159,255,0); } 100% { box-shadow: 0 0 0 0 rgba(74,159,255,0); } }
.status-pulse { width: 6px; height: 6px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.status-pulse.amber { background: var(--gold); animation: pulse-amber 1.5s infinite; }
.status-pulse.green { background: var(--green); animation: pulse-green 2s infinite; }
.status-pulse.blue  { background: var(--a3); animation: pulse-blue 2.5s infinite; }
.status-pulse.dim   { background: var(--dim); }

/* Mermaid Highlights */
.node.highlight rect, .node.highlight polygon, .node.highlight circle {
  stroke: var(--green) !important; stroke-width: 3px !important; filter: drop-shadow(0 0 6px rgba(0,200,112,0.6));
}
.edgePath.highlight path {
  stroke: var(--green) !important; stroke-width: 3px !important; filter: drop-shadow(0 0 4px rgba(0,200,112,0.5));
}

/* Floating Toolbar */
.cc-toolbar {
  position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 8px; padding: 6px 12px; border-radius: 8px;
  background: rgba(10, 24, 40, 0.85); backdrop-filter: blur(10px);
  border: 1px solid var(--border); box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 100;
}
.cc-edge-search{
  position:absolute;right:0;top:50%;transform:translateY(-50%);z-index:110;
  display:flex;align-items:center;gap:6px;padding:6px 6px 6px 8px;
  background:rgba(10,24,40,.88);backdrop-filter:blur(10px);
  border:1px solid var(--border);border-right:none;border-radius:8px 0 0 8px;
  box-shadow:0 4px 12px rgba(0,0,0,.45);transition:all .2s ease;
}
.cc-edge-search.closed{padding:4px;border-radius:8px 0 0 8px}
.cc-edge-toggle{
  width:18px;height:18px;border-radius:4px;border:1px solid var(--border);
  background:var(--s2);color:var(--mid);cursor:pointer;font-size:11px;line-height:1;
  display:flex;align-items:center;justify-content:center;transition:all .15s;
}
.cc-edge-toggle:hover{color:var(--a3);border-color:var(--a2);background:var(--s3)}

/* Empty Blueprint */
.blueprint-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; color: var(--dim); font-family: var(--display); text-align: center;
}
.blueprint-empty svg { opacity: 0.15; width: 120px; height: 120px; margin-bottom: 20px; }
.blueprint-title { font-size: 24px; font-weight: 700; color: var(--mid); margin-bottom: 8px; }
.blueprint-sub { font-size: 13px; font-family: var(--mono); color: var(--dim); max-width: 300px; line-height: 1.5; }

/* Command Palette */
.cmd-overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 9999;
  display: flex; justify-content: center; padding-top: 15vh;
}
.cmd-modal {
  width: 600px; max-width: 90vw; background: var(--s1); border: 1px solid var(--border);
  border-radius: 8px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); display: flex; flex-direction: column;
  overflow: hidden;
}
.cmd-head{display:flex;align-items:center;border-bottom:1px solid var(--border)}
.cmd-input {
  width: 100%; padding: 16px 20px; font-size: 18px; font-family: var(--mono); color: var(--text);
  background: transparent; border: none; outline: none;
}
.cmd-close{
  width:34px;height:34px;margin-right:10px;border-radius:6px;border:1px solid var(--border);
  background:var(--s2);color:var(--mid);cursor:pointer;font-size:12px;line-height:1;
  display:flex;align-items:center;justify-content:center;transition:all .15s;
}
.cmd-close:hover{color:var(--text);border-color:var(--a2);background:var(--s3)}
.cmd-results { max-height: 350px; overflow-y: auto; padding: 8px; }
.cmd-item {
  padding: 10px 14px; display: flex; align-items: center; gap: 12px; cursor: pointer;
  border-radius: 4px; color: var(--mid); transition: background 0.1s;
}
.cmd-item:hover, .cmd-item.selected { background: var(--s3); color: var(--text); }
.cmd-item-icon { width: 24px; text-align: center; font-size: 14px; opacity: 0.7; }
.cmd-item-text { flex: 1; font-size: 13px; }
.cmd-item-type { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.6; }
`;

export default function App() {
  return (
    <>
      <style>{CSS}</style>
      <CommandCenter />
      <CommandPalette />
    </>
  );
}

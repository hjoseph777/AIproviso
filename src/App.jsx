import { useEffect, useMemo, useState } from 'react';
import CommandCenter from './components/CommandCenter';
import CommandPalette from './components/CommandPalette';
import { approveInvoice, getDashboardSummary, getInvoices, getRuntimeView, sendInvoiceToReview } from './lib/api';

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
.cc-body{flex:1;display:grid;grid-template-columns:35% 45% 20%;overflow:hidden;transition:grid-template-columns .28s cubic-bezier(.4,0,.2,1)}
.cc-left{display:flex;flex-direction:column;overflow:hidden;border-right:1px solid var(--border);background:rgba(7,17,31,0.85);backdrop-filter:blur(12px);transition:opacity .22s ease,border-color .28s ease;position:relative;z-index:2}
.cc-left.left-collapsed{opacity:0;pointer-events:none;border-right-color:transparent}
.cc-center{display:flex;flex-direction:column;overflow:hidden;border-right:1px solid var(--border);background:radial-gradient(circle at top, rgba(39,88,160,.14), transparent 34%),linear-gradient(180deg,#06111f 0%,#040c16 100%);min-width:0;position:relative}
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
.inline-mini tr.rule-focus td{background:rgba(240,165,0,.14) !important;border-bottom:1px solid rgba(240,165,0,.28)}
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
.diagram-wrap{flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:18px;position:relative;background:
  radial-gradient(circle at 18% 16%, rgba(74,159,255,.14), transparent 0 24%),
  radial-gradient(circle at 82% 74%, rgba(74,159,255,.08), transparent 0 22%),
  linear-gradient(180deg, rgba(12,25,42,.98) 0%, rgba(5,12,23,1) 100%)}
.diagram-wrap::before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.38;background:
  linear-gradient(rgba(104,150,214,.08) 1px, transparent 1px),
  linear-gradient(90deg, rgba(104,150,214,.08) 1px, transparent 1px),
  radial-gradient(circle at 1px 1px, rgba(110,164,232,.2) .9px, transparent 1.1px),
  linear-gradient(rgba(104,150,214,.04) 1px, transparent 1px),
  linear-gradient(90deg, rgba(104,150,214,.04) 1px, transparent 1px);
  background-size:20px 20px,20px 20px,20px 20px,100px 100px,100px 100px;
  mask-image:radial-gradient(circle at center, black 72%, transparent 100%)}
.diagram-wrap::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:.28;background:
  radial-gradient(circle at 22% 18%, rgba(74,159,255,.12), transparent 0 18%),
  radial-gradient(circle at 76% 68%, rgba(74,159,255,.1), transparent 0 16%),
  radial-gradient(circle at 7% 12%, rgba(255,255,255,.75) 0 .6px, transparent 1.5px),
  radial-gradient(circle at 16% 29%, rgba(255,255,255,.72) 0 .6px, transparent 1.5px),
  radial-gradient(circle at 24% 61%, rgba(255,255,255,.7) 0 .6px, transparent 1.5px),
  radial-gradient(circle at 32% 18%, rgba(74,159,255,.66) 0 .7px, transparent 1.6px),
  radial-gradient(circle at 39% 47%, rgba(255,255,255,.72) 0 .6px, transparent 1.5px),
  radial-gradient(circle at 47% 78%, rgba(255,255,255,.68) 0 .6px, transparent 1.5px),
  radial-gradient(circle at 55% 26%, rgba(255,255,255,.74) 0 .6px, transparent 1.5px),
  radial-gradient(circle at 63% 56%, rgba(74,159,255,.6) 0 .7px, transparent 1.6px),
  radial-gradient(circle at 71% 11%, rgba(255,255,255,.78) 0 .6px, transparent 1.5px),
  radial-gradient(circle at 78% 39%, rgba(255,255,255,.68) 0 .6px, transparent 1.5px),
  radial-gradient(circle at 86% 71%, rgba(255,255,255,.74) 0 .6px, transparent 1.5px),
  radial-gradient(circle at 93% 23%, rgba(74,159,255,.62) 0 .7px, transparent 1.6px),
  linear-gradient(180deg, rgba(255,255,255,.06), transparent 24%),
  radial-gradient(circle at center, transparent 56%, rgba(0,0,0,.38) 100%)}
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
.node.route-dim, .edgePath.route-dim { opacity: .22; transition: opacity .18s ease; }
.node.route-active rect, .node.route-active polygon, .node.route-active circle {
  stroke: #4A9FFF !important; stroke-width: 3px !important; filter: drop-shadow(0 0 6px rgba(74,159,255,.55));
}
.edgePath.route-active path {
  stroke: #4A9FFF !important; stroke-width: 3px !important; filter: drop-shadow(0 0 6px rgba(74,159,255,.5));
}
.node.route-failed rect, .node.route-failed polygon, .node.route-failed circle {
  stroke: #F0A500 !important; stroke-width: 3px !important; filter: drop-shadow(0 0 8px rgba(240,165,0,.7));
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

/* ── Integrated AI Proviso shell ── */
.surface-shell{display:flex;height:100vh;overflow:hidden;background:#f0f4f9;color:#0d1b2e;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
.surface-sidebar{width:76px;flex-shrink:0;background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%);border-right:1px solid #cbd8ea;display:flex;flex-direction:column;align-items:center;padding:12px 0 10px;gap:6px;box-shadow:inset -1px 0 0 rgba(148,163,184,.16)}
.surface-brand{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#1a6bdb 0%,#5b9fff 100%);display:flex;align-items:center;justify-content:center;color:#fff;font-size:17px;box-shadow:0 8px 18px rgba(26,107,219,.25);margin-bottom:10px}
.surface-navbtn{width:44px;height:44px;border:1px solid #e2eaf5;border-radius:12px;background:rgba(241,245,249,.88);color:#334155;display:flex;align-items:center;justify-content:center;font-size:19px;cursor:pointer;transition:all .15s;position:relative;opacity:1;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.surface-navbtn:hover{background:#eef4fb;border-color:#bfd2ea;color:#123a63;transform:translateY(-1px)}
.surface-navbtn.active{background:#dbeafe;border-color:#60a5fa;color:#1459ba;box-shadow:0 6px 18px rgba(20,89,186,.16)}
.surface-navspacer{flex:1}
.surface-avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#1a6bdb,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700}

.surface-main{flex:1;display:flex;flex-direction:column;min-width:0;background:var(--surface-bg,#f0f4f9);color:var(--surface-text,#0d1b2e)}
.surface-topbar{height:58px;display:flex;align-items:center;gap:12px;padding:0 20px;background:var(--surface-panel,#fff);border-bottom:1px solid var(--surface-border,#e2e8f2);flex-shrink:0}
.surface-logo{font-size:18px;font-weight:700;letter-spacing:-.4px}
.surface-logo span{color:var(--surface-accent,#1a6bdb)}
.surface-badge{font-size:10px;font-weight:700;color:var(--surface-subtle,#8a97a8);background:var(--surface-muted,#edf1f7);border:1px solid var(--surface-border,#e2e8f2);padding:2px 7px;border-radius:999px}
.surface-spacer{flex:1}
.surface-mode{display:flex;gap:3px;padding:3px;border-radius:999px;background:var(--surface-muted,#edf1f7);border:1px solid var(--surface-border,#e2e8f2)}
.surface-modebtn{border:none;background:transparent;color:var(--surface-mid,#4a5568);padding:6px 13px;border-radius:999px;font-size:12px;font-weight:700;cursor:pointer;transition:all .18s}
.surface-modebtn.active.client{background:#fff;color:#1459ba;box-shadow:0 2px 8px rgba(13,27,46,.08)}
.surface-modebtn.active.integrator{background:#2a7fff;color:#fff;box-shadow:0 4px 12px rgba(42,127,255,.3)}
.surface-modebtn.active.operation{background:#123a63;color:#d4e6ff;box-shadow:0 4px 12px rgba(12,30,54,.35)}
.surface-action{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:8px;border:1px solid var(--surface-border2,#cdd5e3);background:var(--surface-panel,#fff);color:var(--surface-mid,#4a5568);font-size:12px;font-weight:700;cursor:pointer;transition:all .15s}
.surface-action:hover{border-color:var(--surface-accent,#1a6bdb);color:var(--surface-accent,#1a6bdb)}
.surface-action.primary{background:var(--surface-accent,#1a6bdb);border-color:var(--surface-accent,#1a6bdb);color:#fff}

.surface-ctxbar{height:42px;display:flex;align-items:center;gap:10px;padding:0 20px;background:var(--surface-panel,#fff);border-bottom:1px solid var(--surface-border,#e2e8f2);flex-shrink:0}
.surface-ctxtitle{font-size:13px;font-weight:700}
.surface-ctxsep{color:var(--surface-border2,#cdd5e3)}
.surface-ctxsub{font-size:12px;color:var(--surface-subtle,#8a97a8)}

.surface-metrics{display:grid;grid-template-columns:repeat(5,1fr);background:var(--surface-panel,#fff);border-bottom:1px solid var(--surface-border,#e2e8f2);flex-shrink:0}
.surface-metric{padding:14px 18px;border-right:1px solid var(--surface-border,#e2e8f2)}
.surface-metric:last-child{border-right:none}
.surface-metricval{font-size:24px;font-weight:700;line-height:1.05;letter-spacing:-.5px}
.surface-metricval.green{color:#1a7a45}.surface-metricval.amber{color:#b85c00}.surface-metricval.red{color:#c42b2b}.surface-metricval.blue{color:#1a6bdb}
.surface-metriclbl{font-size:11px;color:var(--surface-mid,#4a5568);margin-top:3px}.surface-metricdelta{font-size:10px;margin-top:2px;color:var(--surface-subtle,#8a97a8)}

.surface-filterbar{display:flex;align-items:center;gap:8px;padding:9px 20px;background:var(--surface-panel,#fff);border-bottom:1px solid var(--surface-border,#e2e8f2);flex-shrink:0}
.surface-search{display:flex;align-items:center;gap:7px;background:var(--surface-muted,#f5f8fc);border:1px solid var(--surface-border,#e2e8f2);border-radius:8px;padding:8px 11px;width:260px}
.surface-search input{border:none;background:transparent;outline:none;width:100%;font:inherit;color:inherit}
.surface-search i{color:var(--surface-subtle,#8a97a8)}
.surface-chips{display:flex;gap:6px;overflow:auto}.surface-chips::-webkit-scrollbar{height:0}
.surface-chip{padding:6px 11px;border-radius:999px;border:1px solid var(--surface-border2,#cdd5e3);background:var(--surface-panel,#fff);color:var(--surface-mid,#4a5568);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap}
.surface-chip.on{border-color:var(--surface-accent,#1a6bdb);background:var(--surface-accent-soft,#e8f2ff);color:var(--surface-accent-strong,#1459ba)}

.surface-content{flex:1;display:flex;min-height:0;overflow:hidden}
.surface-view{display:none;flex:1;min-width:0;min-height:0;overflow:hidden}
.surface-view.active{display:flex}

.ap-shell{display:flex;flex:1;min-width:0;min-height:0}
.ap-table-wrap{flex:1;overflow:auto;min-width:0;background:#fff}
.ap-detail{width:300px;flex-shrink:0;background:#f5f8fc;border-left:1px solid #e2e8f2;display:flex;flex-direction:column;overflow:hidden}
.ap-table{width:100%;border-collapse:collapse}.ap-table thead{position:sticky;top:0;z-index:2;background:#fff}.ap-table th{padding:10px 14px;font-size:10px;text-transform:uppercase;letter-spacing:.7px;color:#8a97a8;text-align:left;border-bottom:1px solid #e2e8f2}.ap-table td{padding:11px 14px;font-size:13px;border-bottom:1px solid #e2e8f2}.ap-table tbody tr{cursor:pointer;transition:background .12s}.ap-table tbody tr:hover{background:#f4f8ff}.ap-table tbody tr.sel{background:#e8f2ff}.ap-table .mono{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:#4a5568}
.ap-status{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700}.ap-status::before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor}.pending{background:#fff4e0;color:#8f4700}.review{background:#fff0f0;color:#9e2020}.approved{background:#e8f8ef;color:#176038}.posted{background:#e8faf2;color:#166038}.extracted{background:#e8f2ff;color:#1459ba}
.ap-conf{display:flex;align-items:center;gap:6px}.ap-conftrack{width:64px;height:4px;background:#edf1f7;border-radius:3px;overflow:hidden}.ap-conffill{height:100%}.ap-conffill.green{background:#1a7a45}.ap-conffill.amber{background:#b85c00}.ap-conffill.red{background:#c42b2b}.ap-confnum{font-family:'JetBrains Mono',monospace;font-size:10px}
.ap-dhead{padding:16px;background:#fff;border-bottom:1px solid #e2e8f2}.ap-dtitle{font-size:14px;font-weight:700;font-family:'JetBrains Mono',monospace}.ap-dsub{font-size:11px;color:#8a97a8;margin-top:2px}.ap-dbody{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:12px}.ap-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#8a97a8;gap:10px;text-align:center;padding:24px}.ap-card{background:#fff;border:1px solid #e2e8f2;border-radius:14px;padding:13px 14px}.ap-card h4{font-size:9px;text-transform:uppercase;letter-spacing:.7px;color:#8a97a8;margin-bottom:8px}.ap-kv{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid #e2e8f2}.ap-kv:last-child{border-bottom:none}.ap-kv span:first-child{font-size:11px;color:#4a5568}.ap-kv span:last-child{font-size:11px;font-weight:700;text-align:right}
.surface-dark .ap-table-wrap{background:#0f1e34}
.surface-dark .ap-table thead{background:#10213a}
.surface-dark .ap-table th{color:#7da8d4;border-bottom:1px solid #1e3452}
.surface-dark .ap-table td{color:#d4e6ff;border-bottom:1px solid #1e3452}
.surface-dark .ap-table .mono{color:#9fc2eb}
.surface-dark .ap-table tbody tr:hover{background:#142540}
.surface-dark .ap-table tbody tr.sel{background:rgba(42,127,255,.18)}
.ap-tabs{display:flex;gap:6px;padding:0 14px 14px;background:#fff;border-bottom:1px solid #e2e8f2}
.ap-tab{border:1px solid #d9e3f0;background:#f8fbff;color:#4a5568;border-radius:999px;padding:6px 10px;font-size:10px;font-weight:700;cursor:pointer;transition:all .15s}
.ap-tab.active{background:#e8f2ff;border-color:#99bbef;color:#1459ba}
.ap-actions{padding:12px 14px;border-top:1px solid #e2e8f2;background:#fff;display:flex;flex-direction:column;gap:6px}
.ap-runtime-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.ap-runtime-source{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;background:#e8f2ff;color:#1459ba;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.ap-runtime-source.fallback{background:#fff4e0;color:#8f4700}
.ap-runtime-section{display:flex;flex-direction:column;gap:8px}
.ap-runtime-title{font-size:9px;text-transform:uppercase;letter-spacing:.7px;color:#8a97a8}
.ap-runtime-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.ap-runtime-box{background:#fff;border:1px solid #e2e8f2;border-radius:10px;padding:10px 11px}
.ap-runtime-box strong{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#4a5568;margin-bottom:4px}
.ap-runtime-box span{font-size:11px;line-height:1.55;color:#0d1b2e}
.ap-trace-flow{display:flex;flex-direction:column;gap:8px}
.ap-trace-node{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #e2e8f2;border-radius:10px;padding:10px 11px;transition:border-color .15s,box-shadow .15s}
.ap-trace-node.active{border-color:#99bbef;box-shadow:0 0 0 2px rgba(20,89,186,.08)}
.ap-trace-dot{width:10px;height:10px;border-radius:50%;background:#cdd5e3;flex-shrink:0}
.ap-trace-node.active .ap-trace-dot{background:#1459ba;box-shadow:0 0 0 6px rgba(20,89,186,.12)}
.ap-trace-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
.ap-trace-copy strong{font-size:11px;color:#0d1b2e}
.ap-trace-copy span{font-size:10px;color:#718096}
.ap-runtime-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid #e2e8f2}
.ap-runtime-row:last-child{border-bottom:none}
.ap-runtime-label{font-size:11px;color:#4a5568}
.ap-runtime-chip{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;text-align:right}
.ap-runtime-chip.blue{background:#e8f2ff;color:#1459ba}.ap-runtime-chip.green{background:#e8f8ef;color:#176038}.ap-runtime-chip.amber{background:#fff4e0;color:#8f4700}.ap-runtime-chip.red{background:#fff0f0;color:#9e2020}.ap-runtime-chip.dim{background:#edf2f7;color:#4a5568}
.ap-runtime-text{font-size:11px;line-height:1.55;color:#0d1b2e;background:#fff;border:1px solid #e2e8f2;border-radius:10px;padding:10px 11px}
.ap-runtime-text.mono{font-family:'JetBrains Mono',monospace;font-size:10px}

.integrator-shell{display:flex;flex:1;min-width:0;min-height:0;background:var(--surface-panel,#fff)}
.integrator-shell.full .integrator-queue{display:none}
.integrator-queue{width:48%;min-width:380px;display:flex;flex-direction:column;border-right:1px solid var(--surface-border,#e2e8f2);background:var(--surface-panel,#fff)}
.integrator-canvas{flex:1;min-width:0;display:flex;flex-direction:column;background:#0a1525}
.integrator-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid var(--surface-border,#1e3452);background:var(--surface-panel,#fff)}
.integrator-debug{padding:12px 16px;border-bottom:1px solid var(--surface-border,#1e3452);background:var(--surface-panel,#fff);display:flex;flex-direction:column;gap:10px}
.integrator-debug-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.integrator-debug-card{border:1px solid var(--surface-border,#e2e8f2);border-radius:12px;background:var(--surface-muted,#f5f8fc);padding:10px 11px;display:flex;flex-direction:column;gap:4px}
.integrator-debug-card strong{font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:var(--surface-subtle,#8a97a8)}
.integrator-debug-card span{font-size:12px;line-height:1.45;color:var(--surface-text,#0d1b2e)}
.integrator-debug-card code{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--surface-accent-strong,#1459ba)}
.integrator-rule-card{border:1px solid var(--surface-border,#e2e8f2);border-radius:14px;background:var(--surface-panel,#fff);padding:12px 13px;display:flex;flex-direction:column;gap:10px}
.integrator-rule-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.integrator-rule-title{display:flex;flex-direction:column;gap:4px}.integrator-rule-title strong{font-size:10px;letter-spacing:.7px;text-transform:uppercase;color:var(--surface-subtle,#8a97a8)}.integrator-rule-title span{font-size:13px;font-weight:700;color:var(--surface-text,#0d1b2e)}
.integrator-rule-chip{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}.integrator-rule-chip.red{background:#fff0f0;color:#9e2020}.integrator-rule-chip.amber{background:#fff4e0;color:#8f4700}.integrator-rule-chip.blue{background:#e8f2ff;color:#1459ba}.integrator-rule-chip.green{background:#e8f8ef;color:#176038}.integrator-rule-chip.dim{background:#edf2f7;color:#4a5568}
.integrator-rule-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.integrator-rule-box{border:1px solid var(--surface-border,#e2e8f2);border-radius:10px;background:var(--surface-muted,#f5f8fc);padding:9px 10px}.integrator-rule-box strong{display:block;font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:var(--surface-subtle,#8a97a8);margin-bottom:4px}.integrator-rule-box span{font-size:11px;line-height:1.5;color:var(--surface-text,#0d1b2e)}
.integrator-rule-remediation{border-top:1px solid var(--surface-border,#e2e8f2);padding-top:10px}.integrator-rule-remediation strong{display:block;font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:var(--surface-subtle,#8a97a8);margin-bottom:4px}.integrator-rule-remediation span{font-size:11px;line-height:1.55;color:var(--surface-text,#0d1b2e)}
.surface-dark .integrator-toolbar{background:#0f1e34}
.integrator-meta{display:flex;flex-direction:column;gap:2px}
.integrator-meta strong{font-size:12px;color:var(--surface-text,#0d1b2e)}
.integrator-meta span{font-size:11px;color:var(--surface-subtle,#8a97a8)}
.integrator-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex:1;flex-wrap:wrap}
.integrator-subtabs{display:flex;gap:6px;align-items:center}
.integrator-subtabs button{border:1px solid var(--surface-border2,#cdd5e3);background:var(--surface-panel,#fff);color:var(--surface-mid,#4a5568);border-radius:999px;padding:6px 11px;font-size:10px;font-weight:700;cursor:pointer}
.integrator-subtabs button.active{background:var(--surface-accent-soft,#e8f2ff);border-color:var(--surface-accent,#1a6bdb);color:var(--surface-accent-strong,#1459ba)}
.integrator-toggle{display:flex;gap:6px}
.integrator-toggle button{border:1px solid var(--surface-border2,#cdd5e3);background:var(--surface-panel,#fff);color:var(--surface-mid,#4a5568);border-radius:999px;padding:6px 11px;font-size:10px;font-weight:700;cursor:pointer}
.integrator-toggle button.active{background:var(--surface-accent-soft,#e8f2ff);border-color:var(--surface-accent,#1a6bdb);color:var(--surface-accent-strong,#1459ba)}
.surface-dark .integrator-subtabs button{background:#142540;border-color:#274468;color:#7da8d4}
.surface-dark .integrator-subtabs button.active{background:rgba(42,127,255,.15);border-color:#2a7fff;color:#7ab8ff}
.surface-dark .integrator-toggle button{background:#142540;border-color:#274468;color:#7da8d4}
.surface-dark .integrator-toggle button.active{background:rgba(42,127,255,.15);border-color:#2a7fff;color:#7ab8ff}

.surface-dark{--surface-bg:#0a1525;--surface-panel:#0f1e34;--surface-muted:#142540;--surface-border:#1e3452;--surface-border2:#274468;--surface-text:#d4e6ff;--surface-mid:#7da8d4;--surface-subtle:#3d6894;--surface-accent:#2a7fff;--surface-accent-strong:#7ab8ff;--surface-accent-soft:rgba(42,127,255,.15)}
.surface-dark .surface-sidebar{background:linear-gradient(180deg,#0f1e34 0%,#12233c 100%);border-right-color:#1e3452}.surface-dark .surface-navbtn{background:rgba(20,37,64,.88);border-color:#274468;color:#d4e6ff;box-shadow:0 1px 2px rgba(0,0,0,.2)}.surface-dark .surface-navbtn:hover{background:#1a3153;border-color:#3c6ea6;color:#ffffff;transform:translateY(-1px)}.surface-dark .surface-navbtn.active{background:rgba(42,127,255,.24);border-color:#5ea1ff;color:#9fd0ff;box-shadow:0 6px 18px rgba(42,127,255,.22)}.surface-dark .surface-brand{box-shadow:0 10px 20px rgba(42,127,255,.18)}

.simple-panel{flex:1;overflow:auto;padding:18px;background:var(--surface-panel,#fff)}
.simple-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.simple-card{background:var(--surface-muted,#f5f8fc);border:1px solid var(--surface-border,#e2e8f2);border-radius:14px;padding:14px 15px}.simple-card h3{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--surface-subtle,#8a97a8);margin-bottom:8px}.simple-card p,.simple-card li{font-size:12px;line-height:1.6;color:var(--surface-text,#0d1b2e)}
.simple-list{display:flex;flex-direction:column;gap:8px}.simple-row{display:flex;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:10px;background:var(--surface-muted,#f5f8fc);border:1px solid var(--surface-border,#e2e8f2)}

.design-host{flex:1;min-width:0;min-height:0;overflow:hidden;background:#0a1525}
.design-host .cc-shell{height:100%;min-height:0;background:#0a1525}
.design-host .cc-topbar{display:none}

.surface-footer{height:34px;flex-shrink:0;display:flex;align-items:center;gap:12px;padding:0 16px;background:var(--surface-panel,#fff);border-top:1px solid var(--surface-border,#e2e8f2);font-size:10px;color:var(--surface-subtle,#8a97a8)}
.surface-footer-ticker{display:flex;align-items:center;gap:8px;flex:1;min-width:0;overflow:auto}.surface-footer-ticker::-webkit-scrollbar{height:0}
.surface-ticker-label{font-size:9px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--surface-subtle,#8a97a8);white-space:nowrap}
.surface-ticker-empty{font-size:10px;color:var(--surface-subtle,#8a97a8);white-space:nowrap}
.surface-ticker-item{display:inline-flex;align-items:center;gap:7px;min-width:0;padding:4px 8px;border-radius:999px;border:1px solid var(--surface-border,#e2e8f2);background:var(--surface-muted,#f5f8fc);white-space:nowrap}
.surface-ticker-item strong{font-size:10px;color:var(--surface-text,#0d1b2e);font-weight:700}.surface-ticker-item span{font-size:10px;color:var(--surface-mid,#4a5568)}
.surface-ticker-item.blue{border-color:rgba(26,107,219,.24)}.surface-ticker-item.amber{border-color:rgba(184,92,0,.24)}.surface-ticker-item.green{border-color:rgba(26,122,69,.24)}.surface-ticker-item.dim{border-color:var(--surface-border,#e2e8f2)}
.surface-footer-infra{display:flex;align-items:center;gap:12px;flex-shrink:0;white-space:nowrap}
.surface-dot{width:6px;height:6px;border-radius:50%;background:#2ecc71;animation:pulse 2s infinite}

@media (max-width: 1280px){.surface-metrics{grid-template-columns:repeat(3,1fr)}.ap-detail{width:280px}.integrator-queue{min-width:320px}}
@media (max-width: 1480px){.ap-runtime-grid{grid-template-columns:1fr}}
`;

const CLIENT_VIEWS = ['ap', 'exc', 'audit'];
const INTEGRATOR_VIEWS = ['wf', 'erp', 'ai'];
const OPERATION_VIEWS = ['wf'];

const NAV_ITEMS = {
  ap: { icon: 'ti ti-layout-list', label: 'AP Workbench', title: 'Invoice processing queue', subtitle: 'Client-facing AP operations and review actions' },
  exc: { icon: 'ti ti-alert-triangle', label: 'Exceptions', title: 'Exception Queues', subtitle: 'Confidence, vendor, and policy exceptions' },
  audit: { icon: 'ti ti-shield-check', label: 'Audit Trail', title: 'Audit Trail', subtitle: 'Immutable operational and workflow events' },
  wf: { icon: 'ti ti-git-branch', label: 'Workflow Designer', title: 'Workflow Designer', subtitle: 'Integrator-facing Proviso design workspace' },
  erp: { icon: 'ti ti-plug', label: 'ERP Mapping', title: 'ERP Mapping', subtitle: 'Connector and canonical field alignment' },
  ai: { icon: 'ti ti-sparkles', label: 'AI Cockpit', title: 'AI Cockpit', subtitle: 'Template selection, diff review, and guided generation' },
  operation: { icon: 'ti ti-route-square-2', label: 'Operation View', title: 'Operation View', subtitle: 'Dedicated Mockup 3 workflow operations surface' }
};

function fmtCurrency(amount) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 }).format(amount);
}

function fmtDateTime(value) {
  if (!value) return 'Pending';
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function fmtTickerTime(value) {
  if (!value) return 'live';
  return new Intl.DateTimeFormat('en-CA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function statusClass(status) {
  return ({ pending: 'pending', review: 'review', approved: 'approved', posted: 'posted', extracted: 'extracted' }[status] || 'pending');
}

function runtimeToneClass(tone) {
  return ({ blue: 'blue', green: 'green', amber: 'amber', red: 'red' }[tone] || 'dim');
}

function RuntimeRows({ rows = [] }) {
  return rows.map(([label, value, tone]) => (
    <div className="ap-runtime-row" key={`${label}-${value}`}>
      <span className="ap-runtime-label">{label}</span>
      <span className={`ap-runtime-chip ${runtimeToneClass(tone)}`}>{value}</span>
    </div>
  ));
}

function runtimeTextRows(rows = []) {
  return rows.map(([label, value]) => (
    <div className="ap-runtime-row" key={`${label}-${value}`}>
      <span className="ap-runtime-label">{label}</span>
      <span className="ap-runtime-label" style={{ textAlign: 'right', color: '#0d1b2e' }}>{value}</span>
    </div>
  ));
}

function deriveRuntimeState(runtimePayload, selectedInvoice) {
  const stateRows = runtimePayload?.stateIntent?.rows || [];
  const currentState = stateRows.find(([label]) => /current state/i.test(label))?.[1]
    || stateRows.find(([label]) => /state/i.test(label))?.[1]
    || selectedInvoice?.status
    || 'pending';
  return String(currentState).toLowerCase();
}

function buildExecutionTrace(runtimePayload, selectedInvoice) {
  const activeState = deriveRuntimeState(runtimePayload, selectedInvoice);
  const runtimeSourceLabel = runtimePayload?.workflow?.name || 'Workflow runtime';
  return [
    { id: 'received', label: 'Received', meta: 'Intake envelope created' },
    { id: 'extracted', label: 'Extracted', meta: 'OCR and field extraction completed' },
    { id: activeState.includes('exception') || activeState.includes('review') ? 'exception' : 'matched', label: activeState.includes('exception') || activeState.includes('review') ? 'Exception' : 'Matched', meta: runtimeSourceLabel },
    { id: activeState.includes('approved') ? 'approved' : 'approval', label: activeState.includes('approved') ? 'Approved' : 'Approval', meta: 'Human decision gate' },
    { id: activeState.includes('posted') ? 'posted' : 'posted', label: 'Posted', meta: 'ERP dispatch and completion' },
  ];
}

function designerStateName(runtimePayload, selectedInvoice) {
  const currentState = String(
    runtimePayload?.stateIntent?.rows?.find(([label]) => /current state/i.test(label))?.[1]
    || runtimePayload?.stateIntent?.rows?.find(([label]) => /state/i.test(label))?.[1]
    || selectedInvoice?.status
    || 'draft'
  ).toLowerCase();

  if (currentState.includes('pending signature')) return 'Pending Signature';
  if (currentState.includes('pending approval') || currentState === 'pending') return 'Pending Approval';
  if (currentState.includes('under review') || currentState.includes('review')) return 'Under Review';
  if (currentState.includes('reviewed') || currentState.includes('matched') || currentState.includes('extract')) return 'Reviewed';
  if (currentState.includes('approved')) return 'Approved';
  if (currentState.includes('signed')) return 'Signed';
  if (currentState.includes('expiring')) return 'Expiring Soon';
  if (currentState.includes('expired')) return 'Expired';
  if (currentState.includes('terminated')) return 'Terminated';
  if (currentState.includes('discard')) return 'Discarded';
  if (currentState.includes('active') || currentState.includes('posted')) return 'Active';
  return 'Draft';
}

function deriveIntegratorDebugContext(runtimePayload, selectedInvoice) {
  if (!selectedInvoice) return null;

  const stateName = runtimePayload?.routeHistory?.current || designerStateName(runtimePayload, selectedInvoice);
  const transitionByState = {
    'Under Review': { from: 'Draft', to: 'Under Review' },
    'Reviewed': { from: 'Under Review', to: 'Reviewed' },
    'Pending Approval': { from: 'Reviewed', to: 'Pending Approval' },
    'Approved': { from: 'Pending Approval', to: 'Approved' },
    'Pending Signature': { from: 'Approved', to: 'Pending Signature' },
    'Signed': { from: 'Pending Signature', to: 'Signed' },
    'Active': { from: 'Signed', to: 'Active' },
    'Expiring Soon': { from: 'Active', to: 'Expiring Soon' },
    'Expired': { from: 'Expiring Soon', to: 'Expired' },
    'Terminated': { from: 'Active', to: 'Terminated' },
    'Discarded': { from: 'Draft', to: 'Discarded' },
  };

  const diagnostics = runtimePayload?.diagnostics || [];
  const routeHistory = runtimePayload?.routeHistory?.states || [stateName];
  const runtimeTransition = runtimePayload?.routeHistory?.latest_transition;
  const ruleDecision = runtimePayload?.ruleDecision;
  const blockingRule = ruleDecision?.copy
    || diagnostics[0]?.copy
    || (selectedInvoice.confidence < 0.7 ? 'Low extraction confidence is holding this invoice in the operator queue.' : 'No blocking rule surfaced from runtime diagnostics.');
  const traceRows = runtimePayload?.trace || [];
  const transition = runtimeTransition?.from && runtimeTransition?.to
    ? { from: runtimeTransition.from, to: runtimeTransition.to }
    : (transitionByState[stateName] || null);
  const lastTransition = traceRows.find(([label]) => /transition/i.test(label))?.[1]
    || (transition ? `${transition.from} -> ${transition.to}` : `${stateName}`);

  return {
    stateName,
    transition,
    blockingRule,
    lastTransition,
    confidenceBand: selectedInvoice.confidence >= 0.9 ? 'High confidence' : selectedInvoice.confidence >= 0.7 ? 'Review threshold' : 'Low confidence',
    activeRoutePath: routeHistory,
    failedStepId: ruleDecision?.severity === 'amber' || ruleDecision?.severity === 'red' ? stateName : undefined,
    ruleId: ruleDecision?.id,
    ruleDecision: ruleDecision || null,
  };
}

export default function App() {
  const [workspaceMode, setWorkspaceMode] = useState('client');
  const [activeView, setActiveView] = useState('ap');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [dataSource, setDataSource] = useState('loading');
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [dataError, setDataError] = useState('');
  const [actionBusy, setActionBusy] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [runtimePayload, setRuntimePayload] = useState(null);
  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const [runtimeError, setRuntimeError] = useState('');
  const [runtimeSource, setRuntimeSource] = useState('');
  const [launcherMessage, setLauncherMessage] = useState('');
  const [inspectionTab, setInspectionTab] = useState('invoice');
  const [showRawRuntime, setShowRawRuntime] = useState(false);
  const [integratorCanvasMode, setIntegratorCanvasMode] = useState('split');
  const [integratorSubview, setIntegratorSubview] = useState('data');

  const allowedViews = workspaceMode === 'client'
    ? CLIENT_VIEWS
    : workspaceMode === 'integrator'
      ? INTEGRATOR_VIEWS
      : OPERATION_VIEWS;

  useEffect(() => {
    if (!allowedViews.includes(activeView)) {
      setActiveView(workspaceMode === 'client' ? 'ap' : 'wf');
    }
  }, [workspaceMode, activeView, allowedViews]);

  useEffect(() => {
    if (workspaceMode === 'operation' && activeView === 'wf') {
      setIntegratorSubview('blueprint');
      return;
    }
    if (workspaceMode !== 'integrator' || activeView !== 'wf') {
      setIntegratorSubview('data');
    }
  }, [workspaceMode, activeView]);

  useEffect(() => {
    if (workspaceMode !== 'client') return undefined;
    let cancelled = false;

    async function loadSummary() {
      try {
        const payload = await getDashboardSummary();
        if (cancelled) return;
        setSummary(payload.metrics);
        setDataSource(payload.source || 'database');
      } catch (error) {
        if (cancelled) return;
        setDataError(error.message || 'Failed to load dashboard summary');
      }
    }

    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [workspaceMode, reloadKey]);

  useEffect(() => {
    const shouldLoadInvoices = activeView === 'ap' || ((workspaceMode === 'integrator' || workspaceMode === 'operation') && activeView === 'wf');
    if (!shouldLoadInvoices) return undefined;
    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setLoadingInvoices(true);
      try {
        const payload = await getInvoices({ status: filter, search: query });
        if (cancelled) return;
        setInvoices(payload.items || []);
        setDataSource(payload.source || 'database');
        setDataError('');
      } catch (error) {
        if (cancelled) return;
        setInvoices([]);
        setDataError(error.message || 'Failed to load invoices');
      } finally {
        if (!cancelled) {
          setLoadingInvoices(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [workspaceMode, activeView, filter, query, reloadKey]);

  useEffect(() => {
    if (!invoices.length) {
      setSelectedInvoiceId(null);
      return;
    }
    if (!selectedInvoiceId || !invoices.some((invoice) => invoice.id === selectedInvoiceId)) {
      setSelectedInvoiceId(invoices[0].id);
    }
  }, [invoices, selectedInvoiceId]);

  const filteredInvoices = invoices;

  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId) || null;
  const executionTrace = buildExecutionTrace(runtimePayload, selectedInvoice);
  const activeRuntimeState = deriveRuntimeState(runtimePayload, selectedInvoice);
  const integratorDebugContext = deriveIntegratorDebugContext(runtimePayload, selectedInvoice);
  const footerTicker = runtimePayload?.executionTicker || [];

  useEffect(() => {
    const shouldLoadRuntime = (activeView === 'ap' || activeView === 'wf') && !!selectedInvoiceId;
    if (!shouldLoadRuntime) {
      setRuntimePayload(null);
      setRuntimeError('');
      setRuntimeSource('');
      return undefined;
    }

    let cancelled = false;
    setRuntimeLoading(true);

    getRuntimeView(selectedInvoiceId)
      .then((payload) => {
        if (cancelled) return;
        setRuntimePayload(payload.data || null);
        setRuntimeSource(payload.source || 'database');
        setRuntimeError('');
      })
      .catch((error) => {
        if (cancelled) return;
        setRuntimePayload(null);
        setRuntimeSource('');
        setRuntimeError(error.message || 'Failed to load runtime view');
      })
      .finally(() => {
        if (!cancelled) {
          setRuntimeLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceMode, activeView, selectedInvoiceId, reloadKey]);

  const metrics = useMemo(() => {
    if (workspaceMode === 'client') {
      const derived = summary || {
        invoicesLoaded: invoices.length,
        avgConfidence: invoices.length ? Math.round((invoices.reduce((sum, invoice) => sum + invoice.confidence, 0) / invoices.length) * 100) : 0,
        pendingApproval: invoices.filter((invoice) => invoice.status === 'pending').length,
        needsReview: invoices.filter((invoice) => invoice.status === 'review').length,
        invoiceVolume: invoices.reduce((sum, invoice) => sum + invoice.amount, 0),
        postedCount: invoices.filter((invoice) => invoice.status === 'posted').length,
        ocrQueueDepth: 0,
      };
      return [
        { value: String(derived.invoicesLoaded), label: 'Invoices Loaded', delta: dataSource === 'database' ? 'Live API data' : 'Backend fallback data', tone: '' },
        { value: `${derived.avgConfidence}%`, label: 'Avg. Confidence', delta: `${derived.ocrQueueDepth} queued for OCR`, tone: 'green' },
        { value: String(derived.pendingApproval), label: 'Pending Approval', delta: 'Approver queue', tone: 'amber' },
        { value: String(derived.needsReview), label: 'Needs Review', delta: 'Human intervention', tone: 'red' },
        { value: fmtCurrency(derived.invoiceVolume || 0), label: 'Invoice Volume', delta: `${derived.postedCount} already posted`, tone: 'blue' }
      ];
    }
    return [
      { value: '4', label: 'Active Workflows', delta: '2 publish ready', tone: '' },
      { value: '98%', label: 'Simulation Pass Rate', delta: 'Last 25 runs', tone: 'green' },
      { value: '3', label: 'Pending Diffs', delta: 'Consultant review', tone: 'amber' },
      { value: '2', label: 'Connector Gaps', delta: 'SAP + NetSuite', tone: 'red' },
      { value: '142', label: 'Dataset Assets', delta: 'Canonical templates', tone: 'blue' }
    ];
  }, [dataSource, invoices, summary, workspaceMode]);

  const approveSelected = async () => {
    if (!selectedInvoice) return;
    try {
      setActionBusy('approve');
      setDataError('');
      await approveInvoice(selectedInvoice.id);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setDataError(error.message || 'Failed to approve invoice');
    } finally {
      setActionBusy('');
    }
  };

  const rejectSelected = async () => {
    if (!selectedInvoice) return;
    try {
      setActionBusy('review');
      setDataError('');
      await sendInvoiceToReview(selectedInvoice.id);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setDataError(error.message || 'Failed to send invoice to review');
    } finally {
      setActionBusy('');
    }
  };

  const openOriginalMockup = async () => {
    if (!window.proviso?.openOriginalMockup) {
      setLauncherMessage('Operation View launcher is available in the Electron desktop app.');
      return;
    }

    const result = await window.proviso.openOriginalMockup();
    setLauncherMessage(result?.ok ? 'Opened Operation View in a separate desktop window.' : (result?.error || 'Failed to open Operation View.'));
  };

  const clientNavItems = CLIENT_VIEWS.map((view) => ({ id: view, ...NAV_ITEMS[view] }));
  const integratorNavItems = [...INTEGRATOR_VIEWS, 'operation'].map((view) => ({ id: view, ...NAV_ITEMS[view] }));
  const navMeta = NAV_ITEMS[activeView] || NAV_ITEMS.ap;

  const selectSidebarItem = (itemId) => {
    if (CLIENT_VIEWS.includes(itemId)) {
      setWorkspaceMode('client');
      setActiveView(itemId);
      return;
    }
    if (itemId === 'operation') {
      setWorkspaceMode('operation');
      setActiveView('wf');
      return;
    }
    setWorkspaceMode('integrator');
    setActiveView(itemId);
  };

  return (
    <>
      <style>{CSS}</style>
      <div className={`surface-shell ${workspaceMode !== 'client' ? 'surface-dark' : ''}`}>
        <aside className="surface-sidebar">
          <div className="surface-brand"><i className="ti ti-sparkles" /></div>
          {clientNavItems.map((item) => (
            <button key={item.id} className={`surface-navbtn ${workspaceMode === 'client' && activeView === item.id ? 'active' : ''}`} onClick={() => selectSidebarItem(item.id)} title={item.label}>
              <i className={item.icon} />
            </button>
          ))}
          <div style={{ width: '28px', height: '1px', background: '#e2e8f2', margin: '8px 0 6px' }} />
          {integratorNavItems.map((item) => (
            <button
              key={item.id}
              className={`surface-navbtn ${((item.id === 'operation' && workspaceMode === 'operation') || (workspaceMode === 'integrator' && activeView === item.id)) ? 'active' : ''}`}
              onClick={() => selectSidebarItem(item.id)}
              title={item.label}
            >
              <i className={item.icon} />
            </button>
          ))}
          <div className="surface-navspacer" />
          <button className="surface-navbtn" title="Notifications"><i className="ti ti-bell" /></button>
          <div className="surface-avatar">HJ</div>
        </aside>

        <main className="surface-main">
          <div className="surface-topbar">
            <div className="surface-logo">AI Provi<span>so</span></div>
            <div className="surface-badge">v1.0 · Integrated Shell</div>
            <div className="surface-spacer" />
            <div className="surface-mode">
              <button className={`surface-modebtn client ${workspaceMode === 'client' ? 'active client' : ''}`} onClick={() => setWorkspaceMode('client')}>Client Workspace</button>
              <button className={`surface-modebtn integrator ${workspaceMode === 'integrator' ? 'active integrator' : ''}`} onClick={() => setWorkspaceMode('integrator')}>Integrator Workspace</button>
              <button className={`surface-modebtn operation ${workspaceMode === 'operation' ? 'active operation' : ''}`} onClick={() => { setWorkspaceMode('operation'); setActiveView('wf'); }}>Operation View</button>
            </div>
            <button className="surface-action"><i className="ti ti-player-play" /> Guided Tour</button>
            <button className="surface-action primary"><i className="ti ti-upload" /> Upload</button>
          </div>

          <div className="surface-ctxbar">
            <span className="surface-ctxtitle">{navMeta.title}</span>
            <span className="surface-ctxsep">›</span>
            <span className="surface-ctxsub">{navMeta.subtitle}</span>
            {workspaceMode === 'client' && <span className="surface-ctxsub">• {dataSource === 'database' ? 'Live backend' : dataSource === 'fallback' ? 'Backend fallback' : 'Connecting'}</span>}
            {!!launcherMessage && (workspaceMode === 'integrator' || workspaceMode === 'operation') && activeView === 'wf' && <span className="surface-ctxsub">• {launcherMessage}</span>}
          </div>

          <div className="surface-metrics">
            {metrics.map((metric) => (
              <div className="surface-metric" key={metric.label}>
                <div className={`surface-metricval ${metric.tone}`}>{metric.value}</div>
                <div className="surface-metriclbl">{metric.label}</div>
                <div className="surface-metricdelta">{metric.delta}</div>
              </div>
            ))}
          </div>

          {activeView === 'ap' && (
            <div className="surface-filterbar">
              <div className="surface-search">
                <i className="ti ti-search" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoices, vendors, assignees..." />
              </div>
              <div className="surface-chips">
                {['all', 'pending', 'review', 'approved', 'extracted'].map((chip) => (
                  <button key={chip} className={`surface-chip ${filter === chip ? 'on' : ''}`} onClick={() => setFilter(chip)}>{chip === 'all' ? 'All' : chip[0].toUpperCase() + chip.slice(1)}</button>
                ))}
              </div>
              <span className="surface-ctxsub">{loadingInvoices ? 'Loading invoices…' : dataError || 'Connected to /api/invoices'}</span>
              <div className="surface-spacer" />
              <button className="surface-action" onClick={approveSelected} disabled={!selectedInvoice || !!actionBusy}><i className="ti ti-checks" /> {actionBusy === 'approve' ? 'Approving…' : 'Bulk approve'}</button>
              <button className="surface-action"><i className="ti ti-download" /> Export</button>
            </div>
          )}

          <div className="surface-content">
            <div className={`surface-view ${activeView === 'ap' ? 'active' : ''}`}>
              <div className="ap-shell">
                <div className="ap-table-wrap">
                  <table className="ap-table">
                    <thead>
                      <tr>
                        <th>Vendor</th>
                        <th>Invoice #</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Confidence</th>
                        <th>Assigned</th>
                        <th>SLA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingInvoices && (
                        <tr>
                          <td colSpan="8">Loading invoices from backend…</td>
                        </tr>
                      )}
                      {!loadingInvoices && !filteredInvoices.length && (
                        <tr>
                          <td colSpan="8">{dataError || 'No invoices match the current filters.'}</td>
                        </tr>
                      )}
                      {!loadingInvoices && filteredInvoices.map((invoice) => (
                        <tr key={invoice.id} className={selectedInvoiceId === invoice.id ? 'sel' : ''} onClick={() => setSelectedInvoiceId(invoice.id)}>
                          <td>{invoice.vendor}</td>
                          <td className="mono">{invoice.invoiceNumber}</td>
                          <td>{invoice.date}</td>
                          <td>{fmtCurrency(invoice.amount)}</td>
                          <td><span className={`ap-status ${statusClass(invoice.status)}`}>{invoice.status}</span></td>
                          <td>
                            <div className="ap-conf">
                              <div className="ap-conftrack"><div className={`ap-conffill ${invoice.confidence >= 0.9 ? 'green' : invoice.confidence >= 0.7 ? 'amber' : 'red'}`} style={{ width: `${Math.round(invoice.confidence * 100)}%` }} /></div>
                              <span className="ap-confnum">{invoice.confidence.toFixed(2)}</span>
                            </div>
                          </td>
                          <td>{invoice.assignee}</td>
                          <td>{invoice.sla}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <aside className="ap-detail">
                  {selectedInvoice ? (
                    <>
                      <div className="ap-dhead">
                        <div className="ap-dtitle">{selectedInvoice.invoiceNumber}</div>
                        <div className="ap-dsub">{selectedInvoice.vendor} · {selectedInvoice.queue}</div>
                      </div>
                      <div className="ap-tabs">
                        <button className={`ap-tab ${inspectionTab === 'invoice' ? 'active' : ''}`} onClick={() => setInspectionTab('invoice')}>Invoice Summary</button>
                        <button className={`ap-tab ${inspectionTab === 'blueprint' ? 'active' : ''}`} onClick={() => setInspectionTab('blueprint')}>Integrator Blueprint</button>
                      </div>
                      <div className="ap-dbody">
                        {inspectionTab === 'invoice' ? (
                          <>
                            <div className="ap-card">
                              <h4>Invoice Summary</h4>
                              <div className="ap-kv"><span>Vendor</span><span>{selectedInvoice.vendor}</span></div>
                              <div className="ap-kv"><span>PO Reference</span><span>{selectedInvoice.po}</span></div>
                              <div className="ap-kv"><span>Amount</span><span>{fmtCurrency(selectedInvoice.amount)}</span></div>
                              <div className="ap-kv"><span>Status</span><span>{selectedInvoice.status}</span></div>
                            </div>
                            <div className="ap-card">
                              <h4>Confidence by Field</h4>
                              <div className="ap-kv"><span>Vendor</span><span>{selectedInvoice.fieldConfidence?.vendor_name?.toFixed(2) ?? '0.00'}</span></div>
                              <div className="ap-kv"><span>Invoice Date</span><span>{selectedInvoice.fieldConfidence?.invoice_date?.toFixed(2) ?? '0.00'}</span></div>
                              <div className="ap-kv"><span>Total</span><span>{selectedInvoice.fieldConfidence?.total_amount?.toFixed(2) ?? selectedInvoice.confidence.toFixed(2)}</span></div>
                              <div className="ap-kv"><span>PO Number</span><span>{selectedInvoice.fieldConfidence?.po_number?.toFixed(2) ?? '0.00'}</span></div>
                            </div>
                            <div className="ap-card">
                              <h4>Lifecycle</h4>
                              <div className="ap-kv"><span>Received</span><span>{fmtDateTime(selectedInvoice.receivedAt)}</span></div>
                              <div className="ap-kv"><span>Updated</span><span>{fmtDateTime(selectedInvoice.updatedAt)}</span></div>
                              <div className="ap-kv"><span>Current Queue</span><span>{selectedInvoice.queue}</span></div>
                            </div>
                          </>
                        ) : (
                          <div className="ap-card">
                            <div className="ap-runtime-meta">
                              <h4 style={{ marginBottom: 0 }}>Live Workflow Execution Trace</h4>
                              <span className={`ap-runtime-source ${runtimeSource === 'fallback' ? 'fallback' : ''}`}>{runtimeSource || 'loading'}</span>
                            </div>
                            {runtimeLoading && <div className="ap-runtime-text">Loading workflow runtime for the selected invoice…</div>}
                            {!runtimeLoading && runtimeError && <div className="ap-runtime-text">{runtimeError}</div>}
                            {!runtimeLoading && !runtimeError && runtimePayload && (
                              <div className="ap-runtime-section">
                                <div className="ap-runtime-grid">
                                  <div className="ap-runtime-box">
                                    <strong>Selected Workflow</strong>
                                    <span>{runtimePayload.workflow?.name || 'Workflow instance'} · {runtimePayload.workflow?.version || 'v1'} · {runtimePayload.workflow?.status || 'active'}</span>
                                  </div>
                                  <div className="ap-runtime-box">
                                    <strong>Current Operational State</strong>
                                    <span>{activeRuntimeState}</span>
                                  </div>
                                </div>
                                <div>
                                  <div className="ap-runtime-title">Execution Path</div>
                                  <div className="ap-trace-flow">
                                    {executionTrace.map((step) => (
                                      <div key={`${step.id}-${step.label}`} className={`ap-trace-node ${activeRuntimeState.includes(step.id) ? 'active' : ''}`}>
                                        <span className="ap-trace-dot" />
                                        <div className="ap-trace-copy">
                                          <strong>{step.label}</strong>
                                          <span>{step.meta}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                {!!runtimePayload.trace?.length && (
                                  <div>
                                    <div className="ap-runtime-title">Execution Trace</div>
                                    {runtimeTextRows(runtimePayload.trace)}
                                  </div>
                                )}
                                {!!runtimePayload.diagnostics?.length && (
                                  <div>
                                    <div className="ap-runtime-title">Diagnostics</div>
                                    {runtimePayload.diagnostics.map((item) => (
                                      <div key={item.title} className={`ap-runtime-text ${item.mono ? 'mono' : ''}`}>
                                        <strong>{item.title}</strong><br />
                                        {item.copy}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div>
                                  <button className="surface-action" onClick={() => setShowRawRuntime((current) => !current)}>
                                    <i className="ti ti-code" /> {showRawRuntime ? 'Hide Raw Payload' : 'Raw JSON / Payload'}
                                  </button>
                                  {showRawRuntime && <pre className="ap-runtime-text mono" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{JSON.stringify(runtimePayload, null, 2)}</pre>}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="ap-actions">
                        <button className="surface-action primary" onClick={approveSelected} disabled={!!actionBusy}><i className="ti ti-check" /> {actionBusy === 'approve' ? 'Approving…' : 'Approve invoice'}</button>
                        <button className="surface-action" onClick={rejectSelected} disabled={!!actionBusy}><i className="ti ti-arrow-back" /> {actionBusy === 'review' ? 'Routing…' : 'Send to review'}</button>
                        <button className="surface-action"><i className="ti ti-eye" /> View original PDF</button>
                      </div>
                    </>
                  ) : (
                    <div className="ap-empty">
                      <i className="ti ti-file-invoice" style={{ fontSize: 36, opacity: 0.25 }} />
                      <div>Select an invoice to inspect fields, confidence, and lifecycle.</div>
                    </div>
                  )}
                </aside>
              </div>
            </div>

            <div className={`surface-view ${activeView === 'exc' ? 'active' : ''}`}>
              <div className="simple-panel">
                <div className="simple-list">
                  <div className="simple-row"><span>Missing Vendor Reference</span><span>2 invoices · SLA 2h</span></div>
                  <div className="simple-row"><span>Low Confidence Extraction</span><span>2 invoices · manual review</span></div>
                  <div className="simple-row"><span>Missing PO Reference</span><span>1 invoice · policy exception</span></div>
                </div>
              </div>
            </div>

            <div className={`surface-view ${activeView === 'audit' ? 'active' : ''}`}>
              <div className="simple-panel">
                <div className="simple-list">
                  <div className="simple-row"><span>14:32 approved</span><span>INV-2026-0441 · MOD-04</span></div>
                  <div className="simple-row"><span>14:28 extracted</span><span>INV-2026-0442 · MOD-02</span></div>
                  <div className="simple-row"><span>14:25 exception</span><span>INV-2026-0438 · MOD-03</span></div>
                  <div className="simple-row"><span>14:21 posted</span><span>INV-2026-0430 · MOD-05</span></div>
                </div>
              </div>
            </div>

            <div className={`surface-view ${activeView === 'wf' ? 'active' : ''}`}>
              {workspaceMode === 'operation' ? (
                <section className="integrator-canvas" style={{ flex: 1 }}>
                  <div className="integrator-toolbar">
                    <div className="integrator-meta">
                      <strong>Operation View</strong>
                      <span>Dedicated Mockup 3 workflow surface for switching directly between client, integrator, and operations work.</span>
                    </div>
                    <button className="surface-action" onClick={openOriginalMockup}><i className="ti ti-layout-board-split" /> Open Standalone Surface</button>
                  </div>
                  <div className="design-host">
                    <CommandCenter externalSelection={integratorDebugContext} />
                  </div>
                </section>
              ) : (
              <div className={`integrator-shell ${integratorCanvasMode === 'full' ? 'full' : ''}`}>
                <section className="integrator-queue">
                  <div className="integrator-toolbar">
                    <div className="integrator-meta">
                      <strong>Incoming Processing Queue</strong>
                      <span>Shared invoice context for integrator debugging without duplicating top metrics.</span>
                    </div>
                  </div>
                  {selectedInvoice && (
                    <div className="integrator-debug">
                      <div className="integrator-debug-grid">
                        <div className="integrator-debug-card">
                          <strong>Selected Invoice</strong>
                          <span>{selectedInvoice.invoiceNumber} · {selectedInvoice.vendor}</span>
                        </div>
                        <div className="integrator-debug-card">
                          <strong>Workflow State</strong>
                          <span><code>{integratorDebugContext?.stateName || 'Draft'}</code></span>
                        </div>
                        <div className="integrator-debug-card">
                          <strong>Last Transition</strong>
                          <span>{integratorDebugContext?.lastTransition || 'Draft -> Under Review'}</span>
                        </div>
                        <div className="integrator-debug-card">
                          <strong>Confidence Signal</strong>
                          <span>{integratorDebugContext?.confidenceBand || 'Awaiting runtime data'} · {selectedInvoice.confidence.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="integrator-debug-card">
                        <strong>Blocking Rule / Attention Point</strong>
                        <span>{integratorDebugContext?.blockingRule || runtimeError || 'Select an invoice to inspect transition context.'}</span>
                      </div>
                      {integratorDebugContext?.ruleDecision && (
                        <div className="integrator-rule-card">
                          <div className="integrator-rule-head">
                            <div className="integrator-rule-title">
                              <strong>Connected Rule Card</strong>
                              <span>{integratorDebugContext.ruleDecision.title}</span>
                            </div>
                            <span className={`integrator-rule-chip ${runtimeToneClass(integratorDebugContext.ruleDecision.severity)}`}>{integratorDebugContext.ruleDecision.severity}</span>
                          </div>
                          <div className="integrator-debug-card" style={{ padding: '9px 10px' }}>
                            <strong>Authority</strong>
                            <span><code>{integratorDebugContext.ruleDecision.id}</code> · <code>{integratorDebugContext.ruleDecision.guard_name || 'guard pending'}</code></span>
                          </div>
                          <div className="integrator-rule-grid">
                            <div className="integrator-rule-box">
                              <strong>Expected</strong>
                              <span>{integratorDebugContext.ruleDecision.expected || 'No explicit expected payload recorded.'}</span>
                            </div>
                            <div className="integrator-rule-box">
                              <strong>Actual</strong>
                              <span>{integratorDebugContext.ruleDecision.actual || 'No explicit actual payload recorded.'}</span>
                            </div>
                          </div>
                          <div className="integrator-rule-remediation">
                            <strong>Remediation</strong>
                            <span>{integratorDebugContext.ruleDecision.remediation || integratorDebugContext.ruleDecision.copy}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="ap-table-wrap">
                    <table className="ap-table">
                      <thead>
                        <tr>
                          <th>Vendor</th>
                          <th>Invoice #</th>
                          <th>Status</th>
                          <th>Confidence</th>
                          <th>SLA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingInvoices && (
                          <tr>
                            <td colSpan="5">Loading invoices from backend…</td>
                          </tr>
                        )}
                        {!loadingInvoices && !filteredInvoices.length && (
                          <tr>
                            <td colSpan="5">{dataError || 'No invoice context is available.'}</td>
                          </tr>
                        )}
                        {!loadingInvoices && filteredInvoices.map((invoice) => (
                          <tr key={`wf-${invoice.id}`} className={selectedInvoiceId === invoice.id ? 'sel' : ''} onClick={() => setSelectedInvoiceId(invoice.id)}>
                            <td>{invoice.vendor}</td>
                            <td className="mono">{invoice.invoiceNumber}</td>
                            <td><span className={`ap-status ${statusClass(invoice.status)}`}>{invoice.status}</span></td>
                            <td>{invoice.confidence.toFixed(2)}</td>
                            <td>{invoice.sla}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="integrator-canvas">
                  <div className="integrator-toolbar">
                    <div className="integrator-head">
                      <div className="integrator-meta">
                        <strong>Integrator Workspace</strong>
                        <span>{integratorSubview === 'data' ? 'Queue, runtime context, and workflow canvas in one operating surface.' : 'Blueprint View keeps the dedicated workflow-design page available without crowding the main shell.'}</span>
                      </div>
                      <div className="integrator-subtabs">
                        <button className={integratorSubview === 'data' ? 'active' : ''} onClick={() => setIntegratorSubview('data')}>Data View</button>
                        <button className={integratorSubview === 'blueprint' ? 'active' : ''} onClick={() => setIntegratorSubview('blueprint')}>Blueprint View</button>
                      </div>
                    </div>
                    <div className="integrator-toggle">
                      <button className={integratorCanvasMode === 'split' ? 'active' : ''} onClick={() => setIntegratorCanvasMode('split')}>Split View</button>
                      <button className={integratorCanvasMode === 'full' ? 'active' : ''} onClick={() => setIntegratorCanvasMode('full')}>Full Canvas</button>
                    </div>
                  </div>
                  {integratorSubview === 'data' ? (
                    <div className="design-host">
                      <CommandCenter externalSelection={integratorDebugContext} />
                    </div>
                  ) : (
                    <div className="simple-panel">
                      <div className="simple-grid">
                        <div className="simple-card">
                          <h3>Blueprint View</h3>
                          <p>The preserved standalone design page remains available as the dedicated workflow-design surface.</p>
                          <p>That keeps the main Integrator Workspace focused while still giving you a full page for deeper architecture work.</p>
                        </div>
                        <div className="simple-card">
                          <h3>Use It For</h3>
                          <ul>
                            <li>Deep pipeline layout work</li>
                            <li>Low-level infrastructure inspection</li>
                            <li>Canvas-first design sessions without queue noise</li>
                          </ul>
                        </div>
                      </div>
                      <div style={{ marginTop: '14px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button className="surface-action" onClick={openOriginalMockup}><i className="ti ti-layout-board-split" /> Open Blueprint View</button>
                        <span className="surface-ctxsub">Launches the preserved standalone design page in Electron.</span>
                      </div>
                    </div>
                  )}
                </section>
              </div>
              )}
            </div>

            <div className={`surface-view ${activeView === 'erp' ? 'active' : ''}`}>
              <div className="simple-panel">
                <div className="simple-grid">
                  <div className="simple-card">
                    <h3>ERP Mapping</h3>
                    <p>AI auto-mapped 5 of 6 canonical fields using previous SAP deployments. One field still needs human confirmation.</p>
                  </div>
                  <div className="simple-card">
                    <h3>Posting Health</h3>
                    <ul>
                      <li>Success rate: 100%</li>
                      <li>Failed postings: 0</li>
                      <li>DLQ events: 0</li>
                      <li>Connector: SAP 2024</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className={`surface-view ${activeView === 'ai' ? 'active' : ''}`}>
              <div className="simple-panel">
                <div className="simple-grid">
                  <div className="simple-card">
                    <h3>Scenario Prompt</h3>
                    <p>Service agreement, Ontario manufacturer, dual approval above $25k CAD, PDF lock on approval, and consultant-visible exception state.</p>
                  </div>
                  <div className="simple-card">
                    <h3>RAG Candidates</h3>
                    <ul>
                      <li>Service Agreement - Mfg (94%)</li>
                      <li>AP Invoice - Dual Approval (81%)</li>
                      <li>Contract Lifecycle - SMB (73%)</li>
                    </ul>
                  </div>
                </div>
                <div className="simple-list" style={{ marginTop: 12 }}>
                  <div className="simple-row"><span>State added: VP Operations</span><span>Accept / Reject</span></div>
                  <div className="simple-row"><span>Threshold changed: $10k to $25k CAD</span><span>Accept / Keep old</span></div>
                  <div className="simple-row"><span>State removed: Signed Internally</span><span>Accept / Restore</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="surface-footer">
            <div className="surface-footer-ticker">
              <span className="surface-ticker-label">Live Execution</span>
              {selectedInvoice ? (
                <>
                  <span className="surface-ticker-item dim">
                    <strong>{selectedInvoice.invoiceNumber}</strong>
                    <span>{integratorDebugContext?.stateName || selectedInvoice.status}</span>
                  </span>
                  {footerTicker.length ? footerTicker.map((item) => (
                    <span key={item.id} className={`surface-ticker-item ${item.tone || 'dim'}`}>
                      <strong>{item.label}</strong>
                      <span>{item.detail} · {fmtTickerTime(item.recorded_at)}</span>
                    </span>
                  )) : <span className="surface-ticker-empty">Awaiting runtime events for the selected invoice.</span>}
                </>
              ) : <span className="surface-ticker-empty">Select an invoice to stream route history and runtime events.</span>}
            </div>
            <div className="surface-footer-infra">
              <span><span className="surface-dot" /> PostgreSQL healthy</span>
              <span><span className="surface-dot" /> Redis connected</span>
              <span><span className="surface-dot" /> n8n webhooks 9/9</span>
              <span><span className="surface-dot" /> Ollama phi4-mini ready</span>
            </div>
          </div>
        </main>
      </div>
      <CommandPalette />
    </>
  );
}

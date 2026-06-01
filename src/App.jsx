import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import CommandPalette from './components/CommandPalette';
import RuntimeErrorBoundary from './components/RuntimeErrorBoundary';
import { approveInvoice, getDashboardSummary, getInvoices, getRuntimeView, sendInvoiceToReview } from './lib/api';

const CommandCenter = lazy(() => import('./modules/workflow-designer/WorkflowDesignerShell'));

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
.cc-topbar{display:none}
.cc-mode-tabs{display:flex;gap:2px;flex:1;padding:0 10px}
.cc-mode-tab{font-size:9.5px;font-family:var(--mono);padding:5px 12px;border-radius:4px;border:1px solid transparent;background:transparent;color:var(--mid);cursor:pointer;transition:all .15s}
.cc-mode-tab:hover{color:var(--text);border-color:var(--border)}
.cc-mode-tab.active-manual{color:var(--a3);background:rgba(74,159,255,.1);border-color:rgba(74,159,255,.3)}
.cc-mode-tab.active-nlp{color:var(--accent);background:rgba(21,101,216,.1);border-color:rgba(21,101,216,.3)}
.cc-mode-tab.active-ai{color:#A78BFA;background:rgba(124,92,252,.1);border-color:rgba(124,92,252,.3)}
.cc-body{flex:1;display:grid;overflow:hidden;transition:grid-template-columns .26s cubic-bezier(.4,0,.2,1)}
.cc-left{display:flex;flex-direction:column;overflow:hidden;border-right:1px solid var(--border);background:rgba(7,17,31,0.85);backdrop-filter:blur(12px);transition:opacity .22s ease,border-color .26s ease;position:relative;z-index:2;min-width:0}
.cc-left.left-collapsed{opacity:0;pointer-events:none;border-right-color:transparent}
.cc-center{display:flex;flex-direction:column;overflow:hidden;border-right:1px solid var(--border);background:radial-gradient(circle at top, rgba(39,88,160,.14), transparent 34%),linear-gradient(180deg,#06111f 0%,#040c16 100%);min-width:0;position:relative}
.cc-right{display:flex;flex-direction:column;overflow:hidden;background:rgba(7,17,31,0.85);backdrop-filter:blur(12px);transition:opacity .22s ease;z-index:2;min-width:0}
.cc-right.right-collapsed{opacity:0;pointer-events:none}
.cc-panel-toggle{position:absolute;top:50%;transform:translateY(-50%);z-index:20;width:16px;height:52px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:rgba(9,20,38,0.94);border:1px solid rgba(255,255,255,0.09);color:rgba(100,116,139,.8);font-size:10px;transition:all .16s;padding:0;line-height:1;user-select:none}
.cc-panel-toggle:hover{color:#94a3b8;background:rgba(14,30,56,1);border-color:rgba(74,159,255,0.4);box-shadow:0 0 0 1px rgba(74,159,255,0.12)}
.cc-panel-toggle-left{left:0;border-left:none;border-radius:0 6px 6px 0}
.cc-panel-toggle-right{right:0;border-right:none;border-radius:6px 0 0 6px}
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
.canvas-panel{padding:0 !important;position:relative;overflow:hidden;height:100%;display:flex;flex-direction:column;min-height:0}
.canvas-surface{height:100%;min-height:300px;width:100%;min-width:100px;position:relative;background:
  radial-gradient(circle at 18% 16%, rgba(74,159,255,.09), transparent 0 22%),
  radial-gradient(circle at 82% 74%, rgba(74,159,255,.05), transparent 0 20%),
  linear-gradient(180deg, rgba(12,25,42,.98) 0%, rgba(5,12,23,1) 100%)}
.canvas-toolbar-shell{position:absolute;top:16px;left:50%;transform:translateX(-50%);z-index:10;display:flex;align-items:center;justify-content:center;width:min(860px, calc(100% - 80px))}
.canvas-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;padding:6px 8px;border:1px solid rgba(255,255,255,.06);background:rgba(7,17,31,.72);border-radius:18px;box-shadow:0 10px 22px rgba(0,0,0,.18);backdrop-filter:blur(12px)}
.canvas-toolbar-brand{display:flex;flex-direction:column;gap:1px;padding:0 8px 0 4px;min-width:176px}
.canvas-toolbar-kicker{font-size:8px;letter-spacing:1.2px;text-transform:uppercase;color:rgba(164,191,230,.56);font-family:var(--mono)}
.canvas-toolbar-title{font-size:11px;color:#f4f8ff;font-weight:600}
.canvas-toolbar-meta{position:absolute;top:18px;right:18px;z-index:9;display:flex;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap;max-width:420px}
.canvas-toolbar-btn{border:1px solid rgba(255,255,255,.06);background:rgba(15,28,46,.76);color:var(--text);padding:9px 11px;border-radius:999px;font-family:var(--mono);font-size:9.5px;cursor:pointer;transition:all .15s;box-shadow:none}
.canvas-toolbar-btn:hover:not(:disabled){border-color:var(--a2);color:#fff;background:rgba(10,24,40,.98)}
.canvas-toolbar-btn:disabled{opacity:.45;cursor:not-allowed}
.canvas-toolbar-hint{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);z-index:9;display:flex;align-items:center;min-height:32px;padding:7px 12px;border:1px solid rgba(255,255,255,.05);background:rgba(7,17,31,.56);border-radius:999px;color:rgba(177,197,225,.72);font-family:var(--mono);font-size:8.5px;letter-spacing:.12px;backdrop-filter:blur(8px);justify-content:center;text-align:center;max-width:min(720px, calc(100% - 32px))}
.canvas-drop-indicator{position:absolute;inset:86px 18px 60px;z-index:8;display:flex;align-items:center;justify-content:center;border:1px dashed rgba(74,159,255,.36);border-radius:20px;background:rgba(74,159,255,.08);color:#dcecff;font-family:var(--mono);font-size:10px;letter-spacing:.9px;text-transform:uppercase;pointer-events:none;backdrop-filter:blur(4px)}
.canvas-stat-pill{display:flex;align-items:center;gap:7px;padding:6px 10px;border:1px solid rgba(255,255,255,.05);background:rgba(8,18,30,.68);border-radius:999px;color:var(--text);min-height:32px}
.canvas-stat-pill.selection{min-width:min(320px, 100%)}
.canvas-stat-label{font-size:8px;letter-spacing:1px;text-transform:uppercase;color:rgba(164,191,230,.56);font-family:var(--mono)}
.canvas-stat-value{font-size:9px;color:#fff;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.canvas-surface.drop-active .canvas-toolbar-hint{border-color:rgba(74,159,255,.22);background:rgba(10,24,40,.76);color:#e8f2ff}
.canvas-surface .react-flow{background:transparent}
.canvas-surface .react-flow__attribution{display:none}
.canvas-surface .react-flow__controls,.canvas-surface .react-flow__minimap{background:rgba(7,17,31,.86);border:1px solid rgba(255,255,255,.09);border-radius:10px;box-shadow:0 8px 16px rgba(0,0,0,.22)}
.canvas-surface .react-flow__controls button{background:transparent;border-bottom:1px solid rgba(255,255,255,.05);color:var(--mid)}
.canvas-surface .react-flow__controls button:hover{background:var(--s3);color:var(--text)}
.canvas-surface .react-flow__minimap-mask{fill:rgba(2,7,14,.72)}
.canvas-surface .react-flow__minimap-node{rx:4;ry:4}
.canvas-surface .react-flow__controls{left:14px;bottom:68px;z-index:30 !important}
/* Minimap must sit above the fallback SVG overlay (z-19) and node layer (z-25) */
.canvas-surface .react-flow__minimap{
  right:14px;bottom:14px;
  transform:scale(.9);transform-origin:bottom right;
  opacity:.92;
  z-index:30 !important;
  border:1px solid rgba(74,159,255,.22) !important;
  box-shadow:0 0 0 1px rgba(74,159,255,.08),0 8px 24px rgba(0,0,0,.38) !important;
}
.wf-node-card{min-width:248px;max-width:290px;border-radius:18px;border:1px solid rgba(255,255,255,.06);background:linear-gradient(180deg, rgba(10,24,40,.96), rgba(8,18,30,.98));padding:16px 18px 18px;box-shadow:0 16px 28px rgba(0,0,0,.24);color:var(--text);position:relative;overflow:hidden}
.wf-node-card.selected{border-color:var(--a3);box-shadow:0 0 0 1px rgba(74,159,255,.32),0 22px 40px rgba(0,0,0,.38)}
.wf-node-card.has-errors{border-color:rgba(255,61,90,.45)}
.wf-node-accent{position:absolute;left:0;top:0;bottom:0;width:4px;background:#4A9FFF;opacity:.9}
.wf-node-card.kind-initial .wf-node-accent{background:#00c870}
.wf-node-card.kind-approval .wf-node-accent{background:#f0a500}
.wf-node-card.kind-exception .wf-node-accent{background:#ff3d5a}
.wf-node-card.kind-terminal .wf-node-accent{background:#8b7dff}
.wf-node-card.kind-technical .wf-node-accent{background:#20c3d8}
.wf-node-kind-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.wf-node-kind{font-size:9px;letter-spacing:1.1px;text-transform:uppercase;color:var(--a3)}
.wf-node-badge{font-size:8px;letter-spacing:.7px;text-transform:uppercase;color:rgba(229,242,255,.75);padding:4px 7px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07)}
.wf-node-name{font-family:var(--display);font-size:22px;line-height:1.05;color:#fff;margin-bottom:10px}
.wf-node-meta{display:flex;justify-content:space-between;gap:8px;font-size:9.5px;color:var(--mid)}
.wf-node-caption{margin-top:12px;font-size:8.5px;color:rgba(200,220,255,.42);text-transform:uppercase;letter-spacing:.6px}
.wf-node-handle{width:18px !important;height:18px !important;border:3px solid rgba(3,9,16,.88) !important;background:var(--a3) !important;box-shadow:0 0 0 4px rgba(74,159,255,.18)}
.wf-edge-path{stroke:#4A9FFF;stroke-width:2.5;opacity:.9}
.wf-edge-path.selected{stroke:#F0A500;stroke-width:3}
.wf-edge-label{position:absolute;padding:6px 10px;border-radius:999px;background:rgba(6,14,24,.92);border:1px solid rgba(255,255,255,.08);font-size:9px;color:var(--text);pointer-events:auto;cursor:pointer;white-space:nowrap;box-shadow:0 6px 14px rgba(0,0,0,.16)}
.wf-edge-label.selected{border-color:rgba(240,165,0,.35);color:#fff}
.wf-edge-label.has-errors{border-color:rgba(255,61,90,.45)}
.canvas-empty-state{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;pointer-events:none;text-align:center;padding:24px}
.canvas-empty-title{font-family:var(--display);font-size:22px;color:#fff}
.canvas-empty-copy{font-size:10px;color:var(--mid);max-width:260px;line-height:1.7}
.cell-pill{display:block;padding:6px 8px;font-size:10px;color:var(--text)}
.cell-flag{display:inline-flex;align-items:center;justify-content:center;min-width:34px;margin:0 auto;padding:3px 6px;border-radius:999px;border:1px solid var(--border);font-size:8px;color:var(--mid);text-transform:uppercase}
.cell-flag.on{border-color:rgba(74,159,255,.35);color:var(--a3);background:rgba(74,159,255,.1)}
.cell-icon{display:flex;align-items:center;justify-content:center;color:var(--mid);font-size:10px;height:100%}
.navigator-list{display:flex;flex-direction:column;gap:6px;padding:8px}
.workflow-palette{display:flex;flex-direction:column;gap:10px;padding:10px 10px 2px}
.workflow-palette-head{display:flex;flex-direction:column;gap:2px;padding:0 2px}
.workflow-palette-kicker{font-size:8px;color:var(--mid);letter-spacing:1px;text-transform:uppercase}
.workflow-palette-copy{font-size:9px;color:rgba(177,197,225,.72);line-height:1.5}
.workflow-palette-list{display:flex;flex-direction:column;gap:7px}
.workflow-palette-item{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(7,17,31,.62);text-align:left;cursor:grab;transition:border-color .15s,background .15s,box-shadow .15s;overflow:hidden}
.workflow-palette-item:hover,.workflow-palette-item:focus-visible{border-color:rgba(74,159,255,.4);background:rgba(10,24,40,.86);box-shadow:0 0 0 1px rgba(74,159,255,.15)}
.workflow-palette-item:active{cursor:grabbing;transform:scale(.98)}
.workflow-palette-item.kind-approval{border-color:rgba(240,165,0,.25)}
.workflow-palette-item.kind-exception{border-color:rgba(255,61,90,.25)}
.workflow-palette-item.kind-technical{border-color:rgba(32,195,216,.25)}
.workflow-palette-item.kind-terminal{border-color:rgba(139,125,255,.25)}
.workflow-palette-icon-wrap{display:flex;align-items:center;gap:6px;flex-shrink:0}
/* Labels always visible — no collapsed icon-only mode */
.workflow-palette-label{font-size:10px;color:var(--text);font-weight:700;white-space:nowrap;opacity:1;flex:1;transition:color .15s}
.workflow-palette-meta{font-size:8px;color:var(--mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0.85;max-width:140px}
.workflow-palette-item:hover .workflow-palette-label{color:#e8f4ff}
.workflow-palette-drag-ghost{position:fixed;top:-9999px;left:-9999px;z-index:-1;display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;background:rgba(6,16,30,.95);border:1px solid color-mix(in srgb,var(--ghost-color,#4A9FFF) 45%,rgba(255,255,255,.1));color:#d8ebff;font:600 11px 'JetBrains Mono',monospace;box-shadow:0 10px 24px rgba(0,0,0,.42)}
.workflow-palette-drag-ghost .ghost-dot{width:8px;height:8px;border-radius:50%;background:var(--ghost-color,#4A9FFF)}
.navigator-item{display:flex;flex-direction:column;gap:6px;width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,.05);border-radius:10px;background:rgba(7,17,31,.5);text-align:left;cursor:pointer;transition:all .15s}
.navigator-item:hover{border-color:rgba(74,159,255,.25);background:rgba(10,24,40,.74)}
.navigator-item.selected{border-color:rgba(74,159,255,.35);background:rgba(21,101,216,.12)}
.navigator-title{font-size:10px;color:var(--text);font-weight:600;line-height:1.4}
.navigator-meta{display:flex;align-items:center;gap:8px;font-size:8.5px;color:var(--mid);min-width:0}
.navigator-meta span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.navigator-footer{padding:6px 4px 2px;font-size:8.5px;color:var(--mid);text-align:center}
.inspector-shell,.inspector-empty{padding:12px;display:flex;flex-direction:column;gap:10px}
.inspector-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}
.inspector-title{font-size:9px;color:var(--mid);letter-spacing:1px;text-transform:uppercase}
.inspector-copy{font-size:10px;color:var(--mid);line-height:1.7}
.inspector-tabs{display:flex;gap:4px;padding:4px;background:rgba(5,14,24,.5);border:1px solid rgba(255,255,255,.05);border-radius:10px}
.inspector-tab{flex:1;border:1px solid transparent;background:transparent;color:var(--mid);padding:8px 10px;border-radius:8px;font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.6px;cursor:pointer;transition:all .15s}
.inspector-tab:hover{color:var(--text);background:rgba(255,255,255,.03)}
.inspector-tab.active{color:#fff;background:rgba(74,159,255,.14);border-color:rgba(74,159,255,.24)}
.inspector-section{display:flex;flex-direction:column;gap:10px}
.inspector-grid{display:grid;gap:10px}
.inspector-grid.two-col{grid-template-columns:1fr 1fr}
.inspector-danger{border:1px solid rgba(255,61,90,.35);background:rgba(255,61,90,.1);color:#ffd6dc;padding:7px 10px;border-radius:8px;font-family:var(--mono);font-size:9px;cursor:pointer;transition:all .15s;text-transform:uppercase;letter-spacing:.5px}
.inspector-danger:hover{border-color:rgba(255,61,90,.55);background:rgba(255,61,90,.18);color:#fff}
.inspector-field{display:flex;flex-direction:column;gap:6px;font-size:9px;color:var(--mid);letter-spacing:.5px;text-transform:uppercase}
.inspector-field input,.inspector-field select,.inspector-field textarea{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-family:var(--mono);font-size:10px;color:var(--text);outline:none;text-transform:none}
.inspector-field input:focus,.inspector-field select:focus,.inspector-field textarea:focus{border-color:var(--a2)}
.inspector-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--s2);font-size:9px;color:var(--text);text-transform:uppercase;letter-spacing:.5px}
.inspector-toggle input[type=checkbox]{width:14px;height:14px;accent-color:var(--accent)}
.inspector-toggle-stack{padding-top:2px}
.inspector-readout{display:flex;flex-direction:column;gap:4px;padding:10px 12px;border:1px solid rgba(255,255,255,.05);border-radius:8px;background:rgba(5,14,24,.42)}
.inspector-readout span{font-size:8px;color:var(--mid);letter-spacing:1px;text-transform:uppercase}
.inspector-readout strong{font-size:10px;color:var(--text);font-family:var(--mono);word-break:break-word}
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
.surface-main.workflow-focus{background:#0a1525}
.surface-topbar{height:58px;display:flex;align-items:center;gap:12px;padding:0 20px;background:var(--surface-panel,#fff);border-bottom:1px solid var(--surface-border,#e2e8f2);flex-shrink:0}
.surface-topbar.compact{height:46px;padding:0 16px;gap:10px}
.surface-logo{font-size:18px;font-weight:700;letter-spacing:-.4px}
.surface-logo span{color:var(--surface-accent,#1a6bdb)}
.surface-badge{font-size:10px;font-weight:700;color:var(--surface-subtle,#8a97a8);background:var(--surface-muted,#edf1f7);border:1px solid var(--surface-border,#e2e8f2);padding:2px 7px;border-radius:999px}
.surface-divider{width:1px;height:16px;background:var(--surface-border,#e2e8f2);flex-shrink:0}
.surface-titlelock{display:flex;align-items:center;gap:8px;min-width:0}
.surface-titleblock{display:flex;flex-direction:column;gap:1px;min-width:0}
.surface-title{font-size:12px;font-weight:700;color:var(--surface-text,#0d1b2e);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.surface-titlecopy{font-size:10px;color:var(--surface-subtle,#8a97a8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.surface-spacer{flex:1}
.surface-mode{display:flex;gap:3px;padding:3px;border-radius:999px;background:var(--surface-muted,#edf1f7);border:1px solid var(--surface-border,#e2e8f2)}
.surface-modebtn{border:none;background:transparent;color:var(--surface-mid,#4a5568);padding:6px 13px;border-radius:999px;font-size:12px;font-weight:700;cursor:pointer;transition:all .18s}
.surface-topbar.compact .surface-modebtn{padding:5px 10px;font-size:11px}
.surface-modebtn.active.client{background:#fff;color:#1459ba;box-shadow:0 2px 8px rgba(13,27,46,.08)}
.surface-modebtn.active.integrator{background:#2a7fff;color:#fff;box-shadow:0 4px 12px rgba(42,127,255,.3)}
.surface-modebtn.active.operation{background:#123a63;color:#d4e6ff;box-shadow:0 4px 12px rgba(12,30,54,.35)}
.surface-action{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:8px;border:1px solid var(--surface-border2,#cdd5e3);background:var(--surface-panel,#fff);color:var(--surface-mid,#4a5568);font-size:12px;font-weight:700;cursor:pointer;transition:all .15s}
.surface-topbar.compact .surface-action{padding:6px 10px;font-size:11px}
.surface-action:hover{border-color:var(--surface-accent,#1a6bdb);color:var(--surface-accent,#1a6bdb)}
.surface-action.primary{background:var(--surface-accent,#1a6bdb);border-color:var(--surface-accent,#1a6bdb);color:#fff}

.surface-ctxbar{height:42px;display:flex;align-items:center;gap:10px;padding:0 20px;background:var(--surface-panel,#fff);border-bottom:1px solid var(--surface-border,#e2e8f2);flex-shrink:0}
.surface-ctxbar.designer{height:36px;padding:0 16px;justify-content:space-between;gap:14px}
.surface-ctxtitle{font-size:13px;font-weight:700}
.surface-ctxsep{color:var(--surface-border2,#cdd5e3)}
.surface-ctxsub{font-size:12px;color:var(--surface-subtle,#8a97a8)}
.surface-designer-meta{display:flex;align-items:center;gap:10px;min-width:0;overflow:hidden}
.surface-designer-status{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end}
.surface-statusitem{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--surface-subtle,#8a97a8);font-family:var(--mono)}
.surface-statusdot{width:6px;height:6px;border-radius:50%;background:#8aa4c6;flex-shrink:0}
.surface-statusdot.green{background:#00C870}
.surface-statusdot.amber{background:#F0A500}
.surface-statusdot.blue{background:#4A9FFF}

.surface-metrics{display:grid;grid-template-columns:repeat(5,1fr);background:var(--surface-panel,#fff);border-bottom:1px solid var(--surface-border,#e2e8f2);flex-shrink:0}
.surface-metrics.hidden{display:none}
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
.integrator-canvas{flex:1;min-width:0;display:flex;flex-direction:column;background:#080f1c}
.integrator-toolbar{display:flex;align-items:center;gap:6px;padding:4px 12px;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(6,12,22,0.96);flex-shrink:0;height:34px}
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
.surface-dark .integrator-toolbar{background:rgba(6,12,22,0.98)}
.integrator-meta{display:flex;flex-direction:column;gap:2px}
.integrator-meta strong{font-size:12px;color:var(--surface-text,#0d1b2e)}
.integrator-meta span{font-size:11px;color:var(--surface-subtle,#8a97a8)}
.integrator-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex:1;flex-wrap:wrap}
.integrator-subtabs{display:flex;gap:3px;align-items:center}
.integrator-subtabs button{border:1px solid rgba(255,255,255,0.07);background:transparent;color:rgba(100,116,139,.6);border-radius:5px;padding:2px 10px;font-size:10px;font-weight:600;cursor:pointer;transition:all .15s;letter-spacing:.2px}
.integrator-subtabs button:hover{color:#94a3b8;border-color:rgba(255,255,255,0.12);background:rgba(255,255,255,0.04)}
.integrator-subtabs button.active{background:rgba(34,197,94,0.1);border-color:rgba(34,197,94,0.32);color:#4ade80}
/* ── Workflow col-head professional styles ── */
.wf-col-head{background:rgba(5,11,20,0.98)!important;border-bottom-color:rgba(255,255,255,0.06)!important;padding:0 12px!important;min-height:36px!important}
.wf-active-name{font-size:12px;font-weight:700;color:#c8d8ec;letter-spacing:-.1px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0}
.wf-status-badge{font-size:8.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:2px 7px;border-radius:99px;flex-shrink:0}
.wf-status-badge.published{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);color:#4ade80}
.wf-status-badge.draft{background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.22);color:#fbbf24}
.wf-tab-group{display:flex;align-items:center;gap:2px;padding:2px;border-radius:7px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.05)}
.wf-tab-sep{width:1px;height:16px;background:rgba(255,255,255,0.07);margin:0 4px;flex-shrink:0}
.wf-vtab{font-size:9.5px;font-weight:600;padding:3px 8px;border-radius:5px;border:none;background:transparent;color:rgba(100,116,139,.7);cursor:pointer;transition:all .14s;white-space:nowrap}
.wf-vtab:hover{color:#94a3b8;background:rgba(255,255,255,0.06)}
.wf-vtab.on{background:rgba(34,197,94,0.13);color:#4ade80}
/* ── Dev buttons ── */
.dev-btn{height:20px;padding:0 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.05);background:transparent;color:rgba(255,255,255,0.15);font-size:9px;cursor:pointer;transition:all .14s;font-family:var(--mono);line-height:1}
.dev-btn:hover{color:rgba(255,255,255,0.45);border-color:rgba(255,255,255,0.12);background:rgba(255,255,255,0.05)}
.surface-collab-btn{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:8px;border:1px solid rgba(34,197,94,0.35);background:rgba(34,197,94,0.08);color:#4ade80;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s;position:relative}
.surface-collab-btn:hover{background:rgba(34,197,94,0.14);border-color:rgba(34,197,94,0.55);box-shadow:0 0 12px rgba(34,197,94,0.2)}
.surface-collab-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 6px rgba(34,197,94,0.8);animation:collab-pulse 2s ease-in-out infinite;flex-shrink:0}
@keyframes collab-pulse{0%,100%{box-shadow:0 0 4px rgba(34,197,94,.6)}50%{box-shadow:0 0 10px rgba(34,197,94,1)}}
/* ── IngestionHub AI card pulsing border ── */
@keyframes ai-border-pulse{
  0%,100%{box-shadow:0 0 0 1px rgba(139,92,246,0.28),0 0 12px rgba(139,92,246,0.08)}
  50%{box-shadow:0 0 0 1px rgba(6,182,212,0.28),0 0 12px rgba(6,182,212,0.08)}
}
.hub-ai-card{animation:ai-border-pulse 3s ease-in-out infinite}
.hub-ai-card:focus-within{
  animation:none !important;
  box-shadow:0 0 0 1.5px rgba(139,92,246,0.6),0 0 0 4px rgba(139,92,246,0.12),0 0 24px rgba(167,139,250,0.28) !important;
  border-color:rgba(139,92,246,0.5) !important;
  background:linear-gradient(135deg,rgba(139,92,246,0.1),rgba(7,11,22,0.85)) !important
}
.surface-dark .integrator-toggle button{background:#142540;border-color:#274468;color:#7da8d4}
.surface-dark .integrator-toggle button.active{background:rgba(42,127,255,.15);border-color:#2a7fff;color:#7ab8ff}

.surface-dark{--surface-bg:#0a1525;--surface-panel:#0f1e34;--surface-muted:#142540;--surface-border:#1e3452;--surface-border2:#274468;--surface-text:#d4e6ff;--surface-mid:#7da8d4;--surface-subtle:#3d6894;--surface-accent:#2a7fff;--surface-accent-strong:#7ab8ff;--surface-accent-soft:rgba(42,127,255,.15)}
.surface-dark .surface-sidebar{background:linear-gradient(180deg,#0f1e34 0%,#12233c 100%);border-right-color:#1e3452}.surface-dark .surface-navbtn{background:rgba(20,37,64,.88);border-color:#274468;color:#d4e6ff;box-shadow:0 1px 2px rgba(0,0,0,.2)}.surface-dark .surface-navbtn:hover{background:#1a3153;border-color:#3c6ea6;color:#ffffff;transform:translateY(-1px)}.surface-dark .surface-navbtn.active{background:rgba(42,127,255,.24);border-color:#5ea1ff;color:#9fd0ff;box-shadow:0 6px 18px rgba(42,127,255,.22)}.surface-dark .surface-brand{box-shadow:0 10px 20px rgba(42,127,255,.18)}

.simple-panel{flex:1;overflow:auto;padding:18px;background:var(--surface-panel,#fff)}
.simple-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.simple-card{background:var(--surface-muted,#f5f8fc);border:1px solid var(--surface-border,#e2e8f2);border-radius:14px;padding:14px 15px}.simple-card h3{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--surface-subtle,#8a97a8);margin-bottom:8px}.simple-card p,.simple-card li{font-size:12px;line-height:1.6;color:var(--surface-text,#0d1b2e)}
.simple-list{display:flex;flex-direction:column;gap:8px}.simple-row{display:flex;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:10px;background:var(--surface-muted,#f5f8fc);border:1px solid var(--surface-border,#e2e8f2)}

.design-host{flex:1;min-width:0;min-height:0;overflow:hidden;background:#0a1525}
.design-host .cc-shell{height:100%;min-height:0;background:#0a1525}

.surface-footer{height:34px;flex-shrink:0;display:flex;align-items:center;gap:12px;padding:0 16px;background:var(--surface-panel,#fff);border-top:1px solid var(--surface-border,#e2e8f2);font-size:10px;color:var(--surface-subtle,#8a97a8)}
.surface-footer-ticker{display:flex;align-items:center;gap:8px;flex:1;min-width:0;overflow:auto}.surface-footer-ticker::-webkit-scrollbar{height:0}
.surface-ticker-label{font-size:9px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--surface-subtle,#8a97a8);white-space:nowrap}
.surface-ticker-empty{font-size:10px;color:var(--surface-subtle,#8a97a8);white-space:nowrap}
.surface-ticker-item{display:inline-flex;align-items:center;gap:7px;min-width:0;padding:4px 8px;border-radius:999px;border:1px solid var(--surface-border,#e2e8f2);background:var(--surface-muted,#f5f8fc);white-space:nowrap}
.surface-ticker-item strong{font-size:10px;color:var(--surface-text,#0d1b2e);font-weight:700}.surface-ticker-item span{font-size:10px;color:var(--surface-mid,#4a5568)}
.surface-ticker-item.blue{border-color:rgba(26,107,219,.24)}.surface-ticker-item.amber{border-color:rgba(184,92,0,.24)}.surface-ticker-item.green{border-color:rgba(26,122,69,.24)}.surface-ticker-item.dim{border-color:var(--surface-border,#e2e8f2)}
.surface-footer-infra{display:flex;align-items:center;gap:12px;flex-shrink:0;white-space:nowrap}
.surface-dot{width:6px;height:6px;border-radius:50%;background:#2ecc71;animation:pulse 2s infinite}

@media (max-width: 1280px){.surface-metrics{grid-template-columns:repeat(3,1fr)}.ap-detail{width:280px}.integrator-queue{min-width:300px}}
@media (max-width: 1280px){.surface-designer-status{display:none}}
@media (max-width: 1480px){.ap-runtime-grid{grid-template-columns:1fr}}

/* ── Integrator canvas layout — give the canvas more room ── */
.integrator-queue{width:360px;min-width:300px;flex-shrink:0}
.integrator-queue.integrator-queue{width:360px}

/* ── Embedded CommandCenter — when hosted inside App shell ── */
.cc-shell.cc-embedded{height:100%}
.cc-embedded .cc-topbar{height:38px;padding:0 10px;background:var(--surface-panel,#0f1e34);border-bottom-color:var(--surface-border,#1e3452)}
.cc-embedded .cc-logo{display:none}
.cc-embedded .cc-mode-tabs{padding-left:0}
.cc-embedded .cc-mode-tab{font-size:9px;padding:4px 9px}
.cc-embedded .cc-sec-hd{padding:5px 10px;min-height:30px}
.cc-embedded .cc-wf-tabs-wrap{background:var(--surface-panel,#0f1e34);border-bottom-color:var(--surface-border,#1e3452)}
.cc-embedded .cc-wf-bar{background:var(--surface-panel,#0f1e34);border-bottom-color:var(--surface-border,#1e3452)}
.cc-embedded .workflow-palette{padding:8px 8px 0}
.cc-embedded .workflow-palette-item{padding:8px 10px;border-radius:8px}
.cc-embedded .navigator-item{padding:7px 10px;border-radius:8px}
.cc-embedded .navigator-title{font-size:10px}

/* ── Workflow node card polish ── */
.wf-node-card{padding:13px 15px 15px}
.wf-node-name{font-size:19px;letter-spacing:-.3px}
.wf-node-kind{font-size:8.5px;letter-spacing:1.3px}
.wf-node-badge{font-size:7.5px}
.wf-node-handle{width:14px !important;height:14px !important;border-width:2px !important}

/* ── Canvas command pill ── */
.canvas-cmd-pill{position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:20;display:flex;align-items:center;background:rgba(7,17,31,.9);border:1px solid rgba(255,255,255,.07);border-radius:20px;padding:3px 4px;box-shadow:0 4px 20px rgba(0,0,0,.35);backdrop-filter:blur(14px);white-space:nowrap}
.cpill-btn{display:flex;align-items:center;gap:3px;padding:5px 11px;border-radius:14px;font-size:10px;font-weight:500;font-family:var(--mono);cursor:pointer;border:none;background:transparent;color:var(--mid);transition:all .12s;letter-spacing:.15px}
.cpill-btn:hover{background:rgba(74,159,255,.1);color:var(--text)}
.cpill-btn:disabled{opacity:.3;cursor:not-allowed}
.cpill-btn:disabled:hover{background:transparent;color:var(--mid)}
.cpill-sep{width:1px;height:14px;background:rgba(255,255,255,.07);margin:0 1px;flex-shrink:0;align-self:center}
.cpill-stat{font-size:9px;font-family:var(--mono);color:var(--dim);padding:5px 9px;letter-spacing:.2px}
.cpill-sel{font-size:9px;font-family:var(--mono);color:var(--a3);padding:0 8px 0 0;max-width:180px;overflow:hidden;text-overflow:ellipsis}

/* ════════════════════════════════════════════════════════════════
   WF2 — Premium Canvas Workflow Designer
   ════════════════════════════════════════════════════════════════ */

/* ── wf2 canvas container ── */
.wf2-canvas{position:relative;background:linear-gradient(180deg,rgba(22,37,60,.96),rgba(14,24,42,.98))}
.wf2-canvas .react-flow__viewport{z-index:4}
.wf2-canvas .react-flow__edges{z-index:18 !important; opacity:1 !important}
.wf2-canvas .react-flow__nodes{z-index:24 !important}
/* Edge label container must be above edges but below nodes */
.wf2-canvas .react-flow__edgelabels{z-index:22 !important}

/* ── Context menu ── */
.wf2-ctx-menu{
  min-width:190px;
  background:rgba(5,12,28,.97);
  border:1px solid rgba(255,255,255,.10);
  border-radius:14px;
  padding:6px;
  box-shadow:0 16px 48px rgba(0,0,0,.58),0 1px 0 rgba(255,255,255,.04) inset;
  backdrop-filter:blur(22px);
  display:flex;flex-direction:column;gap:2px;
}
.wf2-ctx-header{
  font-size:8px;letter-spacing:1px;text-transform:uppercase;
  color:rgba(120,160,210,.55);
  padding:4px 10px 2px;
}
.wf2-ctx-item{
  display:flex;align-items:center;gap:9px;
  padding:8px 10px;border-radius:9px;
  border:none;background:transparent;cursor:pointer;
  text-align:left;width:100%;
  font-size:11px;font-family:var(--mono);
  color:rgba(192,220,255,.88);
  transition:background .1s;
}
.wf2-ctx-item:hover{background:rgba(74,159,255,.12);color:#d8edff}
.wf2-ctx-item.danger{color:rgba(255,100,115,.75)}
.wf2-ctx-item.danger:hover{background:rgba(255,61,90,.12);color:#ff8095}
.wf2-ctx-icon{font-size:13px;width:18px;text-align:center;flex-shrink:0;opacity:.8}
.wf2-ctx-sep{height:1px;background:rgba(255,255,255,.06);margin:4px 6px}

/* ── Bézier edge pill label ── */
.wf2-bezier-pill{
  display:inline-flex;align-items:center;
  padding:3px 9px;
  border-radius:6px;
  font-size:10px;font-weight:600;letter-spacing:.18px;
  font-family:var(--mono,'JetBrains Mono',monospace);
  background:#071426;           /* solid dark — hides the edge line behind it */
  color:#d6ecff;
  border:1px solid color-mix(in srgb, var(--pill-color,#7EA7D4) 55%, transparent);
  box-shadow:0 2px 8px rgba(0,0,0,.5);
  white-space:nowrap;
  cursor:pointer;
  user-select:none;
  transition:border-color .14s, box-shadow .14s;
  min-height:20px;
}
.wf2-bezier-pill:hover{
  box-shadow:0 0 0 3px color-mix(in srgb, var(--pill-color,#7EA7D4) 20%, transparent), 0 2px 8px rgba(0,0,0,.5);
}
.wf2-bezier-pill-input{
  background:transparent;
  border:none;
  outline:none;
  font:600 10px var(--mono,'JetBrains Mono',monospace);
  color:#d6ecff;
  letter-spacing:.18px;
  min-width:56px;
  max-width:180px;
}
/* Edge labels above nodes */
.wf2-canvas .react-flow__edgelabels{z-index:22 !important}

/* ── Linter badges ── */
.wf2-badge.lint{
  background:rgba(245,158,11,.14);
  border:1px solid rgba(245,158,11,.38);
  color:#f0b429;
  font-size:8px;font-weight:700;padding:2px 6px;border-radius:999px;
  letter-spacing:.3px;text-transform:uppercase;
}
.wf2-node.has-lint{border-color:rgba(245,158,11,.38) !important}
.wf2-canvas .react-flow__node{
  z-index:25 !important;
  opacity:1 !important;
  visibility:visible !important;
  filter:none !important;
}
.wf2-canvas .react-flow__node.selected{z-index:30 !important}
.wf2-canvas::before,
.wf2-canvas::after{
  content:'';
  position:absolute;
  inset:10px;
  border-radius:14px;
  pointer-events:none;
  opacity:0;
  transition:opacity .16s ease, box-shadow .2s ease, border-color .2s ease;
  z-index:11;
}
.wf2-canvas::before{
  border:1px solid rgba(156,198,255,.2);
}
.wf2-canvas::after{
  inset:6px;
  border:1px dashed rgba(156,198,255,.24);
}
.wf2-canvas.drop-active::before{
  opacity:1;
  border-color:rgba(156,198,255,.42);
  box-shadow:0 0 0 1px rgba(156,198,255,.18),0 0 20px rgba(79,152,255,.18),inset 0 0 24px rgba(79,152,255,.08);
}
.wf2-canvas.drop-active::after{
  opacity:1;
  border-color:rgba(156,198,255,.3);
  animation:wf2-drop-pulse 1.2s ease-in-out infinite;
}
@keyframes wf2-drop-pulse{
  0%,100%{opacity:.72}
  50%{opacity:1}
}

/* ── State node card ── */
.wf2-node{
  min-width:200px;max-width:250px;
  border-radius:16px;
  border:1.5px solid rgba(255,255,255,.08);
  background:linear-gradient(155deg,rgba(20,42,76,.99) 0%,rgba(11,24,45,.99) 100%);
  padding:0 0 10px;
  box-shadow:0 8px 32px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.04);
  position:relative;overflow:hidden;
  cursor:default;user-select:none;
  transition:border-color .18s,box-shadow .2s,transform .13s;
  font-family:var(--sans,'Inter',sans-serif);
}
.wf2-node:hover{
  border-color:var(--kind-color);
  box-shadow:0 0 0 3px var(--kind-glow),0 14px 44px rgba(0,0,0,.38);
  transform:none;
}
.wf2-node.selected{
  border-color:var(--kind-color);
  box-shadow:0 0 0 2px var(--kind-glow),0 0 0 5px color-mix(in srgb,var(--kind-color) 10%,transparent),0 18px 52px rgba(0,0,0,.42);
}
.wf2-node.recent{
  border-color:rgba(74,159,255,.9);
  box-shadow:0 0 0 2px rgba(74,159,255,.28),0 0 0 8px rgba(74,159,255,.08),0 0 28px rgba(74,159,255,.22),0 20px 52px rgba(0,0,0,.44);
  animation:wf2-recent-flash 1.3s ease-in-out 1;
}
@keyframes wf2-recent-flash{
  0%{transform:translateY(0) scale(.98)}
  35%{transform:translateY(-2px) scale(1.01)}
  100%{transform:translateY(0) scale(1)}
}
.wf2-node.has-errors{border-color:#FF3D5A;box-shadow:0 0 0 3px rgba(255,61,90,.18)}

.wf2-node-drag-handle{
  position:absolute;
  top:6px;
  right:8px;
  z-index:4;
  display:inline-flex;
  align-items:center;
  gap:4px;
  padding:2px 8px;
  border-radius:999px;
  border:1px solid rgba(145,182,228,.26);
  background:rgba(8,19,34,.75);
  color:rgba(180,208,242,.88);
  font:700 8px var(--mono,'JetBrains Mono',monospace);
  letter-spacing:.18px;
  cursor:grab;
  user-select:none;
}
.wf2-node-drag-handle:active{cursor:grabbing}
.wf2-node-drag-dots{font-size:10px;line-height:1;opacity:.9}
.wf2-node-drag-text{font-size:8px;text-transform:uppercase}

.wf2-canvas.mode-select .wf2-node{cursor:grab}
.wf2-canvas.mode-select .wf2-node:active{cursor:grabbing}
/* In select mode, the drag-handle badge is a hint, not the only drag target */
.wf2-canvas.mode-select .wf2-node-drag-handle{cursor:grab}
/* In connect mode, whole node is a crosshair — drag from handles to wire */
.wf2-canvas.mode-connect .wf2-node{cursor:crosshair}

/* Left accent bar */
.wf2-accent{position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--kind-color);border-radius:16px 0 0 16px;opacity:.85}

/* Header row */
.wf2-header{display:flex;align-items:center;gap:6px;padding:12px 14px 6px 18px}
.wf2-icon{font-size:10px;opacity:.9;flex-shrink:0;line-height:1}
.wf2-kind-label{font-size:10px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:var(--kind-color);flex:1;min-width:0}
.wf2-initial-pulse{width:7px;height:7px;border-radius:50%;background:var(--kind-color);flex-shrink:0;animation:wf2-pulse 2s ease-in-out infinite}
@keyframes wf2-pulse{0%,100%{box-shadow:0 0 0 0 var(--kind-glow)}50%{box-shadow:0 0 0 5px rgba(0,200,112,0)}}
.wf2-badge{font-size:8px;font-weight:700;padding:2px 6px;border-radius:999px;letter-spacing:.4px;text-transform:uppercase}
.wf2-badge.error{background:rgba(255,61,90,.15);color:#FF3D5A;border:1px solid rgba(255,61,90,.3)}

/* State name */
.wf2-name{
  font-size:15px;font-weight:700;letter-spacing:-.18px;
  color:#e0eeff;line-height:1.3;
  padding:2px 14px 6px 18px;
  min-height:26px;
  cursor:text;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.wf2-name:hover{color:#fff}
.wf2-name-input{
  display:block;width:calc(100% - 32px);margin:2px 14px 6px 18px;
  background:rgba(74,159,255,.1);border:1px solid rgba(74,159,255,.4);
  border-radius:8px;padding:4px 8px;
  color:#e0eeff;font-size:15px;font-weight:700;letter-spacing:-.25px;
  outline:none;box-sizing:border-box;
}

/* Footer meta chips */
.wf2-footer{display:flex;align-items:center;gap:5px;padding:0 12px 0 16px;flex-wrap:wrap;min-height:24px}
.wf2-meta-chip{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);font-size:8.4px;color:rgba(180,205,240,.65);max-width:112px;overflow:hidden;white-space:nowrap}
.wf2-meta-chip.assignee{border-color:rgba(74,159,255,.2);color:rgba(170,214,255,.82)}
.wf2-meta-chip.sla{border-color:rgba(240,165,0,.2);color:rgba(240,200,80,.8)}
.wf2-meta-chip.tags{border-color:rgba(155,126,255,.2);color:rgba(188,172,255,.82)}
.wf2-meta-icon{font-size:9px;flex-shrink:0}
.wf2-meta-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ── 4-direction connection handles ── */
.wf2-handle{transition:opacity .14s,transform .14s,box-shadow .14s,background .14s,border-color .14s !important}
.wf2-handle.wf2-src{
  width:11px !important;height:11px !important;
  background:var(--kind-color) !important;
  border:2px solid rgba(3,9,16,.95) !important;
  border-radius:50% !important;
  opacity:0;
  z-index:5 !important;
  cursor:crosshair !important;
}
/* Source handles appear on hover/select */
.wf2-node:hover .wf2-handle.wf2-src,
.wf2-node.selected .wf2-handle.wf2-src{
  opacity:1;
  transform:scale(1.3);
  box-shadow:0 0 0 5px var(--kind-glow),0 0 12px color-mix(in srgb,var(--kind-color) 55%,transparent) !important;
}
/* Grow handles on direct hover to make them easier to grab */
.wf2-handle.wf2-src:hover{
  opacity:1 !important;
  transform:scale(1.65) !important;
  box-shadow:0 0 0 7px var(--kind-glow),0 0 18px color-mix(in srgb,var(--kind-color) 70%,transparent) !important;
}
/* Target handles — large hit areas; show as soft ring on hover so users know where to land */
.wf2-handle.wf2-tgt{
  width:18px !important;height:18px !important;
  background:transparent !important;
  border:2px dashed transparent !important;
  border-radius:50% !important;
  opacity:0 !important;
  z-index:4 !important;
  cursor:crosshair !important;
  pointer-events:all !important;
}
/* Show target handles when hovering any node so user knows where to drop */
.wf2-node:hover .wf2-handle.wf2-tgt{
  opacity:0.6 !important;
  background:rgba(74,159,255,.1) !important;
  border-color:rgba(74,159,255,.45) !important;
  width:18px !important;height:18px !important;
}
/* RF v12: valid target handles during active connection drag */
.react-flow__handle-connecting.wf2-tgt,
.react-flow__handle-valid.wf2-tgt,
.wf2-handle.wf2-tgt.react-flow__handle-connecting,
.wf2-handle.wf2-tgt.react-flow__handle-valid{
  opacity:1 !important;
  width:28px !important;height:28px !important;
  background:rgba(74,222,128,.18) !important;
  border:2px solid rgba(74,222,128,.7) !important;
  box-shadow:0 0 0 6px rgba(74,222,128,.12),0 0 18px rgba(74,222,128,.3) !important;
}
.wf2-handle.wf2-fallback-handle{
  width:1px !important;
  height:1px !important;
  opacity:0 !important;
  pointer-events:none !important;
}
/* Connect mode: show a subtle crosshair ring around each node to signal "drag from edge to connect" */
.wf2-canvas.mode-connect .wf2-node:hover .wf2-handle.wf2-src{
  opacity:1;
  transform:scale(1.5);
}
.wf2-canvas.mode-connect .wf2-node{cursor:crosshair}

/* Node glows green when it's a valid connection drop target */
.react-flow__node.react-flow__node-workflowState.connecting{
  outline:2px solid rgba(74,222,128,.55) !important;
  outline-offset:3px;
  border-radius:14px;
  box-shadow:0 0 0 6px rgba(74,222,128,.1),0 0 20px rgba(74,222,128,.2) !important;
}
.wf2-connection-line{filter:drop-shadow(0 0 5px rgba(74,159,255,.42))}
.wf2-connection-line.kind-approval{filter:drop-shadow(0 0 5px rgba(240,165,0,.42))}
.wf2-connection-line.kind-exception{filter:drop-shadow(0 0 5px rgba(255,61,90,.42))}
.wf2-connection-line.kind-technical{filter:drop-shadow(0 0 5px rgba(32,195,216,.42))}
.wf2-connection-line.kind-terminal{filter:drop-shadow(0 0 5px rgba(155,126,255,.42))}

.wf2-drop-ghost{position:absolute;z-index:35;pointer-events:none;transform:translate(12px,-18px);display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:10px;border:1px solid rgba(74,159,255,.35);background:rgba(7,17,31,.94);color:#d4e6ff;font:600 10px var(--mono,'JetBrains Mono',monospace);box-shadow:0 8px 20px rgba(0,0,0,.35)}
.wf2-drop-ghost-dot{width:7px;height:7px;border-radius:50%;background:var(--a3)}
.wf2-drop-ghost-snap{font-size:8px;letter-spacing:.45px;padding:2px 5px;border-radius:999px;border:1px solid rgba(120,210,160,.35);background:rgba(32,120,72,.26);color:#84e8ae}
.wf2-drop-ghost.kind-approval{border-color:rgba(240,165,0,.4)}
.wf2-drop-ghost.kind-approval .wf2-drop-ghost-dot{background:#F0A500}
.wf2-drop-ghost.kind-exception{border-color:rgba(255,61,90,.4)}
.wf2-drop-ghost.kind-exception .wf2-drop-ghost-dot{background:#FF3D5A}
.wf2-drop-ghost.kind-technical{border-color:rgba(32,195,216,.4)}
.wf2-drop-ghost.kind-technical .wf2-drop-ghost-dot{background:#20C3D8}
.wf2-drop-ghost.kind-terminal{border-color:rgba(155,126,255,.4)}
.wf2-drop-ghost.kind-terminal .wf2-drop-ghost-dot{background:#9B7EFF}


/* ── Canvas drop indicator ── */
.wf2-drop-indicator{
  position:absolute;inset:0;z-index:15;
  display:flex;align-items:center;justify-content:center;
  background:radial-gradient(circle at 50% 58px, rgba(110,177,255,.14), rgba(96,166,255,.05) 32%, rgba(96,166,255,.025) 58%, transparent 72%);
  border:2px dashed rgba(156,198,255,.4);
  border-radius:12px;pointer-events:none;
  font-size:14px;font-weight:600;color:rgba(223,235,249,.98);
  text-shadow:0 2px 10px rgba(12,38,72,.52);
}

.wf2-drop-snap-target{
  position:absolute;
  z-index:36;
  pointer-events:none;
  transform:translate(-50%,-50%);
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding:5px 10px;
  border-radius:999px;
  border:1px solid rgba(132,230,176,.58);
  background:rgba(8,30,22,.9);
  color:#9af3bf;
  font:600 9px var(--mono,'JetBrains Mono',monospace);
  letter-spacing:.28px;
  box-shadow:0 0 0 1px rgba(132,230,176,.26),0 0 24px rgba(58,180,112,.35);
}
.wf2-drop-snap-dot{
  width:8px;
  height:8px;
  border-radius:50%;
  background:#6ce29d;
  box-shadow:0 0 0 5px rgba(108,226,157,.2),0 0 12px rgba(108,226,157,.62);
}

/* ── Canvas empty state ── */
.wf2-empty-state{
  position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  z-index:5;text-align:center;pointer-events:none;
  display:flex;flex-direction:column;align-items:center;gap:10px;
}
.wf2-empty-icon{font-size:42px;opacity:.2;line-height:1}
.wf2-empty-title{font-size:17px;font-weight:700;color:rgba(180,205,240,.35);letter-spacing:-.3px}
.wf2-empty-copy{font-size:12px;color:rgba(140,170,210,.4);max-width:320px;line-height:1.55}
.wf2-empty-hints{display:flex;flex-direction:column;gap:5px;margin-top:4px}
.wf2-empty-hints span{font-size:10px;color:rgba(100,140,190,.35)}

/* ── Floating pill ── */
.fp-wrap{position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:25;pointer-events:none}
.fp-pill{
  display:inline-flex;align-items:center;gap:2px;
  background:rgba(5,12,28,.92);
  border:1px solid rgba(255,255,255,.08);
  border-radius:24px;padding:4px 6px;
  box-shadow:0 6px 28px rgba(0,0,0,.42),0 1px 0 rgba(255,255,255,.04) inset;
  backdrop-filter:blur(18px);
  white-space:nowrap;pointer-events:all;
}
.fp-btn{
  display:inline-flex;align-items:center;gap:4px;
  padding:5px 12px;border-radius:18px;
  border:none;background:transparent;
  color:rgba(160,195,240,.75);
  font-size:12px;font-weight:700;letter-spacing:.1px;
  cursor:pointer;transition:all .12s;
}
.fp-btn:hover{background:rgba(74,159,255,.12);color:#d0e8ff}
.fp-btn:disabled{opacity:.3;cursor:not-allowed}
.fp-btn:disabled:hover{background:transparent}
.fp-btn.primary{background:rgba(74,159,255,.14);color:#7ab8ff;border:1px solid rgba(74,159,255,.22)}
.fp-btn.primary:hover{background:rgba(74,159,255,.24);color:#a0d0ff;border-color:rgba(74,159,255,.45)}
.fp-btn.danger:hover{background:rgba(255,61,90,.12);color:#ff8098}
.fp-btn.dim{color:rgba(120,155,200,.55)}
.fp-btn.dim:hover{color:rgba(180,210,250,.8);background:rgba(74,159,255,.08)}
.fp-sep{width:1px;height:16px;background:rgba(255,255,255,.07);margin:0 2px;flex-shrink:0;align-self:center}
.fp-sel-label{font-size:10px;font-weight:700;padding:5px 10px;letter-spacing:.1px;max-width:160px;overflow:hidden;text-overflow:ellipsis}
.fp-count-group{display:flex;gap:6px;align-items:center;padding:0 4px}
.fp-count{font-size:9px;font-weight:700;color:rgba(120,155,200,.55);display:inline-flex;align-items:center;gap:3px}
.fp-caret{font-size:8px;margin-left:2px;opacity:.6}

/* ── Integrator builder toolbar ── */
.wf2-builder-tabbar{display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:10px;background:rgba(8,18,33,.72);border:1px solid rgba(140,182,232,.12)}
.wf2-builder-tabgroup{display:flex;align-items:center;padding:3px;border-radius:8px;background:rgba(5,13,24,.75);border:1px solid rgba(125,165,214,.12)}
/* Mode tabs: Select / Connect */
.wf2-builder-tab{height:26px;min-width:58px;padding:0 10px;border-radius:6px;border:none;background:transparent;color:rgba(156,186,224,.72);font-family:var(--mono);font-size:10px;letter-spacing:.25px;cursor:pointer;transition:all .14s}
.wf2-builder-tab:hover:not(:disabled){background:rgba(74,159,255,.14);color:#d5e9ff}
.wf2-builder-tab.is-active{background:linear-gradient(180deg,rgba(56,128,220,.35),rgba(31,97,182,.32));color:#e7f3ff;border:1px solid rgba(95,162,244,.44)}
/* Connect mode active: teal accent to distinguish from select */
.wf2-builder-tab.is-active[title*="Connect"]{background:linear-gradient(180deg,rgba(32,195,216,.22),rgba(18,140,158,.18));color:#9af0ff;border:1px solid rgba(32,195,216,.38)}
/* Action buttons: Layout / Fit — green accent to distinguish from mode tabs */
.wf2-builder-tab.wf2-action-btn{color:rgba(120,200,155,.85)}
.wf2-builder-tab.wf2-action-btn:hover{background:rgba(0,200,112,.14);color:#72f0aa;border:none}
/* Undo / Redo */
.wf2-builder-tab[title="Undo"]:not(:disabled):hover,
.wf2-builder-tab[title="Redo"]:not(:disabled):hover{background:rgba(155,126,255,.14);color:#c8b4ff}
.wf2-builder-tab:disabled{opacity:.35;cursor:not-allowed}
/* Separator between tabgroups */
.wf2-builder-tabbar .wf2-builder-tabgroup + .wf2-builder-tabgroup::before{content:'';display:block;width:1px;height:14px;background:rgba(255,255,255,.07);margin-right:4px}

/* Add menu dropdown */
.fp-add-wrap{position:relative}
.fp-add-menu{
  position:absolute;top:calc(100% + 8px);left:0;
  min-width:210px;
  background:rgba(5,12,28,.97);
  border:1px solid rgba(255,255,255,.1);
  border-radius:14px;
  padding:6px;
  box-shadow:0 16px 48px rgba(0,0,0,.55);
  backdrop-filter:blur(20px);
  z-index:99;
  display:flex;flex-direction:column;gap:2px;
}
.fp-add-option{
  display:flex;align-items:center;gap:10px;
  padding:8px 10px;border-radius:10px;
  border:none;background:transparent;cursor:pointer;
  text-align:left;width:100%;
  transition:background .12s;
}
.fp-add-option:hover{background:rgba(74,159,255,.1)}
.fp-add-icon{font-size:14px;flex-shrink:0;line-height:1}
.fp-add-label{font-size:11px;font-weight:700;color:rgba(200,225,255,.9);flex-shrink:0}
.fp-add-desc{font-size:9px;color:rgba(120,155,200,.55);flex:1;text-align:right}

/* ── Canvas Inspector (ci-*) ── */
.ci-shell{display:flex;flex-direction:column;height:100%;overflow:hidden;background:var(--surface-panel,#0f1e34);font-family:var(--sans,'Inter',sans-serif)}
.ci-header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px 10px;border-bottom:1px solid var(--surface-border,#1e3452);flex-shrink:0}
.ci-header-left{display:flex;align-items:center;gap:10px;min-width:0}
.ci-header-icon{font-size:20px;flex-shrink:0;line-height:1}
.ci-header-title{font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--surface-subtle,#3d6894)}
.ci-header-sub{font-size:13px;font-weight:600;color:var(--surface-text,#d4e6ff);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px}
.ci-danger-btn{border:none;background:rgba(255,61,90,.08);color:rgba(255,100,115,.7);border-radius:8px;padding:6px 8px;cursor:pointer;font-size:13px;flex-shrink:0;transition:all .14s}
.ci-danger-btn:hover{background:rgba(255,61,90,.18);color:#ff5570}

/* Kind picker pills */
.ci-kind-picker{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;padding:10px 12px;border-bottom:1px solid var(--surface-border,#1e3452);flex-shrink:0}
.ci-kind-pill{
  display:flex;align-items:center;justify-content:center;gap:4px;
  padding:5px 6px;border-radius:8px;
  border:1px solid rgba(255,255,255,.07);
  background:rgba(255,255,255,.03);
  color:rgba(140,170,210,.65);
  font-size:9px;font-weight:700;letter-spacing:.3px;
  cursor:pointer;transition:all .13s;
}
.ci-kind-pill span:first-child{font-size:11px}
.ci-kind-pill:hover{background:rgba(255,255,255,.06);color:rgba(200,225,255,.85);border-color:rgba(255,255,255,.14)}
.ci-kind-pill.active{background:color-mix(in srgb,var(--kp-color) 14%,transparent);border-color:color-mix(in srgb,var(--kp-color) 45%,transparent);color:var(--kp-color)}

/* Tabs */
.ci-tabs{display:flex;gap:4px;padding:8px 12px;border-bottom:1px solid var(--surface-border,#1e3452);flex-shrink:0}
.ci-tab{padding:5px 12px;border-radius:20px;border:1px solid rgba(255,255,255,.07);background:transparent;color:rgba(120,155,200,.6);font-size:9px;font-weight:700;cursor:pointer;transition:all .13s;letter-spacing:.2px}
.ci-tab:hover{background:rgba(74,159,255,.08);color:rgba(160,200,255,.8)}
.ci-tab.active{background:rgba(74,159,255,.14);border-color:rgba(74,159,255,.35);color:#7ab8ff}

/* Body / scrollable area */
.ci-body{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.ci-body::-webkit-scrollbar{width:4px}
.ci-body::-webkit-scrollbar-thumb{background:rgba(74,159,255,.2);border-radius:2px}

/* Route pill (edge inspector) */
.ci-route-pill{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--surface-border,#1e3452);flex-shrink:0}
.ci-route-from,.ci-route-to{font-size:11px;font-weight:700;color:var(--surface-text,#d4e6ff);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ci-route-arrow{font-size:14px;color:rgba(74,159,255,.6);flex-shrink:0}

/* Field */
.ci-field{display:flex;flex-direction:column;gap:4px}
.ci-field-label{display:flex;align-items:center;gap:4px;font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--surface-subtle,#3d6894)}
.ci-field-icon{font-size:10px}
.ci-field input,.ci-field textarea,.ci-field select{
  background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.09);
  border-radius:8px;padding:6px 9px;
  color:var(--surface-text,#d4e6ff);
  font-size:11px;font-family:inherit;
  outline:none;transition:border-color .14s,background .14s;
  width:100%;box-sizing:border-box;resize:none;
}
.ci-field input:focus,.ci-field textarea:focus,.ci-field select:focus{
  border-color:rgba(74,159,255,.4);
  background:rgba(74,159,255,.06);
}

/* Row (2-col) */
.ci-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}

/* Section label */
.ci-section-label{font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--surface-subtle,#3d6894);padding-top:4px;border-top:1px solid rgba(255,255,255,.05);margin-top:2px}

/* Toggle */
.ci-toggle{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 2px}
.ci-toggle-label{display:flex;align-items:center;gap:5px;font-size:10px;font-weight:600;color:rgba(140,170,210,.75);cursor:pointer;flex:1}
.ci-toggle-track{width:30px;height:16px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);position:relative;cursor:pointer;transition:background .16s,border-color .16s;flex-shrink:0}
.ci-toggle-track.on{background:rgba(74,159,255,.3);border-color:rgba(74,159,255,.5)}
.ci-toggle-thumb{position:absolute;top:2px;left:2px;width:10px;height:10px;border-radius:50%;background:#8aadcf;transition:transform .16s,background .16s}
.ci-toggle-track.on .ci-toggle-thumb{transform:translateX(14px);background:#7ab8ff}

/* Readout */
.ci-readout{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 2px;border-top:1px solid rgba(255,255,255,.04);margin-top:2px}
.ci-readout-label{display:flex;align-items:center;gap:4px;font-size:9px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:rgba(80,110,155,.65)}
.ci-readout-value{font-size:9px;font-family:var(--mono,'JetBrains Mono',monospace);color:rgba(100,145,200,.55);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px}

/* Empty inspector */
.ci-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:24px;text-align:center;gap:10px}
.ci-empty-icon{font-size:32px;opacity:.2}
.ci-empty-title{font-size:13px;font-weight:700;color:rgba(140,170,210,.4);letter-spacing:-.2px}
.ci-empty-copy{font-size:11px;color:rgba(100,140,190,.35);line-height:1.6;max-width:230px}
.ci-empty-hints{display:flex;flex-direction:column;gap:5px;margin-top:6px}
.ci-empty-hints span{font-size:9px;color:rgba(80,115,165,.35);background:rgba(74,159,255,.04);padding:4px 10px;border-radius:999px;border:1px solid rgba(74,159,255,.06)}

/* ── Palette items (left panel upgrade) ── */
.workflow-palette-item .wp-kind-icon{font-size:13px;flex-shrink:0}
.workflow-palette-item .wp-kind-color{display:inline-block;width:6px;height:6px;border-radius:50%;flex-shrink:0}

/* ══════════════════════════════════════════════════════════════
   OPERATION VIEW — Live read-only invoice operations monitor
   ══════════════════════════════════════════════════════════════ */
.op-view-shell{display:flex;flex-direction:column;height:100%;background:var(--surface-bg,#0a1525);overflow:hidden}
.op-view-header{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  padding:10px 20px;
  background:var(--surface-panel,#0f1e34);
  border-bottom:1px solid var(--surface-border,#1e3452);
  flex-shrink:0;
}
.op-view-kpi{display:flex;flex-direction:column;gap:2px;min-width:90px}
.op-view-kpi>span{font-size:9px;text-transform:uppercase;letter-spacing:.6px;color:var(--surface-subtle,#3d6894)}
.op-view-kpi>strong{font-size:13px;font-weight:700;color:var(--surface-text,#d4e6ff);white-space:nowrap}
.op-view-kpi-sep{width:1px;height:32px;background:var(--surface-border,#1e3452);flex-shrink:0;margin:0 4px}
.op-view-spacer{flex:1}
.op-view-readonly-badge{
  display:inline-flex;align-items:center;gap:5px;
  padding:4px 10px;border-radius:999px;
  background:rgba(60,180,120,.1);
  border:1px solid rgba(60,180,120,.28);
  color:#5de6a8;
  font-size:9px;font-weight:700;letter-spacing:.6px;
}
.op-view-readonly-badge::before{content:'';width:6px;height:6px;border-radius:50%;background:#5de6a8;animation:pulse-green 2s infinite;flex-shrink:0}
.op-view-body{display:flex;flex:1;min-height:0;overflow:hidden}
.op-view-queue{
  width:58%;border-right:1px solid var(--surface-border,#1e3452);
  display:flex;flex-direction:column;overflow:hidden;
}
.op-view-pipeline{
  flex:1;display:flex;flex-direction:column;overflow-y:auto;
  background:var(--surface-muted,#142540);
}
.op-view-section-head{
  display:flex;align-items:center;justify-content:space-between;
  padding:9px 14px;
  background:var(--surface-panel,#0f1e34);
  border-bottom:1px solid var(--surface-border,#1e3452);
  font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;
  color:var(--surface-subtle,#3d6894);
  flex-shrink:0;
}
.op-view-webhook-dot{width:6px;height:6px;border-radius:50%;background:#00C870;display:inline-block;flex-shrink:0;animation:pulse-green 2.5s infinite}
.op-view-active-chip{
  margin-left:auto;
  font-size:8px;font-weight:700;letter-spacing:.5px;
  padding:2px 7px;border-radius:999px;
  background:rgba(0,200,112,.12);
  border:1px solid rgba(0,200,112,.3);
  color:#7ee8b6;
}
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
  const [integratorCanvasMode, setIntegratorCanvasMode] = useState('full');
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
      return;
    }
    // Entering integrator-wf: clear any 'blueprint' state left over from operation view.
    // Without this, rapid Operation→Integrator switches leave the canvas invisible.
    setIntegratorSubview((prev) => (prev === 'blueprint' ? 'data' : prev));
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
    if ((workspaceMode === 'integrator' || workspaceMode === 'operation') && activeView === 'wf' && integratorCanvasMode !== 'full') {
      setIntegratorCanvasMode('full');
    }
  }, [workspaceMode, activeView]);

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
  const isWorkflowDesignerView = activeView === 'wf';
  const workflowHeaderStatus = [
    { label: 'Validation', value: '2 publish ready', tone: 'green' },
    { label: 'Diffs', value: '3 pending review', tone: 'amber' },
    { label: 'Connectors', value: '2 gaps', tone: 'blue' },
  ];

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

        <main className={`surface-main ${isWorkflowDesignerView ? 'workflow-focus' : ''}`}>
          <div className={`surface-topbar ${isWorkflowDesignerView ? 'compact' : ''}`}>
            <div className="surface-logo">AI Provi<span>so</span></div>
            <div className="surface-badge">v1.0 · Integrated Shell</div>
            {isWorkflowDesignerView && <div className="surface-divider" />}
            {isWorkflowDesignerView && (
              <div className="surface-titlelock">
                <div className="surface-titleblock">
                  <span className="surface-title">
                    {workspaceMode === 'operation' ? 'Operation View' : workspaceMode === 'integrator' ? 'Workflow Designer' : navMeta.title}
                  </span>
                  <span className="surface-titlecopy">
                    {workspaceMode === 'operation' ? 'Live AP invoice monitor · read-only · n8n routing feed' : 'Integrator-facing Proviso design workspace'}
                  </span>
                </div>
              </div>
            )}
            <div className="surface-spacer" />
            <div className="surface-mode">
              <button className={`surface-modebtn client ${workspaceMode === 'client' ? 'active client' : ''}`} onClick={() => setWorkspaceMode('client')}>Client Workspace</button>
              <button className={`surface-modebtn integrator ${workspaceMode === 'integrator' ? 'active integrator' : ''}`} onClick={() => setWorkspaceMode('integrator')}>Integrator Workspace</button>
              <button className={`surface-modebtn operation ${workspaceMode === 'operation' ? 'active operation' : ''}`} onClick={() => { setWorkspaceMode('operation'); setActiveView('wf'); }}>Operation View</button>
            </div>
            {!isWorkflowDesignerView && <button className="surface-action"><i className="ti ti-player-play" /> Guided Tour</button>}
            {isWorkflowDesignerView && (
              <button
                className="surface-collab-btn"
                onClick={() => { setWorkspaceMode('integrator'); }}
                title="Real-time collaboration — powered by React Flow Pro Yjs · click to open Collaboration panel"
              >
                <span className="surface-collab-dot" />
                <span>● Live</span>
                <span style={{ opacity: 0.6, fontSize: 10 }}>Collab</span>
              </button>
            )}
            <button className="surface-action primary"><i className="ti ti-upload" /> Upload</button>
          </div>

          <div className={`surface-ctxbar ${isWorkflowDesignerView ? 'designer' : ''}`}>
            {isWorkflowDesignerView ? (
              <>
                {!!launcherMessage && (workspaceMode === 'integrator' || workspaceMode === 'operation') && (
                  <span className="surface-ctxsub">{launcherMessage}</span>
                )}
                <div className="surface-designer-status">
                  {workflowHeaderStatus.map((item) => (
                    <div key={item.label} className="surface-statusitem">
                      <span className={`surface-statusdot ${item.tone}`} />
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <span className="surface-ctxtitle">{navMeta.title}</span>
                <span className="surface-ctxsep">›</span>
                <span className="surface-ctxsub">{navMeta.subtitle}</span>
                {workspaceMode === 'client' && <span className="surface-ctxsub">• {dataSource === 'database' ? 'Live backend' : dataSource === 'fallback' ? 'Backend fallback' : 'Connecting'}</span>}
                {!!launcherMessage && (workspaceMode === 'integrator' || workspaceMode === 'operation') && activeView === 'wf' && <span className="surface-ctxsub">• {launcherMessage}</span>}
              </>
            )}
          </div>

          <div className={`surface-metrics ${isWorkflowDesignerView ? 'hidden' : ''}`}>
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
                /* ── OPERATION VIEW: Read-only live operations monitor ──────────────────
                   Distinct from Integrator Workspace — no canvas, no editing tools.
                   Persona: AP Supervisor / Client — tracks live invoice routing.       */
                <div className="op-view-shell">
                  {/* KPI header strip */}
                  <div className="op-view-header">
                    <div className="op-view-kpi">
                      <span>Queue Depth</span>
                      <strong>{invoices.length} invoices</strong>
                    </div>
                    <div className="op-view-kpi-sep" />
                    <div className="op-view-kpi">
                      <span>Active Invoice</span>
                      <strong>{selectedInvoice?.invoiceNumber || '—'}</strong>
                    </div>
                    <div className="op-view-kpi-sep" />
                    <div className="op-view-kpi">
                      <span>Workflow State</span>
                      <strong>{integratorDebugContext?.stateName || selectedInvoice?.status || '—'}</strong>
                    </div>
                    <div className="op-view-kpi-sep" />
                    <div className="op-view-kpi">
                      <span>Confidence</span>
                      <strong style={{ color: selectedInvoice ? (selectedInvoice.confidence >= 0.7 ? '#00C870' : '#F0A500') : '#3d6894' }}>
                        {selectedInvoice ? `${(selectedInvoice.confidence * 100).toFixed(0)}%` : '—'}
                      </strong>
                    </div>
                    <div className="op-view-kpi-sep" />
                    <div className="op-view-kpi">
                      <span>n8n Webhooks</span>
                      <strong style={{ color: '#00C870' }}>9 / 9 live</strong>
                    </div>
                    <div className="op-view-spacer" />
                    <span className="op-view-readonly-badge">READ ONLY · Live Monitor</span>
                  </div>

                  <div className="op-view-body">
                    {/* Left: Invoice queue */}
                    <section className="op-view-queue">
                      <div className="op-view-section-head">
                        <span>Live Invoice Queue</span>
                        <span>{invoices.length} invoices{filter !== 'all' ? ` · ${filter}` : ''}</span>
                      </div>
                      <div className="ap-table-wrap">
                        <table className="ap-table">
                          <thead>
                            <tr><th>Vendor</th><th>Invoice #</th><th>Status</th><th>Confidence</th><th>SLA</th></tr>
                          </thead>
                          <tbody>
                            {loadingInvoices && <tr><td colSpan="5" style={{ padding: '16px', color: '#5878A0' }}>Loading…</td></tr>}
                            {!loadingInvoices && !filteredInvoices.length && <tr><td colSpan="5" style={{ padding: '16px', color: '#5878A0' }}>No invoices.</td></tr>}
                            {!loadingInvoices && filteredInvoices.map((inv) => (
                              <tr key={`op-${inv.id}`} className={selectedInvoiceId === inv.id ? 'sel' : ''} onClick={() => setSelectedInvoiceId(inv.id)}>
                                <td>{inv.vendor}</td>
                                <td className="mono">{inv.invoiceNumber}</td>
                                <td><span className={`ap-status ${statusClass(inv.status)}`}>{inv.status}</span></td>
                                <td>
                                  <div className="ap-conf">
                                    <div className="ap-conftrack">
                                      <div className={`ap-conffill ${inv.confidence >= 0.7 ? 'green' : inv.confidence >= 0.5 ? 'amber' : 'red'}`} style={{ width: `${inv.confidence * 100}%` }} />
                                    </div>
                                    <span className="ap-confnum">{inv.confidence.toFixed(2)}</span>
                                  </div>
                                </td>
                                <td>{inv.sla}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    {/* Right: Pipeline trace + webhook feed */}
                    <section className="op-view-pipeline">
                      <div className="op-view-section-head">
                        <span>Pipeline Trace</span>
                        {selectedInvoice && <span>{selectedInvoice.invoiceNumber} · {selectedInvoice.vendor}</span>}
                      </div>
                      {selectedInvoice ? (
                        <div className="ap-trace-flow" style={{ padding: '12px 14px' }}>
                          {buildExecutionTrace(runtimePayload, selectedInvoice).map((step) => (
                            <div key={step.id} className={`ap-trace-node ${step.id === deriveRuntimeState(runtimePayload, selectedInvoice) ? 'active' : ''}`}>
                              <div className="ap-trace-dot" />
                              <div className="ap-trace-copy">
                                <strong>{step.label}</strong>
                                <span>{step.meta}</span>
                              </div>
                              {step.id === deriveRuntimeState(runtimePayload, selectedInvoice) && (
                                <span className="op-view-active-chip">ACTIVE</span>
                              )}
                            </div>
                          ))}
                          {integratorDebugContext?.blockingRule && (
                            <div style={{ marginTop: 10, padding: '9px 11px', background: 'rgba(240,80,96,.08)', border: '1px solid rgba(240,80,96,.28)', borderRadius: 8, fontSize: 11, color: '#ffa0b0' }}>
                              <strong style={{ display: 'block', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.5px', color: '#ff6080', marginBottom: 3 }}>Blocking Rule</strong>
                              {integratorDebugContext.blockingRule}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ padding: '18px 14px', color: '#3d6894', fontSize: 12 }}>Select an invoice to trace its pipeline state.</div>
                      )}

                      <div className="op-view-section-head" style={{ marginTop: 4 }}>
                        <span>n8n Webhook Events</span>
                        <span style={{ color: '#00C870' }}>● 9 active</span>
                      </div>
                      <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {['invoice-received','invoice-extracted','invoice-matched','invoice-exception','invoice-resolved','invoice-approved','invoice-posted','invoice-rejected','audit-event'].map((evt) => (
                          <div key={evt} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10 }}>
                            <span className="op-view-webhook-dot" />
                            <span style={{ fontFamily: 'var(--mono)', color: '#7da8d4' }}>{evt}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
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
                  <div className="integrator-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderBottom: '1px solid var(--border)', background: 'var(--s2)', flexShrink: 0 }}>
                    <div className="integrator-subtabs">
                      <button className={integratorCanvasMode === 'full' ? 'active' : ''} onClick={() => { setIntegratorCanvasMode('full'); setIntegratorSubview('data'); }}>Full Canvas</button>
                      <button className={integratorCanvasMode === 'split' ? 'active' : ''} onClick={() => { setIntegratorCanvasMode('split'); setIntegratorSubview('data'); }}>Data + Canvas</button>
                    </div>
                  </div>
                  {integratorSubview === 'data' ? (
                    <div className="design-host">
                      <RuntimeErrorBoundary>
                        <Suspense fallback={<div className="simple-panel" style={{ display: 'grid', placeItems: 'center', minHeight: '220px' }}>Loading workflow designer…</div>}>
                          <CommandCenter externalSelection={integratorDebugContext} />
                        </Suspense>
                      </RuntimeErrorBoundary>
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

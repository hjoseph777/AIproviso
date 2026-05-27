import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { useMermaid } from '../hooks/useMermaid';
import { useExport } from '../hooks/useExport';

const mkId = () => Math.random().toString(36).slice(2,9);
const delay = ms => new Promise(r => setTimeout(r, ms));
const TS = () => new Date().toLocaleTimeString('en-CA',{hour12:false});
const MODES = [['manual','⊞ Manual'],['nlp','◈ NLP'],['ai','✦ AI']];
const VIEW_MODES = [['business','Business'],['runtime','Runtime'],['target','Target']];

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
    window.mermaid.initialize({startOnLoad:false,theme:'base',
      // Prevent Mermaid from injecting style="max-width:Xpx" on the SVG element.
      // Without this flag, the inline style overrides all CSS and locks the SVG to
      // a fixed pixel width even when the column expands.
      state:{useMaxWidth:false},
      themeVariables:{
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

// buildEdgeMap: parses mermaid string -> [{fromId,toId}] for highlightEdge index lookup.
// Note: [*] lines never match [A-Za-z0-9_]+ so the continue guard is redundant but kept for clarity.
function buildEdgeMap(mermaidStr) {
  if (!mermaidStr) return [];
  const map = [];
  const re = /^\s+([A-Za-z0-9_]+)\s+-->\s+([A-Za-z0-9_]+)/gm;
  let m;
  while ((m = re.exec(mermaidStr)) !== null) {
    const from = m[1], to = m[2];
    if (from === '[*]' || to === '[*]') continue;
    map.push({ fromId: from, toId: to });
  }
  return map;
}

// addClicks: detects from/to by path geometry, not SVG order.
// Mermaid's layout engine can reorder path.transition elements in the SVG
// differently from the input string, making index-based edgeMap matching
// unreliable for some transitions. Geometry is always correct.
function addClicks(el, onNode, onEdge, onInspectNode, onInspectEdge) {
  const svg = el?.querySelector('svg'); if (!svg) return;

  // ── State node clicks ──
  svg.querySelectorAll('.node').forEach(n => {
    n.style.cursor = 'pointer';
    n.onclick = e => {
      e.stopPropagation();
      const lbl = n.querySelector('.nodeLabel,text,span')?.textContent?.trim() || '';
      if (lbl) onNode(lbl);
    };
    n.ondblclick = e => {
      e.stopPropagation();
      const lbl = n.querySelector('.nodeLabel,text,span')?.textContent?.trim() || '';
      if (lbl && onInspectNode) onInspectNode(lbl);
    };
  });

  // ── Build a screen-coordinate map of all node centers ──
  const nodeBoxes = [];
  svg.querySelectorAll('.node').forEach(n => {
    const lbl = n.querySelector('.nodeLabel,text,span')?.textContent?.trim() || '';
    if (!lbl) return;
    const r = n.getBoundingClientRect();
    nodeBoxes.push({
      id: lbl.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, ''),
      cx: r.left + r.width / 2,
      cy: r.top  + r.height / 2
    });
  });

  const nearest = (x, y) => {
    let best = null, bestD = Infinity;
    nodeBoxes.forEach(nb => {
      const d = (nb.cx-x)**2 + (nb.cy-y)**2;
      if (d < bestD) { bestD = d; best = nb.id; }
    });
    return best;
  };

  // ── Transition arrow clicks — geometry-based ──
  const transPaths = [...svg.querySelectorAll('path.transition')]
    .filter(p => !p.getAttribute('marker-start'));

  svg.querySelectorAll('.ghost-overlay').forEach(g => g.remove());
  const ghostLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  ghostLayer.setAttribute('class', 'ghost-overlay');
  svg.appendChild(ghostLayer);

  transPaths.forEach(p => {
    const len = p.getTotalLength();
    if (len < 1) return;
    // Sample near-start (5%) and near-end (95%) to avoid arrowhead/node overlap
    const s = p.getPointAtLength(len * 0.05);
    const e2 = p.getPointAtLength(len * 0.95);
    // Convert SVG user-space points to screen coords
    const ctm = p.getScreenCTM();
    const toScreen = pt => {
      const sp = svg.createSVGPoint(); sp.x = pt.x; sp.y = pt.y;
      return ctm ? sp.matrixTransform(ctm) : sp;
    };
    const ss = toScreen(s), es = toScreen(e2);
    const fromId = nearest(ss.x, ss.y);
    const toId   = nearest(es.x, es.y);
    if (!fromId || !toId || fromId === toId) return;

    const ghost = p.cloneNode(false);
    ghost.removeAttribute('id');
    ghost.removeAttribute('class');
    ghost.removeAttribute('marker-end');
    ghost.removeAttribute('marker-start');
    ghost.removeAttribute('marker-mid');
    ghost.style.cssText = 'stroke-width:32px;stroke:transparent;fill:none;cursor:pointer;pointer-events:stroke';
    ghost.onclick = ev => { ev.stopPropagation(); onEdge({fromId, toId}); };
    ghost.ondblclick = ev => {
      ev.stopPropagation();
      if (onInspectEdge) onInspectEdge({fromId, toId});
    };
    ghostLayer.appendChild(ghost);
  });
}

// highlightEdge: lights up the matching path.transition in blue
// NOTE: do NOT change strokeWidth — Mermaid markers use markerUnits="strokeWidth"
// so changing strokeWidth scales the arrowhead proportionally (makes it expand).
// Color change + drop-shadow filter is sufficient visual feedback.
function highlightEdge(el, selTrans, edgeMap) {
  if (!el || !selTrans) return;
  const svg = el.querySelector('svg'); if (!svg) return;

  // Reset all transition paths (stroke color + filter only — not strokeWidth)
  const allTransPaths = [...svg.querySelectorAll('path.transition')];
  const transPaths = allTransPaths.filter(p => !p.getAttribute('marker-start'));
  transPaths.forEach(p => { p.style.stroke = ''; p.style.filter = ''; });

  // Highlight the matching path by edgeMap index
  const matchIdx = edgeMap.findIndex(e => e.fromId === selTrans.fromId && e.toId === selTrans.toId);
  if (matchIdx >= 0 && transPaths[matchIdx]) {
    const p = transPaths[matchIdx];
    p.style.stroke = '#4A9FFF';
    // strokeWidth intentionally NOT set — arrowhead marker scales with it
    p.style.filter = 'drop-shadow(0 0 6px rgba(74,159,255,.85))';
  }
}

const normalizeNodeId = (value = '') => value.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

const titleCase = (value = '') => String(value)
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

function deriveRuleIdForState(stateName = '') {
  const normalized = stateName.toLowerCase();
  if (normalized.includes('review')) return 'rule.invoice.confidence.manual_review';
  if (normalized.includes('approval')) return 'rule.invoice.approval.pending';
  if (normalized.includes('signature')) return 'rule.invoice.signature.pending';
  if (normalized.includes('draft')) return 'rule.workflow.transition.recorded';
  return null;
}

function buildCanonicalWorkflowIR(wf, rules = []) {
  if (!wf) return null;
  const ruleCatalog = Object.fromEntries(rules.map((rule) => [rule.id, rule]));
  const states = (wf.states || []).map((state) => {
    const stateId = normalizeNodeId(state.name).toLowerCase();
    const ruleId = deriveRuleIdForState(state.name);
    return {
      id: state.id,
      name: state.name,
      initial: !!state.initial,
      meta: {
        business: {
          label: state.name,
          lane: state.initial ? 'entry' : 'flow',
        },
        runtime: {
          stateId,
          ruleId,
          routeEligible: true,
        },
        xstate: {
          stateId: `states.${stateId}`,
          entryAction: `action.enter.${stateId}`,
          exitAction: `action.exit.${stateId}`,
        },
        n8n: {
          nodeId: `n8n.state.${stateId}`,
          webhookPath: `/webhook/invoice.${stateId}`,
          connector: state.initial ? 'intake' : 'workflow-router',
        },
        rule: ruleId ? ruleCatalog[ruleId] || { id: ruleId, text: titleCase(ruleId) } : null,
      },
    };
  });

  const transitions = (wf.transitions || []).map((transition) => {
    const fromId = normalizeNodeId(transition.from).toLowerCase();
    const toId = normalizeNodeId(transition.to).toLowerCase();
    const eventType = eventTypeForTransition(transition);
    const ruleId = deriveRuleIdForState(transition.to) || deriveRuleIdForState(transition.from);
    return {
      id: transition.id,
      from: transition.from,
      to: transition.to,
      meta: {
        runtime: {
          eventType,
          ruleId,
          guardName: ruleId ? titleCase(ruleId).replace(/\s+/g, '_').toLowerCase() : null,
        },
        xstate: {
          eventType,
          target: `states.${toId}`,
          guardName: ruleId ? `guard.${fromId}_to_${toId}` : null,
        },
        n8n: {
          nodeId: `n8n.edge.${fromId}_${toId}`,
          webhookPath: `/webhook/${eventType.replace(/\./g, '-')}`,
          connector: 'http-request',
        },
      },
    };
  });

  return {
    workflow: {
      id: wf.id,
      name: wf.name,
    },
    states,
    transitions,
    rules: rules.map((rule) => ({ id: rule.id, text: rule.text })),
  };
}

function compileToXState(ir) {
  if (!ir) return null;
  return {
    id: normalizeNodeId(ir.workflow.name || 'workflow').toLowerCase(),
    initial: ir.states.find((state) => state.initial)?.meta.runtime.stateId || ir.states[0]?.meta.runtime.stateId || 'draft',
    states: Object.fromEntries(ir.states.map((state) => {
      const outgoing = ir.transitions.filter((transition) => transition.from === state.name);
      return [state.meta.runtime.stateId, {
        entry: state.meta.xstate.entryAction,
        exit: state.meta.xstate.exitAction,
        on: Object.fromEntries(outgoing.map((transition) => [transition.meta.xstate.eventType, {
          target: transition.meta.xstate.target,
          guard: transition.meta.xstate.guardName,
        }])),
      }];
    })),
  };
}

function compileToN8n(ir) {
  if (!ir) return null;
  return {
    name: `${ir.workflow.name || 'Workflow'} Orchestration`,
    nodes: [
      ...ir.states.map((state) => ({
        id: state.meta.n8n.nodeId,
        name: `${state.name} Node`,
        type: state.initial ? 'webhook' : 'trigger',
        webhookPath: state.meta.n8n.webhookPath,
        connector: state.meta.n8n.connector,
      })),
      ...ir.transitions.map((transition) => ({
        id: transition.meta.n8n.nodeId,
        name: `${transition.from} -> ${transition.to}`,
        type: 'httpRequest',
        webhookPath: transition.meta.n8n.webhookPath,
        connector: transition.meta.n8n.connector,
      })),
    ],
  };
}

function eventTypeForTransition(transition) {
  if (!transition?.to) return 'workflow.transition';
  return `invoice.${String(transition.to).trim().toLowerCase().replace(/\s+/g, '_')}`;
}

function getSelectedTransition(wf, selTrans) {
  if (!wf?.transitions?.length || !selTrans) return null;
  return wf.transitions.find((transition) => (
    normalizeNodeId(transition.from) === selTrans.fromId && normalizeNodeId(transition.to) === selTrans.toId
  )) || null;
}

function buildViewOverlay({ wf, sel, selTrans, externalSelection, rules, viewMode }) {
  const activeState = sel || externalSelection?.stateName || wf?.states?.find((state) => state.initial)?.name || 'Draft';
  const activeTransition = getSelectedTransition(wf, selTrans)
    || (externalSelection?.transition?.from && externalSelection?.transition?.to ? externalSelection.transition : null);
  const activeRule = rules.find((rule) => rule.id === externalSelection?.ruleId) || null;
  const route = externalSelection?.activeRoutePath || [];
  const ruleDecision = externalSelection?.ruleDecision || null;

  if (viewMode === 'runtime') {
    return {
      title: 'Runtime Overlay',
      subtitle: 'Execution facts and persisted identifiers for the selected workflow slice.',
      items: [
        ['State', activeState],
        ['Route', route.length ? route.join(' -> ') : activeState],
        ['Rule ID', ruleDecision?.id || externalSelection?.ruleId || 'Awaiting runtime rule'],
        ['Guard', ruleDecision?.guard_name || 'Not recorded'],
        ['Failed Step', externalSelection?.failedStepId || 'None'],
      ],
    };
  }

  if (viewMode === 'target') {
    const stateId = normalizeNodeId(activeState).toLowerCase();
    const eventType = eventTypeForTransition(activeTransition);
    const n8nNodeId = activeTransition
      ? `n8n.edge.${normalizeNodeId(activeTransition.from).toLowerCase()}_${normalizeNodeId(activeTransition.to).toLowerCase()}`
      : `n8n.state.${stateId}`;
    return {
      title: 'Target Overlay',
      subtitle: 'Compiled runtime identities for XState execution and n8n orchestration.',
      items: [
        ['XState State', `states.${stateId}`],
        ['XState Event', eventType],
        ['Guard Name', ruleDecision?.guard_name || titleCase(activeRule?.id || 'derived guard')],
        ['n8n Node', n8nNodeId],
        ['Webhook Path', `/webhook/${eventType.replace(/\./g, '-')}`],
      ],
    };
  }

  return {
    title: 'Business Overlay',
    subtitle: 'Default Proviso-native authoring view with detail on demand.',
    items: [
      ['Workflow', wf?.name || 'Unnamed Workflow'],
      ['Selected State', activeState],
      ['Transition', activeTransition ? `${activeTransition.from} -> ${activeTransition.to}` : 'Select an edge to inspect'],
      ['Business Rule', activeRule?.text || ruleDecision?.title || 'No explicit rule selected'],
      ['SLA Lens', route.length > 2 ? 'Multi-step path in progress' : 'Local state focus'],
    ],
  };
}

function buildViewJson({ wf, sel, selTrans, externalSelection, rules, viewMode, workflowIR, xstateSpec, n8nSpec }) {
  const activeTransition = getSelectedTransition(wf, selTrans)
    || (externalSelection?.transition?.from && externalSelection?.transition?.to ? externalSelection.transition : null);
  const stateName = sel || externalSelection?.stateName || wf?.states?.find((state) => state.initial)?.name || 'Draft';
  const eventType = eventTypeForTransition(activeTransition);
  const stateId = normalizeNodeId(stateName).toLowerCase();
  const xstateStates = Object.fromEntries((wf?.states || []).map((state) => {
    const outgoing = (wf?.transitions || []).filter((transition) => transition.from === state.name);
    return [
      normalizeNodeId(state.name).toLowerCase(),
      {
        entry: `action.enter.${normalizeNodeId(state.name).toLowerCase()}`,
        on: Object.fromEntries(outgoing.map((transition) => [
          eventTypeForTransition(transition),
          {
            target: normalizeNodeId(transition.to).toLowerCase(),
            guard: externalSelection?.ruleDecision?.guard_name || null,
          },
        ])),
      },
    ];
  }));

  const n8nNodes = (wf?.states || []).map((state, index) => ({
    id: `n8n.state.${normalizeNodeId(state.name).toLowerCase()}`,
    name: `${state.name} Handler`,
    type: index === 0 ? 'webhook' : 'httpRequest',
    meta: {
      state: state.name,
      routeTo: (wf?.transitions || []).filter((transition) => transition.from === state.name).map((transition) => transition.to),
    },
  }));

  if (viewMode === 'runtime') {
    return {
      viewMode,
      runtime: {
        stateName,
        routeHistory: externalSelection?.activeRoutePath || [],
        ruleDecision: externalSelection?.ruleDecision || null,
        transition: activeTransition,
      },
    };
  }

  if (viewMode === 'target') {
    const selectedTransition = activeTransition
      ? {
          eventType,
          target: `states.${normalizeNodeId(activeTransition.to).toLowerCase()}`,
          guard: externalSelection?.ruleDecision?.guard_name || null,
          nodeId: `n8n.edge.${normalizeNodeId(activeTransition.from).toLowerCase()}_${normalizeNodeId(activeTransition.to).toLowerCase()}`,
        }
      : null;

    return {
      viewMode,
      canonicalIR: workflowIR,
      selectedTarget: {
        stateName,
        xstateState: xstateSpec?.states?.[stateId] || null,
        n8nStateNode: n8nSpec?.nodes?.find((node) => node.id === `n8n.state.${stateId}`) || null,
        transition: selectedTransition,
      },
      compile: {
        xstate: xstateSpec,
        n8n: n8nSpec,
      },
    };
  }

  return {
    viewMode,
    canonicalIR: workflowIR,
    workflow: wf || null,
    semanticSelection: {
      stateName,
      transition: activeTransition,
      rule: rules.find((rule) => rule.id === externalSelection?.ruleId) || null,
    },
  };
}

function buildTargetInspector({ wf, sel, selTrans, externalSelection, xstateSpec, n8nSpec }) {
  const activeTransition = getSelectedTransition(wf, selTrans)
    || (externalSelection?.transition?.from && externalSelection?.transition?.to ? externalSelection.transition : null);
  const stateName = sel || externalSelection?.stateName || wf?.states?.find((state) => state.initial)?.name || 'Draft';
  const stateId = normalizeNodeId(stateName).toLowerCase();

  return {
    stateName,
    stateId,
    xstateMachineId: xstateSpec?.id || null,
    xstateState: xstateSpec?.states?.[stateId] || null,
    n8nStateNode: n8nSpec?.nodes?.find((node) => node.id === `n8n.state.${stateId}`) || null,
    transition: activeTransition
      ? {
          from: activeTransition.from,
          to: activeTransition.to,
          eventType: eventTypeForTransition(activeTransition),
          target: `states.${normalizeNodeId(activeTransition.to).toLowerCase()}`,
          guard: externalSelection?.ruleDecision?.guard_name || null,
          nodeId: `n8n.edge.${normalizeNodeId(activeTransition.from).toLowerCase()}_${normalizeNodeId(activeTransition.to).toLowerCase()}`,
        }
      : null,
  };
}

function applyRouteFocus(el, selection) {
  if (!el) return;
  const svg = el.querySelector('svg');
  if (!svg) return;

  svg.querySelectorAll('.route-dim,.route-active,.route-failed').forEach((node) => {
    node.classList.remove('route-dim', 'route-active', 'route-failed');
  });

  const route = selection?.activeRoutePath || [];
  if (!route.length) return;

  const routeIds = route.map(normalizeNodeId);
  const failedId = normalizeNodeId(selection?.failedStepId || '');

  svg.querySelectorAll('.node').forEach((node) => {
    const label = node.querySelector('.nodeLabel,text,span')?.textContent?.trim() || '';
    const nodeId = normalizeNodeId(label);
    if (!routeIds.includes(nodeId)) {
      node.classList.add('route-dim');
      return;
    }
    node.classList.add('route-active');
    if (failedId && nodeId === failedId) {
      node.classList.add('route-failed');
    }
  });

  svg.querySelectorAll('.edgePath').forEach((edge) => edge.classList.add('route-dim'));
  for (let index = 0; index < routeIds.length - 1; index += 1) {
    const fromId = routeIds[index];
    const toId = routeIds[index + 1];
    const edge = svg.querySelector(`[class*="LS-${fromId}"][class*="LE-${toId}"]`);
    if (edge) {
      edge.classList.remove('route-dim');
      edge.classList.add('route-active');
    }
  }
}

function focusRuleRow(ruleId) {
  if (!ruleId) return;
  const rows = [...document.querySelectorAll('.rule-row')];
  if (!rows.length) return;

  const target = rows.find((row) => row.dataset.ruleId === ruleId);

  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('rule-focus');
  window.setTimeout(() => target.classList.remove('rule-focus'), 1800);
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

export default function CommandCenter({ externalSelection = null } = {}) {
  const workflows=useWorkflowStore(s=>s.workflows), activeId=useWorkflowStore(s=>s.activeId);
  const getActive=useWorkflowStore(s=>s.getActive), setActive=useWorkflowStore(s=>s.setActive);
  const addWorkflow=useWorkflowStore(s=>s.addWorkflow), deleteWorkflow=useWorkflowStore(s=>s.deleteWorkflow);
  const renameWorkflow=useWorkflowStore(s=>s.renameWorkflow), clearWorkflow=useWorkflowStore(s=>s.clearWorkflow);
  const importWorkflow=useWorkflowStore(s=>s.importWorkflow), resetAll=useWorkflowStore(s=>s.resetAll);
  const addState=useWorkflowStore(s=>s.addState), updateState=useWorkflowStore(s=>s.updateState);
  const renameState=useWorkflowStore(s=>s.renameState), deleteState=useWorkflowStore(s=>s.deleteState);
  const addTransition=useWorkflowStore(s=>s.addTransition), updateTransition=useWorkflowStore(s=>s.updateTransition);
  const deleteTransition=useWorkflowStore(s=>s.deleteTransition);
  const seedStressTest=useWorkflowStore(s=>s.seedStressTest);
  const users=useWorkflowStore(s=>s.users), properties=useWorkflowStore(s=>s.properties), rules=useWorkflowStore(s=>s.rules);
  const addUser=useWorkflowStore(s=>s.addUser), updateUser=useWorkflowStore(s=>s.updateUser), deleteUser=useWorkflowStore(s=>s.deleteUser);
  const addProperty=useWorkflowStore(s=>s.addProperty), updateProperty=useWorkflowStore(s=>s.updateProperty), deleteProperty=useWorkflowStore(s=>s.deleteProperty);
  const addRule=useWorkflowStore(s=>s.addRule), updateRule=useWorkflowStore(s=>s.updateRule), deleteRule=useWorkflowStore(s=>s.deleteRule);
  const hoveredState=useWorkflowStore(s=>s.hoveredState), setHoveredState=useWorkflowStore(s=>s.setHoveredState);
  const hoveredTransition=useWorkflowStore(s=>s.hoveredTransition), setHoveredTransition=useWorkflowStore(s=>s.setHoveredTransition);
  const setCmdPaletteOpen=useWorkflowStore(s=>s.setCmdPaletteOpen);

  const [mode,setMode]=useState('manual');
  const [viewMode,setViewMode]=useState('business');
  const [nlpText,setNlpText]=useState(''), [aiText,setAiText]=useState('');
  const [aiKey,setAiKey]=useState(''), [aiModel,setAiModel]=useState('claude-sonnet-4-5');
  const [log,setLog]=useState([]), [busy,setBusy]=useState(false);
  const [sel,setSel]=useState(''), [selTrans,setSelTrans]=useState(null); // selTrans: {fromId,toId} | null
  const [centerView,setCenterView]=useState('diagram');
  const edgeMapRef=useRef([]);
  const [saveFlash,setSaveFlash]=useState(false), [saved,setSaved]=useState(false);
  const [mfLog,setMfLog]=useState([]), [mfBusy,setMfBusy]=useState(false), [mfOk,setMfOk]=useState(null);
  const [mfAdv,setMfAdv]=useState(false), [mfServer,setMfServer]=useState('localhost');
  const [mfVault,setMfVault]=useState('{E7E445BE-3AEF-425F-9D4D-BFCC33008C9E}');
  const [mfAuth,setMfAuth]=useState('windows'), [mfUser,setMfUser]=useState(''), [mfPass,setMfPass]=useState('');
  const [open,setOpen]=useState({states:true,trans:true,users:false,props:false,rules:false});
  const [stateFilter,setStateFilter]=useState(''), [transFilter,setTransFilter]=useState('');
  const [editTabId,setEditTabId]=useState(null), [tabDraft,setTabDraft]=useState('');
  const [leftOpen,setLeftOpen]=useState(true);
  const [rightOpen,setRightOpen]=useState(false);
  const [rightPanelMode,setRightPanelMode]=useState('deliver');
  const [zoom,setZoom]=useState(1);
  const [mfPushQueue,setMfPushQueue]=useState([]);
  const [mfPullQueue,setMfPullQueue]=useState([]);
  const [mfVaultWorkflows,setMfVaultWorkflows]=useState([]);
  const [syncMode,setSyncMode]=useState('export');
  const [expandTabLabels,setExpandTabLabels]=useState(false);
  const [canScrollUp,setCanScrollUp]=useState(false);
  const [canScrollDown,setCanScrollDown]=useState(false);
  const [canTabsLeft,setCanTabsLeft]=useState(false);
  const [canTabsRight,setCanTabsRight]=useState(false);
  const [showEdgeSearch,setShowEdgeSearch]=useState(false);

  const wf=getActive(), mermaidStr=useMermaid(wf);
  const workflowIR = useMemo(() => buildCanonicalWorkflowIR(wf, rules), [wf, rules]);
  const xstateSpec = useMemo(() => compileToXState(workflowIR), [workflowIR]);
  const n8nSpec = useMemo(() => compileToN8n(workflowIR), [workflowIR]);
  const overlay = useMemo(() => buildViewOverlay({ wf, sel, selTrans, externalSelection, rules, viewMode }), [wf, sel, selTrans, externalSelection, rules, viewMode]);
  const jsonView = useMemo(() => buildViewJson({ wf, sel, selTrans, externalSelection, rules, viewMode, workflowIR, xstateSpec, n8nSpec }), [wf, sel, selTrans, externalSelection, rules, viewMode, workflowIR, xstateSpec, n8nSpec]);
  const targetInspector = useMemo(() => buildTargetInspector({ wf, sel, selTrans, externalSelection, xstateSpec, n8nSpec }), [wf, sel, selTrans, externalSelection, xstateSpec, n8nSpec]);
  const filteredStates=(wf?.states||[]).filter(s=>!stateFilter||s.name.toLowerCase().includes(stateFilter.toLowerCase()));
  const filteredTrans=(wf?.transitions||[]).filter(t=>!transFilter||t.from.toLowerCase().includes(transFilter.toLowerCase())||t.to.toLowerCase().includes(transFilter.toLowerCase()));
  const {exportJSON}=useExport();
  const diagRef=useRef(null), rcRef=useRef(0), zoomRef=useRef(1), wrapRef=useRef(null);
  const leftBodyRef=useRef(null), wfTabsRef=useRef(null);
  const logRef=useRef(null), mfLogRef=useRef(null);
  const logTailRef=useRef(null), mfLogTailRef=useRef(null);
  const logFollowRef=useRef(true), mfLogFollowRef=useRef(true);
  const tog=k=>setOpen(o=>({...o,[k]:!o[k]}));
  const addLog=(msg,t='info')=>setLog(p=>[...p,{msg,t,ts:TS()}]);
  const addMfLog=(msg,t='info')=>setMfLog(p=>[...p,{msg,t,ts:TS()}]);

  const keepLogAtBottom=(el, followRef)=>{
    if(!el) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 16;
    followRef.current = nearBottom;
  };

  const updateLeftScrollState=()=>{
    const el=leftBodyRef.current;
    if(!el){setCanScrollUp(false);setCanScrollDown(false);return;}
    setCanScrollUp(el.scrollTop>2);
    setCanScrollDown(el.scrollTop+el.clientHeight<el.scrollHeight-2);
  };

  const updateTabsScrollState=()=>{
    const el=wfTabsRef.current;
    if(!el){setCanTabsLeft(false);setCanTabsRight(false);return;}
    setCanTabsLeft(el.scrollLeft>2);
    setCanTabsRight(el.scrollLeft+el.clientWidth<el.scrollWidth-2);
  };

  const scrollLeftPanel=(delta)=>{
    const el=leftBodyRef.current;
    if(!el) return;
    el.scrollBy({top:delta,behavior:'smooth'});
  };

  const scrollTabs=(delta)=>{
    const el=wfTabsRef.current;
    if(!el) return;
    el.scrollBy({left:delta,behavior:'smooth'});
  };

  const switchWorkflow=(id)=>{
    setSel('');
    setSelTrans(null);
    setActive(id);
  };

  useEffect(()=>{updateLeftScrollState();},[open.states,open.trans,open.users,open.props,open.rules,workflows.length,activeId,mode]);
  useEffect(()=>{updateTabsScrollState();},[workflows.length,activeId,editTabId,expandTabLabels]);
  useLayoutEffect(()=>{
    if(logFollowRef.current) logTailRef.current?.scrollIntoView({block:'end'});
  },[log.length,busy]);
  useLayoutEffect(()=>{
    if(mfLogFollowRef.current) mfLogTailRef.current?.scrollIntoView({block:'end'});
  },[mfLog.length,mfBusy,mfOk]);

  useEffect(()=>{
    if(!mermaidStr||centerView!=='diagram'){
      // Always clear the diagram container on tab switch to a workflow with no states.
      // diagRef.current may be null here (JSX conditionally unmounts it when !mermaidStr)
      // so we target the wrapper directly instead.
      if(diagRef.current) diagRef.current.innerHTML='';
      return;
    }
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
          // Override Mermaid's inline style="max-width:Xpx" — JS .style wins over
          // both stylesheet rules and Mermaid's own style attribute.
          const svgEl=diagRef.current.querySelector('svg');
          if(svgEl){
            svgEl.removeAttribute('width');
            svgEl.removeAttribute('height');
            svgEl.style.maxWidth='none';
            // Use intrinsic width from viewBox so it scales naturally, default to 800 if missing
            const vb = svgEl.viewBox.baseVal;
            const baseW = (vb && vb.width > 0) ? vb.width : 800;
            svgEl.dataset.baseWidth = baseW;
            svgEl.style.width=`${baseW * zoomRef.current}px`;
            svgEl.style.height='auto';
            svgEl.style.display='block';
            svgEl.style.margin='0 auto';
          }
          highlightNode(diagRef.current,sel);
          addClicks(
            diagRef.current,
            name=>{setSel(name);setSelTrans(null);},
            entry=>{
              setSelTrans(entry);
              setSel('');
              setOpen(o=>({...o,trans:true}));
              setTimeout(()=>{
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
            name=>{openTargetInspectorForState(name);},
            entry=>{openTargetInspectorForEdge(entry);}
          );
        }
      }catch{if(!dead&&diagRef.current)diagRef.current.innerHTML=`<div style="color:var(--red);font-size:11px;padding:16px">Diagram error</div>`;}
    })();
    return()=>{dead=true;};
  }, [mermaidStr, centerView, leftOpen]);

  // Handle Bi-Directional Diagram Highlighting
  useEffect(() => {
    if (!diagRef.current) return;
    diagRef.current.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
    if (hoveredState) {
      const id = hoveredState.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
      const node = diagRef.current.querySelector(`#${id}`);
      if (node) node.classList.add('highlight');
    }
    if (hoveredTransition?.from && hoveredTransition?.to) {
      const f = hoveredTransition.from.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
      const t = hoveredTransition.to.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
      // Mermaid stateDiagram-v2 edges have classes like LS-from LE-to
      const edge = diagRef.current.querySelector(`[class*="LS-${f}"][class*="LE-${t}"]`);
      if (edge) edge.classList.add('highlight');
    }
  }, [hoveredState, hoveredTransition, mermaidStr, zoom]);

  // ── Sync Logic (M-Files) ──────────────────────────────────────────────
  // Uses a non-passive listener so e.preventDefault() can suppress browser zoom.
  // zoomRef keeps the value accessible inside the setZoom updater (closure-safe).
  useEffect(()=>{
    const el=wrapRef.current; if(!el) return;
    const onWheel=(e)=>{
      if(!e.ctrlKey) return;
      e.preventDefault();
      setZoom(z=>{
        // scroll up (deltaY<0) = zoom in ×1.12, scroll down = zoom out ×0.90
        const next=Math.min(4,Math.max(0.25,z*(e.deltaY<0?1.12:0.90)));
        zoomRef.current=next;
        return next;
      });
    };
    el.addEventListener('wheel',onWheel,{passive:false});
    return()=>el.removeEventListener('wheel',onWheel);
  },[]);

  // Apply zoom to the live SVG whenever zoom state changes
  useEffect(()=>{
    zoomRef.current=zoom;
    const svgEl=diagRef.current?.querySelector('svg');
    if(svgEl) {
      const baseW = parseFloat(svgEl.dataset.baseWidth) || 800;
      svgEl.style.width=`${baseW * zoom}px`;
    }
  },[zoom]);

  // Reset zoom to 100% when switching workflows
  useEffect(()=>{ setZoom(1); zoomRef.current=1; },[activeId]);

  useEffect(()=>{if(diagRef.current)highlightNode(diagRef.current,sel);},[sel]);
  useEffect(()=>{
    if(!diagRef.current) return;
    if(selTrans==null){
      const svg=diagRef.current.querySelector('svg');
      svg?.querySelectorAll('path.transition').forEach(p=>{
        if(!p.getAttribute('marker-start')){
          p.style.stroke=''; p.style.filter='';
        }
      });
    } else {
      // Pass edgeMap from ref so highlightEdge can find the correct SVG edge by name
      highlightEdge(diagRef.current,selTrans,edgeMapRef.current);
    }
  },[selTrans]);

  useEffect(() => {
    applyRouteFocus(diagRef.current, externalSelection);
  }, [externalSelection?.activeRoutePath?.join('|'), externalSelection?.failedStepId, mermaidStr, centerView, zoom]);

  useEffect(() => {
    if (!externalSelection) return;

    setCenterView('diagram');
    if (externalSelection.transition?.from && externalSelection.transition?.to) {
      const fromId = externalSelection.transition.from.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const toId = externalSelection.transition.to.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      setSel('');
      setSelTrans({ fromId, toId });
      setOpen((current) => ({ ...current, trans: true, rules: true }));
      window.setTimeout(() => {
        const rows = [...document.querySelectorAll('.trans-row')];
        const target = rows.find((row) => {
          const inputs = row.querySelectorAll('input');
          return inputs[0]?.value === externalSelection.transition.from && inputs[1]?.value === externalSelection.transition.to;
        });
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        focusRuleRow(externalSelection.ruleId);
      }, 80);
      return;
    }

    if (externalSelection.stateName) {
      setSel(externalSelection.stateName);
      setSelTrans(null);
      setOpen((current) => ({ ...current, states: true, rules: true }));
      window.setTimeout(() => {
        const rows = [...document.querySelectorAll('.inline-mini tbody tr')];
        const target = rows.find((row) => row.querySelector('input')?.value === externalSelection.stateName);
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        focusRuleRow(externalSelection.ruleId);
      }, 80);
    }
  }, [externalSelection?.stateName, externalSelection?.transition?.from, externalSelection?.transition?.to, externalSelection?.ruleId]);

  const changeMode=m=>{setMode(m);setLog([]);setSel('');};
  const openTargetInspectorForState=name=>{
    setSel(name);
    setSelTrans(null);
    setViewMode('target');
    setCenterView('diagram');
    setRightPanelMode('target');
    setRightOpen(true);
  };
  const openTargetInspectorForEdge=entry=>{
    setSelTrans(entry);
    setSel('');
    setViewMode('target');
    setCenterView('diagram');
    setRightPanelMode('target');
    setRightOpen(true);
  };
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
  const handleReset=()=>{resetAll();setLog([]);setSel('');setSelTrans(null);setMfLog([]);setMfOk(null);setSaved(false);setStateFilter('');setTransFilter('');};
  const handleSave=()=>{exportJSON();setSaved(true);setSaveFlash(true);setTimeout(()=>setSaveFlash(false),2000);};
  const handleSOW=()=>{if(wf?.states.length)dl(buildSOW(wf,users,properties,rules),`${(wf.name||'sow').replace(/\s+/g,'_')}.md`);};
  const handlePRD=()=>{if(wf?.states.length)dl(buildPRD(wf,users,properties,rules),`${(wf.name||'prd').replace(/\s+/g,'_')}_PRD.md`);};
  const handleMfFetch=async()=>{
    if(!mfVault.trim()){addMfLog('Vault GUID is required','error');return;}
    setMfBusy(true);setMfLog([]);setMfPullQueue([]);addMfLog('Fetching available workflows...');
    try{
      const res=await window.mfiles.listWorkflows({
        vaultGuid:mfVault,server:mfServer,authType:mfAuth,username:mfUser,password:mfPass
      });
      if(!res.ok) throw new Error(res.error||'Fetch failed');
      const fetched=(res.workflows||[])
        .map(w=>({id:Number(w?.id),name:String(w?.name||'').trim()}))
        .filter(w=>Number.isFinite(w.id)&&w.name);
      const seen=new Set();
      const unique=fetched.filter(w=>{
        if(seen.has(w.id)) return false;
        seen.add(w.id);
        return true;
      });
      setMfVaultWorkflows(unique);
      addMfLog(`Found ${unique.length} workflows`,'ok');
    }catch(e){addMfLog(e.message,'error');}
    finally{setMfBusy(false);}
  };

  const handleMfPull=async()=>{
    if(!mfVault.trim()){addMfLog('Vault GUID is required','error');return;}
    if(!mfPullQueue.length)return;
    setMfBusy(true);setMfLog([]);addMfLog(`Pulling ${mfPullQueue.length} workflows...`);
    window.mfiles.onProgress(m=>addMfLog(m));
    try{
      const res=await window.mfiles.pullWorkflows({
        workflowIds:mfPullQueue,vaultGuid:mfVault,server:mfServer,authType:mfAuth,username:mfUser,password:mfPass
      });
      if(!res.ok) throw new Error(res.error||'Pull failed');
      (res.workflows||[]).forEach(w=>useWorkflowStore.getState().seedImportedWorkflow(w));
      addMfLog(`Successfully pulled ${(res.workflows||[]).length} workflows into tabs`,'ok');
      setMfPullQueue([]);
    }catch(e){addMfLog(e.message,'error');}
    finally{
      setMfBusy(false);
      try{ window.mfiles.offProgress(); }catch(e){}
    }
  };

  const handleMfPush=async()=>{
    if(!mfVault.trim()){addMfLog('Vault GUID is required','error');return;}
    if(!mfPushQueue.length)return;
    if(!window.mfiles){addMfLog('window.mfiles not found — run in Electron','error');return;}
    setMfBusy(true);setMfLog([]);setMfOk(null);
    addMfLog(`Staging ${mfPushQueue.length} workflows for push...`);
    window.mfiles.onProgress(msg=>addMfLog(msg));
    try{
      for(const id of mfPushQueue){
        const targetWf=workflows.find(w=>w.id===id);
        if(!targetWf)continue;
        addMfLog(`Pushing "${targetWf.name}"...`);
        const json={
          name: targetWf.name||'Unnamed Workflow',
          states: targetWf.states.map(s=>({name:s.name, initial:!!s.initial})),
          transitions: targetWf.transitions.map(t=>({from:t.from, to:t.to, ...(t.conditions?{conditions:t.conditions}:{}), ...(t.permissions?{allowedUsers:t.permissions}:{})})),
        };
        const res=await window.mfiles.pushWorkflow({json,vaultGuid:mfVault,server:mfServer,authType:mfAuth,username:mfUser,password:mfPass});
        if(!res.ok) throw new Error(`${targetWf.name}: ${res.error||'Unknown push error'}`);
      }
      setMfOk(true);
      addMfLog('All staged workflows pushed successfully','ok');
      setMfPushQueue([]);
    }catch(e){
      setMfOk(false);
      addMfLog(e.message,'error');
    }finally{
      setMfBusy(false);
      try{ window.mfiles.offProgress(); }catch(e){}
    }
  };

  const commitTabRename=()=>{if(editTabId&&tabDraft.trim())renameWorkflow(editTabId,tabDraft.trim());setEditTabId(null);setTabDraft('');};

  const hasStates=!!wf?.states.length;
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
      </div>

      {/* ── 3-COLUMN BODY ── */}
      <div className="cc-body" style={{gridTemplateColumns:`${leftOpen?'35%':'0px'} 1fr ${rightOpen?'20%':'0px'}`}}>

        {/* ═══ LEFT — INPUT ═══ */}
        <div className={`cc-left${leftOpen?'':' left-collapsed'}`}>
          {/* Workflow tabs */}
          <div className="cc-wf-tabs-wrap">
            <button className="cc-scroll-arrow left" onClick={()=>scrollTabs(-160)} disabled={!canTabsLeft} title="Scroll workflows left">◀</button>
            <div className={`cc-wf-tabs ${expandTabLabels?'expanded':''}`} ref={wfTabsRef} onScroll={updateTabsScrollState}>
              {workflows.map(w=>(
                <div key={w.id} className={`cc-wf-tab ${w.id===activeId?'active':''} ${w.source==='mfiles'?'imported':''}`} onClick={()=>switchWorkflow(w.id)} onDoubleClick={()=>{setEditTabId(w.id);setTabDraft(w.name);}} title={editTabId===w.id?'Rename workflow':`${w.name} · double-click to rename`}>
                  {editTabId===w.id
                    ?<input style={{background:'transparent',border:'none',outline:'none',fontFamily:'var(--mono)',fontSize:9,color:'var(--text)',width:80}} value={tabDraft} autoFocus onChange={e=>setTabDraft(e.target.value)} onBlur={commitTabRename} onKeyDown={e=>{if(e.key==='Enter')commitTabRename();if(e.key==='Escape')setEditTabId(null);}} onClick={e=>e.stopPropagation()}/>
                    :<span className="cc-wf-tab-name" style={{fontSize:9}}>{w.name}</span>}
                  {workflows.length>1&&<button className="cc-wf-tab-del" onClick={e=>{e.stopPropagation();deleteWorkflow(w.id);}}>✕</button>}
                </div>
              ))}
              <button className="cc-sec-add" style={{marginLeft:4,alignSelf:'center'}} onClick={addWorkflow}>+ Workflow</button>
            </div>
            <button className="cc-tab-expand" onClick={()=>setExpandTabLabels(v=>!v)} title={expandTabLabels?'Compact tab labels':'Expand tab labels'}>{expandTabLabels?'⇤':'⇥'}</button>
            <button className="cc-scroll-arrow right" onClick={()=>scrollTabs(160)} disabled={!canTabsRight} title="Scroll workflows right">▶</button>
          </div>

          {/* Workflow name */}
          {wf&&<div className="cc-wf-bar">
            <input className="cc-wf-name-input" value={wf.name} placeholder="Workflow name…"
              onChange={e=>renameWorkflow(activeId,e.target.value)}/>
            <button className="xb" onClick={()=>{clearWorkflow(activeId);setSel('');}}>↺</button>
          </div>}

          {/* Parse input panel (NLP / AI) */}
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
              {log.length>0&&<div className="log" ref={logRef} onScroll={()=>keepLogAtBottom(logRef.current, logFollowRef)} style={{marginTop:4}}>{log.map((l,i)=><div key={i} ref={i===log.length-1?logTailRef:null} className="ll"><span className="lt">{l.ts}</span><span className={l.t==='ok'?'lok':l.t==='warn'?'lwarn':l.t==='error'?'lerr':'linf'}>{l.msg}</span></div>)}</div>}
            </div>
          )}

          {/* Sections — States, Transitions, Users, Props, Rules */}
          <div className="cc-col-body" ref={leftBodyRef} onScroll={updateLeftScrollState}>
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
                  {filteredStates.map(s=>(<tr key={s.id} className={sel===s.name?'sel-row':''} onClick={()=>setSel(s.name)}
                    onMouseEnter={()=>setHoveredState(s.name)} onMouseLeave={()=>setHoveredState(null)}>
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
                      onMouseEnter={()=>setHoveredTransition(t.from, t.to)} onMouseLeave={()=>setHoveredTransition(null)}
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
                <tbody>{rules.map(r=>(<tr key={r.id} className="rule-row" data-rule-id={r.id} title={r.id}>
                  <td><input value={r.text} placeholder="Business rule…" onChange={e=>updateRule(r.id,e.target.value)}/></td>
                  <td><button className="mini-del" onClick={()=>deleteRule(r.id)}>✕</button></td>
                </tr>))}</tbody>
              </table>}
            </Sec>
          </div>

          <div className="cc-left-scroll-arrows" aria-hidden={!leftOpen}>
            <button className="cc-scroll-arrow up" onClick={()=>scrollLeftPanel(-180)} disabled={!canScrollUp} title="Scroll up">▲</button>
            <button className="cc-scroll-arrow down" onClick={()=>scrollLeftPanel(180)} disabled={!canScrollDown} title="Scroll down">▼</button>
          </div>
        </div>

        {/* ═══ CENTER — LIVE DIAGRAM ═══ */}
        <div className="cc-center">
          <div className="cc-col-head">
            {/* Panel toggle — collapses/expands the left configuration panel */}
            <button className="panel-toggle" onClick={()=>setLeftOpen(o=>!o)}
              title={leftOpen?'Hide panel (more diagram space)':'Show panel'}>
              {leftOpen?'‹':'›'}
            </button>
            <span className="cc-col-lbl">
              {sel ? `State — ${sel}` : selTransObj ? `→ ${selTransObj.from} → ${selTransObj.to}` : 'Live Diagram'}
            </span>
            <div className="tab-row">
              <div style={{display:'flex',gap:2,marginRight:6,padding:'2px',border:'1px solid var(--border)',borderRadius:6,background:'var(--s2)'}}>
                {VIEW_MODES.map(([id,lbl])=> (
                  <button
                    key={id}
                    className={`tab ${viewMode===id?'on':''}`}
                    onClick={()=>setViewMode(id)}
                    title={`${lbl} overlay`}
                    style={{padding:'3px 7px'}}
                  >{lbl}</button>
                ))}
              </div>
              {[['diagram','Diagram'],['json','JSON'],['stats','Stats']].map(([id,lbl])=>(
                <button key={id} className={`tab ${centerView===id?'on':''}`} onClick={()=>setCenterView(id)}>{lbl}</button>
              ))}
              {/* Right panel toggle — mirrors left panel button */}
              <button className="panel-toggle" onClick={()=>setRightOpen(o=>!o)}
                title={rightOpen?'Hide Deliver panel':'Show Deliver panel'}
                style={{marginLeft:6}}>
                {rightOpen?'›':'‹'}
              </button>
            </div>
          </div>
          {centerView==='diagram'&&(
            <div className="diagram-wrap" ref={wrapRef} onClick={()=>{setSel('');setSelTrans(null);}}>
              <div
                onClick={e=>e.stopPropagation()}
                style={{
                  position:'absolute',
                  top:14,
                  left:16,
                  zIndex:30,
                  width:'min(320px, calc(100% - 32px))',
                  padding:'10px 12px',
                  border:'1px solid var(--border)',
                  borderRadius:10,
                  background:'rgba(5,14,26,.88)',
                  backdropFilter:'blur(8px)',
                  boxShadow:'0 6px 18px rgba(0,0,0,.28)',
                }}
              >
                <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:8}}>
                  <strong style={{fontSize:10,letterSpacing:'.7px',textTransform:'uppercase',color:'var(--a3)'}}>{overlay.title}</strong>
                  <span style={{fontSize:10,lineHeight:1.45,color:'var(--mid)'}}>{overlay.subtitle}</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'minmax(88px, auto) 1fr',gap:'6px 10px',alignItems:'start'}}>
                  {overlay.items.map(([label, value]) => (
                    <>
                      <span key={`${label}-label`} style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.5px',color:'var(--mid)'}}>{label}</span>
                      <span key={`${label}-value`} style={{fontSize:10.5,lineHeight:1.45,color:'var(--text)',wordBreak:'break-word'}}>{value}</span>
                    </>
                  ))}
                </div>
              </div>
              {!mermaidStr
                ?<div key="empty" className="blueprint-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                  <div className="blueprint-title">No Diagram Available</div>
                  <div className="blueprint-sub">{wf ? 'Add at least one state and mark it as "Initial" to begin building the diagram.' : 'Create a new workflow, parse a Markdown file, or import from M-Files to get started.'}</div>
                </div>
                :<div key="diagram" ref={diagRef} style={{width:'100%'}} onClick={e=>e.stopPropagation()}/>}
              {mermaidStr&&zoom!==1&&(
                <div className="zoom-badge" onClick={e=>e.stopPropagation()}>
                  <span>{Math.round(zoom*100)}%</span>
                  <button title="Reset zoom (Ctrl+Scroll)" onClick={()=>{setZoom(1);zoomRef.current=1;}}>⟳</button>
                </div>
              )}

              <div className={`cc-edge-search ${showEdgeSearch?'open':'closed'}`} onClick={e=>e.stopPropagation()}>
                {showEdgeSearch
                  ?<>
                    <button className="xb" onClick={()=>setCmdPaletteOpen(true)} title="Open search menu">⌕ Search</button>
                    <button className="cc-edge-toggle" onClick={()=>setShowEdgeSearch(false)} title="Hide search control">›</button>
                  </>
                  :<button className="cc-edge-toggle" onClick={()=>setShowEdgeSearch(true)} title="Show search control">‹</button>}
              </div>

              {mermaidStr&&zoom!==1&&<div className="cc-toolbar" onClick={e=>e.stopPropagation()}>
                <button className="xb" onClick={()=>{setZoom(1);zoomRef.current=1;if(wrapRef.current){wrapRef.current.scrollTop=0;wrapRef.current.scrollLeft=0;}}} title="Reset Zoom">⟳ Recenter</button>
              </div>}
            </div>
          )}
          {centerView==='json'&&(
            <div className="cc-col-body" style={{padding:'14px 16px'}}>
              <pre style={{fontFamily:'var(--mono)',fontSize:10,lineHeight:1.7,color:'var(--text)',whiteSpace:'pre-wrap'}}>
                {JSON.stringify(jsonView, null, 2)}
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
        <div className={`cc-right${rightOpen?'':' right-collapsed'}`}>
          <div className="cc-col-head" style={{gap:8}}>
            <span className="cc-col-lbl">{rightPanelMode==='target' ? 'Inspector' : 'Deliver'}</span>
            <div style={{display:'flex',gap:4,marginLeft:'auto',marginRight:8,background:'var(--s2)',padding:3,borderRadius:4,border:'1px solid var(--border)'}}>
              <button className="tab" onClick={()=>setRightPanelMode('target')} style={{padding:'3px 7px',background:rightPanelMode==='target'?'var(--s3)':'transparent',borderColor:rightPanelMode==='target'?'var(--border)':'transparent',color:rightPanelMode==='target'?'var(--text)':'var(--mid)'}}>Inspector</button>
              <button className="tab" onClick={()=>setRightPanelMode('deliver')} style={{padding:'3px 7px',background:rightPanelMode==='deliver'?'var(--s3)':'transparent',borderColor:rightPanelMode==='deliver'?'var(--border)':'transparent',color:rightPanelMode==='deliver'?'var(--text)':'var(--mid)'}}>Deliver</button>
            </div>
            {rightPanelMode==='deliver' && syncMode !== 'export' && <span className={`status-pulse ${mfBusy ? 'amber' : (mfVault ? 'green' : 'dim')}`} title={mfBusy ? 'Syncing...' : (mfVault ? 'Connected' : 'Disconnected')} />}
          </div>
          <div className="cc-col-body">
            {rightPanelMode==='target' ? (
              <TargetInspectorPanel targetInspector={targetInspector} />
            ) : (
              <>

            {/* SOW */}
            <div className="deliver-section">
              <div className="deliver-section-lbl">Documents</div>
              <div className="deliver-row">
                <div className="deliver-icon">📄</div>
                <div className="deliver-info">
                  <div className="deliver-title">SOW</div>
                  <div className="deliver-sub">Statement of Work · .md</div>
                </div>
                <button className={`xb ${hasStates?'blue':''}`} disabled={!hasStates} onClick={handleSOW}>↓</button>
              </div>
              <div className="deliver-row">
                <div className="deliver-icon">📋</div>
                <div className="deliver-info">
                  <div className="deliver-title">PRD</div>
                  <div className="deliver-sub">Product Requirements · .md</div>
                </div>
                <button className={`xb ${hasStates?'green':''}`} disabled={!hasStates} onClick={handlePRD}>↓</button>
              </div>
            </div>

            {/* M-Files */}
            <div className="deliver-section">
              <div className="deliver-section-lbl">M-Files Sync</div>
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

              {!mfVault.trim()&&<div style={{fontSize:8.5,color:'var(--red)',marginTop:4,lineHeight:1.6}}>A Vault GUID is required to connect.</div>}

              {/* Unified Sync Menu */}
              <div style={{marginTop:12,borderTop:'1px solid var(--border)',paddingTop:8}}>
                <div style={{display:'flex',gap:4,marginBottom:8,background:'var(--s2)',padding:3,borderRadius:4,border:'1px solid var(--border)'}}>
                  <button onClick={()=>{setSyncMode('export');setMfOk(null);setMfLog([]);}} style={{flex:1,padding:'4px 0',fontSize:9,fontFamily:'var(--mono)',background:syncMode==='export'?'var(--s3)':'transparent',color:syncMode==='export'?'var(--text)':'var(--mid)',border:syncMode==='export'?'1px solid var(--border)':'1px solid transparent',borderRadius:3,cursor:'pointer',transition:'all 0.15s'}}>
                    Export to Vault
                  </button>
                  <button onClick={()=>{setSyncMode('import');setMfOk(null);setMfLog([]);setMfPullQueue([]);setMfVaultWorkflows([]);}} style={{flex:1,padding:'4px 0',fontSize:9,fontFamily:'var(--mono)',background:syncMode==='import'?'var(--s3)':'transparent',color:syncMode==='import'?'var(--text)':'var(--mid)',border:syncMode==='import'?'1px solid var(--border)':'1px solid transparent',borderRadius:3,cursor:'pointer',transition:'all 0.15s'}}>
                    Import from Vault
                  </button>
                </div>

                {syncMode==='export' && (
                  <div>
                    <SyncQueue available={workflows} queue={mfPushQueue} setQueue={setMfPushQueue} stagedLabel="Staged for Push" />
                    <button className={`xb ${saveFlash?'green':''}`} style={{width:'100%',padding:'6px 0',fontSize:10,marginTop:6}} onClick={handleSave} disabled={mfBusy||!mfVault.trim()||!mfPushQueue.length}>
                      {saveFlash?'✓ Saved':'Review & Save →'}
                    </button>
                    <button className={`xb ${mfOk===true?'green':mfOk===false?'red':'blue'}`} style={{width:'100%',padding:'6px 0',fontSize:10,marginTop:6}} onClick={handleMfPush} disabled={mfBusy||!saved||!mfVault.trim()||!mfPushQueue.length}>
                      {mfBusy?'Pushing…':mfOk===true?'✓ Pushed':mfOk===false?'✗ Retry Push':'→ Push Staged'}
                    </button>
                    {(!saved||!mfPushQueue.length||!mfVault.trim())&&<div style={{fontSize:8.5,color:'var(--mid)',marginTop:4,textAlign:'center'}}>
                      {!mfPushQueue.length?'Select at least one workflow to export':!mfVault.trim()?'Connect to a vault to continue':'Click “Review & Save” to enable push'}
                    </div>}
                  </div>
                )}

                {syncMode==='import' && (
                  <div>
                    {mfVaultWorkflows.length===0 ? (
                      <button className="xb" style={{width:'100%',padding:'6px 0',fontSize:10}} onClick={handleMfFetch} disabled={mfBusy||!mfVault.trim()}>
                        {mfBusy?'Fetching…':'Fetch Vault Workflows'}
                      </button>
                    ) : (
                      <>
                        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:4}}>
                          <button onClick={handleMfFetch} disabled={mfBusy||!mfVault.trim()} style={{background:'none',border:'none',color:'var(--a2)',cursor:'pointer',fontSize:9,fontFamily:'var(--mono)'}}>⟳ Refresh List</button>
                        </div>
                        <SyncQueue available={mfVaultWorkflows} queue={mfPullQueue} setQueue={setMfPullQueue} stagedLabel="Staged for Pull" />
                        <button className="xb green" style={{width:'100%',padding:'6px 0',fontSize:10,marginTop:6}} onClick={handleMfPull} disabled={mfBusy||!mfVault.trim()||!mfPullQueue.length}>
                          {mfBusy?'Pulling…':'← Pull Staged into Tabs'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {mfLog.length>0&&<div className="mf-log" ref={mfLogRef} onScroll={()=>keepLogAtBottom(mfLogRef.current, mfLogFollowRef)} style={{marginTop:12}}>{mfLog.map((l,i)=><div key={i} ref={i===mfLog.length-1?mfLogTailRef:null} className="ll"><span className="lt">{l.ts}</span><span className={l.t==='ok'?'lok':l.t==='error'?'lerr':'linf'}>{l.msg}</span></div>)}</div>}
            </div>
              </>
            )}
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

function SyncQueue({ available, queue, setQueue, stagedLabel }) {
  const unqueued = available.filter(w => !queue.includes(w.id));
  return (
    <div className="q-list">
      {unqueued.length > 0 && (
        <div style={{maxHeight: 130, overflowY: unqueued.length > 5 ? 'auto' : 'visible'}}>
          {unqueued.map(w => (
            <div key={w.id} className="q-row">
              <span className="q-name">{w.name}</span>
              <button className="q-btn add" onClick={() => setQueue(q => [...q, w.id])}>+</button>
            </div>
          ))}
        </div>
      )}
      {queue.length > 0 && <div className="q-staged-lbl">{stagedLabel}</div>}
      {queue.map(id => {
        const w = available.find(x => x.id === id);
        if (!w) return null;
        return (
          <div key={w.id} className="q-row staged">
            <span className="q-name">{w.name}</span>
            <button className="q-btn del" onClick={() => setQueue(q => q.filter(x => x !== id))}>✕</button>
          </div>
        );
      })}
    </div>
  );
}

function TargetInspectorPanel({ targetInspector }) {
  return (
    <div style={{padding:12,display:'flex',flexDirection:'column',gap:10}}>
      <div className="deliver-section" style={{padding:0,borderBottom:'none',gap:10}}>
        <div className="deliver-section-lbl">XState Inspector</div>
        <div style={{border:'1px solid var(--border)',borderRadius:8,background:'var(--s2)',padding:10}}>
          <div style={{fontSize:9,color:'var(--mid)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:6}}>Selected State</div>
          <div style={{fontSize:13,fontWeight:600,color:'var(--text)',marginBottom:8}}>{targetInspector.stateName}</div>
          <div style={{display:'grid',gridTemplateColumns:'88px 1fr',gap:'6px 8px',fontSize:9.5}}>
            <span style={{color:'var(--mid)',textTransform:'uppercase'}}>Machine</span><span style={{color:'var(--text)',wordBreak:'break-word'}}>{targetInspector.xstateMachineId || 'Unavailable'}</span>
            <span style={{color:'var(--mid)',textTransform:'uppercase'}}>State Id</span><span style={{color:'var(--a3)',wordBreak:'break-word'}}>{`states.${targetInspector.stateId}`}</span>
            <span style={{color:'var(--mid)',textTransform:'uppercase'}}>Entry</span><span style={{color:'var(--text)',wordBreak:'break-word'}}>{targetInspector.xstateState?.entry || 'None'}</span>
            <span style={{color:'var(--mid)',textTransform:'uppercase'}}>Exit</span><span style={{color:'var(--text)',wordBreak:'break-word'}}>{targetInspector.xstateState?.exit || 'None'}</span>
          </div>
        </div>

        <div style={{border:'1px solid var(--border)',borderRadius:8,background:'var(--s2)',padding:10}}>
          <div style={{fontSize:9,color:'var(--mid)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:6}}>Transitions</div>
          {targetInspector.xstateState?.on && Object.keys(targetInspector.xstateState.on).length ? (
            Object.entries(targetInspector.xstateState.on).map(([eventName, config]) => (
              <div key={eventName} style={{padding:'8px 0',borderTop:'1px solid rgba(255,255,255,.05)'}}>
                <div style={{fontSize:10.5,color:'var(--a3)',marginBottom:4}}>{eventName}</div>
                <div style={{fontSize:9.5,color:'var(--text)'}}>Target: {config.target || 'None'}</div>
                <div style={{fontSize:9.5,color:'var(--text)'}}>Guard: {config.guard || 'None'}</div>
              </div>
            ))
          ) : <div style={{fontSize:9.5,color:'var(--mid)'}}>No outgoing transitions compiled for this state.</div>}
        </div>

        <div style={{border:'1px solid var(--border)',borderRadius:8,background:'var(--s2)',padding:10}}>
          <div style={{fontSize:9,color:'var(--mid)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:6}}>n8n Mapping</div>
          <div style={{display:'grid',gridTemplateColumns:'88px 1fr',gap:'6px 8px',fontSize:9.5}}>
            <span style={{color:'var(--mid)',textTransform:'uppercase'}}>Node</span><span style={{color:'var(--text)',wordBreak:'break-word'}}>{targetInspector.n8nStateNode?.id || 'Unavailable'}</span>
            <span style={{color:'var(--mid)',textTransform:'uppercase'}}>Type</span><span style={{color:'var(--text)'}}>{targetInspector.n8nStateNode?.type || 'Unknown'}</span>
            <span style={{color:'var(--mid)',textTransform:'uppercase'}}>Webhook</span><span style={{color:'var(--text)',wordBreak:'break-word'}}>{targetInspector.n8nStateNode?.webhookPath || 'None'}</span>
            <span style={{color:'var(--mid)',textTransform:'uppercase'}}>Connector</span><span style={{color:'var(--text)'}}>{targetInspector.n8nStateNode?.connector || 'Unknown'}</span>
          </div>
        </div>

        <div style={{border:'1px solid var(--border)',borderRadius:8,background:'var(--s2)',padding:10}}>
          <div style={{fontSize:9,color:'var(--mid)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:6}}>Focused Edge</div>
          {targetInspector.transition ? (
            <div style={{display:'grid',gridTemplateColumns:'88px 1fr',gap:'6px 8px',fontSize:9.5}}>
              <span style={{color:'var(--mid)',textTransform:'uppercase'}}>Path</span><span style={{color:'var(--text)'}}>{`${targetInspector.transition.from} -> ${targetInspector.transition.to}`}</span>
              <span style={{color:'var(--mid)',textTransform:'uppercase'}}>Event</span><span style={{color:'var(--a3)',wordBreak:'break-word'}}>{targetInspector.transition.eventType}</span>
              <span style={{color:'var(--mid)',textTransform:'uppercase'}}>Guard</span><span style={{color:'var(--text)'}}>{targetInspector.transition.guard || 'None'}</span>
              <span style={{color:'var(--mid)',textTransform:'uppercase'}}>n8n Edge</span><span style={{color:'var(--text)',wordBreak:'break-word'}}>{targetInspector.transition.nodeId}</span>
            </div>
          ) : <div style={{fontSize:9.5,color:'var(--mid)'}}>Double-click an edge to inspect its compiled event and guard mapping.</div>}
        </div>
      </div>
    </div>
  );
}

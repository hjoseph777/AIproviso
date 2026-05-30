import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkflowStore } from './store/useWorkflowStore';
import WorkflowModeSelector from './canvas/WorkflowModeSelector';
import CanvasSurface from './canvas/CanvasSurface';
import CanvasInspector from './canvas/CanvasInspector';
import { useExport } from '../../hooks/useExport';
import {
  AP_WORKFLOW_TEMPLATES,
  serializeWorkflowPaletteItem,
  WORKFLOW_PALETTE_MIME,
  setGlobalWorkflowPaletteDragItem,
} from './palette/workflowPalette';
import {
  buildCanonicalWorkflowIR,
  compileToN8n,
  compileToXState,
  eventTypeForTransition,
  normalizeNodeId,
} from './engine/workflowIR';

const VIEW_MODES = [['business', 'Business'], ['runtime', 'Runtime'], ['target', 'Target']];
const SIM_DEFAULT_CONTEXT = {
  amount: 24000,
  confidence: 0.84,
  hasPo: true,
  overdueHours: 0,
};

function extractThresholdNumber(text = '') {
  const normalized = String(text || '').toLowerCase();
  const amountMatch = normalized.match(/(\d+(?:\.\d+)?)\s*k/);
  if (amountMatch) return Number.parseFloat(amountMatch[1]) * 1000;

  const plainMatch = normalized.match(/\$?\s*(\d+(?:\.\d+)?)/);
  if (plainMatch) return Number.parseFloat(plainMatch[1]);
  return null;
}

function evaluateTransitionGuard(transition, context) {
  const source = [
    transition?.guard_id,
    transition?.conditions,
    transition?.label,
    transition?.xstate?.guardName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!source.trim()) return { match: true, reason: 'default' };

  if (/no\s*po|missing\s*po|without\s*po/.test(source)) {
    return { match: !context.hasPo, reason: 'missing-po' };
  }
  if (/po\s*match|po\s*found|has\s*po/.test(source)) {
    return { match: context.hasPo, reason: 'po-match' };
  }

  if (/conf|confidence/.test(source)) {
    const threshold = extractThresholdNumber(source);
    if (threshold !== null && threshold <= 1.5) {
      if (/<=|under|below|less/.test(source)) return { match: context.confidence <= threshold, reason: `confidence<=${threshold}` };
      if (/>=|over|above|greater/.test(source)) return { match: context.confidence >= threshold, reason: `confidence>=${threshold}` };
    }
  }

  if (/after|overdue|timeout|escalat/.test(source)) {
    const hours = extractThresholdNumber(source);
    if (hours !== null) return { match: context.overdueHours >= hours, reason: `overdue>=${hours}` };
  }

  const amountThreshold = extractThresholdNumber(source);
  if (amountThreshold !== null) {
    if (/<=|under|below|less/.test(source)) return { match: context.amount <= amountThreshold, reason: `amount<=${amountThreshold}` };
    if (/>=|over|above|greater/.test(source)) return { match: context.amount >= amountThreshold, reason: `amount>=${amountThreshold}` };
  }

  return { match: true, reason: 'fallback' };
}

function getSelectedTransition(wf, selTrans) {
  if (!wf?.transitions?.length || !selTrans) return null;
  return wf.transitions.find((transition) => (
    normalizeNodeId(transition.from) === selTrans.fromId && normalizeNodeId(transition.to) === selTrans.toId
  )) || null;
}

function buildViewJson({ wf, sel, selTrans, externalSelection, rules, viewMode, workflowIR, xstateSpec, n8nSpec }) {
  const activeTransition = getSelectedTransition(wf, selTrans)
    || (externalSelection?.transition?.from && externalSelection?.transition?.to ? externalSelection.transition : null);
  const stateName = sel || externalSelection?.stateName || wf?.states?.find((state) => state.initial)?.name || 'Draft';
  const eventType = eventTypeForTransition(activeTransition);
  const stateId = normalizeNodeId(stateName).toLowerCase();

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

export default function WorkflowDesignerShell({ externalSelection = null, embedded = false } = {}) {
  const workflows = useWorkflowStore((s) => s.workflows);
  const activeId = useWorkflowStore((s) => s.activeId);
  const getActive = useWorkflowStore((s) => s.getActive);
  const setActive = useWorkflowStore((s) => s.setActive);
  const addWorkflow = useWorkflowStore((s) => s.addWorkflow);
  const deleteWorkflow = useWorkflowStore((s) => s.deleteWorkflow);
  const renameWorkflow = useWorkflowStore((s) => s.renameWorkflow);
  const resetAll = useWorkflowStore((s) => s.resetAll);
  const seedStressTest = useWorkflowStore((s) => s.seedStressTest);
  const addCanvasNode = useWorkflowStore((s) => s.addCanvasNode);
  const activeDefinition = useWorkflowStore((s) => s.activeDefinition);
  const rfNodes = useWorkflowStore((s) => s.rfNodes);
  const rfEdges = useWorkflowStore((s) => s.rfEdges);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const selectEdge = useWorkflowStore((s) => s.selectEdge);
  const validationIssues = useWorkflowStore((s) => s.validationIssues);
  const publishActiveWorkflow = useWorkflowStore((s) => s.publishActiveWorkflow);
  const lastPublishError = useWorkflowStore((s) => s.lastPublishError);
  const lastPublishedAt = useWorkflowStore((s) => s.lastPublishedAt);

  const isDirty              = useWorkflowStore((s) => s.isDirty);
  const lastSavedAt          = useWorkflowStore((s) => s.lastSavedAt);
  const saveActiveWorkflow   = useWorkflowStore((s) => s.saveActiveWorkflow);
  const bootstrapFromBackend = useWorkflowStore((s) => s.bootstrapFromBackend);
  const publishActiveWorkflowToBackend = useWorkflowStore((s) => s.publishActiveWorkflowToBackend);

  const users = useWorkflowStore((s) => s.users);
  const properties = useWorkflowStore((s) => s.properties);
  const rules = useWorkflowStore((s) => s.rules);
  const hasCanvasSelection = Boolean(selectedNodeId || selectedEdgeId);

  // ── Bootstrap on mount: load from backend, or show Workflow Studio ─────────
  const [bootstrapping, setBootstrapping] = useState(true);
  const [showModeSelector, setShowModeSelector] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await bootstrapFromBackend();
        if (!cancelled) {
          // No saved workflows found → present the mode selector so the user
          // can choose how to start (template / blank / AI / preset default)
          if (!loaded) setShowModeSelector(true);
        }
      } catch {
        if (!cancelled) setShowModeSelector(true);
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced auto-save: fires 2 s after last isDirty change ───────────────
  const autoSaveTimerRef = useRef(null);
  useEffect(() => {
    if (!isDirty) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => { saveActiveWorkflow(); }, 2000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [isDirty, activeId, saveActiveWorkflow]);

  const [centerView, setCenterView] = useState('canvas');

  // ── Handle mode selector result ──────────────────────────────────────────────
  const handleModeSelect = ({ mode, template, parsed, name, preset }) => {
    setShowModeSelector(false);
    const store = useWorkflowStore.getState();

    if (mode === 4 && preset) {
      // Preset Default — create a named COPY; the original preset is never modified
      store.importWorkflow({
        workflow: {
          name: name || preset.name,
          states: preset.states,
          transitions: preset.transitions,
        },
      });
      return;
    }

    if (mode === 2) {
      // Draw from Scratch — create empty workflow then rename it
      store.addWorkflow();
      const newId = useWorkflowStore.getState().activeId;
      if (name?.trim()) store.renameWorkflow(newId, name.trim());
    } else if (mode === 1 && template) {
      // Rapid Fire — seed from template
      store.importWorkflow({
        workflow: {
          name: name || template.name,
          states: template.states,
          transitions: template.transitions,
        },
      });
    } else if (mode === 3 && parsed) {
      // AI Generated — seed from parsed scenario
      store.importWorkflow({
        workflow: {
          name: name || 'AI Generated Workflow',
          states: parsed.states,
          transitions: parsed.transitions,
        },
      });
    }
  };
  const [viewMode, setViewMode] = useState('business');
  const [tabDraft, setTabDraft] = useState('');
  const [editTabId, setEditTabId] = useState(null);
  const [inspectorPinnedOpen, setInspectorPinnedOpen] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [inspectorHiddenByHandle, setInspectorHiddenByHandle] = useState(true);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [simulationActiveStateId, setSimulationActiveStateId] = useState(null);
  const [simulationHistory, setSimulationHistory] = useState([]);
  const [simulationContext, setSimulationContext] = useState(SIM_DEFAULT_CONTEXT);
  const simulationTimerRef = useRef(null);
  const lastPaletteDragAtRef = useRef(0);
  const { exportJSON } = useExport();
  const inspectorVisible = !inspectorHiddenByHandle;
  const leftVisible = leftPanelOpen;
  const panelGridTemplate = leftVisible
    ? (inspectorVisible ? '300px minmax(0,1fr) 320px' : '300px minmax(0,1fr) 0px')
    : (inspectorVisible ? '0px minmax(0,1fr) 320px' : '0px minmax(0,1fr) 0px');
  const embeddedGridTemplate = panelGridTemplate;

  const wf = getActive();

  const sel = useMemo(() => {
    if (!selectedNodeId || !activeDefinition) return '';
    return activeDefinition.nodes.find((node) => node.id === selectedNodeId)?.name || '';
  }, [activeDefinition, selectedNodeId]);

  const selTrans = useMemo(() => {
    if (!selectedEdgeId || !activeDefinition) return null;
    const edge = activeDefinition.edges.find((candidate) => candidate.id === selectedEdgeId);
    if (!edge) return null;
    const fromName = activeDefinition.nodes.find((node) => node.id === edge.from_node_id)?.name || '';
    const toName = activeDefinition.nodes.find((node) => node.id === edge.to_node_id)?.name || '';
    if (!fromName || !toName) return null;
    return {
      fromId: normalizeNodeId(fromName),
      toId: normalizeNodeId(toName),
    };
  }, [activeDefinition, selectedEdgeId]);

  const workflowIR = useMemo(() => buildCanonicalWorkflowIR(wf, rules), [wf, rules]);
  const xstateSpec = useMemo(() => compileToXState(workflowIR), [workflowIR]);
  const n8nSpec = useMemo(() => compileToN8n(workflowIR), [workflowIR]);
  const jsonView = useMemo(
    () => buildViewJson({ wf, sel, selTrans, externalSelection, rules, viewMode, workflowIR, xstateSpec, n8nSpec }),
    [wf, sel, selTrans, externalSelection, rules, viewMode, workflowIR, xstateSpec, n8nSpec],
  );
  const errorCount = useMemo(
    () => (validationIssues || []).filter((issue) => issue.severity === 'error').length,
    [validationIssues],
  );
  const warningCount = useMemo(
    () => (validationIssues || []).filter((issue) => issue.severity !== 'error').length,
    [validationIssues],
  );

  const stateIdByName = useMemo(() => {
    if (!activeDefinition?.nodes?.length) return new Map();
    return new Map(activeDefinition.nodes.map((node) => [normalizeNodeId(node.name).toLowerCase(), node.id]));
  }, [activeDefinition]);

  const edgeIdByRoute = useMemo(() => {
    if (!wf?.transitions?.length || !activeDefinition?.edges?.length || !activeDefinition?.nodes?.length) return new Map();
    const nodeNameById = new Map(activeDefinition.nodes.map((node) => [node.id, node.name]));
    const edgeByRoute = new Map();
    activeDefinition.edges.forEach((edge) => {
      const fromName = nodeNameById.get(edge.from_node_id);
      const toName = nodeNameById.get(edge.to_node_id);
      if (!fromName || !toName) return;
      edgeByRoute.set(`${normalizeNodeId(fromName).toLowerCase()}::${normalizeNodeId(toName).toLowerCase()}`, edge.id);
    });
    return edgeByRoute;
  }, [activeDefinition, wf]);

  const stateNameByKey = useMemo(() => {
    if (!activeDefinition?.nodes?.length) return new Map();
    return new Map(activeDefinition.nodes.map((node) => [normalizeNodeId(node.name).toLowerCase(), node.name]));
  }, [activeDefinition]);

  const terminalStateKeys = useMemo(() => {
    if (!activeDefinition?.nodes?.length) return new Set();
    return new Set(
      activeDefinition.nodes
        .filter((node) => node.state_kind === 'terminal')
        .map((node) => normalizeNodeId(node.name).toLowerCase()),
    );
  }, [activeDefinition]);

  const stopSimulation = () => {
    setSimulationRunning(false);
    if (simulationTimerRef.current) {
      window.clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
  };

  const resetSimulation = () => {
    stopSimulation();
    setSimulationActiveStateId(null);
    setSimulationHistory([]);
    setSimulationContext(SIM_DEFAULT_CONTEXT);
    selectNode(null);
    selectEdge(null);
  };

  const stepSimulation = useCallback(() => {
    if (!wf?.states?.length) return;
    const states = wf.states || [];
    const transitions = wf.transitions || [];
    const stateByName = new Map(states.map((state) => [normalizeNodeId(state.name).toLowerCase(), state]));

    let currentState = simulationActiveStateId
      ? stateByName.get(simulationActiveStateId)
      : states.find((state) => state.initial) || states[0];

    if (!currentState) return;

    if (!simulationActiveStateId) {
      const normalized = normalizeNodeId(currentState.name).toLowerCase();
      setSimulationActiveStateId(normalized);
      selectNode(stateIdByName.get(normalized) || null);
      setSimulationHistory((prev) => ([
        ...prev,
        { ts: new Date().toISOString(), kind: 'start', from: null, to: currentState.name, event: 'start' },
      ]));
      return;
    }

    if (terminalStateKeys.has(simulationActiveStateId)) {
      setSimulationHistory((prev) => {
        const last = prev[prev.length - 1];
        if (last?.kind === 'complete') return prev;
        return [
          ...prev,
          {
            ts: new Date().toISOString(),
            kind: 'complete',
            from: currentState.name,
            to: currentState.name,
            event: 'terminal-complete',
          },
        ];
      });
      stopSimulation();
      return;
    }

    const outgoing = transitions.filter((transition) => (
      normalizeNodeId(transition.from).toLowerCase() === simulationActiveStateId
    ));

    if (!outgoing.length) {
      setSimulationHistory((prev) => ([
        ...prev,
        {
          ts: new Date().toISOString(),
          kind: 'stalled',
          from: currentState.name,
          to: currentState.name,
          event: 'no-outgoing-transition',
        },
      ]));
      stopSimulation();
      return;
    }

    const resolved = outgoing
      .map((transition) => ({ transition, verdict: evaluateTransitionGuard(transition, simulationContext) }));
    const nextResolved = resolved.find((candidate) => candidate.verdict.match) || resolved[0];
    const nextTransition = nextResolved.transition;
    const nextStateKey = normalizeNodeId(nextTransition.to).toLowerCase();
    setSimulationActiveStateId(nextStateKey);
    selectNode(stateIdByName.get(nextStateKey) || null);
    selectEdge(edgeIdByRoute.get(`${normalizeNodeId(nextTransition.from).toLowerCase()}::${nextStateKey}`) || null);
    setSimulationHistory((prev) => ([
      ...prev,
      {
        ts: new Date().toISOString(),
        kind: 'transition',
        from: nextTransition.from,
        to: nextTransition.to,
        event: `${nextTransition.xstate?.eventType || nextTransition.label || 'transition'} [${nextResolved.verdict.reason}]`,
      },
    ]));
  }, [edgeIdByRoute, selectEdge, selectNode, simulationActiveStateId, simulationContext, stateIdByName, terminalStateKeys, wf]);

  const startSimulation = () => {
    if (simulationRunning) return;
    setCenterView('simulation');
    setSimulationRunning(true);
    if (!simulationActiveStateId) stepSimulation();
  };

  const handlePublish = () => {
    if (errorCount > 0) {
      const proceed = window.confirm(
        `${errorCount} blocking validation issue(s) found. Publish anyway and bypass gate?`,
      );
      if (!proceed) return;
      publishActiveWorkflow({ allowInvalid: true });
      return;
    }
    publishActiveWorkflow({ allowInvalid: false });
  };

  useEffect(() => {
    stopSimulation();
    setSimulationActiveStateId(null);
    setSimulationHistory([]);
  }, [activeId]);

  useEffect(() => {
    if (!simulationRunning) {
      if (simulationTimerRef.current) {
        window.clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
      return;
    }

    const interval = Math.max(250, Math.round(1000 / Math.max(simulationSpeed, 0.5)));
    simulationTimerRef.current = window.setInterval(() => {
      stepSimulation();
    }, interval);

    return () => {
      if (simulationTimerRef.current) {
        window.clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
    };
  }, [simulationRunning, simulationSpeed, simulationActiveStateId, wf, stepSimulation]);

  useEffect(() => {
    if (!externalSelection) return;

    // When the user is actively interacting with canvas selections (including new drops),
    // avoid immediately overriding that selection from external runtime context.
    if (selectedNodeId || selectedEdgeId) return;

    setCenterView('canvas');

    if (externalSelection.transition?.from && externalSelection.transition?.to) {
      const transition = (wf?.transitions || []).find((candidate) => (
        candidate.from === externalSelection.transition.from && candidate.to === externalSelection.transition.to
      ));
      selectEdge(transition?.id || null);
      return;
    }

    if (externalSelection.stateName) {
      const stateRecord = (wf?.states || []).find((state) => state.name === externalSelection.stateName);
      selectNode(stateRecord?.id || null);
    }
  }, [externalSelection?.stateName, externalSelection?.transition?.from, externalSelection?.transition?.to, selectEdge, selectNode, selectedEdgeId, selectedNodeId, wf]);

  const commitTabRename = () => {
    if (editTabId && tabDraft.trim()) renameWorkflow(editTabId, tabDraft.trim());
    setEditTabId(null);
    setTabDraft('');
  };

  const startPaletteDrag = (event, item) => {
    lastPaletteDragAtRef.current = Date.now();
    const serialized = serializeWorkflowPaletteItem(item);
    event.dataTransfer.setData(WORKFLOW_PALETTE_MIME, serialized);
    event.dataTransfer.setData('application/reactflow', item?.stateKind || 'standard');
    event.dataTransfer.setData('application/nodeLabel', item?.name || item?.label || 'New State');
    event.dataTransfer.setData('text/plain', serialized);
    event.dataTransfer.effectAllowed = 'move';
    setGlobalWorkflowPaletteDragItem(item);
  };

  const handlePaletteQuickAdd = (item) => {
    if ((Date.now() - lastPaletteDragAtRef.current) < 260) return;
    addCanvasNode({ stateKind: item.stateKind, name: item.name });
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!embedded) return;

      const target = event.target;
      const isInput = target instanceof HTMLElement && (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT'
        || target.isContentEditable
      );
      if (isInput) return;

      if (event.key?.toLowerCase() !== 'i') return;
      event.preventDefault();
      if (inspectorVisible) {
        setInspectorHiddenByHandle(true);
        setInspectorPinnedOpen(false);
        return;
      }

      setInspectorHiddenByHandle(false);
      setInspectorPinnedOpen(true);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [embedded]);

  // ── Loading screen while checking backend ────────────────────────────────
  if (bootstrapping) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', flexDirection: 'column', gap: 12,
        background: 'var(--bg, #030910)', color: 'var(--mid, #5878A0)',
        fontFamily: 'var(--mono)', fontSize: 11,
      }}>
        <div className="spin" style={{ width: 18, height: 18 }} />
        <span>Loading workspace…</span>
      </div>
    );
  }

  return (
    <>
    <div className={`cc-shell${embedded ? ' cc-embedded' : ''}`}>

      <div
        className="cc-body"
        style={{ gridTemplateColumns: panelGridTemplate }}
      >
        <div className={`cc-left${leftVisible ? '' : ' left-collapsed'}`}>
          <div className="cc-wf-tabs-wrap">
            <div className="cc-wf-tabs expanded">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className={`cc-wf-tab ${workflow.id === activeId ? 'active' : ''}`}
                  onClick={() => setActive(workflow.id)}
                  onDoubleClick={() => {
                    setEditTabId(workflow.id);
                    setTabDraft(workflow.name);
                  }}
                  title="Double-click to rename workflow"
                >
                  {editTabId === workflow.id ? (
                    <input
                      style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text)', width: 120 }}
                      value={tabDraft}
                      autoFocus
                      onChange={(event) => setTabDraft(event.target.value)}
                      onBlur={commitTabRename}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitTabRename();
                        if (event.key === 'Escape') setEditTabId(null);
                      }}
                      onClick={(event) => event.stopPropagation()}
                    />
                  ) : (
                    <span className="cc-wf-tab-name" style={{ fontSize: 9, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span
                        title={`Status: ${workflow.status || 'draft'}`}
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 999,
                          background: workflow.status === 'published' ? '#34d399' : '#fbbf24',
                          boxShadow: workflow.status === 'published'
                            ? '0 0 8px rgba(52,211,153,.65)'
                            : '0 0 8px rgba(251,191,36,.55)',
                        }}
                      />
                      {workflow.name}
                    </span>
                  )}
                  {workflows.length > 1 && (
                    <button className="cc-wf-tab-del" type="button" onClick={(event) => { event.stopPropagation(); deleteWorkflow(workflow.id); }}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                className="cc-sec-add"
                type="button"
                style={{ marginLeft: 4, alignSelf: 'center' }}
                onClick={() => setShowModeSelector(true)}
                title="Create a new workflow — choose from templates, blank canvas, or AI generation"
              >
                + Workflow
              </button>
            </div>
          </div>

          {wf && (
            <div className="cc-wf-bar">
              <input
                className="cc-wf-name-input"
                value={wf.name}
                placeholder="Workflow name…"
                onChange={(event) => renameWorkflow(activeId, event.target.value)}
              />
            </div>
          )}

          <div className="cc-col-body" style={{ padding: 10 }}>
            {embedded && (
              <div
                className="deliver-section"
                style={{
                  marginBottom: 10,
                  border: '1px solid rgba(124,170,222,.24)',
                  background: 'rgba(12,28,50,.46)',
                  borderRadius: 10,
                  padding: '8px 9px',
                }}
              >
                <div className="deliver-section-lbl" style={{ marginBottom: 2 }}>Workflow Studio</div>
                <div className="deliver-sub">Design-first mode enabled. Palette + canvas + inspector prioritized.</div>
              </div>
            )}

            {/* ── AP Component Palette ── */}
            {!embedded && (
              <div className="p-3 pb-2">
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="text-[8.5px] font-bold uppercase tracking-widest text-slate-500">AP Component Palette</span>
                  <span className="text-[8px] text-slate-600">· drag or click</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {AP_WORKFLOW_TEMPLATES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      draggable
                      onDragStart={(event) => startPaletteDrag(event, item)}
                      onDragEnd={() => { lastPaletteDragAtRef.current = Date.now(); setGlobalWorkflowPaletteDragItem(null); }}
                      onClick={() => handlePaletteQuickAdd(item)}
                      onDoubleClick={() => addCanvasNode({ stateKind: item.stateKind, name: item.name })}
                      title="Drag to canvas · click to add at centre · double-click to add with name"
                      className="group flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-slate-900/60 px-2.5 py-2 text-left transition-all duration-150 hover:border-white/[0.18] hover:bg-slate-800/70 hover:shadow-md active:scale-[.98] cursor-grab active:cursor-grabbing"
                    >
                      {/* Kind dot + icon */}
                      <span
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-sm"
                        style={{ background: `${item.color}18`, border: `1px solid ${item.color}44`, color: item.color }}
                      >
                        {item.icon}
                      </span>
                      {/* Name + description */}
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[10px] font-semibold leading-none text-slate-200 group-hover:text-white transition-colors">
                          {item.label}
                        </span>
                        <span className="truncate text-[8px] text-slate-500 leading-none">
                          {item.description}
                        </span>
                      </span>
                      {/* Drag hint */}
                      <span className="ml-auto flex-shrink-0 text-[9px] text-slate-600 group-hover:text-slate-400 transition-colors">⋮⋮</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!embedded && <div className="stats-grid">
              {[
                ['States', wf?.states.length || 0, 'var(--a3)'],
                ['Transitions', wf?.transitions.length || 0, 'var(--a3)'],
                ['Users', users.length, 'var(--green)'],
                ['Properties', properties.length, 'var(--green)'],
                ['Rules', rules.length, 'var(--gold)'],
                ['Workflows', workflows.length, 'var(--mid)'],
              ].map(([label, value, color]) => (
                <div key={label} className="stat-card">
                  <div className="stat-val" style={{ color }}>{value}</div>
                  <div className="stat-lbl">{label}</div>
                </div>
              ))}
            </div>}
          </div>
        </div>

        <div className="cc-center">
          {/* ── Left panel toggle ── */}
          <button
            className="cc-panel-toggle cc-panel-toggle-left"
            type="button"
            onClick={() => setLeftPanelOpen((p) => !p)}
            title={leftVisible ? 'Collapse palette' : 'Expand palette'}
          >
            {leftVisible ? '‹' : '›'}
          </button>
          {/* ── Right panel toggle ── */}
          <button
            className="cc-panel-toggle cc-panel-toggle-right"
            type="button"
            onClick={() => setInspectorHiddenByHandle((p) => !p)}
            title={inspectorVisible ? 'Collapse inspector' : 'Expand inspector'}
          >
            {inspectorVisible ? '›' : '‹'}
          </button>

          <div className="cc-col-head wf-col-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%' }}>
              {/* Workflow name + status */}
              <span className="wf-active-name" title={wf?.name || 'New Workflow'}>
                {wf?.name || 'New Workflow'}
              </span>
              {wf?.status && (
                <span
                  className={`wf-status-badge ${wf.status === 'published' ? 'published' : 'draft'}`}
                  title={`Workflow status: ${wf.status}`}
                >
                  {wf.status}
                </span>
              )}

              <div style={{ flex: 1 }} />

              {/* View tabs */}
              <div className="wf-tab-group" title="Switch workflow perspective">
                {!embedded && VIEW_MODES.map(([id, label]) => (
                  <button
                    key={id}
                    className={`wf-vtab ${viewMode === id ? 'on' : ''}`}
                    onClick={() => setViewMode(id)}
                    type="button"
                    title={`${label} view — ${id === 'business' ? 'AP process flow & approvals' : id === 'runtime' ? 'Live execution context' : 'Target system mapping'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="wf-tab-sep" />

              <div className="wf-tab-group">
                {[
                  ['canvas',        'Canvas',        'Workflow designer — drag nodes, wire transitions, run layouts'],
                  ['simulation',    'Simulation',    'Step through the workflow with a test invoice context'],
                  ['collaboration', 'Collaboration', 'Real-time multi-user editing — powered by React Flow Pro Yjs collaboration'],
                  ['json',          'JSON',          'Raw XState / IR export — copy to clipboard or download'],
                  ['stats',         'Stats',         'Node/edge counts, validation errors, publish history'],
                ].map(([id, label, tip]) => (
                  <button
                    key={id}
                    className={`wf-vtab ${centerView === id ? 'on' : ''}`}
                    onClick={() => setCenterView(id)}
                    type="button"
                    title={tip}
                    style={id === 'collaboration' ? {
                      position: 'relative',
                    } : undefined}
                  >
                    {id === 'collaboration' && (
                      <span style={{
                        position: 'absolute', top: 1, right: 1,
                        width: 5, height: 5, borderRadius: '50%',
                        background: '#22c55e',
                        boxShadow: '0 0 5px rgba(34,197,94,.8)',
                      }} />
                    )}
                    {label}
                  </button>
                ))}
              </div>

              {/* Dev tools — dim, tooltip-only */}
              <div style={{ display: 'flex', gap: 3, marginLeft: 6 }}>
                <button
                  className="dev-btn"
                  type="button"
                  onClick={() => seedStressTest(25, 50)}
                  title="Dev: seed 25 nodes + 50 transitions to stress-test the canvas"
                >
                  ⚡
                </button>
                <button
                  className="dev-btn"
                  type="button"
                  onClick={resetAll}
                  title="Dev: wipe all workflows and reset to empty canvas"
                >
                  ↺
                </button>
              </div>
            </div>
          </div>

          {centerView === 'canvas' && (
            <div className="cc-col-body canvas-panel">
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '8px 10px',
                  borderBottom: '1px solid rgba(255,255,255,.08)',
                  background: 'rgba(7,17,31,.78)',
                }}
              >
                <div style={{ fontSize: 9, letterSpacing: '.6px', textTransform: 'uppercase', color: 'rgba(164,191,230,.72)' }}>
                  Quick Palette (Design Focus)
                </div>
                {embedded && !inspectorVisible && (
                  <div style={{ fontSize: 9, color: 'rgba(164,191,230,.62)' }}>
                    Select a state or transition to open Inspector, or press I.
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {AP_WORKFLOW_TEMPLATES.slice(0, 8).map((item) => (
                    <button
                      key={`quick-${item.id}`}
                      type="button"
                      draggable
                      onDragStart={(event) => startPaletteDrag(event, item)}
                      onDragEnd={() => { lastPaletteDragAtRef.current = Date.now(); setGlobalWorkflowPaletteDragItem(null); }}
                      onClick={() => handlePaletteQuickAdd(item)}
                      title="Click to add, or drag onto canvas"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        border: '1px solid rgba(124,170,222,.3)',
                        borderRadius: 8,
                        background: 'rgba(8,22,40,.82)',
                        color: '#d6e9ff',
                        padding: '4px 7px',
                        fontSize: 9,
                        cursor: 'grab',
                      }}
                    >
                      <span style={{ color: item.color }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
                {embedded && (
                  <button
                    type="button"
                    onClick={() => setLeftPanelOpen((prev) => !prev)}
                    title={leftVisible ? 'Hide left panel' : 'Show left panel'}
                    style={{
                      position: 'absolute',
                      left: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 31,
                      borderRadius: 10,
                      border: '1px solid rgba(124,170,222,.35)',
                      background: 'rgba(7,20,38,.9)',
                      color: '#d6e9ff',
                      fontSize: 10,
                      fontFamily: 'var(--mono)',
                      padding: '8px 6px',
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed',
                      letterSpacing: '.2px',
                    }}
                  >
                    {leftVisible ? 'Hide Left' : 'Show Left'}
                  </button>
                )}

                {embedded && (
                  <button
                    type="button"
                    onClick={() => {
                      if (inspectorVisible) {
                        setInspectorHiddenByHandle(true);
                        setInspectorPinnedOpen(false);
                        return;
                      }
                      setInspectorHiddenByHandle(false);
                      setInspectorPinnedOpen(true);
                    }}
                    title={inspectorVisible ? 'Hide properties panel (I)' : 'Show properties panel (I)'}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 31,
                      borderRadius: 10,
                      border: '1px solid rgba(124,170,222,.35)',
                      background: 'rgba(7,20,38,.9)',
                      color: '#d6e9ff',
                      fontSize: 10,
                      fontFamily: 'var(--mono)',
                      padding: '8px 6px',
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed',
                      letterSpacing: '.2px',
                    }}
                  >
                    {inspectorVisible ? 'Hide Properties' : 'Show Properties'}
                  </button>
                )}

                {embedded && !inspectorVisible && (
                  <button
                    type="button"
                    onClick={() => {
                      setInspectorHiddenByHandle(false);
                      setInspectorPinnedOpen(true);
                    }}
                    title="Press I to open Inspector"
                    style={{
                      position: 'absolute',
                      right: 12,
                      bottom: 12,
                      zIndex: 30,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      borderRadius: 999,
                      border: '1px solid rgba(124,170,222,.35)',
                      background: 'rgba(7,20,38,.92)',
                      color: '#d6e9ff',
                      fontSize: 10,
                      fontFamily: 'var(--mono)',
                      letterSpacing: '.2px',
                      padding: '6px 10px',
                      boxShadow: '0 10px 26px rgba(0,0,0,.34)',
                    }}
                  >
                    <span style={{
                      border: '1px solid rgba(124,170,222,.45)',
                      borderRadius: 6,
                      minWidth: 16,
                      height: 16,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      background: 'rgba(14,34,59,.88)',
                    }}>
                      I
                    </span>
                    <span>Open Inspector</span>
                  </button>
                )}
                <CanvasSurface />
              </div>
            </div>
          )}
          {centerView === 'collaboration' && (
            <div className="cc-col-body" style={{ padding: '16px' }}>
              {/* ── Collaboration panel ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 }}>

                {/* Status banner */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
                }}>
                  <span style={{ fontSize: 20 }}>●</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>Collaboration Active</div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                      React Flow Pro — Yjs CRDT real-time sync · BroadcastChannel fallback for local tabs
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: 10, color: '#64748b', textAlign: 'right' }}>
                    <div style={{ color: '#4ade80', fontWeight: 600 }}>● Live</div>
                    <div>same-device tabs synced</div>
                  </div>
                </div>

                {/* Session */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.5px' }}>Session ID</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <code style={{
                      flex: 1, padding: '6px 10px', borderRadius: 7,
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      fontSize: 11, color: '#c8d8ec', fontFamily: 'var(--mono)',
                    }}>
                      default
                    </code>
                    <div style={{ fontSize: 10, color: '#475569' }}>
                      Share this ID with teammates to join the same session
                    </div>
                  </div>
                </div>

                {/* How it works */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.5px' }}>How It Works</div>
                  {[
                    ['🔄', 'Real-time sync', 'Every node move, connection, and rename is broadcast instantly to all collaborators on the same session'],
                    ['👥', 'Presence', 'Remote collaborators appear as coloured avatar dots on nodes and transitions they are viewing or editing'],
                    ['🌐', 'Network collab', 'Set VITE_COLLAB_NETWORK=true and run node scripts/collab-server.mjs to enable cross-device collaboration via WebSocket'],
                    ['🔒', 'Conflict-free', 'Powered by Yjs CRDT — simultaneous edits from multiple users never corrupt the workflow data'],
                    ['⚡', 'Local fallback', 'BroadcastChannel API keeps tabs on the same device in sync even without a network server'],
                  ].map(([icon, title, desc]) => (
                    <div key={title} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 16, flexShrink: 0, width: 24, textAlign: 'center' }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>{title}</div>
                        <div style={{ fontSize: 10, color: '#475569', marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* vs competitors */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.5px' }}>vs. Competitors</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {[
                      { name: 'AI Proviso', collab: true,  rf: true,  ai: true,  inline: true  },
                      { name: 'M-Files',    collab: false, rf: false, ai: false, inline: false },
                      { name: 'Nintex',     collab: false, rf: false, ai: false, inline: false },
                    ].map(({ name, collab, rf, ai, inline }) => (
                      <div key={name} style={{
                        padding: '8px 10px', borderRadius: 8,
                        background: name === 'AI Proviso' ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${name === 'AI Proviso' ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.07)'}`,
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: name === 'AI Proviso' ? '#4ade80' : '#64748b', marginBottom: 6 }}>{name}</div>
                        {[['Real-time Collab', collab], ['RF Pro Canvas', rf], ['AI Generation', ai], ['Inline Edit', inline]].map(([feat, has]) => (
                          <div key={feat} style={{ fontSize: 9, color: has ? '#4ade80' : '#334155', display: 'flex', gap: 5, marginBottom: 3 }}>
                            <span>{has ? '✓' : '✗'}</span><span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}
          {centerView === 'json' && (
            <div className="cc-col-body" style={{ padding: '14px 16px' }}>
              <pre style={{ fontFamily: 'var(--mono)', fontSize: 10, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(jsonView, null, 2)}
              </pre>
            </div>
          )}
          {centerView === 'simulation' && (
            <div className="cc-col-body" style={{ padding: '12px 14px', display: 'grid', gridTemplateRows: 'auto 1fr', gap: 10 }}>
              <div
                style={{
                  border: '1px solid rgba(124,170,222,.22)',
                  borderRadius: 10,
                  background: 'rgba(9,25,45,.48)',
                  padding: '10px 12px',
                  display: 'grid',
                  gridTemplateColumns: 'auto auto auto auto 1fr auto',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <button className="xb blue" type="button" onClick={startSimulation} disabled={simulationRunning}>▶ Play</button>
                <button className="xb" type="button" onClick={() => setSimulationRunning(false)} disabled={!simulationRunning}>⏸ Pause</button>
                <button className="xb" type="button" onClick={stepSimulation}>⏭ Step</button>
                <button className="xb" type="button" onClick={resetSimulation}>⏹ Stop</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifySelf: 'start' }}>
                  <span style={{ fontSize: 10, color: 'var(--mid)' }}>Speed</span>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.5"
                    value={simulationSpeed}
                    onChange={(event) => setSimulationSpeed(Number(event.target.value))}
                  />
                  <span style={{ fontSize: 10, color: 'var(--text)' }}>{simulationSpeed.toFixed(1)}x</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text)' }}>
                  Active: {simulationActiveStateId ? (stateNameByKey.get(simulationActiveStateId) || simulationActiveStateId) : 'none'}
                  {simulationActiveStateId && terminalStateKeys.has(simulationActiveStateId) ? ' · terminal' : ''}
                </div>
              </div>

              <div
                style={{
                  border: '1px solid rgba(124,170,222,.16)',
                  borderRadius: 10,
                  background: 'rgba(6,18,34,.48)',
                  padding: '8px 10px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
                  gap: 8,
                }}
              >
                <label style={{ display: 'grid', gap: 4, fontSize: 10, color: 'var(--mid)' }}>
                  Amount
                  <input
                    type="number"
                    value={simulationContext.amount}
                    onChange={(event) => setSimulationContext((prev) => ({ ...prev, amount: Number(event.target.value || 0) }))}
                  />
                </label>
                <label style={{ display: 'grid', gap: 4, fontSize: 10, color: 'var(--mid)' }}>
                  Confidence
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={simulationContext.confidence}
                    onChange={(event) => setSimulationContext((prev) => ({ ...prev, confidence: Number(event.target.value || 0) }))}
                  />
                </label>
                <label style={{ display: 'grid', gap: 4, fontSize: 10, color: 'var(--mid)' }}>
                  Overdue Hours
                  <input
                    type="number"
                    min="0"
                    value={simulationContext.overdueHours}
                    onChange={(event) => setSimulationContext((prev) => ({ ...prev, overdueHours: Number(event.target.value || 0) }))}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--mid)', marginTop: 18 }}>
                  <input
                    type="checkbox"
                    checked={simulationContext.hasPo}
                    onChange={(event) => setSimulationContext((prev) => ({ ...prev, hasPo: event.target.checked }))}
                  />
                  Has PO
                </label>
              </div>

              <div
                style={{
                  border: '1px solid rgba(124,170,222,.16)',
                  borderRadius: 10,
                  background: 'rgba(6,18,34,.58)',
                  overflow: 'auto',
                  padding: '8px 10px',
                }}
              >
                {simulationHistory.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--mid)' }}>Run simulation to inspect route history.</div>
                ) : (
                  simulationHistory.map((entry, index) => (
                    <div
                      key={`${entry.ts}-${index}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '148px 1fr',
                        gap: 10,
                        fontSize: 10,
                        fontFamily: 'var(--mono)',
                        color: 'var(--text)',
                        padding: '6px 0',
                        borderBottom: '1px solid rgba(255,255,255,.04)',
                      }}
                    >
                      <span style={{ color: 'var(--mid)' }}>{entry.ts}</span>
                      <span>
                        {entry.kind === 'start'
                          ? `START -> ${entry.to}`
                          : `${entry.from} -> ${entry.to} (${entry.event})`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {centerView === 'stats' && (
            <div className="stats-grid">
              {[
                ['RF Nodes', rfNodes.length, 'var(--a3)'],
                ['RF Edges', rfEdges.length, 'var(--a3)'],
                ['Selected Node', selectedNodeId ? 1 : 0, 'var(--green)'],
                ['Selected Edge', selectedEdgeId ? 1 : 0, 'var(--green)'],
              ].map(([label, value, color]) => (
                <div key={label} className="stat-card">
                  <div className="stat-val" style={{ color }}>{value}</div>
                  <div className="stat-lbl">{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`cc-right${inspectorVisible ? '' : ' right-collapsed'}`}>
          <div className="cc-col-head" style={{ gap: 8 }}>
            <span className="cc-col-lbl">Inspector</span>
            {embedded && (
              <button
                type="button"
                className="tab"
                onClick={() => setInspectorPinnedOpen((prev) => !prev)}
                title="Toggle Inspector pin (I)"
                style={{ marginLeft: 'auto', padding: '2px 6px', fontSize: 9 }}
              >
                {inspectorPinnedOpen ? 'Unpin I' : 'Pin I'}
              </button>
            )}
          </div>
          <div className="cc-col-body">
            {inspectorVisible && <CanvasInspector />}
            {inspectorVisible && !embedded && (
              <div className="deliver-section">
                <div className="deliver-section-lbl">Validation</div>
                <div className="deliver-sub" style={{ marginBottom: 8 }}>
                  {errorCount} error(s), {warningCount} warning(s)
                </div>
                {lastPublishError && (
                  <div style={{ marginBottom: 8, fontSize: 10, color: '#fca5a5' }}>{lastPublishError}</div>
                )}
                <div className="deliver-section-lbl">Publish</div>
                <button className="xb" type="button" onClick={handlePublish}>✓ Publish Local Version</button>
                {lastPublishedAt && (
                  <div style={{ marginTop: 6, fontSize: 10, color: 'var(--mid)' }}>
                    Last published: {new Date(lastPublishedAt).toLocaleString()}
                  </div>
                )}
                <button
                  className="xb"
                  type="button"
                  style={{ marginTop: 8 }}
                  onClick={() => setCenterView('simulation')}
                >
                  ▶ Open Simulation
                </button>
                <div className="deliver-section-lbl">Export</div>
                <button className="xb blue" type="button" onClick={exportJSON}>↓ Export JSON</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* ── Workflow Mode Selector overlay ── */}
    {showModeSelector && (
      <WorkflowModeSelector
        onSelect={handleModeSelect}
        onDismiss={() => setShowModeSelector(false)}
        existingWorkflows={workflows}
      />
    )}
    </>
  );
}
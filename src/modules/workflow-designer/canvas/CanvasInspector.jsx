import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMachine } from '@xstate/react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { KIND_CONFIG } from './nodes/WorkflowStateNode';
import { propertyInspectorMachine } from '../../../machines/propertyInspectorMachine';
import { compileToXState, buildCanonicalWorkflowIR } from '../engine/workflowIR';
import GuardBuilder from './GuardBuilder';

const NODE_KINDS = Object.entries(KIND_CONFIG).map(([value, { label, icon, color }]) => ({ value, label, icon, color }));

const parseTokenList = (value) =>
  value.split(',').map((t) => t.trim()).filter(Boolean);

const toggleToken = (list, token, on) => {
  const next = Array.isArray(list) ? list.filter((t) => t !== token) : [];
  return on ? [...next, token] : next;
};

// ── Reusable field components ────────────────────────────────────────────────
function Field({ icon, label, children }) {
  return (
    <label className="ci-field">
      <span className="ci-field-label">
        {icon && <span className="ci-field-icon">{icon}</span>}
        {label}
      </span>
      {children}
    </label>
  );
}

function Toggle({ icon, label, checked, onChange }) {
  return (
    <label className="ci-toggle">
      <span className="ci-toggle-label">
        {icon && <span className="ci-field-icon">{icon}</span>}
        {label}
      </span>
      <div className={`ci-toggle-track${checked ? ' on' : ''}`} onClick={() => onChange(!checked)}>
        <div className="ci-toggle-thumb" />
      </div>
    </label>
  );
}

function Readout({ icon, label, value }) {
  return (
    <div className="ci-readout">
      <span className="ci-readout-label">
        {icon && <span className="ci-field-icon">{icon}</span>}
        {label}
      </span>
      <span className="ci-readout-value">{value || '—'}</span>
    </div>
  );
}

// ── Node Inspector ───────────────────────────────────────────────────────────
function NodeInspector({ node, activeTab, onTabChange, onPropertyChange, deleteCanvasNode, isDirty, activeDefinition, rules }) {
  const flags = node.behaviour_flags || {};
  const [copiedXState, setCopiedXState] = useState(false);

  // Compile XState config for this node in real time
  const xstateConfig = useMemo(() => {
    if (!activeDefinition) return null;
    try {
      const ir  = buildCanonicalWorkflowIR(activeDefinition, rules || []);
      const spec = compileToXState(ir);
      const stateKey = Object.keys(spec?.states || {}).find(k => k === node.id || k === node.name?.toLowerCase().replace(/\s+/g,'_'));
      return stateKey ? { [stateKey]: spec.states[stateKey] } : spec?.states?.[node.id] ? { [node.id]: spec.states[node.id] } : null;
    } catch { return null; }
  }, [activeDefinition, node.id, node.state_kind, node.name, rules]);

  const xstateJson = xstateConfig ? JSON.stringify(xstateConfig, null, 2) : '{}';

  const handleCopyXState = () => {
    navigator.clipboard?.writeText(xstateJson).then(() => {
      setCopiedXState(true);
      setTimeout(() => setCopiedXState(false), 1500);
    });
  };

  const tabs = ['basic', 'actions', 'flags', 'xstate'];

  return (
    <div className="ci-shell">
      <div className="ci-header">
        <div className="ci-header-left">
          <span className="ci-header-icon" style={{ color: KIND_CONFIG[node.state_kind]?.color || '#4A9FFF' }}>
            {KIND_CONFIG[node.state_kind]?.icon || '◎'}
          </span>
          <div>
            <div className="ci-header-title">State Properties</div>
            <div className="ci-header-sub">
              {node.name || 'Untitled State'}
              {isDirty ? ' · unsaved' : ''}
            </div>
          </div>
        </div>
        <button className="ci-danger-btn" onClick={() => deleteCanvasNode(node.id)} title="Delete state">
          🗑
        </button>
      </div>

      {/* Kind picker */}
      <div className="ci-kind-picker">
        {NODE_KINDS.map((k) => (
          <button
            key={k.value}
            className={`ci-kind-pill${node.state_kind === k.value ? ' active' : ''}`}
            style={{ '--kp-color': k.color }}
            onClick={() => onPropertyChange({ state_kind: k.value })}
            title={k.label}
          >
            <span>{k.icon}</span>
            <span>{k.label}</span>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="ci-tabs">
        {tabs.map((t) => (
          <button key={t} className={`ci-tab${activeTab === t ? ' active' : ''}`} onClick={() => onTabChange(t)}>
            {t === 'basic' ? '📋 Basic' : t === 'actions' ? '⚡ Actions' : t === 'flags' ? '🚦 Flags' : '⚙ XState'}
          </button>
        ))}
      </div>

      <div className="ci-body">
        {activeTab === 'basic' && (
          <>
            <Field icon="✏️" label="Name">
              <input
                value={node.name || ''}
                placeholder="State name"
                onChange={(e) => onPropertyChange({ name: e.target.value })}
              />
            </Field>
            <Field icon="📝" label="Description">
              <textarea
                rows={2}
                value={node.description || ''}
                placeholder="What happens in this state…"
                onChange={(e) => onPropertyChange({ description: e.target.value })}
              />
            </Field>
            <div className="ci-row">
              <Field icon="👤" label="Assignee Role">
                <input
                  value={node.assignee_role_id || ''}
                  placeholder="e.g. approver"
                  onChange={(e) => onPropertyChange({ assignee_role_id: e.target.value || null })}
                />
              </Field>
              <Field icon="👤" label="Fallback Role">
                <input
                  value={node.fallback_role_id || ''}
                  placeholder="e.g. manager"
                  onChange={(e) => onPropertyChange({ fallback_role_id: e.target.value || null })}
                />
              </Field>
            </div>
            <div className="ci-row">
              <Field icon="⏱" label="SLA Policy">
                <input
                  value={node.sla_policy_id || ''}
                  placeholder="e.g. 48h"
                  onChange={(e) => onPropertyChange({ sla_policy_id: e.target.value || null })}
                />
              </Field>
              <Field icon="🏷" label="Tags">
                <input
                  value={(node.tags || []).join(', ')}
                  placeholder="e.g. finance, ap"
                  onChange={(e) => onPropertyChange({ tags: parseTokenList(e.target.value) })}
                />
              </Field>
            </div>
          </>
        )}

        {activeTab === 'actions' && (
          <>
            <Field icon="⚡" label="Invoked Service">
              <input
                value={node.invoked_service_id || ''}
                placeholder="service.id"
                onChange={(e) => onPropertyChange({ invoked_service_id: e.target.value || null })}
              />
            </Field>
            <Field icon="📈" label="Escalation Policy">
              <input
                value={node.escalation_policy_id || ''}
                placeholder="escalation.id"
                onChange={(e) => onPropertyChange({ escalation_policy_id: e.target.value || null })}
              />
            </Field>
            <Field icon="▶️" label="Entry Actions">
              <input
                value={(node.entry_action_ids || []).join(', ')}
                placeholder="action.id, …"
                onChange={(e) => onPropertyChange({ entry_action_ids: parseTokenList(e.target.value) })}
              />
            </Field>
            <Field icon="⏹️" label="Exit Actions">
              <input
                value={(node.exit_action_ids || []).join(', ')}
                placeholder="action.id, …"
                onChange={(e) => onPropertyChange({ exit_action_ids: parseTokenList(e.target.value) })}
              />
            </Field>
          </>
        )}

        {activeTab === 'flags' && (
          <>
            <Toggle icon="💬" label="Comments Enabled" checked={!!flags.comments_enabled} onChange={(v) => onPropertyChange({ behaviour_flags: { ...flags, comments_enabled: v } })} />
            <Toggle icon="📧" label="Email Approval" checked={!!flags.email_approval_enabled} onChange={(v) => onPropertyChange({ behaviour_flags: { ...flags, email_approval_enabled: v } })} />
            <Toggle icon="💬" label="Vendor Replies" checked={!!flags.vendor_reply_enabled} onChange={(v) => onPropertyChange({ behaviour_flags: { ...flags, vendor_reply_enabled: v } })} />
            <Toggle icon="🔒" label="Lock Fields on Entry" checked={!!flags.lock_fields_on_entry} onChange={(v) => onPropertyChange({ behaviour_flags: { ...flags, lock_fields_on_entry: v } })} />
            <Toggle icon="🧮" label="GL Suggestion" checked={!!flags.gl_suggestion_enabled} onChange={(v) => onPropertyChange({ behaviour_flags: { ...flags, gl_suggestion_enabled: v } })} />
            <Toggle icon="🔍" label="Anomaly Check" checked={!!flags.anomaly_check_enabled} onChange={(v) => onPropertyChange({ behaviour_flags: { ...flags, anomaly_check_enabled: v } })} />
            <Toggle icon="🔁" label="Duplicate Check" checked={!!flags.duplicate_check_enabled} onChange={(v) => onPropertyChange({ behaviour_flags: { ...flags, duplicate_check_enabled: v } })} />
            <Field icon="⏱" label="Token Expiry (hours)">
              <input
                type="number"
                min="1"
                value={flags.token_expiry_hours ?? ''}
                placeholder="48"
                onChange={(e) => {
                  const v = e.target.value.trim();
                  const n = v ? Number.parseInt(v, 10) : null;
                  onPropertyChange({ behaviour_flags: { ...flags, token_expiry_hours: Number.isNaN(n) ? null : n } });
                }}
              />
            </Field>
          </>
        )}

        {activeTab === 'xstate' && (
          <>
            <div className="ci-section-label" style={{ marginBottom: 6 }}>
              Compiled XState state config — read only, updates live
            </div>
            <div style={{ position: 'relative' }}>
              <button
                onClick={handleCopyXState}
                style={{
                  position: 'absolute', top: 6, right: 6, zIndex: 2,
                  fontSize: 9, padding: '2px 7px', borderRadius: 4,
                  border: '1px solid rgba(74,159,255,.35)',
                  background: 'rgba(74,159,255,.08)',
                  color: copiedXState ? '#7ee3b0' : '#a0c8f0',
                  cursor: 'pointer',
                }}
              >
                {copiedXState ? '✓ Copied' : 'Copy'}
              </button>
              <pre style={{
                margin: 0, overflowX: 'auto', maxHeight: 320,
                fontSize: 9.5, lineHeight: 1.55, fontFamily: 'var(--mono)',
                background: 'rgba(5,14,26,.72)', border: '1px solid rgba(255,255,255,.07)',
                borderRadius: 8, padding: '10px 12px', color: 'rgba(180,210,255,.85)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {xstateJson}
              </pre>
            </div>
            {!xstateConfig && (
              <div style={{ fontSize: 9.5, color: 'rgba(160,180,210,.55)', marginTop: 4 }}>
                Could not compile — ensure this state is reachable from the initial state.
              </div>
            )}
          </>
        )}

        <Readout icon="🆔" label="Node ID" value={node.id} />
      </div>
    </div>
  );
}

// ── Edge Inspector ───────────────────────────────────────────────────────────
function EdgeInspector({ edge, nodeNameById, updateEdgeProperties, deleteCanvasEdge, activeTab, onTabChange, isDirty }) {
  const fromName = nodeNameById.get(edge.from_node_id) || edge.from_node_id || '?';
  const toName   = nodeNameById.get(edge.to_node_id)   || edge.to_node_id   || '?';
  const tabs = ['basic', 'actions', 'flags'];

  return (
    <div className="ci-shell">
      <div className="ci-header">
        <div className="ci-header-left">
          <span className="ci-header-icon" style={{ color: '#4A9FFF' }}>→</span>
          <div>
            <div className="ci-header-title">Transition Properties</div>
            <div className="ci-header-sub">{fromName} → {toName}{isDirty ? ' · pending changes' : ''}</div>
          </div>
        </div>
        <button className="ci-danger-btn" onClick={() => deleteCanvasEdge(edge.id)} title="Delete transition">
          🗑
        </button>
      </div>

      <div className="ci-tabs">
        {tabs.map((t) => (
          <button key={t} className={`ci-tab${activeTab === t ? ' active' : ''}`} onClick={() => onTabChange(t)}>
            {t === 'basic' ? '📋 Basic' : t === 'actions' ? '⚡ Actions' : '🚦 Flags'}
          </button>
        ))}
      </div>

      <div className="ci-route-pill">
        <span className="ci-route-from">{fromName}</span>
        <span className="ci-route-arrow">→</span>
        <span className="ci-route-to">{toName}</span>
      </div>

      <div className="ci-body">
        {activeTab === 'basic' && (
          <>
            <Field icon="✏️" label="Label">
              <input
                value={edge.label || ''}
                placeholder="e.g. Submit for review"
                onChange={(e) => updateEdgeProperties(edge.id, { label: e.target.value })}
              />
            </Field>
            <Field icon="⚡" label="Event Type">
              <input
                value={edge.event_type || ''}
                placeholder="workflow.state_name"
                onChange={(e) => updateEdgeProperties(edge.id, { event_type: e.target.value })}
              />
            </Field>

            {/* ── Line style ── */}
            <Field icon="〰" label="Line Style" tooltip="Controls how the transition arrow is drawn. Auto detects from label keywords (exception→dashed, timeout→dotted).">
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[
                  { value: 'auto',     label: 'Auto',     title: 'Auto-detect from label/event type keywords', preview: '— — —' },
                  { value: 'solid',    label: 'Solid',    title: 'Solid unbroken line',                        preview: '———' },
                  { value: 'dashed',   label: 'Dashed',   title: 'Dashed line — used for exception/rejection routes', preview: '- - -' },
                  { value: 'dotted',   label: 'Dotted',   title: 'Dotted line — used for timeout/SLA escalation', preview: '· · ·' },
                  { value: 'dash-dot', label: 'Dash·Dot', title: 'Dash-dot — used for conditional/guard transitions', preview: '–·–·' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    title={opt.title}
                    onClick={() => updateEdgeProperties(edge.id, { line_style: opt.value })}
                    style={{
                      flex: '1 1 auto',
                      padding: '4px 6px',
                      borderRadius: 6,
                      border: '1px solid',
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all .14s',
                      background: (edge.line_style || 'auto') === opt.value ? 'rgba(34,197,94,.12)' : 'rgba(255,255,255,.04)',
                      borderColor: (edge.line_style || 'auto') === opt.value ? 'rgba(34,197,94,.4)' : 'rgba(255,255,255,.1)',
                      color: (edge.line_style || 'auto') === opt.value ? '#4ade80' : '#64748b',
                    }}
                  >
                    <div style={{ fontSize: 9, letterSpacing: 1 }}>{opt.preview}</div>
                    <div>{opt.label}</div>
                  </button>
                ))}
              </div>
            </Field>

            <div className="ci-section-label" style={{ marginTop: 4, marginBottom: 6 }}>🛡 Guard Condition</div>
            <GuardBuilder edgeId={edge.id} initialGuardId={edge.guard_id || null} />
            <Readout icon="🆔" label="Transition ID" value={edge.id} />
          </>
        )}

        {activeTab === 'actions' && (
          <>
            <Field icon="⏳" label="Delay Policy">
              <input
                value={edge.delay_policy_id || ''}
                placeholder="delay.id"
                onChange={(e) => updateEdgeProperties(edge.id, { delay_policy_id: e.target.value || null })}
              />
            </Field>
            <div className="ci-section-label">⚡ Actions</div>
            <Toggle
              icon="🧮"
              label="GL Suggestion on transition"
              checked={(edge.pre_action_ids || []).includes('action.gl_suggestion')}
              onChange={(v) => updateEdgeProperties(edge.id, { pre_action_ids: toggleToken(edge.pre_action_ids, 'action.gl_suggestion', v) })}
            />
            <Toggle
              icon="🔍"
              label="Anomaly Check on transition"
              checked={(edge.pre_action_ids || []).includes('action.anomaly_check')}
              onChange={(v) => updateEdgeProperties(edge.id, { pre_action_ids: toggleToken(edge.pre_action_ids, 'action.anomaly_check', v) })}
            />
            <Toggle
              icon="🔔"
              label="Notify Vendor"
              checked={(edge.post_notification_ids || []).includes('notification.vendor')}
              onChange={(v) => updateEdgeProperties(edge.id, { post_notification_ids: toggleToken(edge.post_notification_ids, 'notification.vendor', v) })}
            />
          </>
        )}

        {activeTab === 'flags' && (
          <>
            <Toggle
              icon="🔄"
              label="Re-enter State"
              checked={edge.reentry !== false}
              onChange={(v) => updateEdgeProperties(edge.id, { reentry: v })}
            />
            <Toggle
              icon="🔀"
              label="Internal Transition"
              checked={!!edge.internal}
              onChange={(v) => updateEdgeProperties(edge.id, { internal: v })}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────
function EmptyInspector() {
  return (
    <div className="ci-empty">
      <div className="ci-empty-icon">🎯</div>
      <div className="ci-empty-title">Canvas Inspector</div>
      <div className="ci-empty-copy">
        Click any state or transition on the canvas to inspect and edit its properties here.
      </div>
      <div className="ci-empty-hints">
        <span>↔ Drag handles to connect states</span>
        <span>✦ Double-click name to rename inline</span>
        <span>⌨ Del to remove selection</span>
      </div>
    </div>
  );
}

// ── Main exported component ──────────────────────────────────────────────────
export default function CanvasInspector() {
  const selectedNodeId       = useWorkflowStore((s) => s.selectedNodeId);
  const selectedEdgeId       = useWorkflowStore((s) => s.selectedEdgeId);
  const rfNodes              = useWorkflowStore((s) => s.rfNodes);
  const rfEdges              = useWorkflowStore((s) => s.rfEdges);
  const activeDefinition     = useWorkflowStore((s) => s.activeDefinition);
  const rules                = useWorkflowStore((s) => s.rules);
  const isDirty              = useWorkflowStore((s) => s.isDirty);
  const lastSavedAt          = useWorkflowStore((s) => s.lastSavedAt);
  const updateNodeProperties = useWorkflowStore((s) => s.updateNodeProperties);
  const updateEdgeProperties = useWorkflowStore((s) => s.updateEdgeProperties);
  const deleteCanvasNode     = useWorkflowStore((s) => s.deleteCanvasNode);
  const deleteCanvasEdge     = useWorkflowStore((s) => s.deleteCanvasEdge);
  const [inspectorState, send] = useMachine(propertyInspectorMachine);

  const nodeNameById = useMemo(() =>
    new Map(rfNodes.map((n) => [n.id, n.data?.definitionNode?.name || n.data?.name || n.id])),
    [rfNodes],
  );

  const selectedNode = selectedNodeId
    ? rfNodes.find((n) => n.id === selectedNodeId)?.data?.definitionNode ?? null
    : null;

  const selectedEdge = selectedEdgeId
    ? rfEdges.find((e) => e.id === selectedEdgeId)?.data?.definitionEdge ?? null
    : null;

  useEffect(() => {
    if (selectedNodeId) {
      send({ type: 'SELECT_NODE', nodeId: selectedNodeId });
      return;
    }
    if (selectedEdgeId) {
      send({ type: 'SELECT_EDGE', edgeId: selectedEdgeId });
      return;
    }
    send({ type: 'CLEAR' });
  }, [selectedNodeId, selectedEdgeId, send]);

  const onNodePropertyChange = useCallback((nodeId, changes) => {
    send({ type: 'MARK_DIRTY' });
    updateNodeProperties(nodeId, changes);
    send({ type: 'SAVED' });
  }, [send, updateNodeProperties]);

  const onEdgePropertyChange = useCallback((edgeId, changes) => {
    send({ type: 'MARK_DIRTY' });
    updateEdgeProperties(edgeId, changes);
    send({ type: 'SAVED' });
  }, [send, updateEdgeProperties]);

  if (selectedNode) {
    return (
      <NodeInspector
        node={selectedNode}
        activeTab={inspectorState.context.activeTab}
        onTabChange={(tab) => send({ type: 'SET_TAB', tab })}
        onPropertyChange={(changes) => onNodePropertyChange(selectedNode.id, changes)}
        deleteCanvasNode={deleteCanvasNode}
        isDirty={isDirty}
        activeDefinition={activeDefinition}
        rules={rules}
      />
    );
  }

  if (selectedEdge) {
    return (
      <EdgeInspector
        edge={selectedEdge}
        nodeNameById={nodeNameById}
        updateEdgeProperties={(edgeId, changes) => onEdgePropertyChange(edgeId, changes)}
        deleteCanvasEdge={deleteCanvasEdge}
        activeTab={inspectorState.context.activeTab}
        onTabChange={(tab) => send({ type: 'SET_TAB', tab })}
        isDirty={inspectorState.context.dirty}
      />
    );
  }

  return <EmptyInspector />;
}

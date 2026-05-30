/**
 * GuardBuilder.jsx
 * Visual condition builder for workflow transition guards.
 * Produces a guard expression string and saves it to guard_registry with a stable UUID.
 * Used inside the Edge / Transition inspector.
 */

import { useCallback, useState } from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';

// ── Available fields, operators, and defaults ─────────────────────────────────
const FIELDS = [
  { id: 'invoice.total',      label: 'Invoice Total',     type: 'number' },
  { id: 'invoice.confidence', label: 'OCR Confidence',    type: 'number' },
  { id: 'invoice.vendor_id',  label: 'Vendor ID',         type: 'string' },
  { id: 'invoice.date',       label: 'Invoice Date',      type: 'date'   },
  { id: 'invoice.po_exists',  label: 'PO Exists',         type: 'boolean'},
  { id: 'vendor.risk_score',  label: 'Vendor Risk Score', type: 'number' },
];

const OPERATORS_BY_TYPE = {
  number:  ['>','>=','<','<=','=','!=','is not empty'],
  string:  ['=','!=','contains','starts with','is not empty','is empty'],
  boolean: ['is true','is false'],
  date:    ['before','after','is not empty'],
};

const DEFAULT_ROW = { field: 'invoice.total', op: '>', value: '', combinator: 'AND' };

// ── Build expression string from rows ────────────────────────────────────────
function buildExpression(rows) {
  return rows.map((row, i) => {
    const fieldLabel = FIELDS.find(f => f.id === row.field)?.id ?? row.field;
    const expr = ['is not empty','is empty','is true','is false'].includes(row.op)
      ? `${fieldLabel} ${row.op}`
      : `${fieldLabel} ${row.op} ${row.value}`;
    return i === 0 ? expr : `${row.combinator} ${expr}`;
  }).join('\n');
}

// ── GuardBuilder component ────────────────────────────────────────────────────
export default function GuardBuilder({ edgeId, initialGuardId }) {
  const rules            = useWorkflowStore((s) => s.rules);
  const updateEdgeProperties = useWorkflowStore((s) => s.updateEdgeProperties);
  const addRule          = useWorkflowStore((s) => s.addRule);
  const updateRule       = useWorkflowStore((s) => s.updateRule);

  // Load existing guard if one is set
  const existingGuard = rules.find(r => r.id === initialGuardId) || null;
  const [rows, setRows] = useState(() => {
    if (existingGuard?.conditions?.length) return existingGuard.conditions;
    return [{ ...DEFAULT_ROW }];
  });
  const [guardName, setGuardName] = useState(existingGuard?.text?.split(':')[0] || '');
  const [saved, setSaved] = useState(false);

  const expression = buildExpression(rows);

  const addRow = () => setRows(prev => [...prev, { ...DEFAULT_ROW }]);
  const removeRow = (i) => setRows(prev => prev.filter((_, idx) => idx !== i));
  const updateRow = (i, patch) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const handleSave = useCallback(() => {
    const text = `${guardName || 'Guard'}: ${expression}`;
    if (initialGuardId) {
      // Update existing guard
      updateRule(initialGuardId, { text, conditions: rows });
    } else {
      // Create new guard and assign UUID to edge
      const newId = addRule({ text, conditions: rows });
      if (newId && edgeId) {
        updateEdgeProperties(edgeId, { guard_id: newId });
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [guardName, expression, rows, initialGuardId, edgeId, addRule, updateRule, updateEdgeProperties]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Guard name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 9, color: 'rgba(120,160,210,.7)', flexShrink: 0 }}>Guard name</span>
        <input
          value={guardName}
          onChange={e => setGuardName(e.target.value)}
          placeholder="e.g. Amount above $25k"
          style={{ flex: 1, fontSize: 10, padding: '3px 8px', borderRadius: 5,
            border: '1px solid rgba(74,159,255,.3)', background: 'rgba(5,14,26,.7)',
            color: '#d4e8ff', outline: 'none', fontFamily: 'var(--mono)' }}
        />
      </div>

      {/* Condition rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {rows.map((row, i) => {
          const fieldDef   = FIELDS.find(f => f.id === row.field) || FIELDS[0];
          const operators  = OPERATORS_BY_TYPE[fieldDef.type] || OPERATORS_BY_TYPE.number;
          const noValue    = ['is not empty','is empty','is true','is false'].includes(row.op);
          const selectStyle = {
            flex: 1, fontSize: 9.5, padding: '3px 5px', borderRadius: 5,
            border: '1px solid rgba(255,255,255,.1)', background: 'rgba(5,14,26,.72)',
            color: '#c8dff8', outline: 'none', minWidth: 0,
          };
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* AND/OR combinator — not shown on first row */}
              {i > 0 && (
                <select value={row.combinator} onChange={e => updateRow(i, { combinator: e.target.value })}
                  style={{ ...selectStyle, width: 52, flex: 'none' }}>
                  <option>AND</option>
                  <option>OR</option>
                  <option>NOT</option>
                </select>
              )}
              {i === 0 && <div style={{ width: 52 }} />}

              {/* Field */}
              <select value={row.field} onChange={e => updateRow(i, { field: e.target.value, op: OPERATORS_BY_TYPE[FIELDS.find(f=>f.id===e.target.value)?.type||'number'][0], value: '' })}
                style={selectStyle}>
                {FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>

              {/* Operator */}
              <select value={row.op} onChange={e => updateRow(i, { op: e.target.value })} style={{ ...selectStyle, width: 88, flex: 'none' }}>
                {operators.map(op => <option key={op} value={op}>{op}</option>)}
              </select>

              {/* Value */}
              {!noValue && (
                <input
                  value={row.value}
                  onChange={e => updateRow(i, { value: e.target.value })}
                  placeholder="value"
                  style={{ flex: 1, fontSize: 9.5, padding: '3px 6px', borderRadius: 5,
                    border: '1px solid rgba(255,255,255,.1)', background: 'rgba(5,14,26,.72)',
                    color: '#c8dff8', outline: 'none', minWidth: 0, fontFamily: 'var(--mono)' }}
                />
              )}
              {noValue && <div style={{ flex: 1 }} />}

              {/* Remove row */}
              {rows.length > 1 && (
                <button onClick={() => removeRow(i)} title="Remove condition"
                  style={{ fontSize: 11, color: 'rgba(255,80,100,.6)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}>
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Expression preview */}
      <pre style={{
        margin: 0, fontSize: 9, lineHeight: 1.6, fontFamily: 'var(--mono)',
        padding: '6px 8px', borderRadius: 6,
        background: 'rgba(5,14,26,.6)', border: '1px solid rgba(74,159,255,.18)',
        color: 'rgba(140,220,160,.9)', whiteSpace: 'pre-wrap',
      }}>
        {expression || '(no conditions)'}
      </pre>

      {/* Actions row */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={addRow} style={{
          fontSize: 9.5, padding: '3px 10px', borderRadius: 5, cursor: 'pointer',
          border: '1px solid rgba(74,159,255,.3)', background: 'rgba(74,159,255,.08)', color: '#a0c8f0',
        }}>
          + Add condition
        </button>
        <button onClick={handleSave} style={{
          fontSize: 9.5, padding: '3px 10px', borderRadius: 5, cursor: 'pointer',
          border: '1px solid rgba(74,200,120,.35)',
          background: saved ? 'rgba(74,200,120,.15)' : 'rgba(74,200,120,.08)',
          color: saved ? '#7ee3b0' : '#90d8b0',
        }}>
          {saved ? '✓ Saved to registry' : 'Save guard'}
        </button>
        {initialGuardId && (
          <span style={{ fontSize: 9, color: 'rgba(120,160,210,.5)', fontFamily: 'var(--mono)' }}>
            id: {initialGuardId.slice(0, 8)}…
          </span>
        )}
      </div>
    </div>
  );
}

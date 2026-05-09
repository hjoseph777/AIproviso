import { useState } from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';

// ── GlobalSection ─────────────────────────────────────────────
// Renders Users, Properties, and Rules sections driven by Zustand.
export default function GlobalSection() {
  const users      = useWorkflowStore(s => s.users);
  const properties = useWorkflowStore(s => s.properties);
  const rules      = useWorkflowStore(s => s.rules);
  const addUser       = useWorkflowStore(s => s.addUser);
  const updateUser    = useWorkflowStore(s => s.updateUser);
  const deleteUser    = useWorkflowStore(s => s.deleteUser);
  const addProperty   = useWorkflowStore(s => s.addProperty);
  const updateProperty = useWorkflowStore(s => s.updateProperty);
  const deleteProperty = useWorkflowStore(s => s.deleteProperty);
  const addRule    = useWorkflowStore(s => s.addRule);
  const updateRule = useWorkflowStore(s => s.updateRule);
  const deleteRule = useWorkflowStore(s => s.deleteRule);

  return (
    <div className="sheet-body">
      {/* ── Users ── */}
      <CollapsibleSection title="Users" icon="👤" count={users.length} onAdd={addUser}>
        <table className="sheet-table">
          <thead><tr>
            <th style={{width:20}}/>
            <th>Name</th><th>Role</th><th>Email</th>
            <th style={{width:50}}>CM</th>
            <th style={{width:28}}/>
          </tr></thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id}>
                <td style={{width:20}}><span className="row-idx">{i+1}</span></td>
                <td><input className="cell-input" value={u.name}  onChange={e => updateUser(u.id, {name:  e.target.value})} placeholder="Full name"/></td>
                <td><input className="cell-input" value={u.role}  onChange={e => updateUser(u.id, {role:  e.target.value})} placeholder="e.g. CEO"/></td>
                <td><input className="cell-input" value={u.email} onChange={e => updateUser(u.id, {email: e.target.value})} placeholder="user@company.com"/></td>
                <td><div className="cell-check"><input type="checkbox" checked={!!u.isCM} onChange={e => updateUser(u.id, {isCM: e.target.checked})}/></div></td>
                <td style={{width:28}}><button className="del-btn" onClick={() => deleteUser(u.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CollapsibleSection>

      {/* ── Properties ── */}
      <CollapsibleSection title="Properties" icon="≡" count={properties.length} onAdd={addProperty}>
        <table className="sheet-table">
          <thead><tr>
            <th style={{width:20}}/>
            <th>Field Name</th>
            <th style={{width:'30%'}}>Type</th>
            <th style={{width:70}}>Required</th>
            <th style={{width:28}}/>
          </tr></thead>
          <tbody>
            {properties.map((p, i) => (
              <tr key={p.id}>
                <td style={{width:20}}><span className="row-idx">{i+1}</span></td>
                <td><input className="cell-input" value={p.name} onChange={e => updateProperty(p.id, {name: e.target.value})} placeholder="e.g. Contract Value"/></td>
                <td>
                  <select className="cell-select" value={p.type} onChange={e => updateProperty(p.id, {type: e.target.value})}>
                    {['Text','Integer','Decimal','Date','Lookup','Boolean'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </td>
                <td><div className="cell-check"><input type="checkbox" checked={!!p.required} onChange={e => updateProperty(p.id, {required: e.target.checked})}/></div></td>
                <td style={{width:28}}><button className="del-btn" onClick={() => deleteProperty(p.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CollapsibleSection>

      {/* ── Business Rules ── */}
      <CollapsibleSection title="Business Rules" icon="§" count={rules.length} onAdd={addRule}>
        <table className="sheet-table">
          <thead><tr>
            <th style={{width:20}}/>
            <th>Rule</th>
            <th style={{width:28}}/>
          </tr></thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={r.id}>
                <td style={{width:20}}><span className="row-idx">{i+1}</span></td>
                <td><input className="cell-input" value={r.text} onChange={e => updateRule(r.id, e.target.value)} placeholder="e.g. Only managers can approve"/></td>
                <td style={{width:28}}><button className="del-btn" onClick={() => deleteRule(r.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CollapsibleSection>
    </div>
  );
}

// ── Reusable collapsible section header ───────────────────────
function CollapsibleSection({ title, icon, count, onAdd, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="sec">
      <div className="sec-header" onClick={() => setOpen(o => !o)}>
        <span className="sec-chevron" style={open ? {transform:'rotate(90deg)'} : {}}>{icon} ▶</span>
        <span className="sec-title">{title}</span>
        <span className="sec-count">{count} rows</span>
        <button className="sec-add" onClick={e => { e.stopPropagation(); onAdd(); }}>+ Add</button>
      </div>
      {open && children}
    </div>
  );
}

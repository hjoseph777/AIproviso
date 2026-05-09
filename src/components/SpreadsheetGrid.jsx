import { useState, useCallback } from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { validateWorkflow } from '../validation/schema';

export default function SpreadsheetGrid({ wfId, onSelectState }) {
  const wf               = useWorkflowStore(s => s.workflows.find(w => w.id === wfId));
  const addState         = useWorkflowStore(s => s.addState);
  const updateState      = useWorkflowStore(s => s.updateState);
  const renameState      = useWorkflowStore(s => s.renameState);
  const deleteState      = useWorkflowStore(s => s.deleteState);
  const addTransition    = useWorkflowStore(s => s.addTransition);
  const updateTransition = useWorkflowStore(s => s.updateTransition);
  const deleteTransition = useWorkflowStore(s => s.deleteTransition);

  const [stateError,      setStateError]      = useState('');
  const [selectedStateId, setSelectedStateId] = useState(null);
  const [statesOpen,      setStatesOpen]      = useState(true);
  const [transOpen,       setTransOpen]       = useState(true);
  // Search filters
  const [stateFilter, setStateFilter] = useState('');
  const [transFilter, setTransFilter] = useState('');

  if (!wf) return null;

  const stateNames = wf.states.map(s => s.name).filter(Boolean);
  const validation = validateWorkflow(wf);

  // Outgoing map for badge display on selected row
  const outgoing = {};
  wf.transitions.forEach(t => {
    if (!t.from) return;
    if (!outgoing[t.from]) outgoing[t.from] = [];
    outgoing[t.from].push(t.to);
  });

  // Filtered rows (search is purely visual — indices into wf.states/wf.transitions)
  const filteredStates = wf.states
    .map((st, i) => ({ ...st, _i: i }))
    .filter(st => !stateFilter || st.name.toLowerCase().includes(stateFilter.toLowerCase()));

  const filteredTrans = wf.transitions
    .map((t, i) => ({ ...t, _i: i }))
    .filter(t =>
      !transFilter ||
      t.from.toLowerCase().includes(transFilter.toLowerCase()) ||
      t.to.toLowerCase().includes(transFilter.toLowerCase())
    );

  const handleSelectState = (id, name) => {
    setSelectedStateId(id);
    onSelectState?.(name);
  };

  const handleDeleteState = (stateId) => {
    const result = deleteState(wfId, stateId);
    if (!result.ok) setStateError(result.error);
    else setStateError('');
  };

  return (
    <div className="sheet-body">

      {/* Validation banner */}
      {!validation.valid && (
        <div className="val-banner">
          {validation.errors.slice(0, 3).map((e, i) => (
            <div key={i} className="val-item">⚠ {e.message}</div>
          ))}
          {validation.errors.length > 3 && (
            <div className="val-item val-more">+{validation.errors.length - 3} more issues</div>
          )}
        </div>
      )}

      {stateError && (
        <div className="val-banner val-banner-err">
          <div className="val-item">⛔ {stateError}</div>
          <button className="val-dismiss" onClick={() => setStateError('')}>✕</button>
        </div>
      )}

      {/* ══ STATES ══ */}
      <div className="sec">
        <div className="sec-header" onClick={() => setStatesOpen(o => !o)}>
          <span className="sec-chevron" style={statesOpen ? {transform:'rotate(90deg)'} : {}}>⬡ ▶</span>
          <span className="sec-title">States</span>
          <span className="sec-count">{wf.states.length} rows</span>
          {/* Inline search — stops propagation so click doesn't collapse */}
          {statesOpen && (
            <input
              className="sec-filter"
              placeholder="Filter states…"
              value={stateFilter}
              onClick={e => e.stopPropagation()}
              onChange={e => setStateFilter(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setStateFilter(''); e.stopPropagation(); }}
            />
          )}
          <button className="sec-add" onClick={e => { e.stopPropagation(); addState(wfId); }}>+ Add</button>
        </div>

        {statesOpen && (
          <div className="table-scroll-states">
            <table className="sheet-table">
              <thead>
                <tr>
                  <th style={{width:28}}>#</th>
                  <th>State Name</th>
                  <th style={{width:70}}>Initial</th>
                  <th style={{width:32}}/>
                </tr>
              </thead>
              <tbody>
                {filteredStates.map((st) => {
                  const i          = st._i;
                  const isSelected = selectedStateId === st.id;
                  const hasError   = validation.stateErrors.has(i);
                  const outs       = outgoing[st.name] || [];
                  return (
                    <>
                      <tr
                        key={st.id}
                        className={`${isSelected ? 'selected' : ''} ${hasError ? 'row-err' : ''}`}
                        onClick={() => handleSelectState(st.id, st.name)}
                        style={{cursor:'pointer'}}
                      >
                        <td style={{width:28, padding:0}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',padding:'0 4px'}}>
                            {isSelected
                              ? <div style={{width:3,height:24,background:'var(--a3)',borderRadius:2}}/>
                              : <span className="row-idx">{i+1}</span>
                            }
                          </div>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <input
                            className="cell-input"
                            value={st.name}
                            placeholder="e.g. Draft"
                            onChange={e => renameState(wfId, st.id, e.target.value)}
                          />
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div className="cell-check">
                            <input
                              type="checkbox"
                              checked={!!st.initial}
                              onChange={e => updateState(wfId, st.id, { initial: e.target.checked })}
                            />
                          </div>
                        </td>
                        <td style={{width:32}} onClick={e => e.stopPropagation()}>
                          <button className="del-btn" onClick={() => handleDeleteState(st.id)}>✕</button>
                        </td>
                      </tr>

                      {/* Outgoing badge row — shown when state is selected */}
                      {isSelected && outs.length > 0 && (
                        <tr key={`${st.id}-out`} style={{background:'rgba(21,101,216,.05)'}}>
                          <td colSpan={4} style={{padding:0}}>
                            <div style={{display:'flex',gap:4,flexWrap:'wrap',padding:'3px 10px'}}>
                              <span style={{fontSize:9,color:'var(--dim)',marginRight:2}}>→ outgoing:</span>
                              {outs.map((t, j) => (
                                <span key={j} style={{fontSize:9,background:'rgba(74,159,255,.1)',border:'1px solid rgba(74,159,255,.2)',color:'var(--a3)',padding:'1px 6px',borderRadius:10}}>
                                  {t}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}

                {/* Ghost row — eliminates empty gap, signals "keep adding" */}
                <tr className="ghost-row">
                  <td colSpan={4}>
                    {stateFilter
                      ? `${filteredStates.length} of ${wf.states.length} shown — ESC to clear`
                      : `─ ─  ${wf.states.length} state${wf.states.length !== 1 ? 's' : ''} · click + Add for more  ─ ─`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ TRANSITIONS ══ */}
      <div className="sec">
        <div className="sec-header" onClick={() => setTransOpen(o => !o)}>
          <span className="sec-chevron" style={transOpen ? {transform:'rotate(90deg)'} : {}}>→ ▶</span>
          <span className="sec-title">Transitions</span>
          <span className="sec-count">{wf.transitions.length} rows</span>
          {transOpen && (
            <input
              className="sec-filter"
              placeholder="Filter transitions…"
              value={transFilter}
              onClick={e => e.stopPropagation()}
              onChange={e => setTransFilter(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setTransFilter(''); e.stopPropagation(); }}
            />
          )}
          <button className="sec-add" onClick={e => { e.stopPropagation(); addTransition(wfId); }}>+ Add</button>
        </div>

        {transOpen && (
          <div className="table-scroll-trans">
            <table className="sheet-table">
              <thead>
                <tr>
                  <th style={{width:28}}>#</th>
                  <th style={{width:'46%'}}>From</th>
                  <th style={{width:'46%'}}>To</th>
                  <th style={{width:32}}/>
                </tr>
              </thead>
              <tbody>
                {filteredTrans.map((t) => {
                  const i        = t._i;
                  const hasError = validation.transitionErrors.has(i);
                  return (
                    <tr key={t.id} className={hasError ? 'row-err' : ''}>
                      <td style={{width:28}}>
                        <span className="row-idx">{i+1}</span>
                      </td>
                      <td>
                        <select
                          className="cell-select"
                          value={t.from}
                          onChange={e => updateTransition(wfId, t.id, { from: e.target.value })}
                        >
                          <option value="">— From —</option>
                          {stateNames.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </td>
                      <td>
                        <select
                          className="cell-select"
                          value={t.to}
                          onChange={e => updateTransition(wfId, t.id, { to: e.target.value })}
                        >
                          <option value="">— To —</option>
                          {stateNames.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </td>
                      <td style={{width:32}}>
                        <button className="del-btn" onClick={() => deleteTransition(wfId, t.id)}>✕</button>
                      </td>
                    </tr>
                  );
                })}

                {/* Ghost row */}
                <tr className="ghost-row">
                  <td colSpan={4}>
                    {transFilter
                      ? `${filteredTrans.length} of ${wf.transitions.length} shown — ESC to clear`
                      : `─ ─  ${wf.transitions.length} transition${wf.transitions.length !== 1 ? 's' : ''} · click + Add for more  ─ ─`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

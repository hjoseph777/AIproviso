import { useState } from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { useMermaid } from '../hooks/useMermaid';
import { useExport } from '../hooks/useExport';
import SpreadsheetGrid from './SpreadsheetGrid';
import GlobalSection from './GlobalSection';
import DiagramPane from './DiagramPane';

// ── WorkflowEditor ─────────────────────────────────────────────
// Main screen: workflow tabs + left spreadsheet + right diagram.
export default function WorkflowEditor({ onSave }) {
  const workflows      = useWorkflowStore(s => s.workflows);
  const activeId       = useWorkflowStore(s => s.activeId);
  const getActive      = useWorkflowStore(s => s.getActive);
  const setActive      = useWorkflowStore(s => s.setActive);
  const addWorkflow    = useWorkflowStore(s => s.addWorkflow);
  const deleteWorkflow = useWorkflowStore(s => s.deleteWorkflow);
  const renameWorkflow = useWorkflowStore(s => s.renameWorkflow);
  const clearWorkflow   = useWorkflowStore(s => s.clearWorkflow);
  const loadStressTest  = useWorkflowStore(s => s.loadStressTest);

  const [leftTab,     setLeftTab]     = useState('diagram'); // diagram | global
  const [rightTab,    setRightTab]    = useState('diagram'); // diagram | json
  const [selectedState, setSelectedState] = useState('');
  const [flash,          setFlash]          = useState(false);
  const [resetFlash,     setResetFlash]     = useState(false);
  const [stressFlash,    setStressFlash]    = useState(false);
  const [stressFlashLbl, setStressFlashLbl] = useState('');   // blink label showing loaded counts
  const [stressMode,     setStressMode]     = useState('low'); // toggles: 'low'=25/50 | 'max'=100/150
  const [resetCount,     setResetCount]     = useState(0);     // forces DiagramPane remount
  const [editingTabId, setEditingTabId] = useState(null);
  const [tabDraft,     setTabDraft]     = useState('');

  const activeWf   = getActive();
  const mermaidStr = useMermaid(activeWf);
  const { exportJSON } = useExport();

  const handleSave = () => {
    if (activeWf) onSave(activeWf);
    setFlash(true);
    setTimeout(() => setFlash(false), 1800);
  };

  const handleClear = () => {
    if (!activeId) return;
    clearWorkflow(activeId);          // empties states + transitions of active tab only
    setSelectedState('');
    setResetCount(c => c + 1);        // force DiagramPane remount
    setResetFlash(true);
    setTimeout(() => setResetFlash(false), 1800);
  };
  // Returns stress config for the ACTIVE tab only
  // Dedicated tabs: wf-a=Low(25/50), wf-b=Max(100/150)
  // Other tabs: use stressMode toggle
  const getStressConfig = () => {
    if (activeId === 'wf-a') return { N: 25,  target: 50,  hint: '🔥 Load 25 States / 50 Transitions into Workflow A' };
    if (activeId === 'wf-b') return { N: 100, target: 150, hint: '🔥🔥 Load 100 States / 150 Transitions into Workflow B' };
    return stressMode === 'low'
      ? { N: 25,  target: 50,  hint: '🔥 Load: 25 States / 50 Transitions - click again for 100/150' }
      : { N: 100, target: 150, hint: '🔥🔥 Load: 100 States / 150 Transitions - click again for 25/50' };
  };

  const handleStress = () => {
    if (!activeId) return;
    const { N, target } = getStressConfig();
    loadStressTest(activeId, N, target);
    setSelectedState('');
    setResetCount(c => c + 1);
    setStressFlashLbl(`⚡ ${N} States / ${target} Trans.`);
    setStressFlash(true);
    setTimeout(() => {
      setStressFlash(false);
      // Only toggle mode when NOT on a dedicated stress tab
      if (activeId !== 'wf-a' && activeId !== 'wf-b') {
        setStressMode(m => m === 'low' ? 'max' : 'low');
      }
    }, N <= 25 ? 1500 : 3000);
  };

  const startRenameTab = (wf) => {
    setEditingTabId(wf.id);
    setTabDraft(wf.name);
  };

  const commitRenameTab = () => {
    if (editingTabId && tabDraft.trim()) renameWorkflow(editingTabId, tabDraft.trim());
    setEditingTabId(null);
    setTabDraft('');
  };

  return (
    <div className="ss-screen">

      {/* ── LEFT PANE ── */}
      <div className="ss-left">

        {/* ── Top toolbar ── */}
        <div className="ss-toolbar">
          {/* Workflow tabs */}
          <div className="wf-tabs">
            {workflows.map(wf => (
              <div
                key={wf.id}
                className={`wf-tab ${wf.id === activeId ? 'active' : ''}`}
                onClick={() => setActive(wf.id)}
                onDoubleClick={() => startRenameTab(wf)}
                title="Double-click to rename"
              >
                {editingTabId === wf.id ? (
                  <input
                    className="wf-tab-input"
                    value={tabDraft}
                    autoFocus
                    onChange={e => setTabDraft(e.target.value)}
                    onBlur={commitRenameTab}
                    onKeyDown={e => { if (e.key === 'Enter') commitRenameTab(); if (e.key === 'Escape') setEditingTabId(null); }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className="wf-tab-name">{wf.name}</span>
                )}
                {workflows.length > 1 && (
                  <button
                    className="wf-tab-del"
                    onClick={e => { e.stopPropagation(); deleteWorkflow(wf.id); }}
                    title="Remove workflow"
                  >✕</button>
                )}
              </div>
            ))}
            <button className="sec-add" style={{marginLeft:6,alignSelf:'center'}} onClick={addWorkflow}>+ Add Workflow</button>
          </div>

          {/* Action buttons */}
          <div style={{display:'flex',gap:6,padding:'6px 12px',flexShrink:0,borderBottom:'1px solid var(--border)',alignItems:'center'}}>
            <button className={`xb ${resetFlash ? 'green' : ''}`} onClick={handleClear} title="Clear all states and transitions for this workflow tab">
              {resetFlash ? '✓ Cleared' : '↺ Clear'}
            </button>
            <button
              className={`xb ${stressFlash ? 'green' : ''}`}
              onClick={handleStress}
              title={getStressConfig().hint}>
              {stressFlash ? stressFlashLbl : '⚡ Stress Test'}
            </button>
            {/* Spacer pushes Export + Save group to the right */}
            <div style={{flex:1}}/>
            <button className="xb" onClick={exportJSON} title="Export all workflows as JSON">↓ Export JSON</button>
            <button className={`xb ${flash ? 'green' : ''}`} onClick={handleSave} title="Mark workflow as saved">
              {flash ? '✓ Saved' : '↓ Save JSON'}
            </button>
          </div>

          {/* View toggle: Diagram | Global */}
          <div style={{display:'flex',gap:2,padding:'6px 12px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
            <div className="tab-row">
              <button className={`tab ${leftTab === 'diagram' ? 'on' : ''}`} onClick={() => setLeftTab('diagram')}>States & Transitions</button>
              <button className={`tab ${leftTab === 'global'  ? 'on' : ''}`} onClick={() => setLeftTab('global')}>Users & Properties</button>
            </div>
          </div>
        </div>

        {/* ── Spreadsheet content ── */}
        {leftTab === 'diagram' && activeWf && (
          <SpreadsheetGrid
            key={activeId}
            wfId={activeId}
            onSelectState={name => setSelectedState(name)}
          />
        )}
        {leftTab === 'global' && <GlobalSection />}
        {!activeWf && (
          <div className="d-empty" style={{flex:1}}>
            <div className="d-empty-icon">⬡</div>
            <div>No workflow — click ＋ to add one</div>
          </div>
        )}
      </div>

      {/* ── RIGHT PANE ── */}
      <div className="ss-right">
        <div className="d-head">
          <span className="ss-headlbl">
            {mermaidStr
              ? selectedState ? `Diagram — ${selectedState} selected` : 'Live Workflow Diagram'
              : activeWf?.states.length ? "Check an 'Initial' state to view the diagram" : 'Live Workflow Diagram'}
          </span>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            {selectedState && rightTab !== 'json' && mermaidStr && (
              <div style={{fontSize:9,background:'rgba(74,159,255,.1)',border:'1px solid rgba(74,159,255,.2)',color:'var(--a3)',padding:'2px 8px',borderRadius:3,display:'flex',alignItems:'center',gap:5}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:'var(--a3)',display:'inline-block',animation:'tip-pulse 1.5s ease-in-out infinite'}}/>
                {selectedState}
              </div>
            )}
            <div className="tab-row">
              <button className={`tab ${rightTab !== 'json' ? 'on' : ''}`} onClick={() => setRightTab('diagram')}>Diagram</button>
              <button className={`tab ${rightTab === 'json' ? 'on' : ''}`} onClick={() => setRightTab('json')}>JSON</button>
            </div>
          </div>
        </div>

        {rightTab === 'json' ? (
          <div className="json-body">
            <pre style={{fontFamily:'JetBrains Mono,monospace',fontSize:10.5,lineHeight:1.7,color:'var(--text)',whiteSpace:'pre-wrap'}}>
              {activeWf ? JSON.stringify(activeWf, null, 2) : 'No workflow loaded'}
            </pre>
          </div>
        ) : (
          <DiagramPane key={resetCount} mermaidCode={mermaidStr} selectedState={selectedState} />
        )}
      </div>
    </div>
  );
}

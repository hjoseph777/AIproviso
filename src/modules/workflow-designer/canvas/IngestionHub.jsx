/**
 * IngestionHub — replaces the blocking "Workflow Studio" modal.
 *
 * Renders as an absolute-positioned glassmorphic panel centered ON the canvas
 * grid when nodes.length === 0. The moment the user adds a node (drag, click,
 * or template), the hub fades out and scales away — no modal, no interruption.
 */

import { useEffect, useRef, useState } from 'react';
import { AP_TEMPLATES, parseScenario } from './WorkflowModeSelector';
import useProjectStore from '../store/useProjectStore';

// ── Glassmorphism base — slate-900/40, backdrop-blur-md, crisp white/10 border
const GLASS = {
  background: 'rgba(15, 23, 42, 0.40)',       // bg-slate-900/40
  backdropFilter: 'blur(12px) saturate(140%)', // backdrop-blur-md
  WebkitBackdropFilter: 'blur(12px) saturate(140%)',
  border: '1px solid rgba(255,255,255,0.10)',  // border-white/10
  boxShadow: '0 0 50px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.06)',
  borderRadius: 18,
};

// Spring easing — cubic-bezier(0.16, 1, 0.3, 1) matches Radix/Linear feel
const SPRING = 'all 550ms cubic-bezier(0.16, 1, 0.3, 1)';

const CARD = {
  ...GLASS,
  borderRadius: 14,
  padding: '20px 22px',
  cursor: 'pointer',
  transition: SPRING,
  flex: '1 1 0',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

function HubCard({ color, icon, title, desc, active, onClick, children, className }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={className}
      style={{
        ...CARD,
        border: `1px solid ${active || hovered ? color + '55' : 'rgba(255,255,255,0.10)'}`,
        background: active || hovered
          ? `linear-gradient(135deg, ${color}14, rgba(15,23,42,0.75))`
          : GLASS.background,
        boxShadow: active
          ? `0 0 0 1px ${color}30, 0 12px 36px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07)`
          : GLASS.boxShadow,
        transform: hovered && !active ? 'translateY(-2px)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22, filter: `drop-shadow(0 0 8px ${color})` }}>{icon}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: active ? color : '#dde7f5', letterSpacing: '-.1px' }}>
            {title}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(100,116,139,0.7)', marginTop: 2, lineHeight: 1.4 }}>
            {desc}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function IngestionHub({ rfNodes, onModeSelect, visible, activeProjectId, onRequireProject }) {
  // ── Project creation — embedded directly in the hub (continuous flow) ──────
  const createProject    = useProjectStore((s) => s.createProject);
  const projects         = useProjectStore((s) => s.projects);
  const [hubProjectName,   setHubProjectName]   = useState('');
  const [hubProjectClient, setHubProjectClient] = useState('');
  const [hubCreating,      setHubCreating]      = useState(false);
  const [hubCreated,       setHubCreated]       = useState(false);
  const [hubProjectNudged, setHubProjectNudged] = useState(false);
  const projectNameInputRef = useRef(null);

  // Auto-focus project name input when hub shows and no project exists
  useEffect(() => {
    if (!activeProjectId && visible) {
      setTimeout(() => projectNameInputRef.current?.focus(), 120);
    }
  }, [activeProjectId, visible]);

  const handleCreateProject = async () => {
    if (!hubProjectName.trim() || hubCreating) return;
    setHubCreating(true);
    try {
      await createProject({ name: hubProjectName.trim(), clientName: hubProjectClient.trim() });
      setHubCreated(true);
      setHubProjectName('');
      setHubProjectClient('');
      setTimeout(() => setHubCreated(false), 2000);
    } finally {
      setHubCreating(false);
    }
  };

  const nudgeProjectForm = () => {
    setHubProjectNudged(true);
    setTimeout(() => setHubProjectNudged(false), 420);
    setTimeout(() => projectNameInputRef.current?.focus(), 40);
  };

  // ── Workflow mode state ────────────────────────────────────────────────────
  const [aiText, setAiText] = useState('');
  const [activeMode, setActiveMode] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [workflowName, setWorkflowName] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSource, setAiSource] = useState(null);   // 'flowise' | 'ollama' | 'keyword-fallback'
  const [aiError, setAiError] = useState(null);
  const [datasetCandidates, setDatasetCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState(null);
  const aiInputRef = useRef(null);

  const isVisible = visible && rfNodes.length === 0;

  useEffect(() => {
    if (activeMode === 3) setTimeout(() => aiInputRef.current?.focus(), 50);
  }, [activeMode]);

  // Reset AI state when mode changes away from 3
  useEffect(() => {
    if (activeMode !== 3) {
      setAiSource(null);
      setAiError(null);
      setDatasetCandidates([]);
      setCandidatesError(null);
      setCandidatesLoading(false);
    }
  }, [activeMode]);

  const fetchDatasetCandidates = async (scenario, workflow) => {
    setCandidatesLoading(true);
    setCandidatesError(null);
    try {
      const res = await fetch('/api/dataset/find-similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_text: scenario,
          workflow_json: workflow,
          limit: 5,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || 'similarity lookup failed');
      }
      setDatasetCandidates(Array.isArray(data.candidates) ? data.candidates : []);
    } catch (err) {
      setCandidatesError(err?.message || 'Unable to load dataset candidates');
      setDatasetCandidates([]);
    } finally {
      setCandidatesLoading(false);
    }
  };

  const handleTemplateSelect = (tpl) => {
    setSelectedTemplate(tpl);
    setActiveMode(1);
    setWorkflowName(tpl.name);
  };

  // ── Mode 3: AI generation via backend (Flowise → Ollama → keyword fallback) ──
  const handleAiGenerate = async () => {
    if (!aiText.trim() || aiGenerating) return;
    if (!activeProjectId) { nudgeProjectForm(); return; }

    setAiGenerating(true);
    setAiError(null);
    setAiSource(null);

    try {
      const res = await fetch('/api/ai/generate-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: aiText.trim() }),
      });
      const data = await res.json();

      if (data.ok && data.workflow) {
        setAiSource(data.source);
        const { name, states, transitions } = data.workflow;
        const generatedWorkflow = { name, states, transitions };
        fetchDatasetCandidates(aiText.trim(), generatedWorkflow);
        // Short delay so user sees the source badge before dismiss
        setTimeout(() => {
          onModeSelect({
            mode: 3,
            parsed: { states, transitions },
            name: workflowName || name || 'AI Generated Workflow',
          });
        }, 800);
      } else {
        // Endpoint returned error — local fallback
        setAiError('Backend unavailable — using keyword NLP');
        const parsed = parseScenario(aiText.trim());
        fetchDatasetCandidates(aiText.trim(), parsed);
        setTimeout(() => {
          onModeSelect({ mode: 3, parsed, name: workflowName || 'AI Generated Workflow' });
        }, 1200);
      }
    } catch {
      // Network error — local fallback
      setAiError('Network error — using keyword NLP');
      const parsed = parseScenario(aiText.trim());
      fetchDatasetCandidates(aiText.trim(), parsed);
      setTimeout(() => {
        onModeSelect({ mode: 3, parsed, name: workflowName || 'AI Generated Workflow' });
      }, 1200);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleConfirm = () => {
    if (!activeProjectId) { nudgeProjectForm(); return; }
    if (activeMode === 1 && selectedTemplate) {
      onModeSelect({ mode: 1, template: selectedTemplate, name: workflowName || selectedTemplate.name });
    } else if (activeMode === 2) {
      onModeSelect({ mode: 2, name: workflowName || 'New Workflow' });
    } else if (activeMode === 3 && aiText.trim()) {
      handleAiGenerate();   // async — replaces old synchronous parseScenario call
    } else if (activeMode === 4) {
      onModeSelect({ mode: 4 });
    }
  };

  const handleAiKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && aiText.trim()) {
      e.preventDefault();
      handleAiGenerate();
    }
  };

  // Source badge colours
  const SOURCE_META = {
    'flowise':          { label: '✦ Flowise + phi4-mini', color: '#a78bfa' },
    'ollama':           { label: `✦ Ollama (${(aiSource||'').replace('ollama/','')})`, color: '#38bdf8' },
    'keyword-fallback': { label: '⌁ Keyword NLP fallback', color: '#fbbf24' },
  };

  const KIND_COLORS = { initial: '#00C870', technical: '#20C3D8', approval: '#F0A500', exception: '#FF3D5A', terminal: '#9B7EFF', standard: '#4A9FFF' };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // z-index: 4 sits above RF grid/background (z:0-2) and nodes (z:3),
        // but below Action Decks, toolbar Panels, and left palette (z:10+)
        zIndex: 4,
        pointerEvents: isVisible ? 'all' : 'none',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(8px)',
        transition: SPRING,
      }}
    >
      <div style={{ width: '100%', maxWidth: 860, padding: '0 24px' }}>

        {/* ── Header — static, no project-state messaging on canvas ── */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(100,116,139,0.45)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 6 }}>
            ✦ Workflow Studio
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#dde7f5', margin: 0, letterSpacing: '-.2px' }}>
            How would you like to start?
          </h2>
          {activeProjectId && (
            <p style={{ fontSize: 11, color: 'rgba(100,116,139,0.45)', marginTop: 5 }}>
              Drag any component from the left palette to skip this
            </p>
          )}
        </div>

        {/* ── Step 1: Inline project creation — only shown when no project exists ── */}
        {!activeProjectId && (
          <div style={{
            ...GLASS,
            padding: '16px 20px 18px',
            marginBottom: 16,
            border: hubCreated
              ? '1px solid rgba(74,222,128,0.45)'
              : hubProjectNudged
                ? '1px solid rgba(245,158,11,0.5)'
                : '1px solid rgba(251,191,36,0.28)',
            background: hubCreated
              ? 'rgba(74,222,128,0.07)'
              : 'rgba(15,23,42,0.55)',
            boxShadow: hubProjectNudged
              ? '0 0 0 1px rgba(245,158,11,0.34), 0 0 26px rgba(245,158,11,0.28), 0 0 46px rgba(245,158,11,0.12)'
              : GLASS.boxShadow,
            transition: SPRING,
          }}>
            {hubCreated ? (
              /* Success flash */
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18, filter: 'drop-shadow(0 0 8px rgba(74,222,128,0.8))' }}>✓</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>Project created!</div>
                  <div style={{ fontSize: 10, color: 'rgba(100,116,139,0.7)', marginTop: 2 }}>Now choose how to start your workflow below.</div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: '#f59e0b',
                    boxShadow: '0 0 6px rgba(245,158,11,0.8)',
                    animation: 'collab-pulse 2s ease-in-out infinite',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', letterSpacing: '.2px' }}>
                    Name your project to get started
                  </span>
                  {projects.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onRequireProject?.()}
                      style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(100,116,139,0.6)', background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}
                    >
                      Switch existing →
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      ref={projectNameInputRef}
                      placeholder="Project name *"
                      value={hubProjectName}
                      onChange={(e) => setHubProjectName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject(); }}
                      aria-label="Project name"
                      style={{
                        background: 'rgba(255,255,255,0.07)',
                        border: `1px solid ${hubProjectName.trim() ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.12)'}`,
                        borderRadius: 8, padding: '8px 12px',
                        fontSize: 12, color: '#dde7f5', outline: 'none',
                        fontFamily: 'inherit', transition: SPRING,
                      }}
                    />
                    <input
                      placeholder="Client name (optional)"
                      value={hubProjectClient}
                      onChange={(e) => setHubProjectClient(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject(); }}
                      aria-label="Client name"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, padding: '7px 12px',
                        fontSize: 11, color: '#94a3b8', outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!hubProjectName.trim() || hubCreating}
                    onClick={handleCreateProject}
                    aria-label="Create project and continue"
                    style={{
                      padding: '0 20px', height: 70, borderRadius: 9,
                      border: `1px solid ${hubProjectName.trim() ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.08)'}`,
                      background: hubProjectName.trim() ? 'rgba(74,222,128,0.14)' : 'rgba(255,255,255,0.04)',
                      color: hubProjectName.trim() ? '#4ade80' : 'rgba(100,116,139,0.4)',
                      fontSize: 12, fontWeight: 700, cursor: hubProjectName.trim() ? 'pointer' : 'not-allowed',
                      transition: SPRING, flexShrink: 0, lineHeight: 1,
                      boxShadow: hubProjectName.trim() ? '0 0 16px rgba(74,222,128,0.15)' : 'none',
                    }}
                  >
                    {hubCreating ? '…' : '✓ Create'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step 2: 4 mode cards — passive dim only when no project; click nudges header pill ── */}
        {!activeProjectId && (
          <div
            style={{
              marginBottom: 8,
              textAlign: 'center',
              fontSize: 10,
              color: 'rgba(148,163,184,0.68)',
              letterSpacing: '.2px',
            }}
          >
            Create a project above to unlock these options.
          </div>
        )}
        <div
          role={!activeProjectId ? 'button' : undefined}
          aria-label={!activeProjectId ? 'Open or create a project to enable workflow creation' : undefined}
          aria-disabled={!activeProjectId ? 'true' : undefined}
          tabIndex={!activeProjectId ? 0 : undefined}
          onKeyDown={!activeProjectId ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nudgeProjectForm(); } } : undefined}
          style={{
            display: 'flex', gap: 12, alignItems: 'stretch', position: 'relative',
            opacity: activeProjectId ? 1 : 0.56,
            filter: activeProjectId ? 'none' : 'saturate(0.55) brightness(0.9)',
            transition: SPRING,
            cursor: !activeProjectId ? 'pointer' : 'default',
          }}
          onClick={!activeProjectId ? () => nudgeProjectForm() : undefined}
        >

          {/* Mode 1: Templates */}
          <HubCard
            color="#38bdf8"
            icon="⚡"
            title="AP Templates"
            desc="Pre-wired AP flows — ready in one click"
            active={activeMode === 1}
            onClick={() => setActiveMode(1)}
          >
            {activeMode === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {AP_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleTemplateSelect(tpl); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', borderRadius: 9, border: '1px solid',
                      background: selectedTemplate?.id === tpl.id ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)',
                      borderColor: selectedTemplate?.id === tpl.id ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.08)',
                      cursor: 'pointer', transition: 'all .14s', textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 15 }}>{tpl.icon}</span>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: selectedTemplate?.id === tpl.id ? '#38bdf8' : '#94a3b8' }}>{tpl.name}</div>
                      <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.6)', marginTop: 1 }}>
                        {tpl.states.length} states ·{' '}
                        {tpl.tags.slice(0, 2).join(' · ')}
                      </div>
                    </div>
                    {/* State kind preview dots */}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
                      {tpl.states.slice(0, 5).map((s, i) => (
                        <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: KIND_COLORS[s.state_kind] || '#4A9FFF', opacity: 0.7 }} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </HubCard>

          {/* Mode 2: Scratch */}
          <HubCard
            color="#4ade80"
            icon="✏️"
            title="Draw from Scratch"
            desc="Start with a blank canvas and build freely"
            active={activeMode === 2}
            onClick={() => { setActiveMode(2); setWorkflowName(''); }}
          >
            {activeMode === 2 && (
              <div style={{ marginTop: 4, fontSize: 10, color: 'rgba(74,222,128,0.7)', lineHeight: 1.6 }}>
                A blank workflow will be created. Drag AP components from the left palette, or click the node kinds on the Creation Deck.
              </div>
            )}
          </HubCard>

          {/* Mode 3: AI Generate — pulsing violet→cyan border via CSS */}
          <HubCard
            color="#a78bfa"
            icon="✨"
            title="AI Generated"
            desc="Describe your process — we build the workflow"
            active={activeMode === 3}
            className="hub-ai-card"
            onClick={() => setActiveMode(3)}
          >
            {activeMode === 3 && (
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  ref={aiInputRef}
                  value={aiText}
                  onChange={(e) => { setAiText(e.target.value); setAiError(null); setAiSource(null); }}
                  onKeyDown={handleAiKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  disabled={aiGenerating}
                  placeholder="✨ Describe your AP process in plain language…&#10;e.g. 'invoice with 3-way match, manager approval over $25k, exception queue for failed matches'"
                  rows={3}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: aiGenerating ? 'rgba(167,139,250,0.04)' : 'rgba(167,139,250,0.08)',
                    border: '1px solid rgba(167,139,250,0.30)',
                    borderRadius: 9, padding: '8px 10px',
                    fontSize: 10, color: '#c8d8ec', outline: 'none', resize: 'none',
                    fontFamily: 'inherit', lineHeight: 1.5, transition: SPRING,
                    opacity: aiGenerating ? 0.6 : 1,
                  }}
                />

                {/* Generating spinner */}
                {aiGenerating && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                      border: '2px solid rgba(167,139,250,0.3)',
                      borderTopColor: '#a78bfa',
                      animation: 'spin 0.7s linear infinite',
                    }} />
                    <span style={{ fontSize: 10, color: '#a78bfa', fontFamily: 'var(--mono)' }}>
                      Generating workflow…
                    </span>
                  </div>
                )}

                {/* Source badge after generation */}
                {aiSource && !aiGenerating && (() => {
                  const meta = SOURCE_META[aiSource] || SOURCE_META['keyword-fallback'];
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: meta.color,
                        background: `${meta.color}18`, border: `1px solid ${meta.color}40`,
                        borderRadius: 99, padding: '2px 9px', fontFamily: 'var(--mono)' }}>
                        {meta.label.replace('${(aiSource||\'\')', aiSource || '')}
                      </span>
                    </div>
                  );
                })()}

                {/* Error / fallback notice */}
                {aiError && (
                  <div style={{ fontSize: 9, color: '#fbbf24', fontFamily: 'var(--mono)' }}>
                    ⚠ {aiError}
                  </div>
                )}

                {(candidatesLoading || candidatesError || datasetCandidates.length > 0) && (
                  <div
                    style={{
                      border: '1px solid rgba(56,189,248,0.22)',
                      background: 'rgba(15,23,42,0.55)',
                      borderRadius: 9,
                      padding: '8px 9px',
                    }}
                  >
                    <div style={{ fontSize: 9, color: 'rgba(56,189,248,0.9)', fontWeight: 700, marginBottom: 6 }}>
                      Dataset candidates (Mode 3)
                    </div>
                    {candidatesLoading && (
                      <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.75)' }}>
                        Finding similar templates...
                      </div>
                    )}
                    {candidatesError && !candidatesLoading && (
                      <div style={{ fontSize: 9, color: '#fbbf24' }}>
                        ⚠ {candidatesError}
                      </div>
                    )}
                    {!candidatesLoading && !candidatesError && datasetCandidates.length === 0 && (
                      <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.7)' }}>
                        No close dataset records found yet.
                      </div>
                    )}
                    {!candidatesLoading && datasetCandidates.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {datasetCandidates.slice(0, 3).map((c) => (
                          <div
                            key={c.id}
                            style={{
                              border: '1px solid rgba(255,255,255,0.10)',
                              borderRadius: 7,
                              padding: '6px 7px',
                              display: 'grid',
                              gridTemplateColumns: '1fr auto',
                              gap: 6,
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 9, color: '#dde7f5', fontWeight: 700 }}>
                                {c.project_name || 'Dataset record'}
                              </div>
                              <div style={{ fontSize: 8, color: 'rgba(100,116,139,0.8)' }}>
                                {[c.province, c.industry, c.erp_type].filter(Boolean).join(' · ')}
                                {c.state_count ? ` · ${c.state_count} states` : ''}
                              </div>
                            </div>
                            <div style={{
                              fontSize: 9, fontFamily: 'var(--mono)', alignSelf: 'center',
                              color: (c.similarity_pct >= 80) ? '#4ade80'
                                   : (c.similarity_pct >= 60) ? '#fbbf24'
                                   : '#94a3b8',
                            }}>
                              {c.similarity_pct ?? 0}%
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!aiGenerating && !aiSource && (
                  <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.5)', textAlign: 'right' }}>
                    Press Enter or click Generate
                  </div>
                )}
              </div>
            )}
          </HubCard>

          {/* Mode 4: Preset Default */}
          <HubCard
            color="#fbbf24"
            icon="🚀"
            title="Preset Default"
            desc="Full AP automation — 9 states, 12 transitions"
            active={activeMode === 4}
            onClick={() => setActiveMode(4)}
          >
            {activeMode === 4 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {['Received', 'OCR Extracted', 'Matched', 'Pending Approval', 'Manager', 'CFO', 'Approved', 'Exception', 'Escalated'].map((name) => (
                    <span key={name} style={{ fontSize: 8, padding: '2px 7px', borderRadius: 99, border: '1px solid rgba(251,191,36,0.25)', color: 'rgba(251,191,36,0.7)', background: 'rgba(251,191,36,0.07)' }}>
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </HubCard>
        </div>{/* end 4-mode cards wrapper */}

        {/* ── Name input + Confirm — only interactive when project is active ── */}
        {activeMode !== null && activeProjectId && (
          <div
            style={{
              marginTop: 16, display: 'flex', gap: 10, alignItems: 'center',
              opacity: activeMode !== null ? 1 : 0,
              transform: activeMode !== null ? 'translateY(0)' : 'translateY(8px)',
              transition: 'all 0.25s ease',
            }}
          >
            <input
              placeholder="Workflow name (optional)…"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9,
                padding: '9px 14px', fontSize: 12, color: '#c8d8ec', outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <button
              type="button"
              onClick={activeMode === 3 ? handleAiGenerate : handleConfirm}
              disabled={(activeMode === 3 && !aiText.trim()) || aiGenerating}
              style={{
                padding: '9px 22px', borderRadius: 9, border: '1px solid',
                fontSize: 12, fontWeight: 700, cursor: (activeMode === 3 && !aiText.trim()) || aiGenerating ? 'not-allowed' : 'pointer',
                transition: 'all .16s',
                background: aiGenerating ? 'rgba(167,139,250,0.1)' : 'rgba(74,222,128,0.14)',
                borderColor: aiGenerating ? 'rgba(167,139,250,0.4)' : 'rgba(74,222,128,0.4)',
                color: aiGenerating ? '#a78bfa' : '#4ade80',
                boxShadow: aiGenerating ? '0 0 12px rgba(167,139,250,0.2)' : '0 0 12px rgba(74,222,128,0.2)',
                opacity: (activeMode === 3 && !aiText.trim()) ? 0.4 : 1,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {aiGenerating ? (
                <>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(167,139,250,0.3)', borderTopColor: '#a78bfa', animation: 'spin 0.7s linear infinite' }} />
                  Generating…
                </>
              ) : activeMode === 3 ? '✨ Generate Workflow' : '✓ Create Workflow'}
            </button>
            <button
              type="button"
              onClick={() => { setActiveMode(null); setSelectedTemplate(null); setAiText(''); setAiSource(null); setAiError(null); }}
              style={{ padding: '9px 14px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'transparent', color: 'rgba(100,116,139,0.6)' }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── Footer hint — only when project is active ── */}
        {activeProjectId && (
          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 10, color: 'rgba(100,116,139,0.4)' }}>
            Or just drag any component from the left palette to skip this entirely
          </div>
        )}

      </div>
    </div>
  );
}

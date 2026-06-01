/**
 * IngestionHub — replaces the blocking "Workflow Studio" modal.
 *
 * Renders as an absolute-positioned glassmorphic panel centered ON the canvas
 * grid when nodes.length === 0. The moment the user adds a node (drag, click,
 * or template), the hub fades out and scales away — no modal, no interruption.
 */

import { useEffect, useRef, useState } from 'react';
import { AP_TEMPLATES } from './WorkflowModeSelector';
import { parseScenario } from './WorkflowModeSelector';

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
  const [aiText, setAiText] = useState('');
  const [activeMode, setActiveMode] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [workflowName, setWorkflowName] = useState('');
  const aiInputRef = useRef(null);

  const isVisible = visible && rfNodes.length === 0;

  // Auto-focus AI input when Mode 3 is selected
  useEffect(() => {
    if (activeMode === 3) setTimeout(() => aiInputRef.current?.focus(), 50);
  }, [activeMode]);

  const handleTemplateSelect = (tpl) => {
    setSelectedTemplate(tpl);
    setActiveMode(1);
    setWorkflowName(tpl.name);
  };

  const handleConfirm = () => {
    // Gate: require a project before any workflow creation
    if (!activeProjectId) {
      onRequireProject?.();
      return;
    }
    if (activeMode === 1 && selectedTemplate) {
      onModeSelect({ mode: 1, template: selectedTemplate, name: workflowName || selectedTemplate.name });
    } else if (activeMode === 2) {
      onModeSelect({ mode: 2, name: workflowName || 'New Workflow' });
    } else if (activeMode === 3 && aiText.trim()) {
      const parsed = parseScenario(aiText.trim());
      onModeSelect({ mode: 3, parsed, name: workflowName || 'AI Generated Workflow' });
    } else if (activeMode === 4) {
      onModeSelect({ mode: 4 });
    }
  };

  const handleAiKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && aiText.trim()) {
      e.preventDefault();
      handleConfirm();
    }
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

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(100,116,139,0.6)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 8 }}>
            ✦ Workflow Studio
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#dde7f5', margin: 0, letterSpacing: '-.3px' }}>
            How would you like to start?
          </h2>
          <p style={{ fontSize: 12, color: 'rgba(100,116,139,0.6)', marginTop: 6 }}>
            Drag any component from the left palette to skip straight to the canvas
          </p>
        </div>

        {/* ── Project Required guard — replaces 4 mode cards when no project is active ── */}
        {!activeProjectId && (
          <div style={{
            ...GLASS,
            padding: '28px 32px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, filter: 'drop-shadow(0 0 10px rgba(56,189,248,0.6))' }}>◆</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#dde7f5', marginBottom: 6 }}>Project Required</div>
              <div style={{ fontSize: 11, color: 'rgba(100,116,139,0.7)', lineHeight: 1.6, maxWidth: 360 }}>
                Workflows must live inside a Project. Select or create a project using the{' '}
                <strong style={{ color: '#38bdf8' }}>◆ Project</strong> selector in the header above, then return here to begin designing.
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRequireProject?.()}
              style={{
                padding: '9px 20px', borderRadius: 9, border: '1px solid rgba(56,189,248,0.4)',
                background: 'rgba(56,189,248,0.1)', color: '#38bdf8',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: SPRING,
              }}
            >
              ◆ Select or Create a Project
            </button>
          </div>
        )}

        {/* ── 4 mode cards — only shown when a project is active ── */}
        {activeProjectId && <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>

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
                  onChange={(e) => setAiText(e.target.value)}
                  onKeyDown={handleAiKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="✨ Describe your AP process… e.g. 'invoice with 3-way match, manager approval over $25k, exception queue'"
                  rows={3}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.30)',
                    borderRadius: 9, padding: '8px 10px',
                    fontSize: 10, color: '#c8d8ec', outline: 'none', resize: 'none',
                    fontFamily: 'inherit', lineHeight: 1.5,
                    transition: SPRING,
                  }}
                />
                <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.5)', textAlign: 'right' }}>
                  Press Enter to generate
                </div>
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
        </div>}

        {/* ── Name input + Confirm ── */}
        {activeMode !== null && (
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
              onClick={handleConfirm}
              disabled={activeMode === 3 && !aiText.trim()}
              style={{
                padding: '9px 22px', borderRadius: 9, border: '1px solid',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .16s',
                background: 'rgba(74,222,128,0.14)', borderColor: 'rgba(74,222,128,0.4)',
                color: '#4ade80',
                boxShadow: '0 0 12px rgba(74,222,128,0.2)',
                opacity: activeMode === 3 && !aiText.trim() ? 0.4 : 1,
              }}
            >
              ✓ Create Workflow
            </button>
            <button
              type="button"
              onClick={() => { setActiveMode(null); setSelectedTemplate(null); setAiText(''); }}
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

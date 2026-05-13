import React, { useState, useEffect, useRef } from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';

export default function CommandPalette() {
  const { 
    workflows, activeId, setActive, 
    cmdPaletteOpen, setCmdPaletteOpen,
    exportJSON
  } = useWorkflowStore();
  
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  
  // Close on ESC, toggle on Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCmdPaletteOpen(!cmdPaletteOpen);
      }
      if (e.key === 'Escape' && cmdPaletteOpen) {
        setCmdPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cmdPaletteOpen, setCmdPaletteOpen]);

  // Focus input when opened
  useEffect(() => {
    if (cmdPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [cmdPaletteOpen]);

  if (!cmdPaletteOpen) return null;

  // Compile list of searchable items
  const items = [];
  
  // 1. Workflows
  workflows.forEach(w => {
    items.push({
      type: 'Workflow',
      icon: '📁',
      text: `Switch to: ${w.name}`,
      action: () => setActive(w.id)
    });
  });

  // 2. States in current workflow
  const activeWf = workflows.find(w => w.id === activeId);
  if (activeWf) {
    activeWf.states.forEach(s => {
      items.push({
        type: 'State',
        icon: '○',
        text: `State: ${s.name}`,
        action: () => {} // Jump to state in view could be added
      });
    });
    
    // 3. Actions
    items.push({
      type: 'Action',
      icon: '↓',
      text: 'Export JSON',
      action: exportJSON
    });
  }

  // Filter based on query
  const filtered = query.trim() 
    ? items.filter(i => i.text.toLowerCase().includes(query.toLowerCase()) || i.type.toLowerCase().includes(query.toLowerCase()))
    : items;

  // Handle keyboard navigation inside the palette
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
      setCmdPaletteOpen(false);
    }
  };

  return (
    <div className="cmd-overlay" onClick={() => setCmdPaletteOpen(false)}>
      <div className="cmd-modal" onClick={e => e.stopPropagation()}>
        <div className="cmd-head">
          <input 
            ref={inputRef}
            className="cmd-input" 
            placeholder="Search states, workflows, or actions..." 
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
          />
          <button className="cmd-close" title="Close search" onClick={() => setCmdPaletteOpen(false)}>✕</button>
        </div>
        <div className="cmd-results">
          {filtered.length === 0 && <div style={{padding: '20px', color: 'var(--dim)', textAlign: 'center'}}>No results found</div>}
          {filtered.map((item, i) => (
            <div 
              key={i} 
              className={`cmd-item ${i === selectedIndex ? 'selected' : ''}`}
              onMouseEnter={() => setSelectedIndex(i)}
              onClick={() => { item.action(); setCmdPaletteOpen(false); }}
            >
              <span className="cmd-item-icon">{item.icon}</span>
              <span className="cmd-item-text">{item.text}</span>
              <span className="cmd-item-type">{item.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef } from 'react';

const loadMermaid = () => new Promise(resolve => {
  if (window.mermaid) return resolve(window.mermaid);
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.6.1/mermaid.min.js';
  s.onload = () => {
    window.mermaid.initialize({
      startOnLoad: false, theme: 'base',
      themeVariables: {
        primaryColor: '#0F2D5C', primaryTextColor: '#C8DEFF',
        primaryBorderColor: '#1E4A8C', lineColor: '#3A7FD5',
        secondaryColor: '#071828', background: '#050E1A',
        mainBkg: '#0F2D5C', nodeBorder: '#1E4A8C',
        edgeLabelBackground: '#071828',
        fontFamily: 'JetBrains Mono, monospace', fontSize: '12px',
      },
    });
    resolve(window.mermaid);
  };
  document.head.appendChild(s);
});

// ── DiagramPane ───────────────────────────────────────────────
// Pure display component — receives mermaid string as prop.
// selectedState is the currently selected row name (for highlight).
export default function DiagramPane({ mermaidCode, selectedState }) {
  const dRef  = useRef(null);
  const rcRef = useRef(0);

  // Render mermaid when code changes
  useEffect(() => {
    if (!mermaidCode) {
      if (dRef.current) dRef.current.innerHTML = '';
      return;
    }
    let dead = false;
    (async () => {
      const m = await loadMermaid();
      rcRef.current++;
      const id = `mp${rcRef.current}`;
      try {
        const { svg } = await m.render(id, mermaidCode);
        if (!dead && dRef.current) {
          dRef.current.innerHTML = svg;
          highlightNode(dRef.current, selectedState);
        }
      } catch {
        if (!dead && dRef.current) {
          dRef.current.innerHTML = `<div style="color:var(--red);font-size:11px;padding:16px">Diagram error — check state names</div>`;
        }
      }
    })();
    return () => { dead = true; };
  }, [mermaidCode]);

  // Re-highlight when selection changes
  useEffect(() => {
    if (dRef.current) highlightNode(dRef.current, selectedState);
  }, [selectedState]);

  const empty   = !mermaidCode;
  const noInit  = mermaidCode === 'NO_INIT';

  return (
    <div className="d-body">
      {empty ? (
        <div key="empty" className="d-empty">
          <div className="d-empty-icon">⬡</div>
          <div>Add states to see the diagram</div>
        </div>
      ) : (
        <div key="diagram" ref={dRef} style={{ width: '100%' }} />
      )}
    </div>
  );
}

function highlightNode(container, stateName) {
  if (!container || !stateName) return;
  const svgEl = container.querySelector('svg');
  if (!svgEl) return;
  svgEl.querySelectorAll('.node rect,.node circle,.node polygon').forEach(el => {
    el.style.stroke = ''; el.style.strokeWidth = ''; el.style.filter = '';
  });
  svgEl.querySelectorAll('.node').forEach(n => { n.style.filter = ''; n.style.transition = ''; });
  const id = stateName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  svgEl.querySelectorAll('.node').forEach(node => {
    const label = node.querySelector('.nodeLabel, text, span');
    const text  = label?.textContent?.trim() || '';
    if (text === stateName || (node.id && node.id.includes(id))) {
      const shape = node.querySelector('rect,circle,polygon');
      if (shape) { shape.style.stroke = '#4A9FFF'; shape.style.strokeWidth = '2.5'; shape.style.transition = 'all .3s'; }
      node.style.filter = 'drop-shadow(0 0 7px rgba(74,159,255,.8))';
      node.style.transition = 'filter .3s';
    }
  });
}

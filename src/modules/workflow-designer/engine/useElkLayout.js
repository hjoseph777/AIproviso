import { useCallback } from 'react';

const ELK_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.edgeRouting': 'SPLINES',           // Curves paths elegantly around node cards
  'elk.layered.mergeEdges': 'true',        // Combines overlapping routes into clean bundles
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
  'elk.layered.thoroughness': '20',        // Higher = more crossing-minimization passes
  'elk.layered.spacing.nodeNodeBetweenLayers': '110',
  'elk.spacing.nodeNode': '90',            // Compact but not cramped
  'elk.spacing.edgeNode': '55',            // Safety cushion so arrows don't slice card text
  'elk.spacing.edgeEdge': '40',            // Separates parallel lines (Manager vs CFO paths)
  'elk.portConstraints': 'FIXED_SIDE',
  'elk.separateConnectedComponents': 'false',
  'elk.layered.unnecessaryBendpoints': 'true',
};

export function useElkLayout({ nodes, edges, updateNodePosition, fitView, pushHistory, onComplete }) {
  return useCallback(async () => {
    if (!nodes?.length) return;

    // Load ELK only when the user requests auto-layout.
    const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
    const elk = new ELK();

    pushHistory?.();

    const graph = {
      id: 'workflow',
      layoutOptions: ELK_OPTIONS,
      children: nodes.map((node) => ({
        id: node.id,
        width: 220,
        height: 150,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      })),
    };

    const layout = await elk.layout(graph);

    const laidOutNodes = (layout.children || []).map((node) => ({
      id: node.id,
      x: Number(node.x || 0),
      y: Number(node.y || 0),
    }));

    const minX = laidOutNodes.reduce((acc, node) => Math.min(acc, node.x), Infinity);
    const minY = laidOutNodes.reduce((acc, node) => Math.min(acc, node.y), Infinity);
    const offsetX = Number.isFinite(minX) ? (80 - minX) : 0;
    const offsetY = Number.isFinite(minY) ? (80 - minY) : 0;

    const shiftedNodes = laidOutNodes.map((node) => ({
      id: node.id,
      x: node.x + offsetX,
      y: node.y + offsetY,
    }));

    const sortedY = [...new Set(shiftedNodes.map((node) => Math.round(node.y)))]
      .sort((a, b) => a - b);
    const layerSpacing = 180;
    const topPadding = 80;

    const normalizedNodes = shiftedNodes.map((node) => {
      const yRounded = Math.round(node.y);
      const layerIndex = Math.max(0, sortedY.indexOf(yRounded));
      return {
        id: node.id,
        x: node.x,
        y: topPadding + (layerIndex * layerSpacing),
      };
    });

    const sourceNodeById = new Map(nodes.map((node) => [node.id, node]));
    const normalizedNameById = new Map(nodes.map((node) => [
      node.id,
      String(node?.data?.name || '').trim().toLowerCase(),
    ]));

    const AP_LANES = [
      // ── Main flow spine (centre column) ──────────────────────────────────
      { key: 'received',  match: (name) => /received/.test(name),            laneX:  0,   laneY: 0 },
      { key: 'extracted', match: (name) => /extract/.test(name),             laneX:  0,   laneY: 1 },
      { key: 'matched',   match: (name) => /match/.test(name),               laneX:  0,   laneY: 2 },
      { key: 'pending',   match: (name) => /pending\s*approval/.test(name),  laneX:  0,   laneY: 3 },
      { key: 'manager',   match: (name) => /manager/.test(name),             laneX: -1,   laneY: 4 },
      { key: 'cfo',       match: (name) => /cfo/.test(name),                 laneX:  1,   laneY: 4 },
      { key: 'approved',  match: (name) => /approved/.test(name),            laneX:  0,   laneY: 5 },
      // ── Exception column (right side, staggered between main layers) ─────
      // Placed BETWEEN main flow layers so arrows arc right cleanly without
      // crossing the spine — Exception sits between Extracted and Matched,
      // Escalated sits between Pending Approval and Manager/CFO.
      // Exception column: laneX 2.2 with laneGapX 248 → x = 220 + 2.2*248 = 765
      // CFO at laneX 1 → x = 468, spans [468,688]. Exception at x=765, no overlap.
      { key: 'exception', match: (name) => /exception/.test(name),           laneX:  2.2, laneY: 1.5 },
      { key: 'escalated', match: (name) => /escalat/.test(name),             laneX:  2.2, laneY: 3.5 },
    ];

    const findApLane = (nodeId) => {
      const name = normalizedNameById.get(nodeId) || '';
      return AP_LANES.find((lane) => lane.match(name)) || null;
    };
    const isExceptionNode = (nodeId) => {
      const sourceNode = sourceNodeById.get(nodeId);
      const kind = String(sourceNode?.data?.stateKind || '').toLowerCase();
      const name = String(sourceNode?.data?.name || sourceNode?.id || '').toLowerCase();
      return kind === 'exception' || /exception|escalat|reject/.test(name);
    };

    const nodesByLayer = sortedY.map((layerY) => normalizedNodes
      .filter((node) => Math.round(node.y) === layerY)
      .sort((a, b) => a.x - b.x));

    const apMatches = normalizedNodes.filter((node) => Boolean(findApLane(node.id))).length;
    const useApLaneMap = apMatches >= 6;

    // Layout constants — balance between readability and compact fit-view zoom.
    // laneGapX must stay > nodeWidth(220) to prevent branch overlap with spine.
    const spineX           = 220;   // Main spine x
    const laneGapX         = 248;   // Horizontal lane step — spine + 28px clearance each side
    const laneGapY         = 162;   // Vertical layer spacing
    const topLaneY         = 80;    // Canvas top padding
    const branchGap        = 260;   // Branch gap for non-AP-lane graphs
    const exceptionColumnX = spineX + 420; // Exception column fixed offset from spine
    const earlyLaneOffsetY = 64;

    const centeredNodes = [];

    if (useApLaneMap) {
      normalizedNodes.forEach((node) => {
        const lane = findApLane(node.id);
        if (!lane) {
          centeredNodes.push(node);
          return;
        }

        centeredNodes.push({
          ...node,
          x: spineX + (lane.laneX * laneGapX),
          y: topLaneY + (lane.laneY * laneGapY) + (lane.laneY <= 2 ? earlyLaneOffsetY : 0),
        });
      });
    }

    if (!useApLaneMap) {
    nodesByLayer.forEach((layerNodes) => {
      const exceptionNodes = layerNodes.filter((node) => isExceptionNode(node.id));
      const primaryNodes = layerNodes.filter((node) => !isExceptionNode(node.id));

      const primaryCount = primaryNodes.length;
      const primaryCenter = (primaryCount - 1) / 2;

      primaryNodes.forEach((node, index) => {
        centeredNodes.push({
          ...node,
          x: spineX + ((index - primaryCenter) * branchGap),
        });
      });

      exceptionNodes.forEach((node, index) => {
        centeredNodes.push({
          ...node,
          x: exceptionColumnX + (index * 22),
        });
      });
    });
    }

    centeredNodes.forEach((node) => {
      updateNodePosition(node.id, {
        x: node.x,
        y: node.y,
      });
    });

    // Signal complete + fit using the ELK positions directly (bypasses RF internal state lag)
    window.requestAnimationFrame(() => {
      onComplete?.();
      // Pass centeredNodes so fitView uses frameNodesInCanvas (manual viewport calc)
      // instead of api.fitView (depends on RF positionAbsolute, which can lag by ~1 render cycle)
      window.setTimeout(() => fitView?.(centeredNodes), 80);
    });
  }, [edges, fitView, nodes, onComplete, pushHistory, updateNodePosition]);
}

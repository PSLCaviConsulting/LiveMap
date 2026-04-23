import type { Node, Edge } from "@xyflow/react";
import type { ProcessNode, ProcessEdge, ProcessGroup } from "@shared/types";
import dagre from "dagre";

// Convert DB nodes to React Flow nodes.
// Note: we keep groupId in data for lane assignment, but we don't emit a
// React Flow parentId — swimlanes are drawn as a background layer, not as
// parent container nodes, so a parentId with no parent node would just
// produce "parent not found" console noise.
export function dbNodesToFlow(dbNodes: ProcessNode[]): Node[] {
  return dbNodes
    .filter(n => n.type !== "ghostAction" && n.type !== "ghostQuestion")
    .map(n => ({
      id: String(n.id),
      type: n.type,
      position: { x: n.positionX, y: n.positionY },
      data: {
        dbId: n.id,
        label: n.label || "",
        what: n.what || "",
        where: n.where || "",
        system: n.system || "",
        role: n.role || "",
        question: n.question || "",
        color: n.color || undefined,
        nodeType: n.type,
        groupId: n.groupId,
      },
      style: {
        width: n.width || (n.type === "action" ? 220 : n.type === "question" ? 200 : 120),
        height: n.height || (n.type === "action" ? 100 : n.type === "question" ? 80 : 50),
      },
    }));
}

// Convert DB edges to React Flow edges
export function dbEdgesToFlow(dbEdges: ProcessEdge[]): Edge[] {
  return dbEdges.map(e => ({
    id: String(e.id),
    source: String(e.sourceId),
    target: String(e.targetId),
    sourceHandle: e.sourceHandle || undefined,
    targetHandle: e.targetHandle || undefined,
    label: e.label || undefined,
    type: e.edgeType || "smoothstep",
    animated: e.animated || false,
    data: { dbId: e.id },
    style: { strokeWidth: 2 },
    labelStyle: { fontSize: 12, fontWeight: 500 },
    labelBgStyle: { fill: "white", fillOpacity: 0.9 },
    labelBgPadding: [6, 4] as [number, number],
    labelBgBorderRadius: 4,
  }));
}

// Auto-layout using dagre
export function autoLayout(nodes: Node[], edges: Edge[], direction: "TB" | "LR" = "TB"): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80, marginx: 40, marginy: 40 });

  nodes.forEach(node => {
    const width = (node.style?.width as number) || 220;
    const height = (node.style?.height as number) || 100;
    g.setNode(node.id, { width, height });
  });

  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map(node => {
    const nodeWithPosition = g.node(node.id);
    if (!nodeWithPosition) return node;
    const width = (node.style?.width as number) || 220;
    const height = (node.style?.height as number) || 100;
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });
}

// Auto-format into swimlanes by role
export function autoFormatBySwimlane(
  nodes: Node[],
  edges: Edge[],
  field: "role" | "system" = "role"
): { nodes: Node[]; groups: { name: string; color: string; y: number; height: number }[] } {
  const SWIMLANE_COLORS = [
    "#0d9488", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444",
    "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  ];

  // Group nodes by the specified field
  const groupMap = new Map<string, Node[]>();
  const ungrouped: Node[] = [];

  nodes.forEach(node => {
    const value = node.data?.[field] as string;
    if (value && value.trim()) {
      const key = value.trim();
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(node);
    } else {
      ungrouped.push(node);
    }
  });

  // Use dagre to compute a global layout first, then separate into lanes
  // This preserves the flow order (edges) while grouping by role
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 80, marginx: 40, marginy: 40 });

  nodes.forEach(node => {
    const width = (node.style?.width as number) || 220;
    const height = (node.style?.height as number) || 100;
    g.setNode(node.id, { width, height });
  });

  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  // Get the dagre X positions to preserve left-to-right flow order
  const dagrePositions = new Map<string, { x: number; y: number }>();
  nodes.forEach(node => {
    const pos = g.node(node.id);
    if (pos) {
      const width = (node.style?.width as number) || 220;
      const height = (node.style?.height as number) || 100;
      dagrePositions.set(node.id, { x: pos.x - width / 2, y: pos.y - height / 2 });
    }
  });

  // Layout each group as a horizontal lane, using dagre X positions for ordering
  const LANE_PADDING = 40;
  const LANE_GAP = 30;
  const LABEL_MARGIN = 160;
  let currentY = LANE_PADDING;
  const resultNodes: Node[] = [];
  const resultGroups: { name: string; color: string; y: number; height: number }[] = [];

  let colorIdx = 0;
  const sortedGroups = Array.from(groupMap.entries());

  // Sort groups by the average dagre X position of their nodes (flow order)
  sortedGroups.sort((a, b) => {
    const avgXA = a[1].reduce((sum, n) => {
      const pos = dagrePositions.get(n.id);
      return sum + (pos?.x || 0);
    }, 0) / a[1].length;
    const avgXB = b[1].reduce((sum, n) => {
      const pos = dagrePositions.get(n.id);
      return sum + (pos?.x || 0);
    }, 0) / b[1].length;
    return avgXA - avgXB;
  });

  sortedGroups.forEach(([groupName, groupNodes]) => {
    const color = SWIMLANE_COLORS[colorIdx % SWIMLANE_COLORS.length];
    colorIdx++;

    // Sort nodes within the lane by their dagre X position
    const sorted = groupNodes.slice().sort((a, b) => {
      const posA = dagrePositions.get(a.id);
      const posB = dagrePositions.get(b.id);
      return (posA?.x || 0) - (posB?.x || 0);
    });

    // Place nodes horizontally within the lane
    let currentX = LABEL_MARGIN + LANE_PADDING;
    const laneStartY = currentY + LANE_PADDING;
    let maxHeight = 0;

    sorted.forEach(node => {
      const width = (node.style?.width as number) || 220;
      const height = (node.style?.height as number) || 100;
      resultNodes.push({
        ...node,
        position: { x: currentX, y: laneStartY },
      });
      currentX += width + 60;
      maxHeight = Math.max(maxHeight, height);
    });

    const laneHeight = maxHeight + LANE_PADDING * 2 + 30;
    resultGroups.push({ name: groupName, color, y: currentY, height: laneHeight });
    currentY += laneHeight + LANE_GAP;
  });

  // Place ungrouped nodes at the bottom
  if (ungrouped.length > 0) {
    let currentX = LABEL_MARGIN + LANE_PADDING;
    const sorted = ungrouped.slice().sort((a, b) => {
      const posA = dagrePositions.get(a.id);
      const posB = dagrePositions.get(b.id);
      return (posA?.x || 0) - (posB?.x || 0);
    });
    sorted.forEach(node => {
      const width = (node.style?.width as number) || 220;
      resultNodes.push({
        ...node,
        position: { x: currentX, y: currentY + LANE_PADDING },
      });
      currentX += width + 60;
    });
  }

  return { nodes: resultNodes, groups: resultGroups };
}

// Create a snapshot of the current state for save points
export function createSnapshot(nodes: Node[], edges: Edge[]) {
  return {
    nodes: nodes.map(n => ({
      id: n.id,
      type: n.type,
      position: { ...n.position },
      data: { ...n.data },
      style: n.style ? { ...n.style } : undefined,
    })),
    edges: edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      label: e.label,
      type: e.type,
      animated: e.animated,
      data: e.data ? { ...e.data } : undefined,
    })),
    timestamp: Date.now(),
  };
}

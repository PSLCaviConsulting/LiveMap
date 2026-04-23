import type { Node, Edge } from "@xyflow/react";

/**
 * Configuration for auto-connection snap zones and behavior
 */
export const AUTO_CONNECTION_CONFIG = {
  SNAP_DISTANCE: 80, // pixels - distance at which nodes snap to each other
  SNAP_DISTANCE_PALETTE: 100, // pixels - distance for palette nodes
  PREVIEW_DISTANCE: 120, // pixels - distance at which connection preview appears
  PREVIEW_OPACITY: 0.5,
};

/**
 * Calculate distance between two points
 */
export function getDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * Get the center point of a node
 */
export function getNodeCenter(
  node: Node,
  nodeWidth: number = 220,
  nodeHeight: number = 110
): { x: number; y: number } {
  return {
    x: node.position.x + nodeWidth / 2,
    y: node.position.y + nodeHeight / 2,
  };
}

/**
 * Find nodes within snap distance of a target node
 * Returns closest node(s) that could be snapped to
 */
export function findSnapTargets(
  draggedNode: Node,
  allNodes: Node[],
  snapDistance: number = AUTO_CONNECTION_CONFIG.SNAP_DISTANCE
): { node: Node; distance: number; direction: "above" | "below" | "left" | "right" }[] {
  const draggedCenter = getNodeCenter(draggedNode);
  const targets: { node: Node; distance: number; direction: "above" | "below" | "left" | "right" }[] = [];

  allNodes.forEach((node) => {
    if (node.id === draggedNode.id) return; // Skip self

    const nodeCenter = getNodeCenter(node);
    const distance = getDistance(
      draggedCenter.x,
      draggedCenter.y,
      nodeCenter.x,
      nodeCenter.y
    );

    if (distance < snapDistance) {
      // Determine direction (which side of the target node)
      const dx = draggedCenter.x - nodeCenter.x;
      const dy = draggedCenter.y - nodeCenter.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      let direction: "above" | "below" | "left" | "right";
      if (absDx > absDy) {
        direction = dx > 0 ? "right" : "left";
      } else {
        direction = dy > 0 ? "below" : "above";
      }

      targets.push({ node, distance, direction });
    }
  });

  // Sort by distance (closest first)
  return targets.sort((a, b) => a.distance - b.distance);
}

/**
 * Check if an edge already exists between two nodes
 */
export function edgeExists(
  edges: Edge[],
  sourceId: string,
  targetId: string
): boolean {
  return edges.some((e) => e.source === sourceId && e.target === targetId);
}

/**
 * Get the best connection point (handle) for a node based on direction
 * For action/question nodes, we use bottom handle for output
 */
export function getConnectionHandle(
  nodeType: string,
  direction: "above" | "below" | "left" | "right",
  isSource: boolean = true
): string {
  // For most nodes, we connect from bottom (output) to top (input)
  if (isSource) {
    return "bottom"; // Output handle
  } else {
    return "top"; // Input handle
  }
}

/**
 * Determine if two nodes should auto-connect based on their types and positions
 */
export function shouldAutoConnect(
  sourceNode: Node,
  targetNode: Node,
  direction: "above" | "below" | "left" | "right"
): boolean {
  const sourceType = sourceNode.type || "action";
  const targetType = targetNode.type || "action";

  // Don't connect start/end nodes to each other
  if ((sourceType === "start" || sourceType === "end") && (targetType === "start" || targetType === "end")) {
    return false;
  }

  // Don't connect to start nodes (start is always source)
  if (targetType === "start") {
    return false;
  }

  // Don't connect from end nodes (end is always sink)
  if (sourceType === "end") {
    return false;
  }

  // Don't connect ghost or note nodes
  if (sourceType.includes("ghost") || targetType.includes("ghost")) {
    return false;
  }

  if (sourceType === "note" || targetType === "note") {
    return false;
  }

  // Only connect if target is below source (natural flow direction)
  if (direction !== "below") {
    return false;
  }

  return true;
}

/**
 * Calculate the optimal position to snap a node to align with target
 */
export function calculateSnapPosition(
  draggedNode: Node,
  targetNode: Node,
  direction: "above" | "below" | "left" | "right",
  snapDistance: number = AUTO_CONNECTION_CONFIG.SNAP_DISTANCE,
  nodeWidth: number = 220,
  nodeHeight: number = 110
): { x: number; y: number } {
  const targetWidth = targetNode.width || 220;
  const targetHeight = targetNode.height || 110;

  let newX = draggedNode.position.x;
  let newY = draggedNode.position.y;

  switch (direction) {
    case "below":
      // Snap below target, centered horizontally
      newX = targetNode.position.x + (targetWidth - nodeWidth) / 2;
      newY = targetNode.position.y + targetHeight + 60; // 60px vertical gap
      break;
    case "above":
      // Snap above target, centered horizontally
      newX = targetNode.position.x + (targetWidth - nodeWidth) / 2;
      newY = targetNode.position.y - nodeHeight - 60;
      break;
    case "right":
      // Snap to the right, centered vertically
      newX = targetNode.position.x + targetWidth + 40; // 40px horizontal gap
      newY = targetNode.position.y + (targetHeight - nodeHeight) / 2;
      break;
    case "left":
      // Snap to the left, centered vertically
      newX = targetNode.position.x - nodeWidth - 40;
      newY = targetNode.position.y + (targetHeight - nodeHeight) / 2;
      break;
  }

  return { x: Math.round(newX), y: Math.round(newY) };
}

/**
 * Find nodes within preview distance for connection preview
 */
export function findConnectionPreviewTargets(
  draggedNode: Node,
  allNodes: Node[],
  previewDistance: number = AUTO_CONNECTION_CONFIG.PREVIEW_DISTANCE
): Node[] {
  const draggedCenter = getNodeCenter(draggedNode);
  const targets: Node[] = [];

  allNodes.forEach((node) => {
    if (node.id === draggedNode.id) return;

    const nodeCenter = getNodeCenter(node);
    const distance = getDistance(
      draggedCenter.x,
      draggedCenter.y,
      nodeCenter.x,
      nodeCenter.y
    );

    if (distance < previewDistance) {
      targets.push(node);
    }
  });

  return targets;
}

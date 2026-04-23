import type { Node, Edge } from "@xyflow/react";

export type HandleSide = "top" | "right" | "bottom" | "left";

/**
 * Picked handle IDs match the `id` props used on each Handle component:
 *   target: "t-top" | "t-right" | "t-bottom" | "t-left"
 *   source: "s-top" | "s-right" | "s-bottom" | "s-left"
 * Question nodes keep their "yes" / "no" source handles for semantic reasons.
 */

function nodeDims(n: Node): { x: number; y: number; w: number; h: number } {
  const styleW = n.style?.width as number | undefined;
  const styleH = n.style?.height as number | undefined;
  const defaults = (() => {
    switch (n.type) {
      case "question": return { w: 260, h: 180 };
      case "start":
      case "end":     return { w: 100, h: 44 };
      case "note":    return { w: 180, h: 80 };
      default:        return { w: 200, h: 160 }; // action
    }
  })();
  return {
    x: n.position.x,
    y: n.position.y,
    w: styleW ?? defaults.w,
    h: styleH ?? defaults.h,
  };
}

/**
 * Pick which side of `from` should face `toward`.
 * Uses the delta of center-to-center, scaled by node dimensions so that
 * for a tall-and-thin target the top/bottom win the tie more often.
 */
export function pickSide(from: Node, toward: Node): HandleSide {
  const a = nodeDims(from);
  const b = nodeDims(toward);
  const acx = a.x + a.w / 2;
  const acy = a.y + a.h / 2;
  const bcx = b.x + b.w / 2;
  const bcy = b.y + b.h / 2;
  const dx = bcx - acx;
  const dy = bcy - acy;
  // Normalize by the from-node half-dimensions so a wide node prefers
  // horizontal sides when the target is roughly along its mid-line.
  const hx = Math.abs(dx) / Math.max(a.w / 2, 1);
  const hy = Math.abs(dy) / Math.max(a.h / 2, 1);
  if (hx >= hy) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "bottom" : "top";
}

function isQuestion(n: Node): boolean {
  return n.type === "question" || (n.data as any)?.nodeType === "question";
}

/**
 * Compute optimal source and target handle IDs so edges attach on the
 * sides of each node that face the other node.
 *
 * For Question source nodes we preserve any existing "yes"/"no" source handle
 * (that's semantic), and only recompute the target side.
 * If the source is a Question node without a prior yes/no assignment we
 * fall back to "yes" — callers should pass the current sourceHandle so
 * this logic stays stable across re-routes.
 */
export function pickBestHandles(
  source: Node,
  target: Node,
  opts: { currentSourceHandle?: string | null } = {}
): { sourceHandle: string; targetHandle: string } {
  let sourceHandle: string;
  if (isQuestion(source)) {
    const cur = opts.currentSourceHandle;
    sourceHandle = cur === "yes" || cur === "no" ? cur : "yes";
  } else {
    const side = pickSide(source, target);
    sourceHandle = `s-${side}`;
  }
  const targetSide = pickSide(target, source);
  const targetHandle = `t-${targetSide}`;
  return { sourceHandle, targetHandle };
}

/**
 * For each edge touching one of the given node IDs, recompute handles based
 * on current node positions. Returns the edges that changed, paired with the
 * old and new handle IDs (so callers can update React state and persist).
 */
export function rerouteEdgesForNodes(
  movedNodeIds: string[],
  nodes: Node[],
  edges: Edge[]
): Array<{ edge: Edge; sourceHandle: string; targetHandle: string }> {
  const moved = new Set(movedNodeIds);
  const byId = new Map(nodes.map(n => [n.id, n] as const));
  const changes: Array<{ edge: Edge; sourceHandle: string; targetHandle: string }> = [];
  for (const edge of edges) {
    if (!moved.has(edge.source) && !moved.has(edge.target)) continue;
    const src = byId.get(edge.source);
    const tgt = byId.get(edge.target);
    if (!src || !tgt) continue;
    const { sourceHandle, targetHandle } = pickBestHandles(src, tgt, {
      currentSourceHandle: edge.sourceHandle ?? null,
    });
    if (edge.sourceHandle !== sourceHandle || edge.targetHandle !== targetHandle) {
      changes.push({ edge, sourceHandle, targetHandle });
    }
  }
  return changes;
}

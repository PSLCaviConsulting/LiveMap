import type { Node, Edge } from "@xyflow/react";

// Minimal snapshots of React Flow entities that history needs. We copy only
// what's required to re-create, re-delete, or reapply an update; display-only
// callbacks (onFieldChange etc.) are left out so they can't accidentally land
// back on state after an undo.
export type NodeSnap = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  style?: { width?: number; height?: number } | undefined;
};

export type EdgeSnap = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string | null;
  type?: string;
  data: Record<string, any>;
};

export type Command =
  | { kind: "createNode"; node: NodeSnap }
  | { kind: "deleteNode"; node: NodeSnap; edges: EdgeSnap[] }
  | { kind: "createEdge"; edge: EdgeSnap }
  | { kind: "deleteEdge"; edge: EdgeSnap }
  | { kind: "updateNodes"; before: NodeSnap[]; after: NodeSnap[] }
  | { kind: "updateEdges"; before: EdgeSnap[]; after: EdgeSnap[] }
  | { kind: "composite"; children: Command[] };

export function snapshotNode(n: Node): NodeSnap {
  const { onFieldChange, onConvertType, suggestions, ...rest } = (n.data ?? {}) as any;
  return {
    id: n.id,
    type: n.type,
    position: { x: n.position.x, y: n.position.y },
    data: { ...rest },
    style: n.style ? { width: n.style.width as number | undefined, height: n.style.height as number | undefined } : undefined,
  };
}

export function snapshotEdge(e: Edge): EdgeSnap {
  const { onLabelChange, ...rest } = (e.data ?? {}) as any;
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
    label: (e.label as string | null | undefined) ?? null,
    type: e.type,
    data: { ...rest },
  };
}

// ── Id remap ────────────────────────────────────────────────────────────
// When an entity is re-created after an undo, it gets a fresh DB id. The
// React Flow id (string) and data.dbId (number) on every stored command
// that still references the old id must be rewritten, otherwise a later
// undo/redo sends the wrong id to the server.

export type NodeRemap = { oldFlowId: string; newFlowId: string; oldDbId: number; newDbId: number };
export type EdgeRemap = { oldFlowId: string; newFlowId: string; oldDbId: number; newDbId: number };

export function remapNodeInCommand(cmd: Command, r: NodeRemap): Command {
  const n = (x: NodeSnap): NodeSnap => ({
    ...x,
    id: x.id === r.oldFlowId ? r.newFlowId : x.id,
    data: {
      ...x.data,
      dbId: x.data.dbId === r.oldDbId ? r.newDbId : x.data.dbId,
    },
  });
  const e = (x: EdgeSnap): EdgeSnap => ({
    ...x,
    source: x.source === r.oldFlowId ? r.newFlowId : x.source,
    target: x.target === r.oldFlowId ? r.newFlowId : x.target,
  });
  switch (cmd.kind) {
    case "createNode":
      return { kind: "createNode", node: n(cmd.node) };
    case "deleteNode":
      return { kind: "deleteNode", node: n(cmd.node), edges: cmd.edges.map(e) };
    case "createEdge":
      return { kind: "createEdge", edge: e(cmd.edge) };
    case "deleteEdge":
      return { kind: "deleteEdge", edge: e(cmd.edge) };
    case "updateNodes":
      return { kind: "updateNodes", before: cmd.before.map(n), after: cmd.after.map(n) };
    case "updateEdges":
      return { kind: "updateEdges", before: cmd.before.map(e), after: cmd.after.map(e) };
    case "composite":
      return { kind: "composite", children: cmd.children.map(c => remapNodeInCommand(c, r)) };
  }
}

export function remapEdgeInCommand(cmd: Command, r: EdgeRemap): Command {
  const e = (x: EdgeSnap): EdgeSnap => ({
    ...x,
    id: x.id === r.oldFlowId ? r.newFlowId : x.id,
    data: {
      ...x.data,
      dbId: x.data.dbId === r.oldDbId ? r.newDbId : x.data.dbId,
    },
  });
  switch (cmd.kind) {
    case "createEdge":
      return { kind: "createEdge", edge: e(cmd.edge) };
    case "deleteEdge":
      return { kind: "deleteEdge", edge: e(cmd.edge) };
    case "deleteNode":
      return { kind: "deleteNode", node: cmd.node, edges: cmd.edges.map(e) };
    case "updateEdges":
      return { kind: "updateEdges", before: cmd.before.map(e), after: cmd.after.map(e) };
    case "composite":
      return { kind: "composite", children: cmd.children.map(c => remapEdgeInCommand(c, r)) };
    default:
      return cmd;
  }
}

export function remapNodeAcross(cmds: Command[], r: NodeRemap): Command[] {
  return cmds.map(c => remapNodeInCommand(c, r));
}

export function remapEdgeAcross(cmds: Command[], r: EdgeRemap): Command[] {
  return cmds.map(c => remapEdgeInCommand(c, r));
}

// Diff helpers used by update commands. Only meaningful when the "before" and
// "after" node/edge sets share ids (no creates/deletes involved).
export function nodeChanged(a: NodeSnap, b: NodeSnap): boolean {
  if (Math.round(a.position.x) !== Math.round(b.position.x)) return true;
  if (Math.round(a.position.y) !== Math.round(b.position.y)) return true;
  if ((a.style?.width ?? null) !== (b.style?.width ?? null)) return true;
  if ((a.style?.height ?? null) !== (b.style?.height ?? null)) return true;
  if (a.type !== b.type) return true;
  const fields = ["what", "where", "system", "role", "question", "label", "note"] as const;
  for (const f of fields) {
    if ((a.data?.[f] ?? "") !== (b.data?.[f] ?? "")) return true;
  }
  return false;
}

export function edgeChanged(a: EdgeSnap, b: EdgeSnap): boolean {
  if ((a.source) !== (b.source)) return true;
  if ((a.target) !== (b.target)) return true;
  if ((a.sourceHandle ?? null) !== (b.sourceHandle ?? null)) return true;
  if ((a.targetHandle ?? null) !== (b.targetHandle ?? null)) return true;
  if ((a.label ?? "") !== (b.label ?? "")) return true;
  return false;
}

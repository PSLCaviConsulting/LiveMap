import { useCallback, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Node, Edge } from "@xyflow/react";
import {
  type Command,
  type NodeSnap,
  type EdgeSnap,
  type NodeRemap,
  type EdgeRemap,
  remapNodeInCommand,
  remapEdgeInCommand,
} from "@/lib/editorHistory";

const MAX_HISTORY = 50;

type AsyncMut<I, O> = {
  mutate: (input: I) => void;
  mutateAsync: (input: I) => Promise<O>;
};
type SyncMut<I> = { mutate: (input: I) => void };

type Muts = {
  createNode: AsyncMut<any, { id: number }>;
  deleteNode: SyncMut<{ id: number }>;
  createEdge: AsyncMut<any, { id: number }>;
  deleteEdge: SyncMut<{ id: number }>;
  updateNode: SyncMut<any>;
  updateEdge: SyncMut<any>;
  bulkUpdateNodes: SyncMut<{ updates: any[] }>;
  bulkUpdateEdges: SyncMut<{ updates: any[] }>;
};

export type NewNodeSpec = {
  type: "action" | "question" | "note" | "start" | "end";
  position: { x: number; y: number };
  style?: { width: number; height: number };
  data?: Record<string, any>;
};

export type NewEdgeSpec = {
  sourceFlowId: string;
  targetFlowId: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string | null;
  edgeType?: string;
};

type RemapCb = (r: NodeRemap | EdgeRemap, kind: "node" | "edge") => void;

export function useEditorHistory(params: {
  processId: number;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  muts: Muts;
}) {
  const { processId, setNodes, setEdges, muts } = params;
  const pastRef = useRef<Command[]>([]);
  const futureRef = useRef<Command[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const busyRef = useRef(false);
  // Transaction buffer: when non-null, push() appends here instead of pastRef;
  // commit() wraps the buffer in a composite.
  const txRef = useRef<Command[] | null>(null);

  const flags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const pushRaw = useCallback((cmd: Command) => {
    if (txRef.current) {
      txRef.current.push(cmd);
      return;
    }
    pastRef.current.push(cmd);
    if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift();
    futureRef.current = [];
    flags();
  }, [flags]);

  // ── Id remap: patch state + stacks after we learn a new DB id. ─────
  const applyNodeRemap = useCallback((r: NodeRemap) => {
    if (r.oldFlowId === r.newFlowId && r.oldDbId === r.newDbId) return;
    setNodes(nds => nds.map(n => n.id === r.oldFlowId
      ? { ...n, id: r.newFlowId, data: { ...n.data, dbId: r.newDbId } }
      : n));
    setEdges(eds => eds.map(e => ({
      ...e,
      source: e.source === r.oldFlowId ? r.newFlowId : e.source,
      target: e.target === r.oldFlowId ? r.newFlowId : e.target,
    })));
    pastRef.current = pastRef.current.map(c => remapNodeInCommand(c, r));
    futureRef.current = futureRef.current.map(c => remapNodeInCommand(c, r));
    if (txRef.current) txRef.current = txRef.current.map(c => remapNodeInCommand(c, r));
  }, [setNodes, setEdges]);

  const applyEdgeRemap = useCallback((r: EdgeRemap) => {
    if (r.oldFlowId === r.newFlowId && r.oldDbId === r.newDbId) return;
    setEdges(eds => eds.map(e => e.id === r.oldFlowId
      ? { ...e, id: r.newFlowId, data: { ...e.data, dbId: r.newDbId } }
      : e));
    pastRef.current = pastRef.current.map(c => remapEdgeInCommand(c, r));
    futureRef.current = futureRef.current.map(c => remapEdgeInCommand(c, r));
    if (txRef.current) txRef.current = txRef.current.map(c => remapEdgeInCommand(c, r));
  }, [setEdges]);

  // ── Primitive operations ───────────────────────────────────────────
  const doCreateNode = useCallback(async (node: NodeSnap): Promise<NodeRemap> => {
    const tempFlowId = node.id;
    const tempDbId = (node.data?.dbId as number | undefined) ?? -1;
    setNodes(nds => nds.some(n => n.id === tempFlowId) ? nds : [
      ...nds,
      {
        id: tempFlowId,
        type: node.type,
        position: { ...node.position },
        data: { ...node.data, dbId: tempDbId, nodeType: node.type },
        style: node.style ? { ...node.style } : undefined,
      } as Node,
    ]);
    const d = node.data ?? {};
    const result = await muts.createNode.mutateAsync({
      processId,
      type: node.type as any,
      positionX: Math.round(node.position.x),
      positionY: Math.round(node.position.y),
      width: node.style?.width,
      height: node.style?.height,
      what: d.what,
      where: d.where,
      system: d.system ?? d.where,
      role: d.role,
      question: d.question,
      label: d.label,
    });
    const remap: NodeRemap = {
      oldFlowId: tempFlowId,
      newFlowId: String(result.id),
      oldDbId: tempDbId,
      newDbId: result.id,
    };
    applyNodeRemap(remap);
    return remap;
  }, [muts.createNode, processId, setNodes, applyNodeRemap]);

  const doDeleteNode = useCallback((node: NodeSnap, edges: EdgeSnap[]) => {
    const flowId = node.id;
    const edgeIds = new Set(edges.map(e => e.id));
    setNodes(nds => nds.filter(n => n.id !== flowId));
    setEdges(eds => eds.filter(e => e.source !== flowId && e.target !== flowId && !edgeIds.has(e.id)));
    const dbId = node.data?.dbId as number | undefined;
    if (dbId && dbId > 0) muts.deleteNode.mutate({ id: dbId });
  }, [muts.deleteNode, setNodes, setEdges]);

  const doCreateEdge = useCallback(async (edge: EdgeSnap): Promise<EdgeRemap> => {
    const tempFlowId = edge.id;
    const tempDbId = (edge.data?.dbId as number | undefined) ?? -1;
    setEdges(eds => eds.some(e => e.id === tempFlowId) ? eds : [
      ...eds,
      {
        id: tempFlowId,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
        label: edge.label ?? undefined,
        type: "editableEdge",
        data: { ...edge.data, dbId: tempDbId },
      } as Edge,
    ]);
    const sourceDbId = parseInt(edge.source);
    const targetDbId = parseInt(edge.target);
    if (Number.isNaN(sourceDbId) || Number.isNaN(targetDbId)) {
      return { oldFlowId: tempFlowId, newFlowId: tempFlowId, oldDbId: tempDbId, newDbId: tempDbId };
    }
    const result = await muts.createEdge.mutateAsync({
      processId,
      sourceId: sourceDbId,
      targetId: targetDbId,
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined,
      label: edge.label ?? undefined,
      edgeType: edge.type && edge.type !== "editableEdge" ? edge.type : "smoothstep",
    });
    const remap: EdgeRemap = {
      oldFlowId: tempFlowId,
      newFlowId: String(result.id),
      oldDbId: tempDbId,
      newDbId: result.id,
    };
    applyEdgeRemap(remap);
    return remap;
  }, [muts.createEdge, processId, setEdges, applyEdgeRemap]);

  const doDeleteEdge = useCallback((edge: EdgeSnap) => {
    const flowId = edge.id;
    setEdges(eds => eds.filter(e => e.id !== flowId));
    const dbId = edge.data?.dbId as number | undefined;
    if (dbId && dbId > 0) muts.deleteEdge.mutate({ id: dbId });
  }, [muts.deleteEdge, setEdges]);

  const doApplyNodeSnaps = useCallback((before: NodeSnap[], after: NodeSnap[]) => {
    const afterById = new Map(after.map(n => [n.id, n] as const));
    setNodes(nds => nds.map(n => {
      const a = afterById.get(n.id);
      if (!a) return n;
      return {
        ...n,
        type: a.type ?? n.type,
        position: { ...a.position },
        data: { ...n.data, ...a.data, dbId: n.data?.dbId ?? a.data?.dbId },
        style: a.style ? { ...n.style, ...a.style } : n.style,
      };
    }));
    const bulk: Array<{ id: number; positionX?: number; positionY?: number; width?: number; height?: number }> = [];
    const beforeById = new Map(before.map(n => [n.id, n] as const));
    for (const a of after) {
      const b = beforeById.get(a.id);
      const dbId = (a.data?.dbId ?? b?.data?.dbId) as number | undefined;
      if (!dbId || dbId < 0) continue;
      const posChanged = !b ||
        Math.round(b.position.x) !== Math.round(a.position.x) ||
        Math.round(b.position.y) !== Math.round(a.position.y);
      const sizeChanged = !b ||
        (b.style?.width ?? null) !== (a.style?.width ?? null) ||
        (b.style?.height ?? null) !== (a.style?.height ?? null);
      if (posChanged || sizeChanged) {
        const entry: { id: number; positionX?: number; positionY?: number; width?: number; height?: number } = { id: dbId };
        if (posChanged) {
          entry.positionX = Math.round(a.position.x);
          entry.positionY = Math.round(a.position.y);
        }
        if (sizeChanged) {
          if (a.style?.width != null) entry.width = a.style.width;
          if (a.style?.height != null) entry.height = a.style.height;
        }
        bulk.push(entry);
      }
      const fields = ["what", "where", "system", "role", "question", "label", "note"] as const;
      const fieldChanges: Record<string, any> = {};
      for (const f of fields) {
        const bv = b?.data?.[f] ?? "";
        const av = a.data?.[f] ?? "";
        if (bv !== av) fieldChanges[f] = av;
      }
      if (b && b.type !== a.type) {
        fieldChanges.type = a.type;
        if (a.style?.width != null) fieldChanges.width = a.style.width;
        if (a.style?.height != null) fieldChanges.height = a.style.height;
      }
      if (Object.keys(fieldChanges).length > 0) {
        muts.updateNode.mutate({ id: dbId, ...fieldChanges });
      }
    }
    if (bulk.length > 0) muts.bulkUpdateNodes.mutate({ updates: bulk });
  }, [muts.updateNode, muts.bulkUpdateNodes, setNodes]);

  const doApplyEdgeSnaps = useCallback((before: EdgeSnap[], after: EdgeSnap[]) => {
    const afterById = new Map(after.map(e => [e.id, e] as const));
    setEdges(eds => eds.map(e => {
      const a = afterById.get(e.id);
      if (!a) return e;
      return {
        ...e,
        source: a.source,
        target: a.target,
        sourceHandle: a.sourceHandle ?? null,
        targetHandle: a.targetHandle ?? null,
        label: a.label ?? undefined,
      };
    }));
    const bulk: Array<{ id: number; sourceHandle?: string | null; targetHandle?: string | null }> = [];
    const beforeById = new Map(before.map(e => [e.id, e] as const));
    for (const a of after) {
      const b = beforeById.get(a.id);
      const dbId = (a.data?.dbId ?? b?.data?.dbId) as number | undefined;
      if (!dbId || dbId < 0) continue;
      const handleChanged = !b ||
        (b.sourceHandle ?? null) !== (a.sourceHandle ?? null) ||
        (b.targetHandle ?? null) !== (a.targetHandle ?? null);
      const endpointChanged = !b || b.source !== a.source || b.target !== a.target;
      if (endpointChanged) {
        const sourceDbId = parseInt(a.source);
        const targetDbId = parseInt(a.target);
        if (!Number.isNaN(sourceDbId) && !Number.isNaN(targetDbId)) {
          muts.updateEdge.mutate({
            id: dbId,
            sourceId: sourceDbId,
            targetId: targetDbId,
            sourceHandle: a.sourceHandle ?? undefined,
            targetHandle: a.targetHandle ?? undefined,
          });
        }
      } else if (handleChanged) {
        bulk.push({
          id: dbId,
          sourceHandle: a.sourceHandle ?? null,
          targetHandle: a.targetHandle ?? null,
        });
      }
      if ((b?.label ?? "") !== (a.label ?? "")) {
        muts.updateEdge.mutate({ id: dbId, label: (a.label as string) ?? "" });
      }
    }
    if (bulk.length > 0) muts.bulkUpdateEdges.mutate({ updates: bulk });
  }, [muts.updateEdge, muts.bulkUpdateEdges, setEdges]);

  // ── Apply a command, forward or inverse. onRemap is invoked for each ─
  // id reassignment, so the caller can patch any local command reference
  // it's still holding (e.g. the popped command about to be pushed to the
  // other stack).
  const applyWithRemap = useCallback(async (
    cmd: Command,
    direction: "forward" | "inverse",
    onRemap: RemapCb,
  ): Promise<void> => {
    const emit = (r: NodeRemap | EdgeRemap, kind: "node" | "edge") => onRemap(r, kind);

    switch (cmd.kind) {
      case "createNode":
        if (direction === "forward") {
          const r = await doCreateNode(cmd.node);
          emit(r, "node");
        } else {
          doDeleteNode(cmd.node, []);
        }
        return;

      case "deleteNode":
        if (direction === "forward") {
          doDeleteNode(cmd.node, cmd.edges);
        } else {
          const nr = await doCreateNode(cmd.node);
          emit(nr, "node");
          // Remap cascade edges' source/target to the freshly-created node
          // id, since cmd.edges still reference the OLD id.
          const localEdges = cmd.edges.map(e => ({
            ...e,
            source: e.source === nr.oldFlowId ? nr.newFlowId : e.source,
            target: e.target === nr.oldFlowId ? nr.newFlowId : e.target,
          }));
          for (const edge of localEdges) {
            const er = await doCreateEdge(edge);
            emit(er, "edge");
          }
        }
        return;

      case "createEdge":
        if (direction === "forward") {
          const r = await doCreateEdge(cmd.edge);
          emit(r, "edge");
        } else {
          doDeleteEdge(cmd.edge);
        }
        return;

      case "deleteEdge":
        if (direction === "forward") {
          doDeleteEdge(cmd.edge);
        } else {
          const r = await doCreateEdge(cmd.edge);
          emit(r, "edge");
        }
        return;

      case "updateNodes":
        if (direction === "forward") doApplyNodeSnaps(cmd.before, cmd.after);
        else doApplyNodeSnaps(cmd.after, cmd.before);
        return;

      case "updateEdges":
        if (direction === "forward") doApplyEdgeSnaps(cmd.before, cmd.after);
        else doApplyEdgeSnaps(cmd.after, cmd.before);
        return;

      case "composite": {
        // Children run in given order (forward) or reversed (inverse).
        // After each child emits remaps, the remaining queue is patched so
        // later children see new ids. Every remap is also propagated to
        // the outer onRemap so the caller rebuilds the full command.
        let queue = direction === "forward"
          ? [...cmd.children]
          : [...cmd.children].reverse();
        while (queue.length > 0) {
          const current = queue.shift()!;
          await applyWithRemap(current, direction, (r, kind) => {
            queue = queue.map(c => kind === "node"
              ? remapNodeInCommand(c, r as NodeRemap)
              : remapEdgeInCommand(c, r as EdgeRemap));
            emit(r, kind);
          });
        }
        return;
      }
    }
  }, [doCreateNode, doDeleteNode, doCreateEdge, doDeleteEdge, doApplyNodeSnaps, doApplyEdgeSnaps]);

  // ── Public API: undo / redo ────────────────────────────────────────
  const undo = useCallback(async () => {
    if (busyRef.current) return;
    if (pastRef.current.length === 0) return;
    busyRef.current = true;
    try {
      let cmd = pastRef.current.pop()!;
      await applyWithRemap(cmd, "inverse", (r, kind) => {
        cmd = kind === "node"
          ? remapNodeInCommand(cmd, r as NodeRemap)
          : remapEdgeInCommand(cmd, r as EdgeRemap);
      });
      futureRef.current.push(cmd);
      flags();
    } finally {
      busyRef.current = false;
    }
  }, [applyWithRemap, flags]);

  const redo = useCallback(async () => {
    if (busyRef.current) return;
    if (futureRef.current.length === 0) return;
    busyRef.current = true;
    try {
      let cmd = futureRef.current.pop()!;
      await applyWithRemap(cmd, "forward", (r, kind) => {
        cmd = kind === "node"
          ? remapNodeInCommand(cmd, r as NodeRemap)
          : remapEdgeInCommand(cmd, r as EdgeRemap);
      });
      pastRef.current.push(cmd);
      if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift();
      flags();
    } finally {
      busyRef.current = false;
    }
  }, [applyWithRemap, flags]);

  const clear = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    flags();
  }, [flags]);

  // ── Action wrappers (user-initiated changes) ───────────────────────
  const createNode = useCallback(async (spec: NewNodeSpec): Promise<{ id: number }> => {
    const flowId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const snap: NodeSnap = {
      id: flowId,
      type: spec.type,
      position: { ...spec.position },
      data: { ...(spec.data ?? {}), dbId: -1, nodeType: spec.type },
      style: spec.style ? { ...spec.style } : undefined,
    };
    const remap = await doCreateNode(snap);
    const finalSnap: NodeSnap = {
      ...snap,
      id: remap.newFlowId,
      data: { ...snap.data, dbId: remap.newDbId },
    };
    pushRaw({ kind: "createNode", node: finalSnap });
    return { id: remap.newDbId };
  }, [doCreateNode, pushRaw]);

  const createEdge = useCallback(async (spec: NewEdgeSpec): Promise<{ id: number } | null> => {
    const flowId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const snap: EdgeSnap = {
      id: flowId,
      source: spec.sourceFlowId,
      target: spec.targetFlowId,
      sourceHandle: spec.sourceHandle ?? null,
      targetHandle: spec.targetHandle ?? null,
      label: spec.label ?? null,
      type: spec.edgeType ?? "smoothstep",
      data: { dbId: -1 },
    };
    const remap = await doCreateEdge(snap);
    if (remap.newDbId <= 0) return null;
    const finalSnap: EdgeSnap = { ...snap, id: remap.newFlowId, data: { dbId: remap.newDbId } };
    pushRaw({ kind: "createEdge", edge: finalSnap });
    return { id: remap.newDbId };
  }, [doCreateEdge, pushRaw]);

  const deleteNode = useCallback((node: NodeSnap, incidentEdges: EdgeSnap[]) => {
    pushRaw({ kind: "deleteNode", node, edges: incidentEdges });
    doDeleteNode(node, incidentEdges);
  }, [doDeleteNode, pushRaw]);

  const deleteEdge = useCallback((edge: EdgeSnap) => {
    pushRaw({ kind: "deleteEdge", edge });
    doDeleteEdge(edge);
  }, [doDeleteEdge, pushRaw]);

  const recordUpdateNodes = useCallback((before: NodeSnap[], after: NodeSnap[]) => {
    if (before.length === 0 && after.length === 0) return;
    pushRaw({ kind: "updateNodes", before, after });
    doApplyNodeSnaps(before, after);
  }, [doApplyNodeSnaps, pushRaw]);

  const recordUpdateEdges = useCallback((before: EdgeSnap[], after: EdgeSnap[]) => {
    if (before.length === 0 && after.length === 0) return;
    pushRaw({ kind: "updateEdges", before, after });
    doApplyEdgeSnaps(before, after);
  }, [doApplyEdgeSnaps, pushRaw]);

  const transaction = useCallback(async (fn: () => Promise<void> | void) => {
    if (txRef.current) {
      // Nested — flatten into the parent buffer.
      await fn();
      return;
    }
    txRef.current = [];
    try {
      await fn();
    } finally {
      const children = txRef.current;
      txRef.current = null;
      if (children && children.length > 0) {
        if (children.length === 1) {
          pastRef.current.push(children[0]);
        } else {
          pastRef.current.push({ kind: "composite", children });
        }
        if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift();
        futureRef.current = [];
        flags();
      }
    }
  }, [flags]);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    clear,
    createNode,
    createEdge,
    deleteNode,
    deleteEdge,
    recordUpdateNodes,
    recordUpdateEdges,
    transaction,
  };
}

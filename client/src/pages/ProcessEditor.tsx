import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import {
  ReactFlow, Background, Controls, MiniMap, ReactFlowProvider,
  useNodesState, useEdgesState, useReactFlow, SelectionMode,
  type Connection, type Node, type Edge, type OnConnect,
  type OnConnectEnd,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import ActionNode from "@/components/editor/ActionNode";
import QuestionNode from "@/components/editor/QuestionNode";
import StartEndNode from "@/components/editor/StartEndNode";
import GhostNode from "@/components/editor/GhostNode";
import NoteNode from "@/components/editor/NoteNode";
import EditorToolbar from "@/components/editor/EditorToolbar";
import NodePalette from "@/components/editor/NodePalette";
import ExportDialog from "@/components/editor/ExportDialog";
import ShareDialog from "@/components/editor/ShareDialog";
import SavePointDialog from "@/components/editor/SavePointDialog";
import SwimlanePanel from "@/components/editor/SwimlanePanel";
import SwimlaneBackground from "@/components/editor/SwimlaneBackground";
import ConnectionDropMenu from "@/components/editor/ConnectionDropMenu";
import NodeContextMenu from "@/components/editor/NodeContextMenu";
import EditableEdge from "@/components/editor/EditableEdge";
import { dbNodesToFlow, dbEdgesToFlow, autoLayout, autoFormatBySwimlane } from "@/lib/editorUtils";
import { pickBestHandles, rerouteEdgesForNodes } from "@/lib/edgeRouting";
import { computeSwimlanes } from "@/components/editor/SwimlaneBackground";
import { useEditorKeyboard } from "@/hooks/useEditorKeyboard";
import { useEditorHistory } from "@/hooks/useEditorHistory";
import { snapshotNode, snapshotEdge, type NodeSnap, type EdgeSnap } from "@/lib/editorHistory";

const nodeTypes = {
  action: ActionNode,
  question: QuestionNode,
  start: StartEndNode,
  end: StartEndNode,
  ghostAction: GhostNode,
  ghostQuestion: GhostNode,
  note: NoteNode,
};

const edgeTypes = {
  editableEdge: EditableEdge,
};

// A question's branches are Yes/No by draw order, not by a fixed handle:
// the first edge drawn out of a question is "Yes", the second "No", and any
// further branches are left unlabeled for the user to name.
function questionBranchLabel(sourceNode: Node, currentEdges: Edge[]): string | null {
  const isQ = sourceNode.type === "question" || (sourceNode.data as any)?.nodeType === "question";
  if (!isQ) return null;
  const outCount = currentEdges.filter(e => e.source === sourceNode.id).length;
  return outCount === 0 ? "Yes" : outCount === 1 ? "No" : null;
}

function ProcessEditorInner() {
  const params = useParams<{ projectId: string; processId: string }>();
  const projectId = parseInt(params.projectId || "0");
  const processId = parseInt(params.processId || "0");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const reactFlowInstance = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [captureMode, setCaptureMode] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [savePointOpen, setSavePointOpen] = useState(false);
  const [swimlaneOpen, setSwimlaneOpen] = useState(false);
  const [showSwimlanes, setShowSwimlanes] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; nodeId: string;
  } | null>(null);

  // Pull-to-create state
  const [dropMenu, setDropMenu] = useState<{
    x: number; y: number;
    sourceNodeId: string; sourceHandleId: string | null;
    flowPosition: { x: number; y: number };
  } | null>(null);
  const connectingNodeRef = useRef<{ nodeId: string; handleId: string | null } | null>(null);
  // Id of a freshly-created node whose primary input should grab focus, so
  // the interviewer can type immediately after a pull/spawn without an extra
  // click. Cleared by the node once it has focused.
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: processData, isLoading } = trpc.process.get.useQuery({ id: processId });

  // Field suggestions for autocomplete
  const { data: suggestions } = trpc.suggestions.getFieldValues.useQuery(
    undefined,
    { enabled: !!user?.id }
  );

  // Mutations — declared before the history hook because the hook consumes
  // them. No process.get invalidation on create/delete: the history hook
  // mutates local state optimistically and swaps the temp id for the real
  // dbId when the server responds.

  const createNodeMut = trpc.canvasObject.create.useMutation({
    onError: () => toast.error("Failed to create node"),
  });

  const updateNode = trpc.canvasObject.update.useMutation({
    onError: () => toast.error("Failed to update node"),
  });

  const deleteNodeMut = trpc.canvasObject.delete.useMutation({
    onError: () => toast.error("Failed to delete node"),
  });

  const createEdgeMut = trpc.edge.create.useMutation({
    onError: () => toast.error("Failed to create connection"),
  });

  const updateEdgeMut = trpc.edge.update.useMutation({
    onError: () => toast.error("Failed to update edge label"),
  });

  const bulkUpdateNodesMut = trpc.canvasObject.bulkUpdate.useMutation({
    onError: () => toast.error("Failed to save layout"),
  });

  const bulkUpdateEdgesMut = trpc.edge.bulkUpdate.useMutation({
    onError: () => toast.error("Failed to save edge routing"),
  });

  const deleteEdgeMut = trpc.edge.delete.useMutation({});

  const history = useEditorHistory({
    processId,
    setNodes,
    setEdges,
    muts: {
      createNode: createNodeMut,
      deleteNode: deleteNodeMut,
      createEdge: createEdgeMut,
      deleteEdge: deleteEdgeMut,
      updateNode,
      updateEdge: updateEdgeMut,
      bulkUpdateNodes: bulkUpdateNodesMut,
      bulkUpdateEdges: bulkUpdateEdgesMut,
    },
  });
  const { canUndo, canRedo } = history;

  // Clear history on process switch — old stack entries would replay against
  // ids from the previous process.
  useEffect(() => {
    history.clear();
  }, [processId, history.clear]);

  // ── Edge label change handler ──────────────────────────────────
  const handleEdgeLabelChange = useCallback((edgeId: string, label: string) => {
    setEdges(eds => eds.map(e => {
      if (e.id !== edgeId) return e;
      return { ...e, label };
    }));
    const edge = edges.find(e => e.id === edgeId);
    const dbId = edge?.data?.dbId as number;
    if (dbId && dbId > 0) {
      updateEdgeMut.mutate({ id: dbId, label });
    }
  }, [edges]);

  // ── Convert node type (Action ↔ Question) ──────────────────────
  const handleConvertType = useCallback((nodeId: string, newType: "action" | "question") => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const before = snapshotNode(node);
    const d = node.data as any;
    const newData: any = { ...d, nodeType: newType };
    if (newType === "question") {
      newData.question = d.what || d.label || "";
      newData.label = newData.question;
    } else {
      newData.what = d.question || d.label || "";
      newData.where = d.system || d.where || "";
      newData.role = d.role || "";
    }
    const newStyle = newType === "question"
      ? { width: 260, height: 180 }
      : { width: 200, height: 160 };
    const after: NodeSnap = {
      ...before,
      type: newType,
      data: newData,
      style: newStyle,
    };

    // The source handles differ per node type (question: "yes"/"no";
    // action: "s-*"). Any outgoing edge still anchored to the old node's
    // source handle would reference an id the new node doesn't have, and
    // React Flow silently drops it. Recompute handles for every incident
    // edge against the post-conversion node so connectors stay attached.
    const convertedNode: Node = { ...node, type: newType, style: newStyle, data: newData };
    const edgeBefore: EdgeSnap[] = [];
    const edgeAfter: EdgeSnap[] = [];
    for (const e of edges) {
      if (e.source !== nodeId && e.target !== nodeId) continue;
      const src = e.source === nodeId ? convertedNode : nodes.find(n => n.id === e.source);
      const tgt = e.target === nodeId ? convertedNode : nodes.find(n => n.id === e.target);
      if (!src || !tgt) continue;
      const picked = pickBestHandles(src, tgt, { currentSourceHandle: e.sourceHandle ?? null });
      if (e.sourceHandle !== picked.sourceHandle || e.targetHandle !== picked.targetHandle) {
        const eb = snapshotEdge(e);
        edgeBefore.push(eb);
        edgeAfter.push({ ...eb, sourceHandle: picked.sourceHandle, targetHandle: picked.targetHandle });
      }
    }

    void history.transaction(async () => {
      history.recordUpdateNodes([before], [after]);
      if (edgeBefore.length > 0) history.recordUpdateEdges(edgeBefore, edgeAfter);
    });
    toast.success(`Converted to ${newType === "question" ? "Question" : "Action"} node`);
  }, [nodes, edges, history]);

  // Debounce suggestion cache invalidation. A rapid burst of field edits
  // (tab-through 3 fields) would otherwise fire 3 refetches; we only need
  // one after the dust settles.
  const invalidateSuggestionsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSuggestionsInvalidate = useCallback(() => {
    if (invalidateSuggestionsTimerRef.current) {
      clearTimeout(invalidateSuggestionsTimerRef.current);
    }
    invalidateSuggestionsTimerRef.current = setTimeout(() => {
      utils.suggestions.getFieldValues.invalidate();
      invalidateSuggestionsTimerRef.current = null;
    }, 600);
  }, [utils]);

  useEffect(() => {
    return () => {
      if (invalidateSuggestionsTimerRef.current) clearTimeout(invalidateSuggestionsTimerRef.current);
    };
  }, []);

  // ── Inline field change handler ──────────────────────────────────
  const handleFieldChange = useCallback((nodeId: string, field: string, value: string) => {
    setNodes(nds => nds.map(n => {
      if (n.id !== nodeId) return n;
      const updatedData = { ...n.data };
      if (field === "where") {
        updatedData.where = value;
        updatedData.system = value;
      } else if (field === "what") {
        updatedData.what = value;
      } else if (field === "role") {
        updatedData.role = value;
      } else if (field === "question") {
        updatedData.question = value;
        updatedData.label = value;
      } else if (field === "label") {
        updatedData.label = value;
      } else if (field === "note") {
        updatedData.note = value;
      }
      return { ...n, data: updatedData };
    }));

    const node = nodes.find(n => n.id === nodeId);
    const dbId = node?.data?.dbId as number;
    if (dbId && dbId > 0) {
      const updateData: { id: number; [key: string]: any } = { id: dbId };
      if (field === "where") { updateData.where = value; updateData.system = value; }
      else if (field === "what") { updateData.what = value; }
      else if (field === "role") { updateData.role = value; }
      else if (field === "question") { updateData.question = value; updateData.label = value; }
      else if (field === "label") { updateData.label = value; }
      else if (field === "note") { updateData.note = value; }
      updateNode.mutate(updateData);
    }

    if (field !== "note") {
      scheduleSuggestionsInvalidate();
    }
  }, [nodes, scheduleSuggestionsInvalidate]);

  // ── Build nodes with callbacks and suggestions ──────────────────
  const clearFocusNode = useCallback(() => setFocusNodeId(null), []);
  const nodesWithCallbacks = useMemo(() => {
    return nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        onFieldChange: handleFieldChange,
        onConvertType: handleConvertType,
        autoFocus: n.id === focusNodeId,
        onAutoFocused: clearFocusNode,
        suggestions: suggestions || { systems: [], actions: [], roles: [] },
      },
    }));
  }, [nodes, handleFieldChange, handleConvertType, suggestions, focusNodeId, clearFocusNode]);

  // ── Build edges with label change callback and source node type info ──
  // Yes/No now live on the edge label (set by draw order), so we just pass
  // the stored label through.
  const edgesWithCallbacks = useMemo(() => {
    return edges.map(e => {
      const sourceNode = nodes.find(n => n.id === e.source);
      const sourceNodeType = sourceNode?.type || (sourceNode?.data?.nodeType as string) || "";
      return {
        ...e,
        type: "editableEdge",
        label: e.label as string | undefined,
        data: {
          ...e.data,
          onLabelChange: handleEdgeLabelChange,
          sourceNodeType,
        },
      };
    });
  }, [edges, nodes, handleEdgeLabelChange]);

  // Hydrate local canvas state from the server exactly once per process.
  // Re-running on every processData identity change (e.g. a refetch) would
  // blow away in-flight nodes and unsaved edits, so we gate on processId.
  const hydratedProcessIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (processData && hydratedProcessIdRef.current !== processId) {
      hydratedProcessIdRef.current = processId;
      const flowNodes = dbNodesToFlow(processData.nodes);
      const flowEdges = dbEdgesToFlow(processData.edges);

      // Migrate legacy question branches: Yes/No used to be encoded in the
      // source handle id ("yes"/"no"); they're now edge labels. Capture the
      // label before the reroute below rewrites the handle to a geometric side.
      for (let i = 0; i < flowEdges.length; i++) {
        const e = flowEdges[i];
        if (!e.label && (e.sourceHandle === "yes" || e.sourceHandle === "no")) {
          const lbl = e.sourceHandle === "yes" ? "Yes" : "No";
          flowEdges[i] = { ...e, label: lbl };
          const dbId = e.data?.dbId as number | undefined;
          if (dbId) updateEdgeMut.mutate({ id: dbId, label: lbl });
        }
      }

      // Normalize handles on load: any edge whose handles don't point at the
      // other node's facing side gets rewritten here, and persisted so the
      // DB value matches what you see.
      const allIds = flowNodes.map(n => n.id);
      const changes = rerouteEdgesForNodes(allIds, flowNodes, flowEdges);
      if (changes.length > 0) {
        const byId = new Map(changes.map(c => [c.edge.id, c] as const));
        for (let i = 0; i < flowEdges.length; i++) {
          const c = byId.get(flowEdges[i].id);
          if (c) {
            flowEdges[i] = { ...flowEdges[i], sourceHandle: c.sourceHandle, targetHandle: c.targetHandle };
          }
        }
        for (const c of changes) {
          const edgeDbId = c.edge.data?.dbId as number | undefined;
          if (edgeDbId) {
            updateEdgeMut.mutate({
              id: edgeDbId,
              sourceHandle: c.sourceHandle,
              targetHandle: c.targetHandle,
            });
          }
        }
      }

      setNodes(flowNodes);
      setEdges(flowEdges);
    }
  }, [processData, processId]);

  // ── Standard connection (handle to handle) ──────────────────────
  const onConnect: OnConnect = useCallback((connection: Connection) => {
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);

    // Override whatever handles the user happened to drag from with the
    // pair facing each other's centers.
    let sourceHandle = connection.sourceHandle || undefined;
    let targetHandle = connection.targetHandle || undefined;
    if (sourceNode && targetNode) {
      const picked = pickBestHandles(sourceNode, targetNode);
      sourceHandle = picked.sourceHandle;
      targetHandle = picked.targetHandle;
    }

    // First branch out of a question is Yes, second is No (by draw order).
    const label = sourceNode ? questionBranchLabel(sourceNode, edges) ?? undefined : undefined;

    // If either endpoint is a still-unsaved temp node (dbId is the -1
    // sentinel until the create round-trip resolves), drop the connect —
    // we can't send a numeric sourceId/targetId to the server yet, and a
    // truthy -1 would otherwise slip through and create a phantom edge.
    const sourceDbId = sourceNode?.data?.dbId as number | undefined;
    const targetDbId = targetNode?.data?.dbId as number | undefined;
    if (!sourceDbId || sourceDbId < 0 || !targetDbId || targetDbId < 0) {
      toast.error("Still saving that node — try the connection again in a moment");
      return;
    }

    void history.createEdge({
      sourceFlowId: connection.source!,
      targetFlowId: connection.target!,
      sourceHandle: sourceHandle ?? null,
      targetHandle: targetHandle ?? null,
      label: label ?? null,
      edgeType: "smoothstep",
    });
  }, [nodes, edges, history]);

  // ── Pull-to-create: track which node/handle started the connection ──
  const onConnectStart = useCallback((_: any, params: { nodeId: string | null; handleId: string | null }) => {
    connectingNodeRef.current = {
      nodeId: params.nodeId || "",
      handleId: params.handleId,
    };
  }, []);

  // ── Spawn a new node already connected to an existing one. Shared by
  // pull-to-create (drag off a handle) and the keyboard spawn shortcut.
  // `startedFromTarget` means the gesture began on a target-type handle
  // (a Question's side handle, or an End node — which only has target
  // handles), so the NEW node becomes the source and the existing node the
  // target; otherwise the edge would carry a source handle the existing
  // node doesn't have and React Flow would silently drop it.
  const createConnectedNode = useCallback((opts: {
    sourceNode: Node;
    sourceHandleId: string | null;
    startedFromTarget: boolean;
    newType: "action" | "question";
    topLeft: { x: number; y: number };
    focus?: boolean;
  }) => {
    const { sourceNode, sourceHandleId, startedFromTarget, newType, topLeft, focus } = opts;
    const dims = newType === "question" ? { width: 260, height: 180 } : { width: 200, height: 160 };
    const newNode: Node = { id: "temp-connect-target", type: newType, position: topLeft, data: {}, style: dims };

    let srcHandle: string | null;
    let tgtHandle: string | null;
    let edgeLabel: string | null = null;
    if (startedFromTarget) {
      // new node → existing node
      const picked = pickBestHandles(newNode, sourceNode, { currentSourceHandle: null });
      srcHandle = picked.sourceHandle ?? null;
      tgtHandle = sourceHandleId ?? picked.targetHandle ?? null;
    } else {
      // existing node → new node
      const picked = pickBestHandles(sourceNode, newNode);
      srcHandle = picked.sourceHandle ?? null;
      tgtHandle = picked.targetHandle ?? null;
      edgeLabel = questionBranchLabel(sourceNode, edges);
    }

    void history.transaction(async () => {
      const created = await history.createNode({
        type: newType,
        position: topLeft,
        style: dims,
        data: newType === "question"
          ? { question: "" }
          : { what: "", where: "", system: "", role: "" },
      });
      const newFlowId = String(created.id);
      await history.createEdge({
        sourceFlowId: startedFromTarget ? newFlowId : sourceNode.id,
        targetFlowId: startedFromTarget ? sourceNode.id : newFlowId,
        sourceHandle: srcHandle,
        targetHandle: tgtHandle,
        label: edgeLabel,
        edgeType: "smoothstep",
      });
      if (focus) {
        setNodes(nds => nds.map(n => ({ ...n, selected: n.id === newFlowId })));
        setFocusNodeId(newFlowId);
      }
    });
  }, [history, setNodes, edges]);

  // ── Pull-to-create: connection dropped on empty space → new connected node.
  // Uses React Flow v12's connectionState so we (a) never double-create when
  // the drop lands within the snap radius of a real handle, (b) attach to
  // whatever node/handle the drag actually started from (works for Question
  // side handles and End nodes), and (c) read touch coordinates correctly.
  const onConnectEnd: OnConnectEnd = useCallback((event, connectionState) => {
    // A valid connection completed (onConnect handled it) or the release
    // landed on a handle — don't also spawn a node.
    if (!connectionState || connectionState.isValid || connectionState.toHandle) return;
    const fromNode = connectionState.fromNode;
    const fromHandle = connectionState.fromHandle;
    if (!fromNode) return;

    const sourceNode = nodes.find(n => n.id === fromNode.id);
    if (!sourceNode) return;
    const sourceDbId = sourceNode.data?.dbId as number | undefined;
    if (!sourceDbId || sourceDbId < 0) {
      toast.error("Still saving that node — try the pull again in a moment");
      return;
    }

    const { clientX, clientY } = "changedTouches" in event ? event.changedTouches[0] : event;
    const flowPosition = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });
    const startedFromTarget = fromHandle?.type === "target";
    const width = 200, height = 160;

    createConnectedNode({
      sourceNode,
      sourceHandleId: fromHandle?.id ?? null,
      startedFromTarget,
      newType: "action",
      topLeft: { x: Math.round(flowPosition.x - width / 2), y: Math.round(flowPosition.y - height / 2) },
      focus: true,
    });
  }, [reactFlowInstance, nodes, createConnectedNode]);

  // ── Handle node type selection from pull-to-create menu ──
  const handleDropMenuSelect = useCallback((type: "action" | "question") => {
    if (!dropMenu) return;

    const defaults: Record<string, any> = {
      action: { width: 200, height: 160, what: "", where: "", role: "" },
      question: { width: 260, height: 180, question: "" },
    };
    const d = defaults[type];
    const posX = Math.round(dropMenu.flowPosition.x - d.width / 2);
    const posY = Math.round(dropMenu.flowPosition.y - d.height / 2);

    const sourceNode = nodes.find(n => n.id === dropMenu.sourceNodeId);
    const isQuestion = sourceNode?.type === "question" || sourceNode?.data?.nodeType === "question";
    let edgeLabel: string | null = null;
    if (isQuestion) {
      if (dropMenu.sourceHandleId === "yes") edgeLabel = "Yes";
      else if (dropMenu.sourceHandleId === "no") edgeLabel = "No";
    }

    let srcHandle: string | null = dropMenu.sourceHandleId || null;
    let tgtHandle: string | null = null;
    if (sourceNode) {
      const fakeTarget: Node = {
        id: "temp-drop-target",
        type,
        position: { x: posX, y: posY },
        data: {},
        style: { width: d.width, height: d.height },
      };
      const picked = pickBestHandles(sourceNode, fakeTarget, {
        currentSourceHandle: dropMenu.sourceHandleId,
      });
      srcHandle = picked.sourceHandle ?? null;
      tgtHandle = picked.targetHandle ?? null;
    }

    const dropSourceNodeId = dropMenu.sourceNodeId;
    setDropMenu(null);
    void history.transaction(async () => {
      const created = await history.createNode({
        type,
        position: { x: posX, y: posY },
        style: { width: d.width, height: d.height },
        data: {
          what: d.what ?? "",
          where: d.where ?? "",
          system: d.where ?? "",
          role: d.role ?? "",
          question: d.question ?? "",
        },
      });
      await history.createEdge({
        sourceFlowId: dropSourceNodeId,
        targetFlowId: String(created.id),
        sourceHandle: srcHandle,
        targetHandle: tgtHandle,
        label: edgeLabel,
        edgeType: "smoothstep",
      });
    });
  }, [dropMenu, nodes, history]);

  // ── Drag & drop from palette ──────────────────────────────────
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/reactflow-type");
    if (type !== "action" && type !== "question" && type !== "start" && type !== "end" && type !== "note") return;

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const defaults: Record<string, { width: number; height: number }> = {
      action: { width: 200, height: 160 },
      question: { width: 260, height: 180 },
      start: { width: 100, height: 44 },
      end: { width: 100, height: 44 },
      note: { width: 180, height: 80 },
    };
    const d = defaults[type];
    const posX = Math.round(position.x - d.width / 2);
    const posY = Math.round(position.y - d.height / 2);
    void history.transaction(async () => {
      const created = await history.createNode({
        type,
        position: { x: posX, y: posY },
        style: { width: d.width, height: d.height },
        data: { what: "", where: "", system: "", role: "", question: "", label: "" },
      });
      // Select + focus the dropped node so the interviewer can type at once.
      const newFlowId = String(created.id);
      setNodes(nds => nds.map(n => ({ ...n, selected: n.id === newFlowId })));
      setFocusNodeId(newFlowId);
    });
  }, [reactFlowInstance, history, setNodes]);

  // ── Drag-to-merge: an EMPTY Action/Question dropped on top of another
  // node collapses into it — the empty node disappears and its connector
  // re-points to the node it was dropped onto. Returns true if it merged.
  const tryMergeEmptyNode = useCallback((dragged: Node): boolean => {
    if (dragged.type !== "action" && dragged.type !== "question") return false;
    const d = (dragged.data ?? {}) as any;
    const isEmpty = dragged.type === "action"
      ? !((d.what || "").trim() || (d.where || d.system || "").trim() || (d.role || "").trim() || (d.note || "").trim())
      : !((d.question || "").trim() || (d.note || "").trim());
    if (!isEmpty) return false;

    const rect = (n: Node) => {
      const w = (n.style?.width as number) || (n.type === "question" ? 260 : n.type === "action" ? 200 : n.type === "note" ? 180 : 100);
      const h = (n.style?.height as number) || (n.type === "question" ? 180 : n.type === "action" ? 160 : n.type === "note" ? 80 : 44);
      return { x: n.position.x, y: n.position.y, w, h };
    };
    const dr = rect(dragged);
    const cx = dr.x + dr.w / 2, cy = dr.y + dr.h / 2;
    const target = nodes.find(n => {
      if (n.id === dragged.id || n.type === "note") return false;
      const r = rect(n);
      return cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h;
    });
    if (!target) return false;

    const incident = edges.filter(e => e.source === dragged.id || e.target === dragged.id);
    if (incident.length === 0) return false; // nothing to carry over — treat as a normal move

    // Re-point each incident edge's dragged-endpoint to the target, dropping
    // self-loops and duplicates, and recompute handles for the new geometry.
    const pairs = new Set(edges.filter(e => e.source !== dragged.id && e.target !== dragged.id).map(e => `${e.source}->${e.target}`));
    const before: EdgeSnap[] = [];
    const after: EdgeSnap[] = [];
    const toDelete: Edge[] = [];
    for (const e of incident) {
      const ns = e.source === dragged.id ? target.id : e.source;
      const nt = e.target === dragged.id ? target.id : e.target;
      if (ns === nt || pairs.has(`${ns}->${nt}`)) { toDelete.push(e); continue; }
      pairs.add(`${ns}->${nt}`);
      const srcNode = ns === target.id ? target : nodes.find(n => n.id === ns);
      const tgtNode = nt === target.id ? target : nodes.find(n => n.id === nt);
      const b = snapshotEdge(e);
      const picked = srcNode && tgtNode ? pickBestHandles(srcNode, tgtNode) : { sourceHandle: e.sourceHandle ?? null, targetHandle: e.targetHandle ?? null };
      before.push(b);
      after.push({ ...b, source: ns, target: nt, sourceHandle: picked.sourceHandle, targetHandle: picked.targetHandle });
    }

    void history.transaction(async () => {
      if (before.length > 0) history.recordUpdateEdges(before, after);
      for (const e of toDelete) history.deleteEdge(snapshotEdge(e));
      history.deleteNode(snapshotNode(dragged), []);
    });
    toast.success("Merged into node");
    return true;
  }, [nodes, edges, history]);

  // ── Node drag stop: save position + reroute handles + swimlane auto-assign ──
  const onNodeDragStop = useCallback((_: any, node: Node, draggedNodes?: Node[]) => {
    const moved = draggedNodes && draggedNodes.length > 0 ? draggedNodes : [node];

    // A single empty node dragged onto another merges into it.
    if (moved.length === 1 && tryMergeEmptyNode(node)) return;

    // React Flow v12 passes every node that moved in the drag (the whole
    // selection). Persist all of them, not just the grabbed one, or the
    // rest snap back on reload.
    const posUpdates = moved
      .map(n => {
        const id = n.data?.dbId as number;
        if (!id || id < 0) return null;
        return { id, positionX: Math.round(n.position.x), positionY: Math.round(n.position.y) };
      })
      .filter((u): u is { id: number; positionX: number; positionY: number } => u !== null);
    if (posUpdates.length === 1) {
      updateNode.mutate(posUpdates[0]);
    } else if (posUpdates.length > 1) {
      bulkUpdateNodesMut.mutate({ updates: posUpdates });
    }

    // Reroute handles for every edge touching any moved node so the
    // connection attaches on the side now facing the other end.
    const changes = rerouteEdgesForNodes(moved.map(n => n.id), nodes, edges);
    if (changes.length > 0) {
      const byId = new Map(changes.map(c => [c.edge.id, c] as const));
      setEdges(eds => eds.map(e => {
        const c = byId.get(e.id);
        if (!c) return e;
        return { ...e, sourceHandle: c.sourceHandle, targetHandle: c.targetHandle };
      }));
      // Persist all edge reroutes in a single round-trip.
      const edgeUpdates = changes
        .map(c => {
          const edgeDbId = c.edge.data?.dbId as number | undefined;
          if (!edgeDbId) return null;
          return { id: edgeDbId, sourceHandle: c.sourceHandle, targetHandle: c.targetHandle };
        })
        .filter((u): u is { id: number; sourceHandle: string; targetHandle: string } => u !== null);
      if (edgeUpdates.length > 0) {
        bulkUpdateEdgesMut.mutate({ updates: edgeUpdates });
      }
    }

    // Swimlane auto-assign: if swimlanes are visible and the node
    // lands inside a different lane, update its role automatically.
    if (!showSwimlanes) return;
    if (node.type === "start" || node.type === "end" || node.type === "note") return;

    // Build lanes from all OTHER nodes (exclude the dragged node so
    // its old position doesn't skew the lane it came from).
    const otherNodes = nodes.filter(n => n.id !== node.id);
    const lanes = computeSwimlanes(otherNodes);
    if (lanes.length === 0) return;

    const nodeCenterY = node.position.y + ((node.style?.height as number) || 160) / 2;
    const currentRole = ((node.data?.role as string) || "").trim();

    // Find which lane the node center falls inside
    const targetLane = lanes.find(
      lane => nodeCenterY >= lane.y && nodeCenterY <= lane.y + lane.height
    );

    if (targetLane && targetLane.name !== currentRole) {
      // Update role in React state
      handleFieldChange(node.id, "role", targetLane.name);
      toast.success(`Role updated to "${targetLane.name}"`);
    }
  }, [nodes, edges, showSwimlanes, handleFieldChange, tryMergeEmptyNode]);

  const addNode = useCallback((type: "action" | "question" | "note") => {
    const center = reactFlowInstance.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    const defaults: Record<string, any> = {
      action: { width: 200, height: 160, what: "", where: "", role: "" },
      question: { width: 260, height: 180, question: "" },
      note: { width: 180, height: 80, label: "" },
    };
    const d = defaults[type];
    const posX = Math.round(center.x - d.width / 2);
    const posY = Math.round(center.y - d.height / 2);
    void history.createNode({
      type,
      position: { x: posX, y: posY },
      style: { width: d.width, height: d.height },
      data: {
        what: d.what ?? "",
        where: d.where ?? "",
        system: d.where ?? "",
        role: d.role ?? "",
        question: d.question ?? "",
        label: d.label ?? "",
      },
    });
  }, [reactFlowInstance, history]);

  const handleNodeDelete = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const incident = edges.filter(e => e.source === nodeId || e.target === nodeId).map(snapshotEdge);
    history.deleteNode(snapshotNode(node), incident);
  }, [nodes, edges, history]);

  const handleDuplicateNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const d = node.data as any;
    const type = (node.type || "action") as "action" | "question" | "note" | "start" | "end";
    const offset = 40;
    const width = (node.style?.width as number) || (type === "question" ? 260 : 200);
    const height = (node.style?.height as number) || (type === "question" ? 180 : 160);
    void history.createNode({
      type,
      position: { x: Math.round(node.position.x + offset), y: Math.round(node.position.y + offset) },
      style: { width, height },
      data: {
        what: d.what ?? "",
        where: d.where ?? d.system ?? "",
        system: d.system ?? d.where ?? "",
        role: d.role ?? "",
        question: d.question ?? "",
        label: d.label ?? "",
      },
    });
    toast.success("Node duplicated");
  }, [nodes, history]);

  const handleAddNote = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const posX = Math.round(node.position.x + (node.style?.width as number || 200) + 20);
    const posY = Math.round(node.position.y);
    void history.createNode({
      type: "note",
      position: { x: posX, y: posY },
      style: { width: 180, height: 80 },
      data: { label: "" },
    });
    toast.success("Note added");
  }, [nodes, history]);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    const wrapperBounds = reactFlowWrapper.current?.getBoundingClientRect();
    setContextMenu({
      x: event.clientX - (wrapperBounds?.left || 0),
      y: event.clientY - (wrapperBounds?.top || 0),
      nodeId: node.id,
    });
  }, []);

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
    setDropMenu(null);
  }, []);

  // After a bulk relayout, edges keep their old handle sides and end up
  // attached to the wrong faces. Recompute handles against the new node
  // positions and fold both changes into one undoable step.
  const relayoutEdgeSnaps = useCallback((newNodes: Node[]) => {
    const changes = rerouteEdgesForNodes(newNodes.map(n => n.id), newNodes, edges);
    const before = changes.map(c => snapshotEdge(c.edge));
    const after: EdgeSnap[] = changes.map(c => ({
      ...snapshotEdge(c.edge),
      sourceHandle: c.sourceHandle,
      targetHandle: c.targetHandle,
    }));
    return { before, after };
  }, [edges]);

  const handleAutoFormat = useCallback(() => {
    const before = nodes.map(snapshotNode);
    const formatted = autoLayout(nodes, edges);
    const after = formatted.map(snapshotNode);
    const edgeSnaps = relayoutEdgeSnaps(formatted);
    void history.transaction(async () => {
      history.recordUpdateNodes(before, after);
      if (edgeSnaps.before.length > 0) history.recordUpdateEdges(edgeSnaps.before, edgeSnaps.after);
    });
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.2 }), 100);
    toast.success("Layout formatted");
  }, [nodes, edges, history, reactFlowInstance, relayoutEdgeSnaps]);

  const handleAutoSwimlane = useCallback(() => {
    const before = nodes.map(snapshotNode);
    const result = autoFormatBySwimlane(nodes, edges, "role");
    const after = result.nodes.map(snapshotNode);
    const edgeSnaps = relayoutEdgeSnaps(result.nodes);
    void history.transaction(async () => {
      history.recordUpdateNodes(before, after);
      if (edgeSnaps.before.length > 0) history.recordUpdateEdges(edgeSnaps.before, edgeSnaps.after);
    });
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.2 }), 100);
    toast.success("Nodes organized by role");
    setShowSwimlanes(true);
    setSwimlaneOpen(true);
  }, [nodes, edges, history, reactFlowInstance, relayoutEdgeSnaps]);

  // ── Duplicate selected nodes helper ──────────────────────────────
  const duplicateSelected = useCallback(() => {
    const selected = nodes.filter(n => n.selected);
    if (selected.length === 0) {
      toast.info("Select a node first to duplicate");
      return;
    }
    void history.transaction(async () => {
      for (const node of selected) {
        const d = node.data as any;
        const type = (node.type || d?.nodeType || "action") as "action" | "question" | "note" | "start" | "end";
        const width = (node.style?.width as number) || 200;
        const height = (node.style?.height as number) || 160;
        await history.createNode({
          type,
          position: { x: Math.round(node.position.x + 40), y: Math.round(node.position.y + 40) },
          style: { width, height },
          data: {
            label: (d?.label as string) || "",
            what: (d?.what as string) || "",
            where: (d?.where as string) || "",
            system: (d?.system as string) || (d?.where as string) || "",
            role: (d?.role as string) || "",
            question: (d?.question as string) || "",
          },
        });
      }
    });
    toast.success(`Duplicated ${selected.length} node${selected.length > 1 ? "s" : ""}`);
  }, [nodes, history]);

  // ── Delete selected nodes (+ their incident edges) and any standalone
  // selected edges in one undoable step. This is the SINGLE delete path —
  // React Flow's built-in delete is disabled (deleteKeyCode={null}) so we
  // don't get two competing removals and a divergent undo stack.
  const deleteSelected = useCallback((selectedNodes: Node[], selectedEdges: Edge[]) => {
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;
    const nodeIds = new Set(selectedNodes.map(n => n.id));
    void history.transaction(async () => {
      for (const node of selectedNodes) {
        const incident = edges.filter(e => e.source === node.id || e.target === node.id).map(snapshotEdge);
        history.deleteNode(snapshotNode(node), incident);
      }
      // Standalone selected edges not already removed as a node's incident edge.
      for (const e of selectedEdges) {
        if (nodeIds.has(e.source) || nodeIds.has(e.target)) continue;
        history.deleteEdge(snapshotEdge(e));
      }
    });
    const n = selectedNodes.length, m = selectedEdges.filter(e => !nodeIds.has(e.source) && !nodeIds.has(e.target)).length;
    if (n > 0) toast.success(`Deleted ${n} node${n > 1 ? "s" : ""}`);
    else if (m > 0) toast.success(`Deleted ${m} connection${m > 1 ? "s" : ""}`);
  }, [edges, history]);

  // ── Keyboard spawn: create a connected next node from the selected one. ──
  const spawnNextNode = useCallback((newType: "action" | "question") => {
    const selected = nodes.filter(n => n.selected);
    if (selected.length !== 1) return;
    const source = selected[0];
    if (source.type === "note") return;
    const dbId = source.data?.dbId as number | undefined;
    if (!dbId || dbId < 0) {
      toast.error("Still saving that node — try again in a moment");
      return;
    }
    // Place the new node to the right of the source, vertically centered.
    const srcW = (source.style?.width as number) || 200;
    const srcH = (source.style?.height as number) || 160;
    const newW = newType === "question" ? 260 : 200;
    const newH = newType === "question" ? 180 : 160;
    const topLeft = {
      x: Math.round(source.position.x + srcW + 80),
      y: Math.round(source.position.y + srcH / 2 - newH / 2),
    };
    // A question source starts from its "yes" handle (source-type); every
    // other node uses its right/best source handle — never a target handle.
    const isQuestion = source.type === "question" || source.data?.nodeType === "question";
    createConnectedNode({
      sourceNode: source,
      sourceHandleId: isQuestion ? "yes" : null,
      startedFromTarget: false,
      newType,
      topLeft,
      focus: true,
    });
  }, [nodes, createConnectedNode]);

  useEditorKeyboard({
    nodes,
    edges,
    setNodes,
    onUndo: history.undo,
    onRedo: history.redo,
    onDuplicate: duplicateSelected,
    onClosePopups: () => {
      setContextMenu(null);
      setDropMenu(null);
    },
    onSpawnNext: spawnNextNode,
    onDeleteSelected: deleteSelected,
  });

  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    if (deletedEdges.length === 0) return;
    void history.transaction(async () => {
      for (const e of deletedEdges) {
        history.deleteEdge(snapshotEdge(e));
      }
    });
  }, [history]);

  // ── Edge reconnection ──────────────────────────────────────────
  const edgeReconnectSuccessful = useRef(true);

  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    edgeReconnectSuccessful.current = true;
    if (!newConnection.source || !newConnection.target) return;
    const before = snapshotEdge(oldEdge);
    const after: EdgeSnap = {
      ...before,
      source: newConnection.source,
      target: newConnection.target,
      sourceHandle: newConnection.sourceHandle ?? null,
      targetHandle: newConnection.targetHandle ?? null,
    };
    history.recordUpdateEdges([before], [after]);
  }, [history]);

  const onReconnectEnd = useCallback((_: MouseEvent | TouchEvent, edge: Edge) => {
    if (!edgeReconnectSuccessful.current) {
      // Edge was dropped on empty space — delete it
      history.deleteEdge(snapshotEdge(edge));
    }
    edgeReconnectSuccessful.current = true;
  }, [history]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          <span className="text-sm text-muted-foreground">Loading process...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <EditorToolbar
        processName={processData?.name || "Process"}
        onBack={() => setLocation(`/projects/${projectId}`)}
        onAddAction={() => addNode("action")}
        onAddQuestion={() => addNode("question")}
        onAutoFormat={handleAutoFormat}
        onAutoSwimlane={handleAutoSwimlane}
        onToggleSwimlanes={() => setShowSwimlanes(v => !v)}
        showSwimlanes={showSwimlanes}
        onFitView={() => reactFlowInstance.fitView({ padding: 0.2 })}
        onZoomIn={() => reactFlowInstance.zoomIn()}
        onZoomOut={() => reactFlowInstance.zoomOut()}
        onUndo={history.undo}
        onRedo={history.redo}
        onSave={() => setSavePointOpen(true)}
        onExport={() => setExportOpen(true)}
        onShare={() => setShareOpen(true)}
        onCapture={() => setCaptureMode(!captureMode)}
        captureMode={captureMode}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodesWithCallbacks}
          edges={edgesWithCallbacks}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onReconnect={onReconnect}
          onReconnectStart={onReconnectStart}
          onReconnectEnd={onReconnectEnd}
          onNodeDragStop={onNodeDragStop}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onEdgesDelete={onEdgesDelete}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: "editableEdge" }}
          deleteKeyCode={null}
          zoomOnDoubleClick={false}
          panOnDrag={[2]}
          selectionOnDrag
          selectionMode={SelectionMode.Partial}
          onPaneContextMenu={(e) => e.preventDefault()}
          fitView
          connectionLineStyle={{ stroke: "#9ca3af", strokeWidth: 2 }}
        >
          <SwimlaneBackground nodes={nodesWithCallbacks} visible={showSwimlanes} />
          <Background />
          <Controls />
          <MiniMap />
          <NodePalette />
        </ReactFlow>

        {/* Right-click context menu */}
        {contextMenu && (
          <NodeContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            nodeId={contextMenu.nodeId}
            onDelete={handleNodeDelete}
            onDuplicate={handleDuplicateNode}
            onAddNote={handleAddNote}
            onClose={() => setContextMenu(null)}
          />
        )}

        {/* Pull-to-create node type picker */}
        {dropMenu && (
          <ConnectionDropMenu
            x={dropMenu.x}
            y={dropMenu.y}
            onSelect={handleDropMenuSelect}
            onClose={() => setDropMenu(null)}
          />
        )}
      </div>

      {exportOpen && <ExportDialog open={exportOpen} onOpenChange={setExportOpen} nodes={nodes} edges={edges} processName={processData?.name} />}
      {shareOpen && <ShareDialog open={shareOpen} onOpenChange={setShareOpen} processId={processId} />}
      {savePointOpen && <SavePointDialog open={savePointOpen} onOpenChange={setSavePointOpen} processId={processId} nodes={nodes} edges={edges} />}
      {swimlaneOpen && <SwimlanePanel processId={processId} nodes={nodes} onClose={() => setSwimlaneOpen(false)} />}
    </div>
  );
}

export default function ProcessEditor() {
  return (
    <ReactFlowProvider>
      <ProcessEditorInner />
    </ReactFlowProvider>
  );
}

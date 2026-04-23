import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import {
  ReactFlow, Background, Controls, MiniMap, ReactFlowProvider,
  useNodesState, useEdgesState, useReactFlow,
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
    if (dbId) {
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
    history.recordUpdateNodes([before], [after]);
    toast.success(`Converted to ${newType === "question" ? "Question" : "Action"} node`);
  }, [nodes, history]);

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
    if (dbId) {
      const updateData: { id: number; [key: string]: any } = { id: dbId };
      if (field === "where") { updateData.where = value; updateData.system = value; }
      else if (field === "what") { updateData.what = value; }
      else if (field === "role") { updateData.role = value; }
      else if (field === "question") { updateData.question = value; updateData.label = value; }
      else if (field === "label") { updateData.label = value; }
      else if (field === "note") { updateData.label = value; } // notes stored in label
      updateNode.mutate(updateData);
    }

    if (field !== "note") {
      scheduleSuggestionsInvalidate();
    }
  }, [nodes, scheduleSuggestionsInvalidate]);

  // ── Build nodes with callbacks and suggestions ──────────────────
  const nodesWithCallbacks = useMemo(() => {
    return nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        onFieldChange: handleFieldChange,
        onConvertType: handleConvertType,
        suggestions: suggestions || { systems: [], actions: [], roles: [] },
      },
    }));
  }, [nodes, handleFieldChange, handleConvertType, suggestions]);

  // ── Build edges with label change callback and source node type info ──
  const edgesWithCallbacks = useMemo(() => {
    return edges.map(e => {
      const sourceNode = nodes.find(n => n.id === e.source);
      const sourceNodeType = sourceNode?.type || (sourceNode?.data?.nodeType as string) || "";
      // Auto-label edges from question nodes
      let label = e.label as string | undefined;
      if (!label && sourceNodeType === "question") {
        if (e.sourceHandle === "yes") label = "Yes";
        else if (e.sourceHandle === "no") label = "No";
      }
      return {
        ...e,
        type: "editableEdge",
        label,
        data: {
          ...e.data,
          onLabelChange: handleEdgeLabelChange,
          sourceNodeType,
        },
      };
    });
  }, [edges, nodes, handleEdgeLabelChange]);

  useEffect(() => {
    if (processData) {
      const flowNodes = dbNodesToFlow(processData.nodes);
      const flowEdges = dbEdgesToFlow(processData.edges);

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
  }, [processData]);

  // ── Standard connection (handle to handle) ──────────────────────
  const onConnect: OnConnect = useCallback((connection: Connection) => {
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);

    // Override whatever handles the user happened to drag from with the
    // pair facing each other's centers. Question sources keep Yes/No.
    let sourceHandle = connection.sourceHandle || undefined;
    let targetHandle = connection.targetHandle || undefined;
    if (sourceNode && targetNode) {
      const picked = pickBestHandles(sourceNode, targetNode, {
        currentSourceHandle: connection.sourceHandle ?? null,
      });
      sourceHandle = picked.sourceHandle;
      targetHandle = picked.targetHandle;
    }

    // Determine auto-label for question node edges
    const isQuestion = sourceNode?.type === "question" || sourceNode?.data?.nodeType === "question";
    let label: string | undefined;
    if (isQuestion) {
      if (sourceHandle === "yes") label = "Yes";
      else if (sourceHandle === "no") label = "No";
    }

    // If either endpoint is a still-unsaved temp node, drop the connect —
    // we can't send a numeric sourceId/targetId to the server yet.
    const sourceDbId = sourceNode?.data?.dbId as number | undefined;
    const targetDbId = targetNode?.data?.dbId as number | undefined;
    if (!sourceDbId || !targetDbId) return;

    void history.createEdge({
      sourceFlowId: connection.source!,
      targetFlowId: connection.target!,
      sourceHandle: sourceHandle ?? null,
      targetHandle: targetHandle ?? null,
      label: label ?? null,
      edgeType: "smoothstep",
    });
  }, [nodes, history]);

  // ── Pull-to-create: track which node/handle started the connection ──
  const onConnectStart = useCallback((_: any, params: { nodeId: string | null; handleId: string | null }) => {
    connectingNodeRef.current = {
      nodeId: params.nodeId || "",
      handleId: params.handleId,
    };
  }, []);

  // ── Pull-to-create: when connection dropped on empty space, create Action node directly ──
  const onConnectEnd: OnConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    if (!connectingNodeRef.current) return;

    const targetIsPane = (event.target as HTMLElement)?.classList?.contains("react-flow__pane");
    if (!targetIsPane) return;

    const clientX = "clientX" in event ? event.clientX : event.touches?.[0]?.clientX || 0;
    const clientY = "clientY" in event ? event.clientY : event.touches?.[0]?.clientY || 0;

    const flowPosition = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });

    // Directly create an Action node — no type picker for fast workflow
    const sourceNodeId = connectingNodeRef.current.nodeId;
    const sourceHandleId = connectingNodeRef.current.handleId;
    const width = 200;
    const height = 160;
    const posX = Math.round(flowPosition.x - width / 2);
    const posY = Math.round(flowPosition.y - height / 2);

    const sourceNode = nodes.find(n => n.id === sourceNodeId);
    const isQuestion = sourceNode?.type === "question" || sourceNode?.data?.nodeType === "question";
    let edgeLabel: string | null = null;
    if (isQuestion) {
      if (sourceHandleId === "yes") edgeLabel = "Yes";
      else if (sourceHandleId === "no") edgeLabel = "No";
    }

    // Compute handles up front so the edge created after the node has them.
    let srcHandle: string | null = sourceHandleId || null;
    let tgtHandle: string | null = null;
    if (sourceNode) {
      const fakeTarget: Node = {
        id: "temp-pull-target",
        type: "action",
        position: { x: posX, y: posY },
        data: {},
        style: { width, height },
      };
      const picked = pickBestHandles(sourceNode, fakeTarget, {
        currentSourceHandle: sourceHandleId,
      });
      srcHandle = picked.sourceHandle ?? null;
      tgtHandle = picked.targetHandle ?? null;
    }

    void history.transaction(async () => {
      const created = await history.createNode({
        type: "action",
        position: { x: posX, y: posY },
        style: { width, height },
        data: { what: "", where: "", system: "", role: "" },
      });
      await history.createEdge({
        sourceFlowId: sourceNodeId,
        targetFlowId: String(created.id),
        sourceHandle: srcHandle,
        targetHandle: tgtHandle,
        label: edgeLabel,
        edgeType: "smoothstep",
      });
    });
  }, [reactFlowInstance, nodes, history]);

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
    if (!type || (type !== "action" && type !== "question")) return;

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const defaults: Record<string, any> = {
      action: { width: 200, height: 160, what: "", where: "", role: "" },
      question: { width: 260, height: 180, question: "" },
    };
    const d = defaults[type];
    const posX = Math.round(position.x - d.width / 2);
    const posY = Math.round(position.y - d.height / 2);
    void history.createNode({
      type: type as "action" | "question",
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
  }, [reactFlowInstance, history]);

  // ── Node drag stop: save position + reroute handles + swimlane auto-assign ──
  const onNodeDragStop = useCallback((_: any, node: Node) => {
    const dbId = node.data?.dbId as number;
    if (dbId) {
      updateNode.mutate({
        id: dbId,
        positionX: Math.round(node.position.x),
        positionY: Math.round(node.position.y),
      });
    }

    // Reroute handles for every edge touching this node so the connection
    // attaches on the side now facing the other end.
    const changes = rerouteEdgesForNodes([node.id], nodes, edges);
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
  }, [nodes, showSwimlanes, handleFieldChange]);

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

  const handleAutoFormat = useCallback(() => {
    const before = nodes.map(snapshotNode);
    const formatted = autoLayout(nodes, edges);
    const after = formatted.map(snapshotNode);
    history.recordUpdateNodes(before, after);
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.2 }), 100);
    toast.success("Layout formatted");
  }, [nodes, edges, history, reactFlowInstance]);

  const handleAutoSwimlane = useCallback(() => {
    const before = nodes.map(snapshotNode);
    const result = autoFormatBySwimlane(nodes, edges, "role");
    const after = result.nodes.map(snapshotNode);
    history.recordUpdateNodes(before, after);
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.2 }), 100);
    toast.success("Nodes organized by role");
    setShowSwimlanes(true);
    setSwimlaneOpen(true);
  }, [nodes, edges, history, reactFlowInstance]);

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

  // ── Delete selected nodes + their incident edges in one undoable step.
  const deleteSelected = useCallback((selected: Node[]) => {
    if (selected.length === 0) return;
    const selectedIds = new Set(selected.map(n => n.id));
    void history.transaction(async () => {
      for (const node of selected) {
        const incident = edges.filter(e => e.source === node.id || e.target === node.id).map(snapshotEdge);
        history.deleteNode(snapshotNode(node), incident);
      }
      // Also drop any edges whose other end is another selected node — they
      // will be captured as incident edges above, so this is already handled.
      void selectedIds;
    });
    toast.success(`Deleted ${selected.length} node${selected.length > 1 ? "s" : ""}`);
  }, [edges, history]);

  useEditorKeyboard({
    nodes,
    setNodes,
    onUndo: history.undo,
    onRedo: history.redo,
    onDuplicate: duplicateSelected,
    onClosePopups: () => {
      setContextMenu(null);
      setDropMenu(null);
    },
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

      {exportOpen && <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />}
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

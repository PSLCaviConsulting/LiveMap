import { useEffect } from "react";
import type { Node, Edge } from "@xyflow/react";

/**
 * Editor keyboard shortcuts.
 * Skips all handlers when the user is typing inside an input/textarea so
 * node-field editing isn't hijacked.
 */
export function useEditorKeyboard(params: {
  nodes: Node[];
  edges: Edge[];
  setNodes: (updater: (prev: Node[]) => Node[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onClosePopups: () => void;
  onSpawnNext?: (newType: "action" | "question") => void;
  onDeleteSelected: (selectedNodes: Node[], selectedEdges: Edge[]) => void;
}) {
  const {
    nodes, edges, setNodes,
    onUndo, onRedo, onDuplicate, onClosePopups, onSpawnNext, onDeleteSelected,
  } = params;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        onUndo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        onRedo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        onDuplicate();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        setNodes(nds => nds.map(n => ({ ...n, selected: true })));
        return;
      }
      if (e.key === "Escape") {
        setNodes(nds => nds.map(n => ({ ...n, selected: false })));
        onClosePopups();
        return;
      }
      // Tab / Shift+Tab: spawn a connected next node from the single
      // selected node (Action / Question) — the interview-speed chain.
      if (e.key === "Tab" && onSpawnNext) {
        const selected = nodes.filter(n => n.selected);
        if (selected.length === 1) {
          e.preventDefault();
          onSpawnNext(e.shiftKey ? "question" : "action");
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const selectedNodes = nodes.filter(n => n.selected);
        const selectedEdges = edges.filter(ed => ed.selected);
        if (selectedNodes.length === 0 && selectedEdges.length === 0) return;
        e.preventDefault();
        onDeleteSelected(selectedNodes, selectedEdges);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [nodes, edges, setNodes, onUndo, onRedo, onDuplicate, onClosePopups, onSpawnNext, onDeleteSelected]);
}

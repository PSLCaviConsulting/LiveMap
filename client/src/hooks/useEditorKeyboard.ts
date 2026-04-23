import { useEffect } from "react";
import type { Node } from "@xyflow/react";

/**
 * Editor keyboard shortcuts.
 * Skips all handlers when the user is typing inside an input/textarea so
 * node-field editing isn't hijacked.
 */
export function useEditorKeyboard(params: {
  nodes: Node[];
  setNodes: (updater: (prev: Node[]) => Node[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onClosePopups: () => void;
  onDeleteSelected: (selected: Node[]) => void;
}) {
  const {
    nodes, setNodes,
    onUndo, onRedo, onDuplicate, onClosePopups, onDeleteSelected,
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
      if (e.key === "Delete" || e.key === "Backspace") {
        const selected = nodes.filter(n => n.selected);
        if (selected.length === 0) return;
        onDeleteSelected(selected);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [nodes, setNodes, onUndo, onRedo, onDuplicate, onClosePopups, onDeleteSelected]);
}

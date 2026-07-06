import { memo, useCallback, useEffect, useRef, useState } from "react";
import { type NodeProps } from "@xyflow/react";

/**
 * Standalone sticky note. Editable inline: the text commits to the node's
 * `label` on blur. `nodrag nopan` keep typing/selection from panning the
 * canvas, and an autoFocus flag lets a freshly-created note grab focus.
 */
function NoteNode({ id, data, selected }: NodeProps) {
  const nodeData = data as {
    label?: string;
    readOnly?: boolean;
    autoFocus?: boolean;
    onFieldChange?: (nodeId: string, field: string, value: string) => void;
    onAutoFocused?: () => void;
  };
  const readOnly = !!nodeData.readOnly;

  const [val, setVal] = useState(nodeData.label || "");
  const committedRef = useRef(nodeData.label || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setVal(nodeData.label || "");
    committedRef.current = nodeData.label || "";
  }, [nodeData.label]);

  useEffect(() => {
    if (nodeData.autoFocus && textareaRef.current) {
      textareaRef.current.focus();
      nodeData.onAutoFocused?.();
    }
  }, [nodeData.autoFocus, nodeData.onAutoFocused]);

  const commit = useCallback(() => {
    if (val !== committedRef.current) {
      committedRef.current = val;
      nodeData.onFieldChange?.(id, "label", val);
    }
  }, [id, val, nodeData]);

  const stop = useCallback((e: React.SyntheticEvent) => e.stopPropagation(), []);

  return (
    <div
      className={`bg-amber-50 rounded-md shadow-sm border border-amber-200 p-3 transition-shadow ${selected ? "shadow-lg ring-2 ring-amber-300/50" : "hover:shadow-md"}`}
      style={{ minWidth: 140, maxWidth: 240 }}
    >
      <div className="text-xs font-medium text-amber-800 mb-1">Note</div>
      {readOnly ? (
        <div className="text-sm text-amber-900 leading-snug whitespace-pre-wrap">
          {val || "Add a note..."}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          className="w-full bg-transparent text-sm text-amber-900 leading-snug outline-none border-none resize-none placeholder:text-amber-400/70 nodrag nopan"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onMouseDown={stop}
          onClick={stop}
          placeholder="Add a note..."
          rows={3}
          spellCheck={false}
        />
      )}
    </div>
  );
}

export default memo(NoteNode);

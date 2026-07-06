import { memo, useCallback, useState, useRef, useEffect } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";

/**
 * Custom edge with an invisible text field that becomes visible/editable on click.
 * Question node edges auto-label as "Yes" / "No" based on sourceHandle.
 * Supports reconnection by dragging.
 */
function EditableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
  selected,
  sourceHandleId,
  style,
}: EdgeProps) {
  const edgeData = data as {
    dbId?: number;
    onLabelChange?: (edgeId: string, label: string) => void;
    sourceNodeType?: string;
    readOnly?: boolean;
  };
  const readOnly = !!edgeData?.readOnly;

  // Determine default label from Question node handles
  const getDefaultLabel = () => {
    if (edgeData?.sourceNodeType === "question") {
      if (sourceHandleId === "yes") return "Yes";
      if (sourceHandleId === "no") return "No";
    }
    return "";
  };

  const defaultLabel = getDefaultLabel();
  const displayLabel = (label as string) || defaultLabel;

  const [editing, setEditing] = useState(false);
  const [labelVal, setLabelVal] = useState(displayLabel);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLabelVal((label as string) || defaultLabel);
  }, [label, defaultLabel]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
  });

  const handleLabelClick = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    setEditing(true);
  }, [readOnly]);

  const handleLabelBlur = useCallback(() => {
    setEditing(false);
    if (edgeData?.onLabelChange && labelVal !== displayLabel) {
      edgeData.onLabelChange(id, labelVal);
    }
  }, [id, labelVal, displayLabel, edgeData]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === "Escape") {
      setLabelVal(displayLabel);
      setEditing(false);
    }
  }, [displayLabel]);

  // Determine edge color based on label
  const isYes = labelVal.toLowerCase() === "yes";
  const isNo = labelVal.toLowerCase() === "no";
  const edgeColor = isYes ? "#22c55e" : isNo ? "#ef4444" : "#9ca3af";
  const labelColor = isYes ? "#16a34a" : isNo ? "#dc2626" : "#6b7280";
  const labelBg = isYes ? "#f0fdf4" : isNo ? "#fef2f2" : "#f9fafb";

  const markerId = `livemap-arrow-${isYes ? "yes" : isNo ? "no" : "default"}${selected ? "-selected" : ""}`;
  const markerColor = selected ? "#374151" : edgeColor;

  return (
    <>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={markerColor} />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={`url(#${markerId})`}
        style={{
          ...style,
          strokeWidth: selected ? 3 : 2,
          stroke: selected ? "#374151" : edgeColor,
          transition: "stroke 0.2s, stroke-width 0.2s",
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {editing && !readOnly ? (
            <input
              ref={inputRef}
              className="text-center text-xs font-medium outline-none border border-gray-300 rounded px-2 py-1 bg-white shadow-md nodrag"
              style={{ minWidth: 60, maxWidth: 120, color: labelColor }}
              value={labelVal}
              onChange={(e) => setLabelVal(e.target.value)}
              onBlur={handleLabelBlur}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              spellCheck={false}
            />
          ) : readOnly ? (
            labelVal ? (
              <span
                className="text-xs font-medium rounded px-2 py-0.5 border"
                style={{
                  color: labelColor,
                  backgroundColor: labelBg,
                  borderColor: isYes ? "#bbf7d0" : isNo ? "#fecaca" : "#e5e7eb",
                }}
              >
                {labelVal}
              </span>
            ) : null
          ) : (
            <button
              onClick={handleLabelClick}
              className="text-xs font-medium rounded px-2 py-0.5 transition-all cursor-text border"
              style={{
                color: labelColor,
                backgroundColor: (labelVal || hovered) ? labelBg : "transparent",
                borderColor: (labelVal || hovered) ? (isYes ? "#bbf7d0" : isNo ? "#fecaca" : "#e5e7eb") : "transparent",
                opacity: labelVal ? 1 : (hovered ? 0.7 : 0),
                minWidth: 28,
                minHeight: 20,
              }}
              title={labelVal ? "Click to edit label" : "Click to add label"}
            >
              {labelVal || "..."}
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(EditableEdge);

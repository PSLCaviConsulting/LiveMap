import { memo } from "react";
import { type NodeProps } from "@xyflow/react";

function NoteNode({ data, selected }: NodeProps) {
  const nodeData = data as { label: string; color?: string };

  return (
    <div
      className={`bg-amber-50 rounded-md shadow-sm border border-amber-200 p-3 transition-shadow ${selected ? "shadow-lg ring-2 ring-amber-300/50" : "hover:shadow-md"}`}
      style={{ minWidth: 140, maxWidth: 240 }}
    >
      <div className="text-xs font-medium text-amber-800 mb-1">Note</div>
      <div className="text-sm text-amber-900 leading-snug">
        {nodeData.label || "Add a note..."}
      </div>
    </div>
  );
}

export default memo(NoteNode);

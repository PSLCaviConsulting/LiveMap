import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";

function GhostNode({ data }: NodeProps) {
  const nodeData = data as { nodeType: string; onClick?: () => void };
  const isQuestion = nodeData.nodeType === "ghostQuestion";

  return (
    <div
      className="ghost-node bg-white/50 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-white/80 transition-all"
      style={{ minWidth: 180, minHeight: 70 }}
      onClick={() => nodeData.onClick?.()}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-2 !h-2" />

      <Plus className="h-5 w-5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground font-medium">
        {isQuestion ? "Add Question" : "Add Action"}
      </span>

      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !w-2 !h-2" />
    </div>
  );
}

export default memo(GhostNode);

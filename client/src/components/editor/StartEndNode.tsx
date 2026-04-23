import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

function StartEndNode({ data, selected }: NodeProps) {
  const nodeData = data as { label: string; nodeType: string; color?: string };
  const isStart = nodeData.nodeType === "start";
  const bgColor = nodeData.color || (isStart ? "#22c55e" : "#ef4444");
  const [hovered, setHovered] = useState(false);

  const handleClass = `
    !w-3.5 !h-3.5 !border-[2.5px] !border-teal-500 !bg-white !rounded-full
    transition-all duration-150
    ${hovered || selected ? "!opacity-100 !scale-100" : "!opacity-0 !scale-0"}
  `;

  return (
    <div
      className={`rounded-full shadow-sm border-2 transition-shadow flex items-center justify-center ${selected ? "shadow-lg ring-2 ring-primary/30" : "hover:shadow-md"}`}
      style={{
        borderColor: bgColor,
        backgroundColor: bgColor,
        width: 100,
        height: 44,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {!isStart && (
        <>
          <Handle type="target" id="t-top"    position={Position.Top}    className={handleClass} />
          <Handle type="target" id="t-right"  position={Position.Right}  className={handleClass} />
          <Handle type="target" id="t-bottom" position={Position.Bottom} className={handleClass} />
          <Handle type="target" id="t-left"   position={Position.Left}   className={handleClass} />
        </>
      )}

      <span className="text-white text-sm font-semibold">
        {nodeData.label || (isStart ? "Start" : "End")}
      </span>

      {isStart && (
        <>
          <Handle type="source" id="s-top"    position={Position.Top}    className={handleClass} />
          <Handle type="source" id="s-right"  position={Position.Right}  className={handleClass} />
          <Handle type="source" id="s-bottom" position={Position.Bottom} className={handleClass} />
          <Handle type="source" id="s-left"   position={Position.Left}   className={handleClass} />
        </>
      )}
    </div>
  );
}

export default memo(StartEndNode);

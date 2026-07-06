import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

function StartEndNode({ id, data, selected }: NodeProps) {
  const nodeData = data as {
    label: string; nodeType: string; color?: string; readOnly?: boolean;
    autoFocus?: boolean;
    onFieldChange?: (nodeId: string, field: string, value: string) => void;
    onAutoFocused?: () => void;
  };
  const isStart = nodeData.nodeType === "start";
  const bgColor = nodeData.color || (isStart ? "#22c55e" : "#ef4444");
  const readOnly = !!nodeData.readOnly;
  const [hovered, setHovered] = useState(false);
  const [labelVal, setLabelVal] = useState(nodeData.label || "");
  const committedRef = useRef(nodeData.label || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLabelVal(nodeData.label || "");
    committedRef.current = nodeData.label || "";
  }, [nodeData.label]);

  useEffect(() => {
    if (nodeData.autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      nodeData.onAutoFocused?.();
    }
  }, [nodeData.autoFocus, nodeData.onAutoFocused]);

  const commit = useCallback(() => {
    if (labelVal !== committedRef.current) {
      committedRef.current = labelVal;
      nodeData.onFieldChange?.(id, "label", labelVal);
    }
  }, [id, labelVal, nodeData]);

  const stop = useCallback((e: React.SyntheticEvent) => e.stopPropagation(), []);

  const handleClass = `
    !w-3.5 !h-3.5 !border-[2.5px] !border-teal-500 !bg-white !rounded-full
    transition-all duration-150
    ${!readOnly && (hovered || selected) ? "!opacity-100 !scale-100" : "!opacity-0 !scale-0"}
  `;

  return (
    <div
      className={`rounded-full shadow-sm border-2 transition-shadow flex items-center justify-center ${selected ? "shadow-lg ring-2 ring-primary/30" : "hover:shadow-md"}`}
      style={{ borderColor: bgColor, backgroundColor: bgColor, width: 100, height: 44 }}
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

      {readOnly ? (
        <span className="text-white text-sm font-semibold">
          {labelVal || (isStart ? "Start" : "End")}
        </span>
      ) : (
        <input
          ref={inputRef}
          className="w-full bg-transparent text-center text-white text-sm font-semibold placeholder:text-white/60 outline-none border-none nodrag nopan"
          value={labelVal}
          onChange={(e) => setLabelVal(e.target.value)}
          onBlur={commit}
          onMouseDown={stop}
          onClick={stop}
          placeholder={isStart ? "Start" : "End"}
          spellCheck={false}
        />
      )}

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

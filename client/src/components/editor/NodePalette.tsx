import { memo } from "react";

const onDragStart = (event: React.DragEvent, nodeType: string) => {
  event.dataTransfer.setData("application/reactflow-type", nodeType);
  event.dataTransfer.effectAllowed = "move";
};

function NodePalette() {
  return (
    <div className="absolute top-4 left-4 z-10 bg-white rounded-xl shadow-md border border-gray-100 p-3 flex flex-col gap-3">
      {/* Action Node - Rectangle with "A" */}
      <div
        className="cursor-grab active:cursor-grabbing select-none"
        draggable
        onDragStart={(e) => onDragStart(e, "action")}
        title="Drag to add Action node"
      >
        <div className="w-14 h-10 border-2 border-gray-800 rounded-sm flex items-center justify-center bg-white hover:bg-gray-50 transition-colors">
          <span className="text-base font-semibold text-gray-800">A</span>
        </div>
      </div>

      {/* Question Node - Wavy/scalloped border with "Q" */}
      <div
        className="cursor-grab active:cursor-grabbing select-none"
        draggable
        onDragStart={(e) => onDragStart(e, "question")}
        title="Drag to add Question node"
      >
        <svg width="56" height="40" viewBox="0 0 56 40" className="hover:opacity-80 transition-opacity">
          {/* Wavy/scalloped border */}
          <path
            d="M4,0 Q0,0 0,4 Q0,8 3,10 Q0,12 0,16 Q0,20 3,22 Q0,24 0,28 Q0,32 0,36 Q0,40 4,40 Q8,40 10,37 Q12,40 16,40 Q20,40 22,37 Q24,40 28,40 Q32,40 34,37 Q36,40 40,40 Q44,40 46,37 Q48,40 52,40 Q56,40 56,36 Q56,32 53,30 Q56,28 56,24 Q56,20 53,18 Q56,16 56,12 Q56,8 56,4 Q56,0 52,0 Q48,0 46,3 Q44,0 40,0 Q36,0 34,3 Q32,0 28,0 Q24,0 22,3 Q20,0 16,0 Q12,0 10,3 Q8,0 4,0 Z"
            fill="white"
            stroke="#1f2937"
            strokeWidth="2"
          />
          <text x="28" y="24" textAnchor="middle" className="text-base font-semibold" fill="#1f2937">Q</text>
        </svg>
      </div>

      <div className="h-px bg-gray-100 -mx-1" />

      {/* Start terminator */}
      <div
        className="cursor-grab active:cursor-grabbing select-none"
        draggable
        onDragStart={(e) => onDragStart(e, "start")}
        title="Drag to add Start node"
      >
        <div className="w-14 h-8 rounded-full flex items-center justify-center bg-green-500 hover:bg-green-600 transition-colors">
          <span className="text-xs font-semibold text-white">Start</span>
        </div>
      </div>

      {/* End terminator */}
      <div
        className="cursor-grab active:cursor-grabbing select-none"
        draggable
        onDragStart={(e) => onDragStart(e, "end")}
        title="Drag to add End node"
      >
        <div className="w-14 h-8 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 transition-colors">
          <span className="text-xs font-semibold text-white">End</span>
        </div>
      </div>
    </div>
  );
}

export default memo(NodePalette);

import { memo } from "react";

interface ConnectionDropMenuProps {
  x: number;
  y: number;
  onSelect: (type: "action" | "question") => void;
  onClose: () => void;
}

/**
 * Popup that appears when a user drags a connection handle
 * and drops it on empty canvas space. Lets them pick Action or Question.
 */
function ConnectionDropMenu({ x, y, onSelect, onClose }: ConnectionDropMenuProps) {
  return (
    <>
      {/* Invisible backdrop to close menu */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        className="absolute z-50 bg-white rounded-xl shadow-lg border border-gray-200 p-2 flex gap-3"
        style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
      >
        {/* Action node option */}
        <button
          className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
          onClick={() => onSelect("action")}
        >
          <div className="w-12 h-12 border-[2.5px] border-gray-800 rounded-sm flex items-center justify-center bg-white group-hover:bg-gray-50 transition-colors">
            <span className="text-lg font-semibold text-gray-800">A</span>
          </div>
          <span className="text-[11px] text-gray-500 font-medium">Action</span>
        </button>

        {/* Question node option */}
        <button
          className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
          onClick={() => onSelect("question")}
        >
          <svg width="48" height="36" viewBox="0 0 56 40" className="group-hover:opacity-80 transition-opacity">
            <path
              d="M4,0 Q0,0 0,4 Q0,8 3,10 Q0,12 0,16 Q0,20 3,22 Q0,24 0,28 Q0,32 0,36 Q0,40 4,40 Q8,40 10,37 Q12,40 16,40 Q20,40 22,37 Q24,40 28,40 Q32,40 34,37 Q36,40 40,40 Q44,40 46,37 Q48,40 52,40 Q56,40 56,36 Q56,32 53,30 Q56,28 56,24 Q56,20 53,18 Q56,16 56,12 Q56,8 56,4 Q56,0 52,0 Q48,0 46,3 Q44,0 40,0 Q36,0 34,3 Q32,0 28,0 Q24,0 22,3 Q20,0 16,0 Q12,0 10,3 Q8,0 4,0 Z"
              fill="white"
              stroke="#1f2937"
              strokeWidth="2"
            />
            <text x="28" y="24" textAnchor="middle" className="text-base font-semibold" fill="#1f2937">Q</text>
          </svg>
          <span className="text-[11px] text-gray-500 font-medium">Question</span>
        </button>
      </div>
    </>
  );
}

export default memo(ConnectionDropMenu);

import { memo, useCallback, useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

/**
 * Question Node — cloud shape with smooth scalloped edges.
 * Centered question text, two "Yes" / "No" labeled output handles.
 * Hover reveals teal ring handles, convert-to-action, and post-it note icons.
 */
function QuestionNode({ id, data, selected }: NodeProps) {
  const nodeData = data as {
    question: string; label: string; color?: string; nodeType: string; dbId?: number;
    onFieldChange?: (nodeId: string, field: string, value: string) => void;
    onConvertType?: (nodeId: string, newType: "action" | "question") => void;
    onToggleNote?: (nodeId: string) => void;
    note?: string;
    readOnly?: boolean;
  };
  const readOnly = !!nodeData.readOnly;

  const [questionVal, setQuestionVal] = useState(nodeData.question || nodeData.label || "");
  const [hovered, setHovered] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteVal, setNoteVal] = useState((nodeData.note as string) || "");

  useEffect(() => {
    setQuestionVal(nodeData.question || nodeData.label || "");
    setNoteVal((nodeData.note as string) || "");
  }, [nodeData.question, nodeData.label, nodeData.note]);

  const handleBlur = useCallback(() => {
    if (nodeData.onFieldChange) {
      nodeData.onFieldChange(id, "question", questionVal);
    }
  }, [id, questionVal, nodeData.onFieldChange]);

  const stopPropagation = useCallback((e: React.MouseEvent | React.FocusEvent) => {
    e.stopPropagation();
  }, []);

  const handleConvert = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (nodeData.onConvertType) {
      nodeData.onConvertType(id, "action");
    }
  }, [id, nodeData.onConvertType]);

  const handleNoteToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setNoteOpen(prev => !prev);
  }, []);

  const handleNoteBlur = useCallback(() => {
    if (nodeData.onFieldChange) {
      nodeData.onFieldChange(id, "note", noteVal);
    }
  }, [id, noteVal, nodeData.onFieldChange]);

  const w = 260;
  const h = 150;

  const cloudPath = `
    M 50,${h - 5}
    C 25,${h - 5} 8,${h - 18} 8,${h - 35}
    C 8,${h - 48} 15,${h - 56} 22,${h - 62}
    C 10,${h - 72} 5,${h - 88} 15,${h - 102}
    C 22,${h - 112} 38,${h - 122} 55,${h - 122}
    C 60,${h - 138} 80,${h - 148} 105,${h - 140}
    C 118,${h - 150} 142,${h - 150} 160,${h - 142}
    C 175,${h - 152} 200,${h - 142} 212,${h - 130}
    C 228,${h - 138} 248,${h - 126} 250,${h - 110}
    C 258,${h - 100} ${w - 2},${h - 85} ${w - 2},${h - 70}
    C ${w - 2},${h - 52} 248,${h - 40} 238,${h - 35}
    C 248,${h - 18} 240,${h - 5} 218,${h - 5}
    Z
  `;

  // Handle visibility class — teal ring style, hidden by default, shown on hover/selected.
  // Forced hidden in read-only mode so the shared viewer has no interactive hints.
  const handleClass = `
    !w-3.5 !h-3.5 !border-[2.5px] !border-teal-500 !bg-white !rounded-full
    transition-all duration-150
    ${!readOnly && (hovered || selected) ? "!opacity-100 !scale-100" : "!opacity-0 !scale-0"}
  `;

  return (
    <div
      className="relative group"
      style={{ width: w, height: h + 30 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Cloud SVG shape */}
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="absolute top-0 left-0"
        style={{
          filter: selected
            ? "drop-shadow(0 4px 12px rgba(0,0,0,0.15))"
            : "drop-shadow(0 2px 6px rgba(0,0,0,0.08))",
          transition: "filter 0.2s ease",
        }}
      >
        <path
          d={cloudPath}
          fill="white"
          stroke={selected ? "#1a1a1a" : "#4b5563"}
          strokeWidth={selected ? "2.5" : "2"}
          strokeLinejoin="round"
        />
      </svg>

      {/* Top-right icons: Note + Convert — editor only */}
      {!readOnly && (hovered || selected) && (
        <div className="absolute -top-2 -right-2 z-20 flex gap-1">
          <button
            onClick={handleNoteToggle}
            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all shadow-sm ${
              noteOpen || noteVal
                ? "bg-amber-100 border-amber-400 hover:bg-amber-200"
                : "bg-white border-gray-300 hover:border-gray-600 hover:bg-gray-50"
            }`}
            title="Add note"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={noteVal ? "text-amber-600" : "text-gray-500"}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </button>
          <button
            onClick={handleConvert}
            className="w-7 h-7 rounded-full bg-white border-2 border-gray-300 hover:border-gray-600 hover:bg-gray-50 flex items-center justify-center transition-all shadow-sm"
            title="Convert to Action"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 hover:text-gray-800">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </button>
        </div>
      )}

      {/* Target handles — one per side, stable IDs for auto-routing */}
      <Handle
        type="target"
        id="t-left"
        position={Position.Left}
        className={handleClass}
        style={{ top: "38%", left: 2 }}
      />
      <Handle
        type="target"
        id="t-top"
        position={Position.Top}
        className={handleClass}
        style={{ top: -4, left: "50%" }}
      />
      <Handle
        type="target"
        id="t-right"
        position={Position.Right}
        className={handleClass}
        style={{ top: "38%", right: 2 }}
      />
      <Handle
        type="target"
        id="t-bottom"
        position={Position.Bottom}
        className={handleClass}
        style={{ bottom: 22, left: "50%" }}
      />

      {/* Question text */}
      <div
        className="absolute flex items-center justify-center"
        style={{ top: 15, left: 30, right: 30, bottom: 50 }}
      >
        {readOnly ? (
          <div
            className="w-full text-center text-[15px] font-medium text-gray-800 leading-snug px-1"
            style={{ marginTop: 8, whiteSpace: "pre-wrap", overflow: "hidden" }}
          >
            {questionVal || <span className="text-gray-300">Question</span>}
          </div>
        ) : (
          <textarea
            className="w-full bg-transparent text-center text-[15px] font-medium text-gray-800 placeholder:text-gray-300 outline-none border-none resize-none leading-snug nodrag"
            value={questionVal}
            onChange={(e) => setQuestionVal(e.target.value)}
            onBlur={handleBlur}
            onMouseDown={stopPropagation}
            onClick={stopPropagation}
            placeholder="Question"
            rows={2}
            spellCheck={false}
            style={{ marginTop: 8 }}
          />
        )}
      </div>

      {/* Two output handles: Yes (left) and No (right) — teal ring, hover-only */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        className={`
          !w-3.5 !h-3.5 !border-[2.5px] !border-green-500 !bg-white !rounded-full
          transition-all duration-150
          ${!readOnly && (hovered || selected) ? "!opacity-100 !scale-100" : "!opacity-0 !scale-0"}
        `}
        style={{ left: "32%", bottom: 22 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        className={`
          !w-3.5 !h-3.5 !border-[2.5px] !border-red-400 !bg-white !rounded-full
          transition-all duration-150
          ${!readOnly && (hovered || selected) ? "!opacity-100 !scale-100" : "!opacity-0 !scale-0"}
        `}
        style={{ left: "68%", bottom: 22 }}
      />

      {/* Yes / No labels */}
      <div
        className="absolute flex justify-between pointer-events-none"
        style={{ bottom: 4, left: 40, right: 40 }}
      >
        <span className={`text-[11px] text-green-600 font-semibold tracking-wide transition-opacity duration-150 ${hovered || selected ? "opacity-100" : "opacity-0"}`}>Yes</span>
        <span className={`text-[11px] text-red-500 font-semibold tracking-wide transition-opacity duration-150 ${hovered || selected ? "opacity-100" : "opacity-0"}`}>No</span>
      </div>

      {/* Post-it note popup */}
      {noteOpen && (
        <div
          className="absolute -right-56 top-0 z-50 w-52"
          onMouseDown={stopPropagation}
          onClick={stopPropagation}
        >
          <div className="bg-amber-50 border border-amber-200 rounded-lg shadow-lg p-3 relative">
            <div className="absolute -left-2 top-4 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[8px] border-r-amber-200" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Note</span>
              <button
                onClick={(e) => { e.stopPropagation(); setNoteOpen(false); }}
                className="text-amber-400 hover:text-amber-600 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <textarea
              className="w-full bg-white/60 border border-amber-200 rounded text-sm text-gray-700 p-2 outline-none resize-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200 nodrag"
              value={noteVal}
              onChange={(e) => setNoteVal(e.target.value)}
              onBlur={handleNoteBlur}
              placeholder="Add a note..."
              rows={3}
              spellCheck={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(QuestionNode);

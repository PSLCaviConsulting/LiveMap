import { memo, useCallback, useEffect, useState, useRef } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

/**
 * Action Node — clean square with thick border.
 * Three centered lines: Action, System, Role — all inline-editable with autocomplete.
 * Hover reveals teal ring handles (top/bottom/left/right), convert-to-question, and post-it note icons.
 */
function ActionNode({ id, data, selected }: NodeProps) {
  const nodeData = data as {
    what: string; where: string; system: string; role: string;
    color?: string; nodeType: string; dbId?: number;
    onFieldChange?: (nodeId: string, field: string, value: string) => void;
    onConvertType?: (nodeId: string, newType: "action" | "question") => void;
    onToggleNote?: (nodeId: string) => void;
    suggestions?: { systems: string[]; actions: string[]; roles: string[] };
    note?: string;
    readOnly?: boolean;
  };
  const readOnly = !!nodeData.readOnly;

  const [whatVal, setWhatVal] = useState(nodeData.what || "");
  const [systemVal, setSystemVal] = useState(nodeData.where || nodeData.system || "");
  const [roleVal, setRoleVal] = useState(nodeData.role || "");
  const [hovered, setHovered] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteVal, setNoteVal] = useState((nodeData.note as string) || "");

  // Autocomplete state — track which field dropdown is open
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  // Ref to prevent blur from closing dropdown when clicking a suggestion
  const isSelectingRef = useRef(false);

  useEffect(() => {
    setWhatVal(nodeData.what || "");
    setSystemVal(nodeData.where || nodeData.system || "");
    setRoleVal(nodeData.role || "");
    setNoteVal((nodeData.note as string) || "");
  }, [nodeData.what, nodeData.where, nodeData.system, nodeData.role, nodeData.note]);

  const getSuggestionList = useCallback((field: string): string[] => {
    const sug = nodeData.suggestions;
    if (!sug) return [];
    if (field === "what") return sug.actions || [];
    if (field === "where") return sug.systems || [];
    if (field === "role") return sug.roles || [];
    return [];
  }, [nodeData.suggestions]);

  const computeFiltered = useCallback((field: string, value: string) => {
    const list = getSuggestionList(field);
    if (!list.length) return [];
    if (value.trim()) {
      const lower = value.toLowerCase();
      return list.filter(s => s.toLowerCase().includes(lower) && s.toLowerCase() !== lower).slice(0, 8);
    }
    return list.slice(0, 8);
  }, [getSuggestionList]);

  const handleFocus = useCallback((field: string, value: string) => {
    setOpenDropdown(field);
    setFilteredSuggestions(computeFiltered(field, value));
  }, [computeFiltered]);

  const handleBlur = useCallback((field: string, value: string) => {
    setTimeout(() => {
      if (isSelectingRef.current) {
        isSelectingRef.current = false;
        return;
      }
      setOpenDropdown(null);
      setFilteredSuggestions([]);
      if (nodeData.onFieldChange) {
        nodeData.onFieldChange(id, field, value);
      }
    }, 250);
  }, [id, nodeData.onFieldChange]);

  const handleChange = useCallback((field: string, value: string) => {
    if (field === "what") setWhatVal(value);
    else if (field === "where") setSystemVal(value);
    else if (field === "role") setRoleVal(value);
    setFilteredSuggestions(computeFiltered(field, value));
  }, [computeFiltered]);

  const selectSuggestion = useCallback((field: string, value: string) => {
    isSelectingRef.current = true;
    if (field === "what") setWhatVal(value);
    else if (field === "where") setSystemVal(value);
    else if (field === "role") setRoleVal(value);
    setOpenDropdown(null);
    setFilteredSuggestions([]);
    if (nodeData.onFieldChange) {
      nodeData.onFieldChange(id, field, value);
    }
  }, [id, nodeData.onFieldChange]);

  const stopPropagation = useCallback((e: React.MouseEvent | React.FocusEvent) => {
    e.stopPropagation();
  }, []);

  const handleConvert = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (nodeData.onConvertType) {
      nodeData.onConvertType(id, "question");
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

  const renderSuggestionDropdown = (field: string) => {
    if (openDropdown !== field || filteredSuggestions.length === 0) return null;
    return (
      <div
        className="absolute left-0 right-0 top-full z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl max-h-40 overflow-y-auto mt-0.5 nodrag nopan nowheel"
        style={{ minWidth: 180, pointerEvents: "all" }}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        {filteredSuggestions.map((s, i) => (
          <button
            key={i}
            type="button"
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 truncate transition-colors cursor-pointer border-b border-gray-50 last:border-b-0 nodrag nopan"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              selectSuggestion(field, s);
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {s}
          </button>
        ))}
      </div>
    );
  };

  // Handle visibility class — teal ring style, hidden by default, shown on hover/selected.
  // In read-only mode handles stay invisible so edges still anchor cleanly
  // but users see no interactive affordance.
  const handleClass = `
    !w-3.5 !h-3.5 !border-[2.5px] !border-teal-500 !bg-white !rounded-full
    transition-all duration-150
    ${!readOnly && (hovered || selected) ? "!opacity-100 !scale-100" : "!opacity-0 !scale-0"}
  `;

  return (
    <div
      className="relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Main node body */}
      <div
        style={{ width: 200, minHeight: 160 }}
        className={`
          relative bg-white rounded-lg
          border-2 transition-all duration-200
          ${selected
            ? "border-gray-900 shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
            : "border-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
          }
          flex flex-col items-center justify-center gap-1 py-5 px-3
        `}
      >
        {/* Top-right icons: Note + Convert — editor only */}
        {!readOnly && (hovered || selected) && (
          <div className="absolute -top-3 -right-3 z-20 flex gap-1">
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
              title="Convert to Question"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 hover:text-gray-800">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>
          </div>
        )}

        {/* Handles — one target + one source per side, both at the same
            pixel so the user sees a single teal dot per side. Stable IDs
            let us auto-pick the best side based on relative node position. */}
        <Handle type="target" position={Position.Top}    id="t-top"    className={`${handleClass} !-top-[8px]`} />
        <Handle type="target" position={Position.Right}  id="t-right"  className={`${handleClass} !-right-[8px]`} />
        <Handle type="target" position={Position.Bottom} id="t-bottom" className={`${handleClass} !-bottom-[8px]`} />
        <Handle type="target" position={Position.Left}   id="t-left"   className={`${handleClass} !-left-[8px]`} />
        <Handle type="source" position={Position.Top}    id="s-top"    className={`${handleClass} !-top-[8px]`} />
        <Handle type="source" position={Position.Left}   id="s-left"   className={`${handleClass} !-left-[8px]`} />

        {/* Action / What field */}
        <div className="relative w-full">
          {readOnly ? (
            <div className="w-full text-center text-[15px] font-medium text-gray-800 leading-relaxed truncate">
              {whatVal || <span className="text-gray-300">Action</span>}
            </div>
          ) : (
            <>
              <input
                className="w-full bg-transparent text-center text-[15px] font-medium text-gray-800 placeholder:text-gray-300 outline-none border-none leading-relaxed nodrag nopan"
                value={whatVal}
                onChange={(e) => handleChange("what", e.target.value)}
                onBlur={() => handleBlur("what", whatVal)}
                onFocus={() => handleFocus("what", whatVal)}
                onMouseDown={stopPropagation}
                onClick={stopPropagation}
                placeholder="Action"
                spellCheck={false}
              />
              {renderSuggestionDropdown("what")}
            </>
          )}
        </div>

        <div className="w-3/4 h-px bg-gray-200 my-0.5" />

        {/* System / Where field */}
        <div className="relative w-full">
          {readOnly ? (
            <div className="w-full text-center text-[13px] font-normal text-gray-500 leading-relaxed truncate">
              {systemVal || <span className="text-gray-300">System</span>}
            </div>
          ) : (
            <>
              <input
                className="w-full bg-transparent text-center text-[13px] font-normal text-gray-500 placeholder:text-gray-300 outline-none border-none leading-relaxed nodrag nopan"
                value={systemVal}
                onChange={(e) => handleChange("where", e.target.value)}
                onBlur={() => handleBlur("where", systemVal)}
                onFocus={() => handleFocus("where", systemVal)}
                onMouseDown={stopPropagation}
                onClick={stopPropagation}
                placeholder="System"
                spellCheck={false}
              />
              {renderSuggestionDropdown("where")}
            </>
          )}
        </div>

        <div className="w-3/4 h-px bg-gray-200 my-0.5" />

        {/* Role field */}
        <div className="relative w-full">
          {readOnly ? (
            <div className="w-full text-center text-[13px] font-normal text-gray-500 leading-relaxed truncate">
              {roleVal || <span className="text-gray-300">Role</span>}
            </div>
          ) : (
            <>
              <input
                className="w-full bg-transparent text-center text-[13px] font-normal text-gray-500 placeholder:text-gray-300 outline-none border-none leading-relaxed nodrag nopan"
                value={roleVal}
                onChange={(e) => handleChange("role", e.target.value)}
                onBlur={() => handleBlur("role", roleVal)}
                onFocus={() => handleFocus("role", roleVal)}
                onMouseDown={stopPropagation}
                onClick={stopPropagation}
                placeholder="Role"
                spellCheck={false}
              />
              {renderSuggestionDropdown("role")}
            </>
          )}
        </div>

        <Handle type="source" position={Position.Bottom} id="s-bottom" className={`${handleClass} !-bottom-[8px]`} />
        <Handle type="source" position={Position.Right}  id="s-right"  className={`${handleClass} !-right-[8px]`} />
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
              className="w-full bg-white/60 border border-amber-200 rounded text-sm text-gray-700 p-2 outline-none resize-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200 nodrag nopan"
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

export default memo(ActionNode);

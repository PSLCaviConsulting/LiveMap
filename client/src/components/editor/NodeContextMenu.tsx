import { memo, useEffect, useRef } from "react";
import { Trash2, Copy, StickyNote } from "lucide-react";

interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  onDelete: (nodeId: string) => void;
  onDuplicate: (nodeId: string) => void;
  onAddNote: (nodeId: string) => void;
  onClose: () => void;
}

function NodeContextMenu({
  x,
  y,
  nodeId,
  onDelete,
  onDuplicate,
  onAddNote,
  onClose,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Delay adding listener to avoid immediate close from the same right-click
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const menuItems = [
    {
      label: "Duplicate",
      icon: Copy,
      action: () => { onDuplicate(nodeId); onClose(); },
      className: "text-foreground hover:bg-accent",
    },
    {
      label: "Add Note",
      icon: StickyNote,
      action: () => { onAddNote(nodeId); onClose(); },
      className: "text-foreground hover:bg-accent",
    },
    { type: "separator" as const },
    {
      label: "Delete",
      icon: Trash2,
      action: () => { onDelete(nodeId); onClose(); },
      className: "text-destructive hover:bg-destructive/10",
    },
  ];

  return (
    <div
      ref={menuRef}
      className="absolute z-[100] bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[160px] animate-in fade-in-0 zoom-in-95"
      style={{ left: x, top: y }}
    >
      {menuItems.map((item, i) => {
        if ("type" in item && item.type === "separator") {
          return <div key={i} className="h-px bg-border my-1 mx-2" />;
        }
        const { label, icon: Icon, action, className } = item as {
          label: string;
          icon: typeof Copy;
          action: () => void;
          className: string;
        };
        return (
          <button
            key={label}
            onClick={action}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors cursor-pointer ${className}`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default memo(NodeContextMenu);

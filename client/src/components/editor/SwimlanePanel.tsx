import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Plus, Trash2, Eye, EyeOff, GripVertical } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { Node } from "@xyflow/react";

const SWIMLANE_COLORS = [
  "#0d9488", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

interface SwimlanePanelProps {
  processId: number;
  nodes: Node[];
  onClose: () => void;
}

export default function SwimlanePanel({ processId, nodes, onClose }: SwimlanePanelProps) {
  const [newName, setNewName] = useState("");

  const utils = trpc.useUtils();
  const { data: groups } = trpc.group.list.useQuery({ processId });

  const createGroup = trpc.group.create.useMutation({
    onSuccess: () => {
      utils.group.list.invalidate();
      setNewName("");
      toast.success("Swimlane created");
    },
    onError: () => toast.error("Failed to create swimlane"),
  });

  const updateGroup = trpc.group.update.useMutation({
    onSuccess: () => utils.group.list.invalidate(),
  });

  const deleteGroup = trpc.group.delete.useMutation({
    onSuccess: () => {
      utils.group.list.invalidate();
      toast.success("Swimlane deleted");
    },
    onError: () => toast.error("Failed to delete swimlane"),
  });

  const handleCreate = () => {
    if (!newName.trim()) return;
    const color = SWIMLANE_COLORS[(groups?.length || 0) % SWIMLANE_COLORS.length];
    createGroup.mutate({
      processId,
      name: newName.trim(),
      color,
      sortOrder: (groups?.length || 0) + 1,
    });
  };

  // Count nodes in each group
  const getNodeCount = (groupId: number) => {
    return nodes.filter(n => n.data?.groupId === groupId).length;
  };

  return (
    <div className="absolute left-0 top-0 h-full w-72 bg-background border-r shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-sm">Swimlanes</h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 border-b">
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="New swimlane name"
            className="text-sm"
            onKeyDown={e => e.key === "Enter" && handleCreate()}
          />
          <Button size="icon" onClick={handleCreate} disabled={!newName.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {groups?.map(group => (
            <div key={group.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: group.color || "#0d9488" }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{group.name}</div>
                <div className="text-xs text-muted-foreground">
                  {getNodeCount(group.id)} nodes
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100"
                onClick={() => updateGroup.mutate({ id: group.id, hidden: !group.hidden })}
              >
                {group.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={() => {
                  if (confirm("Delete this swimlane?")) {
                    deleteGroup.mutate({ id: group.id });
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          {(!groups || groups.length === 0) && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <p>No swimlanes yet.</p>
              <p className="mt-1">Use auto-swimlane or create one above.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

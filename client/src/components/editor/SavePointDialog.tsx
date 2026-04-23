import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, Clock, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { createSnapshot } from "@/lib/editorUtils";
import type { Node, Edge } from "@xyflow/react";

interface SavePointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processId: number;
  nodes: Node[];
  edges: Edge[];
}

export default function SavePointDialog({ open, onOpenChange, processId, nodes, edges }: SavePointDialogProps) {
  const [name, setName] = useState("");

  const utils = trpc.useUtils();
  const { data: savePoints } = trpc.savePoint.list.useQuery(
    { processId },
    { enabled: open }
  );

  const createSavePoint = trpc.savePoint.create.useMutation({
    onSuccess: () => {
      utils.savePoint.list.invalidate();
      setName("");
      toast.success("Save point created");
    },
    onError: () => toast.error("Failed to create save point"),
  });

  const handleSave = () => {
    if (!name.trim()) return;
    const snapshot = createSnapshot(nodes, edges);
    createSavePoint.mutate({
      processId,
      name: name.trim(),
      snapshot,
    });
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    return new Date(date).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Save Points</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Create Save Point</Label>
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Before restructuring"
                onKeyDown={e => e.key === "Enter" && handleSave()}
              />
              <Button onClick={handleSave} disabled={!name.trim() || createSavePoint.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>

          {savePoints && savePoints.length > 0 && (
            <div className="space-y-2">
              <Label>History</Label>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {savePoints.map(sp => (
                    <div key={sp.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">{sp.name}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(sp.createdAt)}</div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toast.info("Restore from save point coming soon")}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Restore
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Plus, GitBranch, MoreVertical, Pencil, Trash2, Clock, ExternalLink
} from "lucide-react";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function ProjectDetail() {
  const params = useParams<{ projectId: string }>();
  const projectId = parseInt(params.projectId || "0");
  const [, setLocation] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const utils = trpc.useUtils();
  const { data: project } = trpc.project.get.useQuery({ id: projectId });
  const { data: processes, isLoading } = trpc.process.list.useQuery({ projectId });

  const createProcess = trpc.process.create.useMutation({
    onSuccess: (result) => {
      utils.process.list.invalidate();
      setCreateOpen(false);
      setName("");
      setDescription("");
      toast.success("Process created");
      setLocation(`/editor/${projectId}/${result.id}`);
    },
    onError: () => toast.error("Failed to create process"),
  });

  const deleteProcess = trpc.process.delete.useMutation({
    onSuccess: () => {
      utils.process.list.invalidate();
      toast.success("Process deleted");
    },
    onError: () => toast.error("Failed to delete process"),
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            {project?.color && <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />}
            <h1 className="text-2xl font-bold tracking-tight truncate">{project?.name || "Project"}</h1>
          </div>
          {project?.description && (
            <p className="text-muted-foreground text-sm mt-1">{project.description}</p>
          )}
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setName(""); setDescription(""); }}>
              <Plus className="h-4 w-4 mr-2" /> New Process
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Process</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="proc-name">Process Name</Label>
                <Input id="proc-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Customer Onboarding" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proc-desc">Description</Label>
                <Textarea id="proc-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => {
                if (!name.trim()) return;
                createProcess.mutate({ projectId, name: name.trim(), description: description.trim() || undefined });
              }} disabled={!name.trim() || createProcess.isPending}>
                {createProcess.isPending ? "Creating..." : "Create & Open Editor"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="py-4"><div className="h-5 bg-muted rounded w-1/3" /></CardContent>
            </Card>
          ))}
        </div>
      ) : !processes?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No processes yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Create your first process to start mapping</p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create Process
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {processes.map(process => (
            <Card key={process.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 min-w-0 flex-1 cursor-pointer"
                    onClick={() => setLocation(`/editor/${projectId}/${process.id}`)}>
                    <GitBranch className="h-5 w-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-medium truncate">{process.name}</h3>
                      {process.description && (
                        <p className="text-sm text-muted-foreground truncate">{process.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(process.updatedAt)}
                    </span>
                    <Button variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => setLocation(`/editor/${projectId}/${process.id}`)}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="text-destructive" onClick={() => {
                          if (confirm("Delete this process and all its data?")) {
                            deleteProcess.mutate({ id: process.id });
                          }
                        }}>
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

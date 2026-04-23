import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";
import { useState, useEffect } from "react";
import type { Node } from "@xyflow/react";

interface NodeEditPanelProps {
  node: Node | null;
  onClose: () => void;
  onSave: (nodeId: string, data: Record<string, any>) => void;
  onDelete: (nodeId: string) => void;
}

export default function NodeEditPanel({ node, onClose, onSave, onDelete }: NodeEditPanelProps) {
  const [what, setWhat] = useState("");
  const [where, setWhere] = useState("");
  const [role, setRole] = useState("");
  const [question, setQuestion] = useState("");
  const [label, setLabel] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (node) {
      setWhat((node.data?.what as string) || "");
      setWhere((node.data?.where as string) || "");
      setRole((node.data?.role as string) || "");
      setQuestion((node.data?.question as string) || "");
      setLabel((node.data?.label as string) || "");
      setErrors({});
    }
  }, [node?.id]);

  if (!node) return null;

  const nodeType = node.data?.nodeType as string || node.type;
  const isAction = nodeType === "action";
  const isQuestion = nodeType === "question";
  const isStartEnd = nodeType === "start" || nodeType === "end";

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (isAction) {
      if (!what.trim()) newErrors.what = "Action is required";
      if (!where.trim()) newErrors.where = "System is required";
      if (!role.trim()) newErrors.role = "Role is required";
    }
    if (isQuestion && !question.trim()) {
      newErrors.question = "Question is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const data: Record<string, any> = {};
    if (isAction) {
      data.what = what.trim();
      data.where = where.trim();
      data.system = where.trim();
      data.role = role.trim();
    } else if (isQuestion) {
      data.question = question.trim();
      data.label = question.trim();
    } else {
      data.label = label.trim();
    }
    onSave(node.id, data);
  };

  return (
    <div className="absolute right-0 top-0 h-full w-80 bg-background border-l shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-sm">
          Edit {isAction ? "Action" : isQuestion ? "Question" : isStartEnd ? (nodeType === "start" ? "Start" : "End") : "Node"}
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isAction && (
          <>
            <div className="space-y-2">
              <Label htmlFor="where">System / Where <span className="text-destructive">*</span></Label>
              <Input id="where" value={where} onChange={e => setWhere(e.target.value)}
                placeholder="e.g., Email, CRM, Phone" className={errors.where ? "border-destructive" : ""} />
              {errors.where && <p className="text-xs text-destructive">{errors.where}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="what">Action / What <span className="text-destructive">*</span></Label>
              <Textarea id="what" value={what} onChange={e => setWhat(e.target.value)}
                placeholder="e.g., Send confirmation email" rows={3} className={errors.what ? "border-destructive" : ""} />
              {errors.what && <p className="text-xs text-destructive">{errors.what}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role <span className="text-destructive">*</span></Label>
              <Input id="role" value={role} onChange={e => setRole(e.target.value)}
                placeholder="e.g., Account Manager" className={errors.role ? "border-destructive" : ""} />
              {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
            </div>
          </>
        )}

        {isQuestion && (
          <div className="space-y-2">
            <Label htmlFor="question">Question <span className="text-destructive">*</span></Label>
            <Textarea id="question" value={question} onChange={e => setQuestion(e.target.value)}
              placeholder="e.g., Is the order approved?" rows={3} className={errors.question ? "border-destructive" : ""} />
            {errors.question && <p className="text-xs text-destructive">{errors.question}</p>}
          </div>
        )}

        {isStartEnd && (
          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input id="label" value={label} onChange={e => setLabel(e.target.value)}
              placeholder={nodeType === "start" ? "Start" : "End"} />
          </div>
        )}

        {nodeType === "note" && (
          <div className="space-y-2">
            <Label htmlFor="note-label">Note</Label>
            <Textarea id="note-label" value={label} onChange={e => setLabel(e.target.value)}
              placeholder="Add a note..." rows={4} />
          </div>
        )}
      </div>

      <div className="p-4 border-t flex gap-2">
        <Button variant="destructive" size="sm" onClick={() => onDelete(node.id)} className="mr-auto">
          Delete
        </Button>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={handleSave}>Save</Button>
      </div>
    </div>
  );
}

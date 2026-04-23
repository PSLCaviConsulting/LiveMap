import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Copy, Link2, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processId: number;
}

export default function ShareDialog({ open, onOpenChange, processId }: ShareDialogProps) {
  const { data: shareLink, refetch } = trpc.share.getLink.useQuery(
    { processId },
    { enabled: open }
  );

  const createLink = trpc.share.createLink.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Share link created");
    },
    onError: () => toast.error("Failed to create link"),
  });

  const deactivateLink = trpc.share.deactivateLink.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Share link deactivated");
    },
    onError: () => toast.error("Failed to deactivate link"),
  });

  const shareUrl = shareLink?.token
    ? `${window.location.origin}/share/${shareLink.token}`
    : "";

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Process</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Public Link</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Anyone with the link can view this process (read-only)
              </p>
            </div>
            <Switch
              checked={!!shareLink?.isActive}
              onCheckedChange={(checked) => {
                if (checked) {
                  createLink.mutate({ processId });
                } else {
                  deactivateLink.mutate({ processId });
                }
              }}
            />
          </div>

          {shareLink?.isActive && shareUrl && (
            <div className="space-y-2">
              <Label>Share URL</Label>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly className="text-xs" />
                <Button variant="outline" size="icon" onClick={copyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => window.open(shareUrl, "_blank")}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
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

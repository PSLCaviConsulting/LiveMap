import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Download, FileImage, FileText, FileType } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const [format, setFormat] = useState("png");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const flowViewport = document.querySelector(".react-flow__viewport") as HTMLElement;
      if (!flowViewport) { toast.error("Canvas not found"); setExporting(false); return; }

      // Dynamic import of html-to-image
      const { toPng: htmlToPng, toSvg: htmlToSvg } = await import("html-to-image");

      let dataUrl: string;
      let filename: string;

      if (format === "svg") {
        dataUrl = await htmlToSvg(flowViewport, { backgroundColor: "#ffffff" });
        filename = "process-map.svg";
      } else if (format === "png") {
        dataUrl = await htmlToPng(flowViewport, { backgroundColor: "#ffffff", quality: 1 });
        filename = "process-map.png";
      } else {
        toast.info("PDF and DOCX export coming soon");
        setExporting(false);
        return;
      }

      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();
      toast.success(`Exported as ${format.toUpperCase()}`);
      onOpenChange(false);
    } catch (err) {
      toast.error("Export failed");
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Process Map</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Label className="mb-3 block">Choose format</Label>
          <RadioGroup value={format} onValueChange={setFormat} className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="png" id="png" />
              <Label htmlFor="png" className="flex items-center gap-2 cursor-pointer flex-1">
                <FileImage className="h-4 w-4 text-blue-500" />
                <div>
                  <div className="font-medium">PNG Image</div>
                  <div className="text-xs text-muted-foreground">High-quality raster image</div>
                </div>
              </Label>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="svg" id="svg" />
              <Label htmlFor="svg" className="flex items-center gap-2 cursor-pointer flex-1">
                <FileType className="h-4 w-4 text-green-500" />
                <div>
                  <div className="font-medium">SVG Vector</div>
                  <div className="text-xs text-muted-foreground">Scalable vector graphic</div>
                </div>
              </Label>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer opacity-60">
              <RadioGroupItem value="pdf" id="pdf" disabled />
              <Label htmlFor="pdf" className="flex items-center gap-2 cursor-pointer flex-1">
                <FileText className="h-4 w-4 text-red-500" />
                <div>
                  <div className="font-medium">PDF Document</div>
                  <div className="text-xs text-muted-foreground">Coming soon</div>
                </div>
              </Label>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer opacity-60">
              <RadioGroupItem value="docx" id="docx" disabled />
              <Label htmlFor="docx" className="flex items-center gap-2 cursor-pointer flex-1">
                <FileText className="h-4 w-4 text-blue-700" />
                <div>
                  <div className="font-medium">DOCX Document</div>
                  <div className="text-xs text-muted-foreground">Coming soon</div>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? "Exporting..." : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Button } from "@/components/ui/button";
import {
  Tooltip, TooltipContent, TooltipTrigger
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Plus, Share2, Download, Undo2, Redo2,
  LayoutGrid, ZoomIn, ZoomOut, Maximize2, Save, Play, Layers
} from "lucide-react";

interface EditorToolbarProps {
  processName: string;
  onBack: () => void;
  onAddAction: () => void;
  onAddQuestion: () => void;
  onAutoFormat: () => void;
  onAutoSwimlane: () => void;
  onToggleSwimlanes: () => void;
  showSwimlanes: boolean;
  onFitView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onExport: () => void;
  onShare: () => void;
  onCapture: () => void;
  captureMode: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export default function EditorToolbar({
  processName, onBack, onAddAction, onAddQuestion,
  onAutoFormat, onAutoSwimlane, onToggleSwimlanes, showSwimlanes, onFitView, onZoomIn, onZoomOut,
  onUndo, onRedo, onSave, onExport, onShare, onCapture,
  captureMode, canUndo, canRedo,
}: EditorToolbarProps) {
  return (
    <div className="h-14 border-b bg-background flex items-center justify-between px-3 gap-2 shrink-0">
      {/* Left section */}
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back to project</TooltipContent>
        </Tooltip>

        <div className="h-6 w-px bg-border" />

        <span className="font-semibold text-primary text-sm hidden sm:inline">LiveMap</span>
        <span className="text-muted-foreground hidden sm:inline">|</span>
        <span className="font-medium text-sm truncate max-w-[200px]">{processName}</span>
      </div>

      {/* Center section - Node tools */}
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Node
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={onAddAction}>
              <div className="w-4 h-3 border-2 border-gray-700 rounded-sm mr-2" />
              Action Node
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAddQuestion}>
              <svg width="16" height="12" viewBox="0 0 16 12" className="mr-2">
                <ellipse cx="8" cy="6" rx="7" ry="5" fill="none" stroke="#4b5563" strokeWidth="1.5" />
                <text x="8" y="9" textAnchor="middle" fontSize="7" fill="#4b5563" fontWeight="600">?</text>
              </svg>
              Question Node
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-6 w-px bg-border mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant={captureMode ? "default" : "outline"} size="sm" onClick={onCapture} className="gap-1.5">
              <Play className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Capture</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle capture mode</TooltipContent>
        </Tooltip>

        <div className="h-6 w-px bg-border mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onAutoFormat} className="h-8 w-8">
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Auto-format layout</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onAutoSwimlane} className="h-8 w-8">
              <Layers className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Auto-swimlane by role</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showSwimlanes ? "default" : "ghost"}
              size="icon"
              onClick={onToggleSwimlanes}
              className="h-8 w-8"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="22" height="6" rx="1" />
                <rect x="1" y="15" width="22" height="6" rx="1" />
              </svg>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{showSwimlanes ? "Hide swimlanes" : "Show swimlanes"}</TooltipContent>
        </Tooltip>

        <div className="h-6 w-px bg-border mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} className="h-8 w-8">
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} className="h-8 w-8">
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
        </Tooltip>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onZoomOut} className="h-8 w-8">
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom out</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onZoomIn} className="h-8 w-8">
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom in</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onFitView} className="h-8 w-8">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fit view</TooltipContent>
        </Tooltip>

        <div className="h-6 w-px bg-border mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onSave} className="h-8 w-8">
              <Save className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Save checkpoint</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onShare} className="h-8 w-8">
              <Share2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Share</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={onExport} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Export</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export process</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

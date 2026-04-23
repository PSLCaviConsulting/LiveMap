import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import { useMemo } from "react";
import {
  ReactFlow, Background, Controls, MiniMap, ReactFlowProvider
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card, CardContent } from "@/components/ui/card";
import { Share2, Eye } from "lucide-react";
import ActionNode from "@/components/editor/ActionNode";
import QuestionNode from "@/components/editor/QuestionNode";
import StartEndNode from "@/components/editor/StartEndNode";
import EditableEdge from "@/components/editor/EditableEdge";
import { dbNodesToFlow, dbEdgesToFlow } from "@/lib/editorUtils";

const nodeTypes = {
  action: ActionNode,
  question: QuestionNode,
  start: StartEndNode,
  end: StartEndNode,
};

const edgeTypes = {
  editableEdge: EditableEdge,
};

function SharedProcessViewer({ token }: { token: string }) {
  const { data: process, isLoading } = trpc.share.getSharedProcess.useQuery({ token });

  // Read-only view: flag nodes and edges so the editor components render as
  // plain text with no input affordances or hover buttons.
  const flowNodes = useMemo(() => {
    if (!process?.nodes) return [];
    return dbNodesToFlow(process.nodes).map(n => ({
      ...n,
      data: { ...n.data, readOnly: true },
    }));
  }, [process?.nodes]);

  const flowEdges = useMemo(() => {
    if (!process?.edges) return [];
    return dbEdgesToFlow(process.edges).map(e => ({
      ...e,
      type: "editableEdge",
      data: { ...(e.data || {}), readOnly: true },
    }));
  }, [process?.edges]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!process) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-8 text-center">
            <Share2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Link not found</h2>
            <p className="text-sm text-muted-foreground">This shared link may have expired or been deactivated.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="h-14 border-b flex items-center justify-between px-4 bg-background">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-primary">LiveMap</span>
          <span className="text-muted-foreground">|</span>
          <span className="font-medium">{process.name}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" />
          Read-only view
        </div>
      </div>
      <div className="flex-1">
        <ReactFlowProvider>
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            edgesReconnectable={false}
            panOnDrag
            zoomOnScroll
          >
            <Background />
            <Controls showInteractive={false} />
            <MiniMap />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}

export default function SharedProcess() {
  const params = useParams<{ token: string }>();

  if (params.token) {
    return <SharedProcessViewer token={params.token} />;
  }

  // Shared list view (inside dashboard)
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Shared Processes</h1>
        <p className="text-muted-foreground mt-1">Processes shared with you or publicly</p>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Share2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No shared processes</h3>
          <p className="text-muted-foreground text-sm">Shared processes will appear here</p>
        </CardContent>
      </Card>
    </div>
  );
}

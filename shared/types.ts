/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

export type NodeType = "action" | "question" | "start" | "end" | "ghostAction" | "ghostQuestion" | "note";

export interface ProcessNode {
  id: number;
  processId: number;
  type: NodeType;
  label: string | null;
  what: string | null;
  where: string | null;
  system: string | null;
  role: string | null;
  question: string | null;
  color: string | null;
  positionX: number;
  positionY: number;
  width: number | null;
  height: number | null;
  groupId: number | null;
  hidden: boolean | null;
  data: any;
}

export interface ProcessEdge {
  id: number;
  processId: number;
  sourceId: number;
  targetId: number;
  sourceHandle: string | null;
  targetHandle: string | null;
  label: string | null;
  edgeType: string | null;
  animated: boolean | null;
}

export interface ProcessGroup {
  id: number;
  processId: number;
  name: string;
  color: string | null;
  sortOrder: number | null;
  hidden: boolean | null;
  positionX: number | null;
  positionY: number | null;
  width: number | null;
  height: number | null;
}

export interface FullProcess {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  companyName: string | null;
  companyOverview: string | null;
  nodes: ProcessNode[];
  edges: ProcessEdge[];
  groups: ProcessGroup[];
}

export const NODE_COLORS: Record<NodeType, string> = {
  action: "#0d9488",
  question: "#f59e0b",
  start: "#22c55e",
  end: "#ef4444",
  ghostAction: "#94a3b8",
  ghostQuestion: "#94a3b8",
  note: "#8b5cf6",
};

export const SWIMLANE_COLORS = [
  "#0d9488", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

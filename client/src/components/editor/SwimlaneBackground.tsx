import { memo, useMemo } from "react";
import { useViewport, Panel } from "@xyflow/react";
import type { Node } from "@xyflow/react";

const SWIMLANE_COLORS = [
  "#0d9488", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

const LANE_PADDING_Y = 30;
const LANE_PADDING_X = 80;
const LABEL_WIDTH = 130;
const MIN_LANE_WIDTH = 1200;

export interface SwimlaneData {
  name: string;
  color: string;
  y: number;
  height: number;
  minX: number;
  maxX: number;
}

/**
 * Compute swimlane boundaries from current node positions and their role values.
 */
export function computeSwimlanes(nodes: Node[]): SwimlaneData[] {
  const roleMap = new Map<string, Node[]>();

  nodes.forEach(node => {
    const role = (node.data?.role as string)?.trim();
    if (!role) return;
    if (node.type === "start" || node.type === "end" || node.type === "note") return;
    if (!roleMap.has(role)) roleMap.set(role, []);
    roleMap.get(role)!.push(node);
  });

  if (roleMap.size === 0) return [];

  const lanes: SwimlaneData[] = [];
  let colorIdx = 0;

  const sortedRoles = Array.from(roleMap.entries()).sort((a, b) => {
    const avgYA = a[1].reduce((sum: number, n: Node) => sum + n.position.y, 0) / a[1].length;
    const avgYB = b[1].reduce((sum: number, n: Node) => sum + n.position.y, 0) / b[1].length;
    return avgYA - avgYB;
  });

  sortedRoles.forEach(([role, roleNodes]) => {
    const color = SWIMLANE_COLORS[colorIdx % SWIMLANE_COLORS.length];
    colorIdx++;

    let minY = Infinity, maxY = -Infinity;
    let minX = Infinity, maxX = -Infinity;

    roleNodes.forEach((node: Node) => {
      const w = (node.style?.width as number) || 220;
      const h = (node.style?.height as number) || 160;
      minY = Math.min(minY, node.position.y);
      maxY = Math.max(maxY, node.position.y + h);
      minX = Math.min(minX, node.position.x);
      maxX = Math.max(maxX, node.position.x + w);
    });

    lanes.push({
      name: role,
      color,
      y: minY - LANE_PADDING_Y,
      height: (maxY - minY) + LANE_PADDING_Y * 2,
      minX: minX - LANE_PADDING_X - LABEL_WIDTH,
      maxX: Math.max(maxX + LANE_PADDING_X, minX + MIN_LANE_WIDTH),
    });
  });

  return lanes;
}

interface SwimlaneBackgroundProps {
  nodes: Node[];
  visible: boolean;
}

/**
 * Renders swimlane background bands using an absolutely positioned SVG
 * that transforms flow-space coordinates to screen-space using the viewport.
 */
function SwimlaneBackground({ nodes, visible }: SwimlaneBackgroundProps) {
  const { x: vpX, y: vpY, zoom } = useViewport();

  const lanes = useMemo(() => computeSwimlanes(nodes), [nodes]);

  if (!visible || lanes.length === 0) return null;

  // Compute global X bounds so all lanes have the same width
  const globalMinX = Math.min(...lanes.map(l => l.minX));
  const globalMaxX = Math.max(...lanes.map(l => l.maxX));
  const laneWidth = globalMaxX - globalMinX;

  return (
    <div
      className="pointer-events-none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        overflow: "visible",
      }}
    >
      {lanes.map((lane, i) => {
        // Convert flow-space coordinates to screen-space
        const screenX = globalMinX * zoom + vpX;
        const screenY = lane.y * zoom + vpY;
        const screenW = laneWidth * zoom;
        const screenH = lane.height * zoom;

        return (
          <div key={i}>
            {/* Lane background band */}
            <div
              style={{
                position: "absolute",
                left: screenX,
                top: screenY,
                width: screenW,
                height: screenH,
                backgroundColor: lane.color,
                opacity: 0.08,
                borderRadius: 8,
                borderTop: `2px dashed ${lane.color}`,
                borderBottom: `2px dashed ${lane.color}`,
              }}
            />

            {/* Lane label on the left */}
            <div
              style={{
                position: "absolute",
                left: screenX + 8,
                top: screenY + screenH / 2 - 14,
                display: "flex",
                alignItems: "center",
                gap: 6,
                zIndex: 1,
              }}
            >
              <div
                style={{
                  backgroundColor: lane.color,
                  color: "white",
                  fontSize: Math.max(11, Math.min(14, 13 * zoom)),
                  fontWeight: 700,
                  padding: `${4 * zoom}px ${12 * zoom}px`,
                  borderRadius: 6,
                  whiteSpace: "nowrap",
                  letterSpacing: "0.02em",
                  boxShadow: `0 1px 4px ${lane.color}40`,
                }}
              >
                {lane.name.length > 20 ? lane.name.slice(0, 20) + "…" : lane.name}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(SwimlaneBackground);

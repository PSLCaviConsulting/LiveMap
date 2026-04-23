import React, { useMemo } from "react";
import type { Node } from "@xyflow/react";
import {
  findConnectionPreviewTargets,
  getNodeCenter,
  AUTO_CONNECTION_CONFIG,
} from "@/lib/autoConnection";

interface SnapZoneOverlayProps {
  draggedNode: Node | null;
  allNodes: Node[];
  containerWidth: number;
  containerHeight: number;
}

/**
 * Visual overlay showing snap zones and connection previews
 * Renders circles around nodes that are within preview distance
 */
export default function SnapZoneOverlay({
  draggedNode,
  allNodes,
  containerWidth,
  containerHeight,
}: SnapZoneOverlayProps) {
  const previewTargets = useMemo(() => {
    if (!draggedNode) return [];
    return findConnectionPreviewTargets(
      draggedNode,
      allNodes,
      AUTO_CONNECTION_CONFIG.PREVIEW_DISTANCE
    );
  }, [draggedNode, allNodes]);

  if (!draggedNode || previewTargets.length === 0) {
    return null;
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={containerWidth}
      height={containerHeight}
      style={{ zIndex: 1 }}
    >
      {/* Render snap zone circles around preview targets */}
      {previewTargets.map((target) => {
        const center = getNodeCenter(target);
        return (
          <g key={`snap-zone-${target.id}`}>
            {/* Outer circle - preview distance */}
            <circle
              cx={center.x}
              cy={center.y}
              r={AUTO_CONNECTION_CONFIG.PREVIEW_DISTANCE}
              fill="none"
              stroke="rgba(16, 185, 129, 0.2)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            {/* Inner circle - snap distance */}
            <circle
              cx={center.x}
              cy={center.y}
              r={AUTO_CONNECTION_CONFIG.SNAP_DISTANCE}
              fill="none"
              stroke="rgba(16, 185, 129, 0.4)"
              strokeWidth="2"
              strokeDasharray="2 4"
            />
            {/* Center dot */}
            <circle
              cx={center.x}
              cy={center.y}
              r="4"
              fill="rgba(16, 185, 129, 0.6)"
            />
          </g>
        );
      })}

      {/* Connection preview lines from dragged node to snap targets */}
      {previewTargets.map((target) => {
        const draggedCenter = getNodeCenter(draggedNode);
        const targetCenter = getNodeCenter(target);

        // Only show preview for nodes below the dragged node (natural flow)
        if (targetCenter.y <= draggedCenter.y) return null;

        return (
          <line
            key={`preview-line-${target.id}`}
            x1={draggedCenter.x}
            y1={draggedCenter.y}
            x2={targetCenter.x}
            y2={targetCenter.y}
            stroke="rgba(16, 185, 129, 0.3)"
            strokeWidth="2"
            strokeDasharray="5 5"
            pointerEvents="none"
          />
        );
      })}
    </svg>
  );
}

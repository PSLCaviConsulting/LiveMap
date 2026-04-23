import { describe, expect, it } from "vitest";
import { dbNodesToFlow, dbEdgesToFlow, autoLayout, autoFormatBySwimlane, createSnapshot } from "../client/src/lib/editorUtils";
import type { ProcessNode, ProcessEdge } from "@shared/types";

// ── dbNodesToFlow ────────────────────────────────────────────────────

describe("dbNodesToFlow", () => {
  it("converts DB nodes to React Flow nodes", () => {
    const dbNodes: ProcessNode[] = [
      {
        id: 1, processId: 1, type: "start", label: "Start",
        what: null, where: null, system: null, role: null, question: null,
        color: null, positionX: 100, positionY: 50, width: 120, height: 50,
        groupId: null, hidden: null, data: null,
      },
      {
        id: 2, processId: 1, type: "action", label: null,
        what: "Review application", where: "CRM", system: "Salesforce", role: "Sales Rep",
        question: null, color: "#0d9488", positionX: 200, positionY: 200,
        width: 220, height: 100, groupId: null, hidden: null, data: null,
      },
    ];

    const result = dbNodesToFlow(dbNodes);
    expect(result).toHaveLength(2);

    // Start node
    expect(result[0].id).toBe("1");
    expect(result[0].type).toBe("start");
    expect(result[0].position).toEqual({ x: 100, y: 50 });
    expect(result[0].data.label).toBe("Start");

    // Action node
    expect(result[1].id).toBe("2");
    expect(result[1].type).toBe("action");
    expect(result[1].data.what).toBe("Review application");
    expect(result[1].data.system).toBe("Salesforce");
    expect(result[1].data.role).toBe("Sales Rep");
    expect(result[1].data.color).toBe("#0d9488");
  });

  it("filters out ghost nodes", () => {
    const dbNodes: ProcessNode[] = [
      {
        id: 1, processId: 1, type: "start", label: "Start",
        what: null, where: null, system: null, role: null, question: null,
        color: null, positionX: 100, positionY: 50, width: 120, height: 50,
        groupId: null, hidden: null, data: null,
      },
      {
        id: 2, processId: 1, type: "ghostAction", label: null,
        what: null, where: null, system: null, role: null, question: null,
        color: null, positionX: 300, positionY: 300, width: null, height: null,
        groupId: null, hidden: null, data: null,
      },
    ];

    const result = dbNodesToFlow(dbNodes);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("start");
  });

  it("handles empty array", () => {
    const result = dbNodesToFlow([]);
    expect(result).toEqual([]);
  });

  it("sets default dimensions based on node type", () => {
    const dbNodes: ProcessNode[] = [
      {
        id: 1, processId: 1, type: "action", label: null,
        what: "Test", where: null, system: null, role: null, question: null,
        color: null, positionX: 0, positionY: 0, width: null, height: null,
        groupId: null, hidden: null, data: null,
      },
    ];

    const result = dbNodesToFlow(dbNodes);
    expect(result[0].style?.width).toBe(220);
    expect(result[0].style?.height).toBe(100);
  });
});

// ── dbEdgesToFlow ────────────────────────────────────────────────────

describe("dbEdgesToFlow", () => {
  it("converts DB edges to React Flow edges", () => {
    const dbEdges: ProcessEdge[] = [
      {
        id: 1, processId: 1, sourceId: 1, targetId: 2,
        sourceHandle: null, targetHandle: null, label: "Yes",
        edgeType: "smoothstep", animated: false,
      },
    ];

    const result = dbEdgesToFlow(dbEdges);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
    expect(result[0].source).toBe("1");
    expect(result[0].target).toBe("2");
    expect(result[0].label).toBe("Yes");
    expect(result[0].type).toBe("smoothstep");
  });

  it("defaults to smoothstep edge type", () => {
    const dbEdges: ProcessEdge[] = [
      {
        id: 1, processId: 1, sourceId: 1, targetId: 2,
        sourceHandle: null, targetHandle: null, label: null,
        edgeType: null, animated: null,
      },
    ];

    const result = dbEdgesToFlow(dbEdges);
    expect(result[0].type).toBe("smoothstep");
  });

  it("handles empty array", () => {
    const result = dbEdgesToFlow([]);
    expect(result).toEqual([]);
  });
});

// ── autoLayout ───────────────────────────────────────────────────────

describe("autoLayout", () => {
  it("repositions nodes using dagre layout", () => {
    const nodes = [
      { id: "1", type: "start", position: { x: 0, y: 0 }, data: {}, style: { width: 120, height: 50 } },
      { id: "2", type: "action", position: { x: 0, y: 0 }, data: {}, style: { width: 220, height: 100 } },
      { id: "3", type: "end", position: { x: 0, y: 0 }, data: {}, style: { width: 120, height: 50 } },
    ];
    const edges = [
      { id: "e1", source: "1", target: "2" },
      { id: "e2", source: "2", target: "3" },
    ];

    const result = autoLayout(nodes as any, edges as any);
    expect(result).toHaveLength(3);

    // Nodes should be repositioned (not all at 0,0)
    const positions = result.map(n => n.position);
    const allAtOrigin = positions.every(p => p.x === 0 && p.y === 0);
    expect(allAtOrigin).toBe(false);

    // Nodes should be in top-to-bottom order (default TB direction)
    expect(result[0].position.y).toBeLessThan(result[1].position.y);
    expect(result[1].position.y).toBeLessThan(result[2].position.y);
  });

  it("supports LR direction", () => {
    const nodes = [
      { id: "1", type: "start", position: { x: 0, y: 0 }, data: {}, style: { width: 120, height: 50 } },
      { id: "2", type: "action", position: { x: 0, y: 0 }, data: {}, style: { width: 220, height: 100 } },
    ];
    const edges = [
      { id: "e1", source: "1", target: "2" },
    ];

    const result = autoLayout(nodes as any, edges as any, "LR");
    expect(result).toHaveLength(2);
    // In LR mode, first node should be to the left
    expect(result[0].position.x).toBeLessThan(result[1].position.x);
  });

  it("handles single node", () => {
    const nodes = [
      { id: "1", type: "start", position: { x: 50, y: 50 }, data: {}, style: { width: 120, height: 50 } },
    ];
    const result = autoLayout(nodes as any, []);
    expect(result).toHaveLength(1);
  });
});

// ── autoFormatBySwimlane ─────────────────────────────────────────────

describe("autoFormatBySwimlane", () => {
  it("groups nodes by role into swimlanes", () => {
    const nodes = [
      { id: "1", type: "action", position: { x: 0, y: 0 }, data: { role: "Sales" }, style: { width: 220, height: 100 } },
      { id: "2", type: "action", position: { x: 0, y: 0 }, data: { role: "Sales" }, style: { width: 220, height: 100 } },
      { id: "3", type: "action", position: { x: 0, y: 0 }, data: { role: "Engineering" }, style: { width: 220, height: 100 } },
    ];

    const result = autoFormatBySwimlane(nodes as any, []);
    expect(result.groups).toHaveLength(2);
    expect(result.groups.map(g => g.name)).toContain("Sales");
    expect(result.groups.map(g => g.name)).toContain("Engineering");
    expect(result.nodes).toHaveLength(3);
  });

  it("places ungrouped nodes separately", () => {
    const nodes = [
      { id: "1", type: "action", position: { x: 0, y: 0 }, data: { role: "Sales" }, style: { width: 220, height: 100 } },
      { id: "2", type: "start", position: { x: 0, y: 0 }, data: { role: "" }, style: { width: 120, height: 50 } },
    ];

    const result = autoFormatBySwimlane(nodes as any, []);
    expect(result.groups).toHaveLength(1);
    expect(result.nodes).toHaveLength(2);
  });

  it("groups by system field when specified", () => {
    const nodes = [
      { id: "1", type: "action", position: { x: 0, y: 0 }, data: { system: "CRM", role: "Sales" }, style: { width: 220, height: 100 } },
      { id: "2", type: "action", position: { x: 0, y: 0 }, data: { system: "ERP", role: "Sales" }, style: { width: 220, height: 100 } },
    ];

    const result = autoFormatBySwimlane(nodes as any, [], "system");
    expect(result.groups).toHaveLength(2);
    expect(result.groups.map(g => g.name)).toContain("CRM");
    expect(result.groups.map(g => g.name)).toContain("ERP");
  });

  it("assigns different colors to each swimlane", () => {
    const nodes = [
      { id: "1", type: "action", position: { x: 0, y: 0 }, data: { role: "A" }, style: { width: 220, height: 100 } },
      { id: "2", type: "action", position: { x: 0, y: 0 }, data: { role: "B" }, style: { width: 220, height: 100 } },
      { id: "3", type: "action", position: { x: 0, y: 0 }, data: { role: "C" }, style: { width: 220, height: 100 } },
    ];

    const result = autoFormatBySwimlane(nodes as any, []);
    const colors = result.groups.map(g => g.color);
    expect(new Set(colors).size).toBe(3); // All different colors
  });
});

// ── createSnapshot ───────────────────────────────────────────────────

describe("createSnapshot", () => {
  it("creates a deep copy of nodes and edges", () => {
    const nodes = [
      {
        id: "1", type: "start",
        position: { x: 100, y: 50 },
        data: { label: "Start", nodeType: "start" },
        style: { width: 120, height: 50 },
      },
    ];
    const edges = [
      {
        id: "e1", source: "1", target: "2",
        sourceHandle: null, targetHandle: null,
        label: "Next", type: "smoothstep", animated: false,
        data: { dbId: 1 },
      },
    ];

    const snapshot = createSnapshot(nodes as any, edges as any);
    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.edges).toHaveLength(1);
    expect(snapshot.timestamp).toBeGreaterThan(0);

    // Verify deep copy (modifying original doesn't affect snapshot)
    nodes[0].position.x = 999;
    expect(snapshot.nodes[0].position.x).toBe(100);
  });

  it("handles empty arrays", () => {
    const snapshot = createSnapshot([], []);
    expect(snapshot.nodes).toEqual([]);
    expect(snapshot.edges).toEqual([]);
    expect(snapshot.timestamp).toBeGreaterThan(0);
  });
});

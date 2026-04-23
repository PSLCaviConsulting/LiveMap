import { describe, expect, it } from "vitest";
import {
  remapNodeInCommand,
  remapEdgeInCommand,
  snapshotNode,
  snapshotEdge,
  type Command,
  type NodeSnap,
  type EdgeSnap,
} from "../client/src/lib/editorHistory";

// Helpers to build snaps quickly in tests.
function mkNode(flowId: string, dbId: number, extra: Partial<NodeSnap> = {}): NodeSnap {
  return {
    id: flowId,
    type: "action",
    position: { x: 0, y: 0 },
    data: { dbId, ...(extra.data ?? {}) },
    style: { width: 200, height: 160 },
    ...extra,
  };
}

function mkEdge(flowId: string, source: string, target: string, dbId: number, extra: Partial<EdgeSnap> = {}): EdgeSnap {
  return {
    id: flowId,
    source,
    target,
    sourceHandle: null,
    targetHandle: null,
    label: null,
    type: "smoothstep",
    data: { dbId, ...(extra.data ?? {}) },
    ...extra,
  };
}

// ── snapshotNode / snapshotEdge strip display callbacks ──────────────

describe("snapshotNode", () => {
  it("copies position / data / style but drops callback fields", () => {
    const n: any = {
      id: "42",
      type: "action",
      position: { x: 100, y: 50 },
      data: {
        dbId: 42,
        what: "Review",
        onFieldChange: () => {},
        onConvertType: () => {},
        suggestions: { systems: [] },
      },
      style: { width: 200, height: 160 },
    };
    const s = snapshotNode(n);
    expect(s.id).toBe("42");
    expect(s.data.dbId).toBe(42);
    expect(s.data.what).toBe("Review");
    expect((s.data as any).onFieldChange).toBeUndefined();
    expect((s.data as any).onConvertType).toBeUndefined();
    expect((s.data as any).suggestions).toBeUndefined();
  });
});

describe("snapshotEdge", () => {
  it("drops onLabelChange from data", () => {
    const e: any = {
      id: "e1",
      source: "1",
      target: "2",
      sourceHandle: null,
      targetHandle: null,
      label: "Yes",
      type: "editableEdge",
      data: { dbId: 7, onLabelChange: () => {}, sourceNodeType: "question" },
    };
    const s = snapshotEdge(e);
    expect(s.data.dbId).toBe(7);
    expect((s.data as any).onLabelChange).toBeUndefined();
    expect(s.data.sourceNodeType).toBe("question");
  });
});

// ── Id remap: the core invariant that undoing a delete produces a new ─
// dbId and every command still referencing the old id is rewritten. ───

describe("remapNodeInCommand", () => {
  it("remaps a createNode command", () => {
    const cmd: Command = { kind: "createNode", node: mkNode("42", 42) };
    const out = remapNodeInCommand(cmd, { oldFlowId: "42", newFlowId: "77", oldDbId: 42, newDbId: 77 });
    expect(out.kind).toBe("createNode");
    if (out.kind === "createNode") {
      expect(out.node.id).toBe("77");
      expect(out.node.data.dbId).toBe(77);
    }
  });

  it("remaps edges inside a deleteNode command", () => {
    const cmd: Command = {
      kind: "deleteNode",
      node: mkNode("42", 42),
      edges: [
        mkEdge("e1", "42", "99", 7),  // points from 42 to another node
        mkEdge("e2", "99", "42", 8),  // points at 42
      ],
    };
    const out = remapNodeInCommand(cmd, { oldFlowId: "42", newFlowId: "77", oldDbId: 42, newDbId: 77 });
    if (out.kind !== "deleteNode") throw new Error("wrong kind");
    expect(out.node.id).toBe("77");
    expect(out.node.data.dbId).toBe(77);
    expect(out.edges[0].source).toBe("77");
    expect(out.edges[0].target).toBe("99");
    expect(out.edges[1].source).toBe("99");
    expect(out.edges[1].target).toBe("77");
  });

  it("remaps source/target in a createEdge command when they reference the old node", () => {
    const cmd: Command = { kind: "createEdge", edge: mkEdge("e1", "42", "99", 7) };
    const out = remapNodeInCommand(cmd, { oldFlowId: "42", newFlowId: "77", oldDbId: 42, newDbId: 77 });
    if (out.kind !== "createEdge") throw new Error("wrong kind");
    expect(out.edge.source).toBe("77");
    expect(out.edge.target).toBe("99");
    expect(out.edge.id).toBe("e1");  // edge id untouched
    expect(out.edge.data.dbId).toBe(7);  // edge dbId untouched
  });

  it("descends into composites", () => {
    const cmd: Command = {
      kind: "composite",
      children: [
        { kind: "createNode", node: mkNode("42", 42) },
        { kind: "createEdge", edge: mkEdge("e1", "42", "99", 7) },
      ],
    };
    const out = remapNodeInCommand(cmd, { oldFlowId: "42", newFlowId: "77", oldDbId: 42, newDbId: 77 });
    if (out.kind !== "composite") throw new Error("wrong kind");
    const first = out.children[0];
    const second = out.children[1];
    if (first.kind !== "createNode") throw new Error();
    if (second.kind !== "createEdge") throw new Error();
    expect(first.node.id).toBe("77");
    expect(second.edge.source).toBe("77");
  });

  it("leaves unrelated ids alone", () => {
    const cmd: Command = { kind: "createNode", node: mkNode("10", 10) };
    const out = remapNodeInCommand(cmd, { oldFlowId: "42", newFlowId: "77", oldDbId: 42, newDbId: 77 });
    if (out.kind !== "createNode") throw new Error();
    expect(out.node.id).toBe("10");
    expect(out.node.data.dbId).toBe(10);
  });

  it("remaps dbId in updateNodes before/after snaps", () => {
    const cmd: Command = {
      kind: "updateNodes",
      before: [mkNode("42", 42, { position: { x: 0, y: 0 } })],
      after: [mkNode("42", 42, { position: { x: 100, y: 100 } })],
    };
    const out = remapNodeInCommand(cmd, { oldFlowId: "42", newFlowId: "77", oldDbId: 42, newDbId: 77 });
    if (out.kind !== "updateNodes") throw new Error();
    expect(out.before[0].id).toBe("77");
    expect(out.before[0].data.dbId).toBe(77);
    expect(out.after[0].id).toBe("77");
    expect(out.after[0].data.dbId).toBe(77);
  });
});

describe("remapEdgeInCommand", () => {
  it("remaps the edge id + dbId in a deleteEdge command", () => {
    const cmd: Command = { kind: "deleteEdge", edge: mkEdge("e1", "1", "2", 7) };
    const out = remapEdgeInCommand(cmd, { oldFlowId: "e1", newFlowId: "99", oldDbId: 7, newDbId: 99 });
    if (out.kind !== "deleteEdge") throw new Error();
    expect(out.edge.id).toBe("99");
    expect(out.edge.data.dbId).toBe(99);
    expect(out.edge.source).toBe("1");  // endpoints untouched
  });

  it("remaps a cascade edge inside a deleteNode command", () => {
    const cmd: Command = {
      kind: "deleteNode",
      node: mkNode("10", 10),
      edges: [mkEdge("e1", "10", "20", 7), mkEdge("e2", "20", "10", 8)],
    };
    const out = remapEdgeInCommand(cmd, { oldFlowId: "e1", newFlowId: "99", oldDbId: 7, newDbId: 99 });
    if (out.kind !== "deleteNode") throw new Error();
    expect(out.edges[0].id).toBe("99");
    expect(out.edges[0].data.dbId).toBe(99);
    expect(out.edges[1].id).toBe("e2");
    expect(out.edges[1].data.dbId).toBe(8);
  });

  it("is a no-op on createNode commands", () => {
    const cmd: Command = { kind: "createNode", node: mkNode("10", 10) };
    const out = remapEdgeInCommand(cmd, { oldFlowId: "e1", newFlowId: "99", oldDbId: 7, newDbId: 99 });
    expect(out).toBe(cmd);
  });
});

// ── End-to-end remap chain: simulate an undo-of-delete that reassigns ─
// dbId, then verify a subsequent command referencing the deleted node ──
// gets rewritten across the whole stack. This is the property the old ──
// snapshot history couldn't honor — the whole reason for the rewrite. ──

describe("id remap across a stack", () => {
  it("rewrites every command that references the re-created node", () => {
    // Stack state before undo: user had deleted node 42 (with cascade edge
    // e1), then later updated node 42's position (updateNodes).
    const past: Command[] = [
      {
        kind: "deleteNode",
        node: mkNode("42", 42),
        edges: [mkEdge("e1", "42", "99", 7)],
      },
      // This entry references the old id 42 — if we re-create 42 as 77,
      // this command must be rewritten or the next undo sends the wrong
      // id to the server.
      {
        kind: "updateNodes",
        before: [mkNode("42", 42, { position: { x: 0, y: 0 } })],
        after: [mkNode("42", 42, { position: { x: 100, y: 0 } })],
      },
    ];
    const remap = { oldFlowId: "42", newFlowId: "77", oldDbId: 42, newDbId: 77 };
    const rewritten = past.map(c => remapNodeInCommand(c, remap));
    const first = rewritten[0];
    const second = rewritten[1];
    if (first.kind !== "deleteNode") throw new Error();
    if (second.kind !== "updateNodes") throw new Error();
    // Cascade edge endpoint was rewritten.
    expect(first.edges[0].source).toBe("77");
    // Update command now points at the new id.
    expect(second.before[0].id).toBe("77");
    expect(second.before[0].data.dbId).toBe(77);
    expect(second.after[0].id).toBe("77");
    expect(second.after[0].data.dbId).toBe(77);
  });

  it("composes node-remap + edge-remap so undoing a delete rewrites both sides", () => {
    // Simulate a deleteNode command where the node was 42 with cascade
    // edge e1 (dbId=7). After undo: node becomes 77, edge becomes 99.
    const cmd: Command = {
      kind: "deleteNode",
      node: mkNode("42", 42),
      edges: [mkEdge("e1", "42", "20", 7)],
    };
    // First rewrite happens when the node is recreated with id 77.
    const afterNodeRemap = remapNodeInCommand(cmd, {
      oldFlowId: "42", newFlowId: "77", oldDbId: 42, newDbId: 77,
    });
    // Then the cascade edge is recreated with dbId 99.
    const final = remapEdgeInCommand(afterNodeRemap, {
      oldFlowId: "e1", newFlowId: "99", oldDbId: 7, newDbId: 99,
    });
    if (final.kind !== "deleteNode") throw new Error();
    expect(final.node.id).toBe("77");
    expect(final.edges[0].id).toBe("99");
    expect(final.edges[0].source).toBe("77");
    expect(final.edges[0].target).toBe("20");
    expect(final.edges[0].data.dbId).toBe(99);
  });
});

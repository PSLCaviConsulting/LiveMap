import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Helpers ──────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>) {
  const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies, user };
}

function createPublicContext() {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
  return { ctx };
}

// ── Auth Router Tests ────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns the authenticated user", async () => {
    const { ctx, user } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result!.openId).toBe("test-user-001");
    expect(result!.email).toBe("test@example.com");
  });

  it("returns null for unauthenticated users", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

// ── Project Router Tests ─────────────────────────────────────────────

describe("project router", () => {
  it("project.create requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.project.create({ name: "Test Project" })
    ).rejects.toThrow();
  });

  it("project.create validates name is non-empty", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.project.create({ name: "" })
    ).rejects.toThrow();
  });

  it("project.create validates name max length", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.project.create({ name: "a".repeat(256) })
    ).rejects.toThrow();
  });

  it("project.list requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.project.list()).rejects.toThrow();
  });

  it("project.delete requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.project.delete({ id: 1 })
    ).rejects.toThrow();
  });

  it("project.update validates input schema", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Empty name should fail
    await expect(
      caller.project.update({ id: 1, name: "" })
    ).rejects.toThrow();
  });
});

// ── Process Router Tests ─────────────────────────────────────────────

describe("process router", () => {
  it("process.create requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.process.create({ projectId: 1, name: "Test Process" })
    ).rejects.toThrow();
  });

  it("process.create validates name is non-empty", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.process.create({ projectId: 1, name: "" })
    ).rejects.toThrow();
  });

  it("process.delete requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.process.delete({ id: 1 })
    ).rejects.toThrow();
  });
});

// ── Canvas Object Router Tests ───────────────────────────────────────

describe("canvasObject router", () => {
  it("canvasObject.create requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.canvasObject.create({
        processId: 1,
        type: "action",
        positionX: 100,
        positionY: 200,
      })
    ).rejects.toThrow();
  });

  it("canvasObject.create validates node type enum", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.canvasObject.create({
        processId: 1,
        type: "invalid" as any,
        positionX: 100,
        positionY: 200,
      })
    ).rejects.toThrow();
  });

  it("canvasObject.create accepts all valid node types", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const validTypes = ["action", "question", "start", "end", "ghostAction", "ghostQuestion", "note"] as const;
    for (const type of validTypes) {
      // Should not throw on validation (will throw on DB, which is expected)
      try {
        await caller.canvasObject.create({
          processId: 1,
          type,
          positionX: 100,
          positionY: 200,
        });
      } catch (e: any) {
        // DB errors are expected, but validation errors are not
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    }
  });

  it("canvasObject.update validates node type enum when provided", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.canvasObject.update({
        id: 1,
        type: "invalid" as any,
      })
    ).rejects.toThrow();
  });
});

// ── Edge Router Tests ────────────────────────────────────────────────

describe("edge router", () => {
  it("edge.create requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.edge.create({
        processId: 1,
        sourceId: 1,
        targetId: 2,
      })
    ).rejects.toThrow();
  });

  it("edge.delete requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.edge.delete({ id: 1 })
    ).rejects.toThrow();
  });
});

// ── Group Router Tests ───────────────────────────────────────────────

describe("group router", () => {
  it("group.create requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.group.create({ processId: 1, name: "Sales" })
    ).rejects.toThrow();
  });

  it("group.create validates name is non-empty", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.group.create({ processId: 1, name: "" })
    ).rejects.toThrow();
  });

  it("group.delete requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.group.delete({ id: 1 })
    ).rejects.toThrow();
  });
});

// ── SavePoint Router Tests ───────────────────────────────────────────

describe("savePoint router", () => {
  it("savePoint.create requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.savePoint.create({
        processId: 1,
        name: "Save 1",
        snapshot: { nodes: [], edges: [] },
      })
    ).rejects.toThrow();
  });

  it("savePoint.create validates name is non-empty", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.savePoint.create({
        processId: 1,
        name: "",
        snapshot: { nodes: [], edges: [] },
      })
    ).rejects.toThrow();
  });
});

// ── Share Router Tests ───────────────────────────────────────────────

describe("share router", () => {
  it("share.createLink requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.share.createLink({ processId: 1 })
    ).rejects.toThrow();
  });

  it("share.getSharedProcess is public and handles missing tokens", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    // Should not throw - it's a public procedure
    const result = await caller.share.getSharedProcess({ token: "nonexistent" });
    expect(result).toBeNull();
  });

  it("share.deactivateLink requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.share.deactivateLink({ processId: 1 })
    ).rejects.toThrow();
  });
});

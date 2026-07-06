import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import * as db from "./db";

const nodeTypeEnum = z.enum(["action", "question", "start", "end", "ghostAction", "ghostQuestion", "note"]);

// ── Ownership gates ────────────────────────────────────────────────────
// Resolve a resource's owning user id and compare against the caller.
// FORBIDDEN is used for owned-by-someone-else; NOT_FOUND for missing
// resources so that non-existent ids aren't distinguishable from
// inaccessible ones beyond the code.

async function assertOwnsProject(userId: number, projectId: number) {
  const ownerId = await db.getProjectOwnerId(projectId);
  if (ownerId == null) throw new TRPCError({ code: "NOT_FOUND" });
  if (ownerId !== userId) throw new TRPCError({ code: "FORBIDDEN" });
}

async function assertOwnsProcess(userId: number, processId: number) {
  const ownerId = await db.getProcessOwnerId(processId);
  if (ownerId == null) throw new TRPCError({ code: "NOT_FOUND" });
  if (ownerId !== userId) throw new TRPCError({ code: "FORBIDDEN" });
}

async function assertOwnsCanvasObject(userId: number, id: number) {
  const processId = await db.getCanvasObjectProcessId(id);
  if (processId == null) throw new TRPCError({ code: "NOT_FOUND" });
  await assertOwnsProcess(userId, processId);
}

async function assertOwnsEdge(userId: number, id: number) {
  const processId = await db.getEdgeProcessId(id);
  if (processId == null) throw new TRPCError({ code: "NOT_FOUND" });
  await assertOwnsProcess(userId, processId);
}

async function assertOwnsGroup(userId: number, id: number) {
  const processId = await db.getGroupProcessId(id);
  if (processId == null) throw new TRPCError({ code: "NOT_FOUND" });
  await assertOwnsProcess(userId, processId);
}

async function assertOwnsSavePoint(userId: number, id: number) {
  const processId = await db.getSavePointProcessId(id);
  if (processId == null) throw new TRPCError({ code: "NOT_FOUND" });
  await assertOwnsProcess(userId, processId);
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── Projects ─────────────────────────────────────────────────────
  project: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.listProjects(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertOwnsProject(ctx.user.id, input.id);
        return db.getProject(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createProject({ ...input, userId: ctx.user.id });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsProject(ctx.user.id, input.id);
        const { id, ...data } = input;
        await db.updateProject(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsProject(ctx.user.id, input.id);
        await db.deleteProject(input.id);
        return { success: true };
      }),

    updateLastOpened: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsProject(ctx.user.id, input.id);
        await db.updateProject(input.id, { lastOpenedAt: new Date() });
        return { success: true };
      }),
  }),

  // ── Processes ────────────────────────────────────────────────────
  process: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertOwnsProject(ctx.user.id, input.projectId);
        return db.listProcesses(input.projectId);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertOwnsProcess(ctx.user.id, input.id);
        const process = await db.getProcess(input.id);
        if (!process) return null;
        const nodes = await db.listCanvasObjects(input.id);
        const edgeList = await db.listEdges(input.id);
        const groupList = await db.listGroups(input.id);
        return { ...process, nodes, edges: edgeList, groups: groupList };
      }),

    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsProject(ctx.user.id, input.projectId);
        const result = await db.createProcess(input);
        return result;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        companyName: z.string().optional(),
        companyOverview: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsProcess(ctx.user.id, input.id);
        const { id, ...data } = input;
        await db.updateProcess(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsProcess(ctx.user.id, input.id);
        await db.deleteProcess(input.id);
        return { success: true };
      }),
  }),

  // ── Field Suggestions (autocomplete) ─────────────────────────────
  suggestions: router({
    getFieldValues: protectedProcedure
      .query(async ({ ctx }) => {
        return db.getFieldSuggestions(ctx.user.id);
      }),
  }),

  // ── Canvas Objects ───────────────────────────────────────────────
  canvasObject: router({
    list: protectedProcedure
      .input(z.object({ processId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertOwnsProcess(ctx.user.id, input.processId);
        return db.listCanvasObjects(input.processId);
      }),

    create: protectedProcedure
      .input(z.object({
        processId: z.number(),
        type: nodeTypeEnum,
        label: z.string().optional(),
        what: z.string().optional(),
        where: z.string().optional(),
        system: z.string().optional(),
        role: z.string().optional(),
        question: z.string().optional(),
        note: z.string().optional(),
        color: z.string().optional(),
        positionX: z.number(),
        positionY: z.number(),
        width: z.number().optional(),
        height: z.number().optional(),
        groupId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsProcess(ctx.user.id, input.processId);
        return db.createCanvasObject(input);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        type: nodeTypeEnum.optional(),
        label: z.string().optional(),
        what: z.string().optional(),
        where: z.string().optional(),
        system: z.string().optional(),
        role: z.string().optional(),
        question: z.string().optional(),
        note: z.string().optional(),
        color: z.string().optional(),
        positionX: z.number().optional(),
        positionY: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        groupId: z.number().nullable().optional(),
        hidden: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsCanvasObject(ctx.user.id, input.id);
        const { id, ...data } = input;
        await db.updateCanvasObject(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsCanvasObject(ctx.user.id, input.id);
        await db.deleteCanvasObject(input.id);
        return { success: true };
      }),

    // Batch update of positions/sizes — used by drag-stop and auto-layout
    // so N-node layouts become one round-trip instead of N.
    bulkUpdate: protectedProcedure
      .input(z.object({
        updates: z.array(z.object({
          id: z.number(),
          positionX: z.number().optional(),
          positionY: z.number().optional(),
          width: z.number().optional(),
          height: z.number().optional(),
        })).min(1).max(500),
      }))
      .mutation(async ({ ctx, input }) => {
        const ids = input.updates.map(u => u.id);
        const owned = await db.countOwnedCanvasObjects(ctx.user.id, ids);
        if (owned !== ids.length) throw new TRPCError({ code: "FORBIDDEN" });
        await db.bulkUpdateCanvasObjects(input.updates);
        return { success: true };
      }),
  }),

  // ── Edges ────────────────────────────────────────────────────────
  edge: router({
    list: protectedProcedure
      .input(z.object({ processId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertOwnsProcess(ctx.user.id, input.processId);
        return db.listEdges(input.processId);
      }),

    create: protectedProcedure
      .input(z.object({
        processId: z.number(),
        sourceId: z.number(),
        targetId: z.number(),
        sourceHandle: z.string().optional(),
        targetHandle: z.string().optional(),
        label: z.string().optional(),
        edgeType: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Gate on the process plus both endpoints, so you can't splice an
        // edge from your own process into someone else's node.
        await assertOwnsProcess(ctx.user.id, input.processId);
        await assertOwnsCanvasObject(ctx.user.id, input.sourceId);
        await assertOwnsCanvasObject(ctx.user.id, input.targetId);
        return db.createEdge(input);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        sourceId: z.number().optional(),
        targetId: z.number().optional(),
        sourceHandle: z.string().nullable().optional(),
        targetHandle: z.string().nullable().optional(),
        label: z.string().optional(),
        edgeType: z.string().optional(),
        animated: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsEdge(ctx.user.id, input.id);
        if (input.sourceId != null) await assertOwnsCanvasObject(ctx.user.id, input.sourceId);
        if (input.targetId != null) await assertOwnsCanvasObject(ctx.user.id, input.targetId);
        const { id, ...data } = input;
        await db.updateEdge(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsEdge(ctx.user.id, input.id);
        await db.deleteEdge(input.id);
        return { success: true };
      }),

    // Batch handle-reroute after a node drag — one round-trip instead of
    // one-per-affected-edge.
    bulkUpdate: protectedProcedure
      .input(z.object({
        updates: z.array(z.object({
          id: z.number(),
          sourceHandle: z.string().nullable().optional(),
          targetHandle: z.string().nullable().optional(),
        })).min(1).max(500),
      }))
      .mutation(async ({ ctx, input }) => {
        const ids = input.updates.map(u => u.id);
        const owned = await db.countOwnedEdges(ctx.user.id, ids);
        if (owned !== ids.length) throw new TRPCError({ code: "FORBIDDEN" });
        await db.bulkUpdateEdges(input.updates);
        return { success: true };
      }),
  }),

  // ── Groups (Swimlanes) ──────────────────────────────────────────
  group: router({
    list: protectedProcedure
      .input(z.object({ processId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertOwnsProcess(ctx.user.id, input.processId);
        return db.listGroups(input.processId);
      }),

    create: protectedProcedure
      .input(z.object({
        processId: z.number(),
        name: z.string().min(1).max(255),
        color: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsProcess(ctx.user.id, input.processId);
        return db.createGroup(input);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        color: z.string().optional(),
        sortOrder: z.number().optional(),
        hidden: z.boolean().optional(),
        positionX: z.number().optional(),
        positionY: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsGroup(ctx.user.id, input.id);
        const { id, ...data } = input;
        await db.updateGroup(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsGroup(ctx.user.id, input.id);
        await db.deleteGroup(input.id);
        return { success: true };
      }),
  }),

  // ── Save Points ─────────────────────────────────────────────────
  savePoint: router({
    list: protectedProcedure
      .input(z.object({ processId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertOwnsProcess(ctx.user.id, input.processId);
        return db.listSavePoints(input.processId);
      }),

    create: protectedProcedure
      .input(z.object({
        processId: z.number(),
        name: z.string().min(1).max(255),
        snapshot: z.any(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsProcess(ctx.user.id, input.processId);
        return db.createSavePoint({ ...input, userId: ctx.user.id });
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertOwnsSavePoint(ctx.user.id, input.id);
        return db.getSavePoint(input.id);
      }),
  }),

  // ── Share ────────────────────────────────────────────────────────
  share: router({
    getLink: protectedProcedure
      .input(z.object({ processId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertOwnsProcess(ctx.user.id, input.processId);
        return db.getShareLink(input.processId);
      }),

    createLink: protectedProcedure
      .input(z.object({ processId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsProcess(ctx.user.id, input.processId);
        // Deactivate existing links
        await db.deactivateShareLink(input.processId);
        const token = nanoid(32);
        return db.createShareLink({ processId: input.processId, token });
      }),

    deactivateLink: protectedProcedure
      .input(z.object({ processId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsProcess(ctx.user.id, input.processId);
        await db.deactivateShareLink(input.processId);
        return { success: true };
      }),

    // Public endpoint for viewing shared processes
    getSharedProcess: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const link = await db.getShareLinkByToken(input.token);
        if (!link) return null;
        const process = await db.getProcess(link.processId);
        if (!process) return null;
        const nodes = await db.listCanvasObjects(link.processId);
        const edgeList = await db.listEdges(link.processId);
        const groupList = await db.listGroups(link.processId);
        return { ...process, nodes, edges: edgeList, groups: groupList };
      }),
  }),
});

export type AppRouter = typeof appRouter;

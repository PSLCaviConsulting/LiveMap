import { eq, desc, and, asc, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import {
  InsertUser, users, projects, processes, canvasObjects, edges, groups,
  savePoints, shareLinks
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

function resolveSqlitePath(): string {
  // DATABASE_URL can be: "sqlite:./data.db", "file:./data.db", or a raw path.
  const raw = process.env.DATABASE_URL?.trim();
  const rel = raw && raw.length > 0
    ? raw.replace(/^sqlite:\/?\/?/, "").replace(/^file:\/?\/?/, "")
    : "./data/livemap.db";
  const abs = path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  return abs;
}

export async function getDb() {
  if (!_db) {
    try {
      const sqlite = new Database(resolveSqlitePath());
      sqlite.pragma("journal_mode = WAL");
      sqlite.pragma("foreign_keys = ON");
      _db = drizzle(sqlite);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ── User helpers ───────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── Ownership helpers ──────────────────────────────────────────────────
// These return the owning user's id for a given resource, resolving
// through the project that owns its process. Used by router-level
// authorization checks to prevent IDOR.

export async function getProjectOwnerId(projectId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select({ userId: projects.userId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return result[0]?.userId ?? null;
}

export async function getProcessOwnerId(processId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select({ userId: projects.userId })
    .from(processes)
    .innerJoin(projects, eq(projects.id, processes.projectId))
    .where(eq(processes.id, processId))
    .limit(1);
  return result[0]?.userId ?? null;
}

// Count how many of `ids` belong to a canvas object whose project is owned
// by `userId`. Used by bulk mutations to authorize the whole batch in one query.
export async function countOwnedCanvasObjects(userId: number, ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ id: canvasObjects.id })
    .from(canvasObjects)
    .innerJoin(processes, eq(processes.id, canvasObjects.processId))
    .innerJoin(projects, eq(projects.id, processes.projectId))
    .where(and(eq(projects.userId, userId), inArray(canvasObjects.id, ids)));
  return rows.length;
}

export async function countOwnedEdges(userId: number, ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ id: edges.id })
    .from(edges)
    .innerJoin(processes, eq(processes.id, edges.processId))
    .innerJoin(projects, eq(projects.id, processes.projectId))
    .where(and(eq(projects.userId, userId), inArray(edges.id, ids)));
  return rows.length;
}

export async function getCanvasObjectProcessId(id: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select({ processId: canvasObjects.processId })
    .from(canvasObjects)
    .where(eq(canvasObjects.id, id))
    .limit(1);
  return result[0]?.processId ?? null;
}

export async function getEdgeProcessId(id: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select({ processId: edges.processId })
    .from(edges)
    .where(eq(edges.id, id))
    .limit(1);
  return result[0]?.processId ?? null;
}

export async function getGroupProcessId(id: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select({ processId: groups.processId })
    .from(groups)
    .where(eq(groups.id, id))
    .limit(1);
  return result[0]?.processId ?? null;
}

export async function getSavePointProcessId(id: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select({ processId: savePoints.processId })
    .from(savePoints)
    .where(eq(savePoints.id, id))
    .limit(1);
  return result[0]?.processId ?? null;
}

// ── Project helpers ────────────────────────────────────────────────────
export async function listProjects(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.lastOpenedAt));
}

export async function getProject(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result[0];
}

export async function createProject(data: { name: string; description?: string; userId: number; color?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(projects).values(data).returning({ id: projects.id });
  return { id: result[0].id };
}

export async function updateProject(id: number, data: { name?: string; description?: string; color?: string; lastOpenedAt?: Date }) {
  const db = await getDb();
  if (!db) return;
  await db.update(projects).set(data).where(eq(projects.id, id));
}

export async function deleteProject(id: number) {
  const db = await getDb();
  if (!db) return;
  // Delete related data in a single transaction so a crash mid-cascade
  // doesn't leave orphaned processes/nodes/edges behind.
  await db.transaction(async tx => {
    const procs = await tx.select({ id: processes.id }).from(processes).where(eq(processes.projectId, id));
    const procIds = procs.map(p => p.id);
    if (procIds.length > 0) {
      await tx.delete(canvasObjects).where(inArray(canvasObjects.processId, procIds));
      await tx.delete(edges).where(inArray(edges.processId, procIds));
      await tx.delete(groups).where(inArray(groups.processId, procIds));
      await tx.delete(savePoints).where(inArray(savePoints.processId, procIds));
      await tx.delete(shareLinks).where(inArray(shareLinks.processId, procIds));
    }
    await tx.delete(processes).where(eq(processes.projectId, id));
    await tx.delete(projects).where(eq(projects.id, id));
  });
}

// ── Process helpers ────────────────────────────────────────────────────
export async function listProcesses(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(processes).where(eq(processes.projectId, projectId)).orderBy(desc(processes.updatedAt));
}

export async function getProcess(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(processes).where(eq(processes.id, id)).limit(1);
  return result[0];
}

export async function createProcess(data: { projectId: number; name: string; description?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(processes).values(data).returning({ id: processes.id });
  return { id: result[0].id };
}

export async function updateProcess(id: number, data: { name?: string; description?: string; companyName?: string; companyOverview?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(processes).set(data).where(eq(processes.id, id));
}

export async function deleteProcess(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async tx => {
    await tx.delete(canvasObjects).where(eq(canvasObjects.processId, id));
    await tx.delete(edges).where(eq(edges.processId, id));
    await tx.delete(groups).where(eq(groups.processId, id));
    await tx.delete(savePoints).where(eq(savePoints.processId, id));
    await tx.delete(shareLinks).where(eq(shareLinks.processId, id));
    await tx.delete(processes).where(eq(processes.id, id));
  });
}

// ── Canvas Object helpers ──────────────────────────────────────────────
export async function listCanvasObjects(processId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(canvasObjects).where(eq(canvasObjects.processId, processId));
}

export async function getCanvasObject(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(canvasObjects).where(eq(canvasObjects.id, id)).limit(1);
  return result[0];
}

export async function createCanvasObject(data: {
  processId: number; type: "action" | "question" | "start" | "end" | "ghostAction" | "ghostQuestion" | "note";
  label?: string; what?: string; where?: string; system?: string; role?: string; question?: string;
  color?: string; positionX: number; positionY: number; width?: number; height?: number; groupId?: number; data?: any;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(canvasObjects).values(data).returning({ id: canvasObjects.id });
  return { id: result[0].id };
}

export async function updateCanvasObject(id: number, data: Partial<{
  type: "action" | "question" | "start" | "end" | "ghostAction" | "ghostQuestion" | "note";
  label: string; what: string; where: string; system: string; role: string; question: string;
  color: string; positionX: number; positionY: number; width: number; height: number;
  groupId: number | null; hidden: boolean; data: any;
}>) {
  const db = await getDb();
  if (!db) return;
  await db.update(canvasObjects).set(data).where(eq(canvasObjects.id, id));
}

export async function bulkUpdateCanvasObjects(
  updates: Array<{ id: number; positionX?: number; positionY?: number; width?: number; height?: number }>
) {
  if (updates.length === 0) return;
  const db = await getDb();
  if (!db) return;
  // One transaction, N updates — still N statements, but they commit
  // atomically and share a single round-trip at the SQLite driver layer.
  await db.transaction(async tx => {
    for (const u of updates) {
      const { id, ...data } = u;
      if (Object.keys(data).length === 0) continue;
      await tx.update(canvasObjects).set(data).where(eq(canvasObjects.id, id));
    }
  });
}

export async function deleteCanvasObject(id: number) {
  const db = await getDb();
  if (!db) return;
  // Delete connected edges (either direction) and the node itself atomically.
  await db.transaction(async tx => {
    await tx.delete(edges).where(eq(edges.sourceId, id));
    await tx.delete(edges).where(eq(edges.targetId, id));
    await tx.delete(canvasObjects).where(eq(canvasObjects.id, id));
  });
}

// ── Edge helpers ───────────────────────────────────────────────────────
export async function listEdges(processId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(edges).where(eq(edges.processId, processId));
}

export async function createEdge(data: {
  processId: number; sourceId: number; targetId: number;
  sourceHandle?: string; targetHandle?: string; label?: string; edgeType?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(edges).values(data).returning({ id: edges.id });
  return { id: result[0].id };
}

export async function updateEdge(id: number, data: Partial<{ sourceId: number; targetId: number; sourceHandle: string | null; targetHandle: string | null; label: string; edgeType: string; animated: boolean }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(edges).set(data).where(eq(edges.id, id));
}

export async function bulkUpdateEdges(
  updates: Array<{ id: number; sourceHandle?: string | null; targetHandle?: string | null }>
) {
  if (updates.length === 0) return;
  const db = await getDb();
  if (!db) return;
  await db.transaction(async tx => {
    for (const u of updates) {
      const { id, ...data } = u;
      if (Object.keys(data).length === 0) continue;
      await tx.update(edges).set(data).where(eq(edges.id, id));
    }
  });
}

export async function deleteEdge(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(edges).where(eq(edges.id, id));
}

// ── Group helpers ──────────────────────────────────────────────────────
export async function listGroups(processId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(groups).where(eq(groups.processId, processId)).orderBy(asc(groups.sortOrder));
}

export async function createGroup(data: { processId: number; name: string; color?: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(groups).values(data).returning({ id: groups.id });
  return { id: result[0].id };
}

export async function updateGroup(id: number, data: Partial<{ name: string; color: string; sortOrder: number; hidden: boolean; positionX: number; positionY: number; width: number; height: number }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(groups).set(data).where(eq(groups.id, id));
}

export async function deleteGroup(id: number) {
  const db = await getDb();
  if (!db) return;
  // Unassign all member nodes and delete the group atomically.
  await db.transaction(async tx => {
    await tx.update(canvasObjects).set({ groupId: null }).where(eq(canvasObjects.groupId, id));
    await tx.delete(groups).where(eq(groups.id, id));
  });
}

// ── SavePoint helpers ──────────────────────────────────────────────────
export async function listSavePoints(processId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(savePoints).where(eq(savePoints.processId, processId)).orderBy(desc(savePoints.createdAt));
}

export async function createSavePoint(data: { processId: number; userId: number; name: string; snapshot: any }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(savePoints).values(data).returning({ id: savePoints.id });
  return { id: result[0].id };
}

export async function getSavePoint(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(savePoints).where(eq(savePoints.id, id)).limit(1);
  return result[0];
}

// ── Share Link helpers ─────────────────────────────────────────────────
export async function getShareLink(processId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(shareLinks)
    .where(and(eq(shareLinks.processId, processId), eq(shareLinks.isActive, true)))
    .limit(1);
  return result[0];
}

export async function getShareLinkByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(shareLinks)
    .where(and(eq(shareLinks.token, token), eq(shareLinks.isActive, true)))
    .limit(1);
  const link = result[0];
  if (!link) return undefined;
  // Honor the schema's existing expiresAt column. A missing value means
  // the link was created before expiry was enforced — treat as open.
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return undefined;
  return link;
}

const SHARE_LINK_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export async function createShareLink(data: { processId: number; token: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const expiresAt = new Date(Date.now() + SHARE_LINK_TTL_MS);
  const result = await db
    .insert(shareLinks)
    .values({ ...data, expiresAt })
    .returning({ id: shareLinks.id });
  return { id: result[0].id };
}

export async function deactivateShareLink(processId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(shareLinks).set({ isActive: false }).where(eq(shareLinks.processId, processId));
}

// ── Field Suggestions (autocomplete) ──────────────────────────────────
export async function getFieldSuggestions(userId: number) {
  const db = await getDb();
  if (!db) return { systems: [], actions: [], roles: [] };

  // Get all processes belonging to this user's projects
  const userProcesses = await db
    .select({ id: processes.id })
    .from(processes)
    .innerJoin(projects, eq(projects.id, processes.projectId))
    .where(eq(projects.userId, userId));
  if (userProcesses.length === 0) return { systems: [], actions: [], roles: [] };

  // Only pull canvas objects belonging to this user
  const allObjects = await db
    .select({
      system: canvasObjects.system,
      where: canvasObjects.where,
      what: canvasObjects.what,
      role: canvasObjects.role,
    })
    .from(canvasObjects)
    .where(inArray(canvasObjects.processId, userProcesses.map(p => p.id)));

  const systems = new Set<string>();
  const actions = new Set<string>();
  const roles = new Set<string>();

  for (const obj of allObjects) {
    if (obj.system && obj.system.trim()) systems.add(obj.system.trim());
    if (obj.where && obj.where.trim()) systems.add(obj.where.trim());
    if (obj.what && obj.what.trim()) actions.add(obj.what.trim());
    if (obj.role && obj.role.trim()) roles.add(obj.role.trim());
  }

  return {
    systems: Array.from(systems).sort(),
    actions: Array.from(actions).sort(),
    roles: Array.from(roles).sort(),
  };
}

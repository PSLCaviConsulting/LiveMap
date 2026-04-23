import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Helper: SQL-default timestamps + $onUpdate for updatedAt.
const now = () => new Date();

// ── Users ──────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).$defaultFn(now).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).$defaultFn(now).$onUpdate(now).notNull(),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" }).default(sql`(unixepoch())`).$defaultFn(now).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Teams ──────────────────────────────────────────────────────────────
export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  ownerId: integer("ownerId").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).$defaultFn(now).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).$defaultFn(now).$onUpdate(now).notNull(),
});

export type Team = typeof teams.$inferSelect;

// ── Team Members ───────────────────────────────────────────────────────
export const teamMembers = sqliteTable("team_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("teamId").notNull(),
  userId: integer("userId").notNull(),
  memberRole: text("memberRole", { enum: ["owner", "editor", "viewer"] }).default("editor").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).$defaultFn(now).notNull(),
});

export type TeamMember = typeof teamMembers.$inferSelect;

// ── Projects ───────────────────────────────────────────────────────────
export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  userId: integer("userId").notNull(),
  teamId: integer("teamId"),
  color: text("color").default("#0d9488"),
  lastOpenedAt: integer("lastOpenedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).$defaultFn(now),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).$defaultFn(now).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).$defaultFn(now).$onUpdate(now).notNull(),
});

export type Project = typeof projects.$inferSelect;

// ── Processes ──────────────────────────────────────────────────────────
export const processes = sqliteTable("processes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("projectId").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  companyName: text("companyName"),
  companyOverview: text("companyOverview"),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).$defaultFn(now).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).$defaultFn(now).$onUpdate(now).notNull(),
});

export type Process = typeof processes.$inferSelect;

// ── Canvas Objects (Nodes) ─────────────────────────────────────────────
export const canvasObjects = sqliteTable("canvas_objects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  processId: integer("processId").notNull(),
  type: text("type", { enum: ["action", "question", "start", "end", "ghostAction", "ghostQuestion", "note"] }).notNull(),
  label: text("label"),
  what: text("what"),
  where: text("where"),
  system: text("system"),
  role: text("role"),
  question: text("question"),
  color: text("color"),
  positionX: integer("positionX").default(0).notNull(),
  positionY: integer("positionY").default(0).notNull(),
  width: integer("width").default(200),
  height: integer("height").default(80),
  groupId: integer("groupId"),
  hidden: integer("hidden", { mode: "boolean" }).default(false),
  data: text("data", { mode: "json" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).$defaultFn(now).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).$defaultFn(now).$onUpdate(now).notNull(),
});

export type CanvasObject = typeof canvasObjects.$inferSelect;

// ── Edges ──────────────────────────────────────────────────────────────
export const edges = sqliteTable("edges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  processId: integer("processId").notNull(),
  sourceId: integer("sourceId").notNull(),
  targetId: integer("targetId").notNull(),
  sourceHandle: text("sourceHandle"),
  targetHandle: text("targetHandle"),
  label: text("label"),
  edgeType: text("edgeType").default("smoothstep"),
  animated: integer("animated", { mode: "boolean" }).default(false),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).$defaultFn(now).notNull(),
});

export type Edge = typeof edges.$inferSelect;

// ── Groups (Swimlanes) ────────────────────────────────────────────────
export const groups = sqliteTable("groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  processId: integer("processId").notNull(),
  name: text("name").notNull(),
  color: text("color").default("#0d9488"),
  sortOrder: integer("sortOrder").default(0),
  hidden: integer("hidden", { mode: "boolean" }).default(false),
  positionX: integer("positionX").default(0),
  positionY: integer("positionY").default(0),
  width: integer("width").default(1200),
  height: integer("height").default(300),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).$defaultFn(now).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).$defaultFn(now).$onUpdate(now).notNull(),
});

export type Group = typeof groups.$inferSelect;

// ── Save Points ────────────────────────────────────────────────────────
export const savePoints = sqliteTable("save_points", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  processId: integer("processId").notNull(),
  userId: integer("userId").notNull(),
  name: text("name").notNull(),
  snapshot: text("snapshot", { mode: "json" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).$defaultFn(now).notNull(),
});

export type SavePoint = typeof savePoints.$inferSelect;

// ── Share Links ────────────────────────────────────────────────────────
export const shareLinks = sqliteTable("share_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  processId: integer("processId").notNull(),
  token: text("token").notNull().unique(),
  isActive: integer("isActive", { mode: "boolean" }).default(true),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).$defaultFn(now).notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }),
});

export type ShareLink = typeof shareLinks.$inferSelect;

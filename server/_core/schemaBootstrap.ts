// Embedded schema DDL so a fresh deployment (e.g. Railway, which runs
// `node dist/index.js` with no migration step) can self-provision its
// database on first boot. Idempotent: every statement uses IF NOT EXISTS,
// so this is a harmless no-op against an already-provisioned database.
//
// Kept in sync with drizzle/schema.ts. To refresh after a schema change:
//   pnpm exec drizzle-kit generate   # writes drizzle/0000_*.sql
// then re-run the generator that produced this file. Identifiers are
// double-quoted so reserved words ("where", "groups") are safe.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "canvas_objects" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"processId" integer NOT NULL,
	"type" text NOT NULL,
	"label" text,
	"what" text,
	"where" text,
	"system" text,
	"role" text,
	"question" text,
	"note" text,
	"color" text,
	"positionX" integer DEFAULT 0 NOT NULL,
	"positionY" integer DEFAULT 0 NOT NULL,
	"width" integer DEFAULT 200,
	"height" integer DEFAULT 80,
	"groupId" integer,
	"hidden" integer DEFAULT false,
	"data" text,
	"createdAt" integer DEFAULT (unixepoch()) NOT NULL,
	"updatedAt" integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE IF NOT EXISTS "edges" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"processId" integer NOT NULL,
	"sourceId" integer NOT NULL,
	"targetId" integer NOT NULL,
	"sourceHandle" text,
	"targetHandle" text,
	"label" text,
	"edgeType" text DEFAULT 'smoothstep',
	"animated" integer DEFAULT false,
	"createdAt" integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE IF NOT EXISTS "groups" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"processId" integer NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#0d9488',
	"sortOrder" integer DEFAULT 0,
	"hidden" integer DEFAULT false,
	"positionX" integer DEFAULT 0,
	"positionY" integer DEFAULT 0,
	"width" integer DEFAULT 1200,
	"height" integer DEFAULT 300,
	"createdAt" integer DEFAULT (unixepoch()) NOT NULL,
	"updatedAt" integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE IF NOT EXISTS "processes" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"projectId" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"companyName" text,
	"companyOverview" text,
	"createdAt" integer DEFAULT (unixepoch()) NOT NULL,
	"updatedAt" integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE IF NOT EXISTS "projects" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"userId" integer NOT NULL,
	"teamId" integer,
	"color" text DEFAULT '#0d9488',
	"lastOpenedAt" integer DEFAULT (unixepoch()),
	"createdAt" integer DEFAULT (unixepoch()) NOT NULL,
	"updatedAt" integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE IF NOT EXISTS "save_points" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"processId" integer NOT NULL,
	"userId" integer NOT NULL,
	"name" text NOT NULL,
	"snapshot" text NOT NULL,
	"createdAt" integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE IF NOT EXISTS "share_links" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"processId" integer NOT NULL,
	"token" text NOT NULL,
	"isActive" integer DEFAULT true,
	"createdAt" integer DEFAULT (unixepoch()) NOT NULL,
	"expiresAt" integer
);

CREATE UNIQUE INDEX IF NOT EXISTS "share_links_token_unique" ON "share_links" ("token");
CREATE TABLE IF NOT EXISTS "team_members" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"teamId" integer NOT NULL,
	"userId" integer NOT NULL,
	"memberRole" text DEFAULT 'editor' NOT NULL,
	"createdAt" integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE IF NOT EXISTS "teams" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"name" text NOT NULL,
	"ownerId" integer NOT NULL,
	"createdAt" integer DEFAULT (unixepoch()) NOT NULL,
	"updatedAt" integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE IF NOT EXISTS "users" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"openId" text NOT NULL,
	"name" text,
	"email" text,
	"loginMethod" text,
	"role" text DEFAULT 'user' NOT NULL,
	"createdAt" integer DEFAULT (unixepoch()) NOT NULL,
	"updatedAt" integer DEFAULT (unixepoch()) NOT NULL,
	"lastSignedIn" integer DEFAULT (unixepoch()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_openId_unique" ON "users" ("openId");
`;

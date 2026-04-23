import "dotenv/config";
import path from "node:path";
import { defineConfig } from "drizzle-kit";

// Accept sqlite:/, file:/, or raw path. Default to ./data/livemap.db.
const raw = process.env.DATABASE_URL?.trim();
const rel = raw && raw.length > 0
  ? raw.replace(/^sqlite:\/?\/?/, "").replace(/^file:\/?\/?/, "")
  : "./data/livemap.db";
const abs = path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: abs,
  },
});

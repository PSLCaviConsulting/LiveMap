import "dotenv/config";
import path from "node:path";
import { defineConfig } from "drizzle-kit";

// Accept sqlite:/file: schemes (with optional // authority) or a raw path,
// keeping absolute paths intact. Default to ./data/livemap.db.
const raw = process.env.DATABASE_URL?.trim();
const rel = raw && raw.length > 0
  ? raw.replace(/^(?:sqlite|file):/i, "").replace(/^\/\//, "")
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

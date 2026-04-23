import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// Dev-auth bypass: when DEV_AUTH=1 (or NODE_ENV=development with no OAuth
// server configured) we auto-login as a single local user. No Manus OAuth
// portal is needed. The dev user is granted admin.
const DEV_OPEN_ID = "local-dev-user";
const DEV_NAME = "Local Dev";
const DEV_EMAIL = "dev@localhost";

async function getOrCreateDevUser() {
  let user = await db.getUserByOpenId(DEV_OPEN_ID);
  if (!user) {
    await db.upsertUser({
      openId: DEV_OPEN_ID,
      name: DEV_NAME,
      email: DEV_EMAIL,
      loginMethod: "dev",
      role: "admin",
      lastSignedIn: new Date(),
    });
    user = await db.getUserByOpenId(DEV_OPEN_ID);
  }
  return user ?? null;
}

function isDevAuthEnabled() {
  if (process.env.DEV_AUTH === "1" || process.env.DEV_AUTH === "true") return true;
  // Fallback: in development with no OAuth configured, auto-enable dev auth.
  if (process.env.NODE_ENV !== "production" && !process.env.OAUTH_SERVER_URL) return true;
  return false;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  if (isDevAuthEnabled()) {
    user = await getOrCreateDevUser();
  } else {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}

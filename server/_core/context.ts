import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// Single-user auto-login. This app ships without a real OAuth provider, so
// by default (no OAUTH_SERVER_URL configured) every request is authenticated
// as one shared local admin user — locally AND on a deployed domain — so the
// app is usable out of the box with no sign-in step. This means anyone who
// can reach the URL is that user; configure OAUTH_SERVER_URL (real auth) to
// turn it off, or set DEV_AUTH=0 to force it off explicitly.
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
  // Explicit override wins in both directions.
  if (process.env.DEV_AUTH === "0" || process.env.DEV_AUTH === "false") return false;
  if (process.env.DEV_AUTH === "1" || process.env.DEV_AUTH === "true") return true;
  // Otherwise auto-login whenever no real OAuth provider is configured — this
  // is what makes a fresh deploy usable without any sign-in setup. Set
  // OAUTH_SERVER_URL to switch to real authentication.
  return !process.env.OAUTH_SERVER_URL;
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

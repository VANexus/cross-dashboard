/**
 * FlowMind RAK — API route helpers
 * Wraps route handlers to ensure database is initialized before execution.
 */
import type { NextRequest } from "next/server";
import { getDbAsync } from "./db";

/**
 * Wrap an API route handler to ensure the database is ready.
 * Preserves the handler's type signature for Next.js compatibility.
 */
export function withDb<T extends (request: NextRequest, ...args: never[]) => unknown>(handler: T): T {
  return (async (request: NextRequest, ...args: never[]) => {
    await getDbAsync();
    return handler(request, ...args);
  }) as unknown as T;
}

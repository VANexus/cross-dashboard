import { NextResponse } from "next/server";
import type { Pagination } from "./types";

export function success<T>(data: T, pagination?: Pagination, status = 200) {
  return NextResponse.json(
    { success: true, data, ...(pagination ? { pagination } : {}) },
    { status }
  );
}

export function error(message: string, code = 400, details?: unknown) {
  return NextResponse.json(
    { success: false, error: message, code, ...(details ? { details } : {}) },
    { status: code }
  );
}

export function notFound(resource = "Resource") {
  return error(`${resource} not found`, 404);
}

export function badRequest(message: string, details?: unknown) {
  return error(message, 400, details);
}

export function methodNotAllowed() {
  return error("Method not allowed", 405);
}

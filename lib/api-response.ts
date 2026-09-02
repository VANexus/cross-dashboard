import { NextResponse } from "next/server";
import type { Pagination } from "./types";

export function success<T>(data: T, pagination?: Pagination, status = 200, headers?: HeadersInit) {
  return NextResponse.json(
    { success: true, data, ...(pagination ? { pagination } : {}) },
    { status, headers }
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

/**
 * 低成本配置类 GET 的浏览器缓存头：
 * 60s 强缓存（切页不重复请求）+ 5min stale-while-revalidate（后台静默更新）。
 * 只用于设置/状态等读多写少端点；付费数据端点走「DB 秒回 + 后台保鲜」，不加。
 */
export const CONFIG_CACHE_HEADERS: HeadersInit = {
  "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
};

/**
 * FlowMind RAK — Repository base utilities
 */
import { getDb } from "../db";
import type { Pagination } from "../types";

export interface PaginatedResult<T> {
  items: T[];
  pagination: Pagination;
}

export function paginatedQuery<T>(
  table: string,
  where: string,
  params: unknown[],
  page: number,
  pageSize: number,
  orderBy = "rowid DESC",
): PaginatedResult<T> {
  const db = getDb();
  const offset = (page - 1) * pageSize;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countRow = db.query(`SELECT COUNT(*) as c FROM ${table} ${where}`).get(...(params as any[])) as { c: number };
  const total = countRow.c;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = db.query(`SELECT * FROM ${table} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...(params as any[]), pageSize, offset) as T[];

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export function parseJsonField<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

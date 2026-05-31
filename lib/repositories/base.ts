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

  const countRow = db.query(`SELECT COUNT(*) as c FROM ${table} ${where}`).get(...(params as any[])) as { c: number };
  const total = countRow.c;

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

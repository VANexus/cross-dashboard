import { getSupabase } from "../db";
import type { PostgrestFilterBuilder } from "@supabase/supabase-js";
import type { Pagination } from "../types";

export interface PaginatedResult<T> {
  items: T[];
  pagination: Pagination;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- 泛型分页助手对任意表结构通用 */
type FilterBuilder = PostgrestFilterBuilder<any, any, any, any>;

/**
 * 通用分页查询：buildQuery 只负责追加过滤条件（eq/or/is...），
 * select / order / range 由本函数统一处理，保证 count 与数据页一致。
 */
export async function paginatedQuery<T>(
  table: string,
  buildQuery: (qb: FilterBuilder) => FilterBuilder,
  page: number,
  pageSize: number,
  orderBy: { column: string; ascending?: boolean } = { column: "created_at", ascending: false },
): Promise<PaginatedResult<T>> {
  const sb = getSupabase();
  const offset = (page - 1) * pageSize;

  const { count, error: countError } = await buildQuery(
    sb.from(table).select("*", { count: "exact", head: true }),
  );
  if (countError) throw countError;
  const total = count ?? 0;

  const { data, error } = await buildQuery(sb.from(table).select("*"))
    .order(orderBy.column, { ascending: orderBy.ascending ?? false })
    .range(offset, offset + pageSize - 1);
  if (error) throw error;

  return {
    items: (data ?? []) as T[],
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function parseJsonField<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

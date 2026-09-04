import { prisma, isoRows } from "@/lib/server/db";
import type { Pagination } from "@/lib/shared/types";

export interface PaginatedResult<T> {
  items: T[];
  pagination: Pagination;
}

/** 通用 where 条件对象（Prisma 风格：{ col: value } / { col: { in, gte, contains... } } / { OR: [...] }）。 */
export type PrismaWhere = Record<string, unknown>;

/** 动态表访问的最小 Prisma 模型委托接口（泛型分页助手对任意表结构通用）。 */
interface ModelDelegate {
  count(args?: { where?: PrismaWhere }): Promise<number>;
  findMany(args?: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
}

/**
 * 通用分页查询：buildQuery 只负责在 where 对象上追加过滤条件（赋值或 in/gte/OR 操作符），
 * select / order / range 由本函数统一处理，保证 count 与数据页一致。
 * 读出的行统一经 isoRows 序列化（DateTime 列 → ISO 字符串），保持 string 语义。
 */
export async function paginatedQuery<T>(
  table: string,
  buildQuery: (where: PrismaWhere) => PrismaWhere,
  page: number,
  pageSize: number,
  orderBy: { column: string; ascending?: boolean } = { column: "created_at", ascending: false },
): Promise<PaginatedResult<T>> {
  const model = (prisma as unknown as Record<string, ModelDelegate>)[table];
  const where = buildQuery({});
  const offset = (page - 1) * pageSize;

  const [total, rows] = await Promise.all([
    model.count({ where }),
    model.findMany({
      where,
      orderBy: { [orderBy.column]: (orderBy.ascending ?? false) ? "asc" : "desc" },
      skip: offset,
      take: pageSize,
    }),
  ]);

  return {
    items: isoRows(rows) as T[],
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

/**
 * 忽略 P2025（记录不存在）：对齐旧 supabase update/delete().eq() 的静默 no-op 语义
 * （0 行命中不报错）；其余错误原样抛出。
 */
export async function ignoreNotFound(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") return;
    throw e;
  }
}

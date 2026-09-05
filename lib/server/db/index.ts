/**
 * FlowMind RAK — Database singleton（集群 PG · Prisma Client）
 *
 * P1 数据层（2026-09-03 拍板：用现成库，不造轮子）：
 *   - ORM = Prisma（schema.prisma 由 `prisma db pull` 自集群 PG 反向生成）；
 *   - 连接串 = DATABASE_URL（.env / 集群 Secret 注入）；
 *   - 建表/迁移 = scripts/db-migrate.ts（DDL 源 lib/server/db/migrations，水位表 schema_migrations；
 *     该运维脚本直用 postgres 驱动，与应用 ORM 无关）。
 *
 * 启动链路：withDb → getDbAsync() → $connect + 基础数据。
 */
import { PrismaClient } from "@prisma/client";

let _prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient({
      log: ["warn", "error"],
    });
  }
  return _prisma;
}

/**
 * 懒代理：`prisma.<model>.<op>(...)` 首次访问时才实例化客户端，
 * 避免模块加载期建连（standalone 场景安全）。
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    return (getPrisma() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

let _init: Promise<void> | null = null;

/** 异步初始化（保持旧签名：withDb / 启动路径 await 它即可）。 */
export function getDbAsync(): Promise<void> {
  if (!_init) _init = init();
  return _init;
}

async function init(): Promise<void> {
  // P1 连接治理：不在这里加 connection()。原因见 withDb —— connection() 会把所有
  // DB 读取标记为 uncached，cache-components 强制每个 uncached 组件落在 <Suspense> 内，
  // 放在 getDbAsync 会波及全部岛/页（含并行请求期），破坏正常 Suspense 结构并报 blocking-route。
  // 仅 withDb（API 路由）需要 connection() 来豁免预渲染连库；页面级由
  // app/**/page.tsx 自身以 Suspense 包数据读取处理（见 agents/[id]/page.tsx）。
  const p = getPrisma();
  await p.$connect();
  await ensureWorkflowStatuses();
  await ensureSeedAgents();

  // Agent 自嗨循环已退役（2026-09-05 架构去双轨）：不再随进程自动启动任何周期循环。
  // 老自主 Runtime（setInterval）仅保留「按需激活」能力，经 /api/agents/[id]/start 或
  // create_agent/create_team 显式触发；对话主线走 /api/agent/chat 统一编排。
  // （原实现：非 build 阶段 agentRuntime.start() 拉起全部种子的 think+decide LLM 循环，
  //   每周期 2 次模型调用 + 全表读 PG，纯白耗无业务产出。）
}

// ── Agent 种子（personas → 真库，幂等）──────────────────────────

const SEED_AGENTS: Array<{ id: string; type: "sentinel" | "dispatch" | "operations" | "risk_control" | "legal" | "marketing"; name: string; desc: string }> = [
  { id: "sentinel-001", type: "sentinel", name: "哨兵Agent", desc: "监控系统健康与合规状态，对风险事件分级评估并快速响应。" },
  { id: "dispatch-001", type: "dispatch", name: "调度Agent", desc: "任务分解与 Agent 编组，数据驱动的资源调度与协作闭环。" },
  { id: "operations-001", type: "operations", name: "运营Agent", desc: "选品分析、库销比监控与 Listing 优化的跨境电商运营专家。" },
  { id: "risk_control-001", type: "risk_control", name: "风控Agent", desc: "支付安全与合规检测，实时交易异常评估与预警。" },
  { id: "legal-001", type: "legal", name: "法务Agent", desc: "知识产权保护与合规审查，防患于未然。" },
  { id: "marketing-001", type: "marketing", name: "营销Agent", desc: "PPC 广告策略、关键词优化与 AI 制图的营销专家。" },
];

async function ensureSeedAgents(): Promise<void> {
  try {
    const p = getPrisma();
    const { getDefaultConfig } = await import("../agent-runtime/personas");
    for (const seed of SEED_AGENTS) {
      const exists = await p.agents.findUnique({ where: { id: seed.id }, select: { id: true } });
      if (exists) continue;
      await p.agents.create({
        data: {
          id: seed.id,
          name: seed.name,
          type: seed.type,
          status: "online",
          description: seed.desc,
          config: JSON.stringify(getDefaultConfig(seed.type, seed.id)),
          last_heartbeat: new Date().toISOString(),
        },
      });
      console.log(`[db] seeded agent: ${seed.id}`);
    }
  } catch (e) {
    console.warn("[db] ensureSeedAgents failed:", (e as Error).message);
  }
}

export function isDbReady(): boolean {
  return _init !== null;
}

/** 释放引用（测试/热重载用）。 */
export function closeDb(): void {
  _init = null;
  if (_prisma) {
    void _prisma.$disconnect();
    _prisma = null;
  }
}

/** Prisma DateTime 列 → ISO 字符串（应用层沿用 string 语义）。 */
export function iso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

/** 行级序列化：把行内所有 Date 字段转 ISO 字符串（浅拷贝，不 mutate 原行）。 */
export function isoRow<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const [k, v] of Object.entries(out)) {
    if (v instanceof Date) out[k] = v.toISOString();
  }
  return out as T;
}

export function isoRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map(isoRow);
}

// ── 基础数据 ─────────────────────────────────────────────────

async function ensureWorkflowStatuses(): Promise<void> {
  const defaults: Array<[string, string, string, string]> = [
    ["keyword-trend", "关键词趋势", "/b2b/keyword-trends", "idle"],
    ["b2b-listing", "货品一键上架", "/b2b/listing", "idle"],
    ["image-skill", "生图 Skill 库", "/b2b/image-skills", "idle"],
    ["copywriting", "文案创作", "/content-studio", "running"],
    ["compliance-audit", "合规审计", "/content-studio", "idle"],
    ["image-gen", "AI 配图", "/content-studio", "idle"],
    ["idea-design", "思路设计", "/content-studio", "idle"],
    ["hot-topic", "热点雷达", "/content-studio", "idle"],
    ["video-localization", "视频本地化", "/workflows/video-localization", "running"],
  ];
  try {
    const p = getPrisma();
    for (const [id, name, href, status] of defaults) {
      await p.wf_workflow_statuses.upsert({
        create: { id, name, href, status },
        update: {},
        where: { id },
      });
    }
  } catch (e) {
    console.warn("[db] ensureWorkflowStatuses failed:", (e as Error).message);
  }
}

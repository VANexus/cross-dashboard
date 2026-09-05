"use client";

import type { DashboardOverview } from "@/lib/server/services/dashboard.service";
import type { ProfileCreations } from "./islands/usage-island";

export type ProfileUsageProps = { overview: DashboardOverview; creations: ProfileCreations };

const TYPE_LABEL: Record<string, string> = {
  draft: "文案",
  idea: "创意",
  image: "生图",
  page: "动态页",
};

const TYPE_TONE: Record<string, string> = {
  draft: "bg-sky-500/10 text-sky-600 border-sky-500/25",
  idea: "bg-violet-500/10 text-violet-600 border-violet-500/25",
  image: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25",
  page: "bg-amber-500/10 text-amber-600 border-amber-500/25",
};

const HEALTH_LABEL: Record<string, string> = {
  ok: "正常",
  down: "故障",
  OPEN: "熔断",
  HALF_OPEN: "半开",
  configured: "就绪",
  missing: "未配置",
};

/** 示例配额（SaaS 计费落地前仅作参考基线，后续按订阅档位替换）。 */
const QUOTA: Array<[string, number]> = [
  ["生图", 500],
  ["趋势数据", 10000],
  ["记忆条目", 2000],
  ["SOP 运行", 200],
  ["对话消息", 5000],
  ["SOP 规划", 100],
];

function QuotaBar({ label, used, quota }: { label: string; used: number; quota: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, quota)) * 100));
  const warn = pct >= 90;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-foreground/80">{label}</span>
        <span className={`tabular-nums ${warn ? "text-red-500" : "text-muted-foreground"}`}>
          {used.toLocaleString()} / {quota.toLocaleString()}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${warn ? "bg-red-500" : "bg-primary/70"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** 个人工作台用量看板：服务健康 + 用量与配额 + 我的产物（Supabase 风格）。 */
export function ProfileUsage({ overview, creations }: ProfileUsageProps) {
  const h = overview?.health;
  const u = overview?.usage;
  const f = overview?.fulfillment ?? {};

  const counts = creations?.counts;
  const recent = creations?.recent ?? [];
  const totalCreations = counts ? counts.draft + counts.idea + counts.image + counts.page : 0;

  const healthItems = [
    ["PostgreSQL", h?.postgres],
    ["Redis", h?.redis],
    ["flowmind MCP", h?.flowmindMcp],
    ["阿里国际站授权", h?.alibaba],
    ["模型网关", h?.llm],
  ] as const;

  const usedList: Array<[string, number]> = [
    ["生图", u?.images ?? 0],
    ["趋势数据", u?.trends ?? 0],
    ["记忆条目", u?.memories ?? 0],
    ["SOP 运行", u?.runs ?? 0],
    ["对话消息", u?.messages ?? 0],
    ["SOP 规划", u?.specs ?? 0],
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* 服务健康 */}
      <section className="rounded-xl border bg-background/60 p-4">
        <h2 className="mb-3 text-xs font-medium text-muted-foreground">服务健康</h2>
        <div className="flex flex-wrap gap-2">
          {healthItems.map(([label, value]) => {
            const status = String(value ?? "missing");
            const ok = status === "ok" || status === "configured";
            return (
              <div
                key={label}
                className={`flex min-w-40 items-center gap-2 rounded-lg border px-3 py-2 ${
                  ok ? "border-emerald-500/25 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
                <div>
                  <div className="text-sm font-medium">{label}</div>
                  <div className={`text-[11px] ${ok ? "text-emerald-600" : "text-amber-600"}`}>
                    {HEALTH_LABEL[status] ?? status}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          「阿里国际站授权 / 模型网关」反映业务可用的关键依赖是否就绪（凭证未配置时走设置引导）。
        </p>
      </section>

      {/* 用量与配额 */}
      <section className="rounded-xl border bg-background/60 p-4">
        <h2 className="mb-3 text-xs font-medium text-muted-foreground">用量</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {usedList.map(([label, used], i) => (
            <QuotaBar key={label} label={label} used={used} quota={QUOTA[i]?.[1] ?? 1000} />
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">配额为示例基线，SaaS 计费落地后按订阅档位生效。</p>
      </section>

      {/* 铺货管道 */}
      <section className="rounded-xl border bg-background/60 p-4">
        <h2 className="mb-3 text-xs font-medium text-muted-foreground">铺货管道</h2>
        <div className="flex h-7 w-full overflow-hidden rounded-md">
          {(["draft", "uploading", "uploaded", "failed"] as const).map((s) => {
            const n = f[s] ?? 0;
            if (!n) return null;
            return (
              <div
                key={s}
                title={`${s}: ${n}`}
                className={
                  s === "uploaded" ? "h-full bg-emerald-500/70"
                    : s === "failed" ? "h-full bg-red-500/70"
                    : s === "uploading" ? "h-full bg-sky-500/70"
                    : "h-full bg-muted"
                }
                style={{ width: `${(n / Math.max(1, Object.values(f).reduce((a, b) => a + (b ?? 0), 0))) * 100}%` }}
              />
            );
          })}
        </div>
        <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
          <span>草稿 {f.draft ?? 0}</span>
          <span>上传中 {f.uploading ?? 0}</span>
          <span className="text-emerald-600">已上传 {f.uploaded ?? 0}</span>
          <span className="text-red-500">失败 {f.failed ?? 0}</span>
        </div>
      </section>

      {/* 个人工作台入口 */}
      <section className="rounded-xl border bg-background/60 p-4">
        <h2 className="mb-3 text-xs font-medium text-muted-foreground">我的工作台</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["对话历史", "/conversations"],
            ["流水线编排", "/journeys"],
            ["SOP 工作流", "/wf"],
            ["店铺管理", "/b2b"],
            ["我的设置", "/settings"],
            ["能力中心", "/skills"],
          ].map(([label, href]) => (
            <a
              key={String(href)}
              href={String(href)}
              className="rounded-lg border bg-muted/30 px-3 py-2.5 text-center text-xs font-medium text-foreground/80 hover:bg-muted/60 hover:text-foreground transition-colors"
            >
              {label}
            </a>
          ))}
        </div>
      </section>

      {/* 我的产物：个人页聚合概览，完整成果库在 /creations */}
      <section className="rounded-xl border bg-background/60 p-4">
        <h2 className="mb-3 flex items-center justify-between text-xs font-medium text-muted-foreground">
          我的产物
          <a href="/creations" className="text-xs text-primary hover:underline">查看全部 →</a>
        </h2>
        <div className="mb-3 text-2xl font-semibold tabular-nums">{totalCreations}</div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(["draft", "idea", "image", "page"] as const).map((t) => (
            <span key={t} className={`rounded-md border px-2 py-0.5 text-[11px] ${TYPE_TONE[t] ?? ""}`}>
              {TYPE_LABEL[t] ?? t} {counts?.[t] ?? 0}
            </span>
          ))}
        </div>
        <ul className="grid gap-1">
          {recent.slice(0, 5).map((c) => (
            <li key={`${c.type}-${c.id}`}>
              <a
                href={c.href ?? "/creations"}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/50 transition-colors"
              >
                <span className={`shrink-0 rounded border px-1.5 text-[10px] leading-4 ${TYPE_TONE[c.type] ?? ""}`}>
                  {TYPE_LABEL[c.type] ?? c.type}
                </span>
                <span className="truncate text-xs text-foreground/85">{c.title}</span>
              </a>
            </li>
          ))}
          {recent.length === 0 && (
            <li className="text-xs text-muted-foreground">暂无产物——让 Agent 生成文案 / 图片 / 动态页面后会出现在这里。</li>
          )}
        </ul>
      </section>
    </div>
  );
}
/**
 * FlowMind — 技能输出渲染器（数据驱动，多样模块）
 *
 * 同一个通用组件，根据输出数据的不同形态，自动选择不同模块：
 *   - number              → 指标卡
 *   - array<object>       → 数据表 / 面积趋势图（含日期键时）
 *   - array<number>       → 柱状图
 *   - array<string>       → 标签云
 *   - object              → 键值对 / 合规清单（含 passed 布尔时）
 *   - string（多行）      → 代码块 / 报告
 *
 * 所有图表均为内联 SVG 填充编码，数值用 mono/tabular。
 */
"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface SkillOutputProps {
  schema?: unknown;
  data: unknown;
}

type Module =
  | { kind: "metric"; key: string; value: number }
  | { kind: "table"; key: string; title: string; rows: Record<string, unknown>[] }
  | { kind: "area"; key: string; title: string; points: { x: string; y: number }[] }
  | { kind: "bar"; key: string; title: string; items: { label: string; value: number }[] }
  | { kind: "tags"; key: string; title: string; items: string[] }
  | { kind: "kv"; key: string; title: string; entries: [string, string][] }
  | { kind: "checks"; key: string; title: string; entries: { label: string; passed: boolean }[] }
  | { kind: "code"; key: string; title: string; text: string }
  | { kind: "text"; key: string; title: string; text: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}
function looksLikeDate(s: string): boolean {
  return /^\d{2,4}[-\/]\d{1,2}|^\d{4}-\d{2}-\d{2}/.test(s);
}

/** 把任意输出对象归类为若干渲染模块 */
function classify(data: unknown): Module[] {
  if (!isRecord(data)) return [];
  const modules: Module[] = [];
  const metrics: Module[] = [];

  for (const [key, v] of Object.entries(data)) {
    const title = key.replace(/_/g, " ");
    if (isNumber(v)) {
      metrics.push({ kind: "metric", key, value: v });
      continue;
    }
    if (typeof v === "string") {
      if (v.includes("\n")) {
        modules.push({ kind: "code", key, title, text: v });
      } else {
        modules.push({ kind: "text", key, title, text: v });
      }
      continue;
    }
    if (!isArray(v)) {
      if (isRecord(v)) {
        // 合规清单：值为 { passed: boolean } 的记录
        const checkEntries = Object.entries(v).map(([k, val]) => {
          if (isRecord(val) && typeof val.passed === "boolean") {
            return { label: k, passed: val.passed };
          }
          return null;
        });
        if (checkEntries.length > 0 && checkEntries.every(Boolean)) {
          modules.push({ kind: "checks", key, title, entries: checkEntries as { label: string; passed: boolean }[] });
        } else {
          modules.push({
            kind: "kv",
            key,
            title,
            entries: Object.entries(v).map(([k2, v2]) => [k2, formatPrimitive(v2)] as [string, string]),
          });
        }
      }
      continue;
    }
    // 数组
    if (v.length === 0) continue;
    if (v.every(isNumber)) {
      modules.push({
        kind: "bar",
        key,
        title,
        items: (v as number[]).map((n, i) => ({ label: `#${i + 1}`, value: n })),
      });
      continue;
    }
    if (v.every((x) => typeof x === "string")) {
      modules.push({ kind: "tags", key, title, items: v as string[] });
      continue;
    }
    if (v.every(isRecord)) {
      const rows = v as Record<string, unknown>[];
      const first = rows[0];
      const keys = Object.keys(first);
      // 面积图：恰有 2 列，一列为日期/类别、一列为数值
      const numKeys = keys.filter((k) => isNumber(first[k]));
      const strKeys = keys.filter((k) => typeof first[k] === "string");
      if (numKeys.length === 1 && strKeys.length >= 1 && rows.every((r) => looksLikeDate(String(r[strKeys[0]])))) {
        modules.push({
          kind: "area",
          key,
          title,
          points: rows.map((r) => ({ x: String(r[strKeys[0]]), y: Number(r[numKeys[0]]) })),
        });
        continue;
      }
      modules.push({ kind: "table", key, title, rows });
      continue;
    }
  }

  // 指标卡提到最前
  return [...metrics, ...modules];
}

function formatPrimitive(v: unknown): string {
  if (typeof v === "boolean") return v ? "是" : "否";
  if (v === null || v === undefined) return "—";
  if (isNumber(v)) return formatNumber(v);
  return String(v);
}

function formatNumber(n: number): string {
  if (n < 1 && n !== 0) return `${Math.round(n * 100)}%`;
  return n.toLocaleString("zh-CN");
}

function cellLabel(v: unknown): string {
  if (typeof v === "boolean") return v ? "通过" : "未通过";
  if (isNumber(v)) return formatNumber(v);
  if (isRecord(v)) return JSON.stringify(v).slice(0, 40);
  return String(v ?? "—");
}

/** 内联 SVG 面积趋势图（填充编码） */
function AreaChart({ points }: { points: { x: string; y: number }[] }) {
  const w = 560;
  const h = 180;
  const pad = 24;
  const max = Math.max(...points.map((p) => p.y));
  const min = Math.min(...points.map((p) => p.y));
  const range = max - min || 1;
  const stepX = (w - pad * 2) / Math.max(points.length - 1, 1);
  const coords = points.map((p, i) => ({
    x: pad + i * stepX,
    y: h - pad - ((p.y - min) / range) * (h - pad * 2),
  }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1].x.toFixed(1)},${h - pad} L${coords[0].x.toFixed(1)},${h - pad} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" preserveAspectRatio="none" role="img" aria-label="趋势图">
        <defs>
          <linearGradient id="od-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#od-area)" className="text-primary" />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="3" fill="var(--card)" stroke="currentColor" strokeWidth="2" className="text-primary" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between px-6 font-mono text-[10px] text-muted-foreground">
        {points.map((p, i) => (
          <span key={i}>{p.x}</span>
        ))}
      </div>
    </div>
  );
}

/** 内联 SVG 柱状图（填充编码） */
function BarChart({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map((i) => i.value)) || 1;
  return (
    <div className="flex items-end gap-2" style={{ height: 120 }}>
      {items.map((it, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">{formatNumber(it.value)}</span>
          <div
            className="w-full rounded-t-md bg-primary/80 transition-all"
            style={{ height: `${Math.max((it.value / max) * 88, 4)}px` }}
          />
          <span className="max-w-full truncate font-mono text-[10px] text-muted-foreground">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

/** 指标卡网格 */
function MetricGrid({ metrics }: { metrics: { key: string; value: number }[] }) {
  if (metrics.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {metrics.map((m) => (
        <div key={m.key} className="rounded-xl border border-border bg-background/50 px-4 py-3">
          <div className="text-xs text-muted-foreground">{m.key.replace(/_/g, " ")}</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums">{formatNumber(m.value)}</div>
        </div>
      ))}
    </div>
  );
}

function ModuleCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60">
      <div className="border-b border-border/60 px-4 py-2.5 text-xs font-medium text-muted-foreground">{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function SkillOutput({ data }: SkillOutputProps) {
  const modules = useMemo(() => classify(data), [data]);
  const metrics = modules.filter((m) => m.kind === "metric");
  const rest = modules.filter((m) => m.kind !== "metric");

  if (modules.length === 0) {
    return <p className="text-sm text-muted-foreground">运行后此处将渲染结构化输出。</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <MetricGrid metrics={metrics as { key: string; value: number }[]} />
      {rest.map((m) => (
        <ModuleCard key={m.key} title={m.title}>
          {m.kind === "table" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {Object.keys((m as { rows: Record<string, unknown>[] }).rows[0] ?? {}).map((k) => (
                      <th key={k} className="px-2 py-2 font-medium">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(m as { rows: Record<string, unknown>[] }).rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-border/50 last:border-0 hover:bg-accent/40">
                      {Object.values(row).map((v, ci) => (
                        <td key={ci} className="px-2 py-2 font-mono text-[12.5px] tabular-nums">
                          {cellLabel(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {m.kind === "area" && <AreaChart points={(m as { points: { x: string; y: number }[] }).points} />}
          {m.kind === "bar" && <BarChart items={(m as { items: { label: string; value: number }[] }).items} />}
          {m.kind === "tags" && (
            <div className="flex flex-wrap gap-1.5">
              {(m as { items: string[] }).items.map((t, i) => (
                <span key={i} className="rounded-full border border-border bg-accent/40 px-2.5 py-0.5 text-xs">
                  {t}
                </span>
              ))}
            </div>
          )}
          {m.kind === "kv" && (
            <dl className="flex flex-col gap-2">
              {(m as { entries: [string, string][] }).entries.map(([k, v], i) => (
                <div key={i} className="flex items-baseline justify-between gap-4 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="text-right font-mono text-[12.5px]">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {m.kind === "checks" && (
            <div className="flex flex-col gap-2">
              {(m as { entries: { label: string; passed: boolean }[] }).entries.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  {c.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-sm">{c.label.replace(/_/g, " ")}</span>
                  <Badge variant={c.passed ? "success" : "danger"} className="ml-auto">
                    {c.passed ? "通过" : "未通过"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          {m.kind === "code" && (
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-4 font-mono text-[12px] leading-relaxed text-muted-foreground">
              {(m as { text: string }).text}
            </pre>
          )}
          {m.kind === "text" && <p className="font-mono text-[13px]">{(m as { text: string }).text}</p>}
        </ModuleCard>
      ))}
      {rest.length === 0 && metrics.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4" /> 无结构化输出
        </div>
      )}
    </div>
  );
}

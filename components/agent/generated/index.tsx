'use client';

/**
 * 生成式 UI 白名单组件集（M3 component-kit）
 *
 * Agent 经 render_component client tool 请求动态渲染；这里提供：
 *   - componentDefs：7 个白名单组件的注册信息（id / 描述 / zod props schema）
 *   - GeneratedComponent：按 id 查表渲染（props 必须先经 schema 校验，禁止任意 JSX/eval）
 *
 * 图表（line-chart/bar-chart）经 next/dynamic(ssr:false) 拆包——recharts 不进首屏 bundle。
 */
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { z } from 'zod';
import { gsap } from 'gsap';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Play, Video, ListOrdered, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { getClientKernel } from '@/lib/kernel';
import type { ComponentDef } from '@/lib/kernel/plugins/component-kit';

// 图表实现整块拆包（含 recharts）
const LineChartGenerated = dynamic(() => import('./charts').then((m) => m.LineChartGenerated), { ssr: false });
const BarChartGenerated = dynamic(() => import('./charts').then((m) => m.BarChartGenerated), { ssr: false });
const AreaChartGenerated = dynamic(() => import('./charts').then((m) => m.AreaChartGenerated), { ssr: false });
const PieChartGenerated = dynamic(() => import('./charts').then((m) => m.PieChartGenerated), { ssr: false });
const RadarChartGenerated = dynamic(() => import('./charts').then((m) => m.RadarChartGenerated), { ssr: false });

// ── props schemas（chat 路由与前端校验共用同一形状约定）──────────────

const statCardProps = z.object({
  title: z.string().describe('指标名，如「TikTok 热度指数」'),
  value: z.union([z.string(), z.number()]).describe('指标值'),
  delta: z.string().optional().describe('变化幅度，如 +12.4% / -3.1%'),
  hint: z.string().optional().describe('补充说明（一行）'),
});

const chartPoint = z.object({ label: z.string(), value: z.number() });
const axisProps = {
  title: z.string().optional().describe('图表标题'),
  data: z.array(chartPoint).min(1).max(60).describe('数据点列，按 x 轴顺序'),
  seriesName: z.string().optional().describe('数值列名称（图例/提示）'),
};

const dataTableProps = z.object({
  title: z.string().optional(),
  columns: z.array(z.string()).min(1).max(8).describe('表头'),
  rows: z
    .array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).max(8))
    .max(50)
    .describe('数据行（与 columns 等长）'),
});

const formProps = z.object({
  title: z.string().optional(),
  submitLabel: z.string().optional().describe('提交按钮文案，默认「提交」'),
  fields: z
    .array(
      z.object({
        name: z.string().min(1),
        label: z.string().min(1),
        type: z.enum(['text', 'number', 'textarea', 'select']).optional(),
        placeholder: z.string().optional(),
        options: z.array(z.string()).optional().describe('type=select 时的选项'),
      }),
    )
    .min(1)
    .max(10),
});

const actionListProps = z.object({
  title: z.string().optional(),
  items: z
    .array(
      z.object({
        label: z.string(),
        description: z.string().optional(),
        actionId: z.string().optional().describe('点击后执行的 UI 动作 id（如 navigate）'),
        params: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .min(1)
    .max(10),
});

const progressProps = z.object({
  label: z.string().optional().describe('进度条标题（左侧）'),
  value: z.number().min(0).max(100).describe('进度值 0-100'),
  display: z.string().optional().describe('右侧展示文本，如「72 / 100」或「72%」；缺省显示 value%'),
});

const timelineProps = z.object({
  title: z.string().optional(),
  items: z
    .array(
      z.object({
        time: z.string().optional().describe('时间/阶段标签'),
        title: z.string().min(1),
        description: z.string().optional(),
      }),
    )
    .min(1)
    .max(12),
});

const tagListProps = z.object({
  title: z.string().optional(),
  tags: z.array(z.string()).min(1).max(30).describe('关键词/标签文本'),
  tone: z.enum(['default', 'primary', 'warning', 'success']).optional().describe('主题色调，默认 default'),
});

const calloutProps = z.object({
  tone: z.enum(['info', 'success', 'warning', 'danger']).describe('语义色调'),
  title: z.string().optional(),
  text: z.string().describe('正文（支持多行）'),
});

const videoScrollProps = z.object({
  title: z.string().optional().describe('视频区标题，如「竞品在投广告素材」'),
  videos: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string().optional().describe('视频标题/素材文案'),
        cover: z.string().describe('封面图 URL'),
        url: z.string().describe('视频直链 URL（mp4）'),
        durationS: z.number().optional().describe('时长（秒）'),
        brand: z.string().optional(),
        badge: z.string().optional().describe('角标文本，如「CTR 2.3%」或「点赞 12k」'),
      }),
    )
    .min(1)
    .max(30)
    .describe('视频列表（横向滑动浏览，点击卡片内联播放）'),
});

const questionProps = z.object({
  title: z.string().optional().describe('问题主题（如「选品方向确认」）'),
  text: z.string().describe('向用户提出的问题'),
  options: z
    .array(
      z.object({
        label: z.string(),
        value: z.string().optional().describe('选项值（默认取 label）'),
        hint: z.string().optional().describe('选项补充说明'),
      }),
    )
    .min(2)
    .max(6),
  multiple: z.boolean().optional().describe('是否多选，默认单选'),
  submitLabel: z.string().optional().describe('提交按钮文案，默认「回答」'),
});

const rankingProps = z.object({
  title: z.string().optional(),
  unit: z.string().optional().describe('数值单位，如「次」/「$」'),
  items: z
    .array(
      z.object({
        rank: z.number().optional().describe('名次（默认按数组顺序）'),
        label: z.string(),
        value: z.union([z.string(), z.number()]),
        delta: z.string().optional().describe('趋势，如 +12.4% / -3.1%'),
        hint: z.string().optional(),
      }),
    )
    .min(1)
    .max(20),
});

const compareProps = z.object({
  title: z.string().optional(),
  left: z.string().describe('左列名称'),
  right: z.string().describe('右列名称'),
  rows: z
    .array(
      z.object({
        label: z.string().describe('对比维度'),
        left: z.union([z.string(), z.number()]),
        right: z.union([z.string(), z.number()]),
        winner: z.enum(['left', 'right', 'tie']).optional().describe('该维度胜出方，高亮显示'),
      }),
    )
    .min(1)
    .max(12),
});

const metricGridProps = z.object({
  title: z.string().optional(),
  metrics: z
    .array(
      z.object({
        label: z.string(),
        value: z.union([z.string(), z.number()]),
        delta: z.string().optional(),
        // 宽容 tone：LLM 可能输出契约外的取值（如 'info'/'blue'），接收任意字符串
        // 并在渲染层兜底，避免整个组件因单个非法值校验失败而不渲染。
        tone: z.string().optional(),
      }),
    )
    .min(1)
    .max(8),
});

// ── 组件实现 ─────────────────────────────────────────────────────────

function StatCard({ title, value, delta, hint }: z.infer<typeof statCardProps>) {
  const up = delta?.trim().startsWith('+');
  const down = delta?.trim().startsWith('-');
  const Arrow = up ? ArrowUpRight : down ? ArrowDownRight : ArrowRight;
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-3">
      <div className="text-caption font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-xl font-bold tabular-nums text-foreground">{value}</span>
        {delta && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-caption font-semibold',
              up && 'text-success',
              down && 'text-destructive',
              !up && !down && 'text-muted-foreground',
            )}
          >
            <Arrow className="h-3 w-3" />
            {delta}
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-caption leading-relaxed text-muted-foreground">{hint}</div>}
    </div>
  );
}

function DataTable({ title, columns, rows }: z.infer<typeof dataTableProps>) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {title && <div className="border-b border-border bg-muted/60 px-3 py-1.5 text-caption font-semibold text-foreground">{title}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-caption">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              {columns.map((c) => (
                <th key={c} className="px-3 py-1.5 font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0">
                {columns.map((_, j) => (
                  <td key={j} className="whitespace-nowrap px-3 py-1.5 tabular-nums text-foreground/90">
                    {row[j] === null || row[j] === undefined ? '—' : String(row[j])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GeneratedForm({ title, submitLabel, fields }: z.infer<typeof formProps>) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  return (
    <form
      className="rounded-xl border border-border bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
    >
      {title && <div className="mb-2 text-caption font-semibold text-foreground">{title}</div>}
      <div className="space-y-2">
        {fields.map((f) => (
          <div key={f.name} className="space-y-1">
            <Label className="text-caption text-muted-foreground">{f.label}</Label>
            {f.type === 'textarea' ? (
              <Textarea
                className="min-h-16 text-xs"
                placeholder={f.placeholder}
                value={values[f.name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              />
            ) : f.type === 'select' ? (
              <select
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                value={values[f.name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              >
                <option value="">请选择…</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <Input
                type={f.type === 'number' ? 'number' : 'text'}
                className="h-8 text-xs"
                placeholder={f.placeholder}
                value={values[f.name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>
      <Button type="submit" size="sm" className="mt-2.5 h-7 text-caption">
        {submitted ? '已提交 ✓' : submitLabel ?? '提交'}
      </Button>
      {submitted && (
        <p className="mt-1.5 font-mono text-caption text-muted-foreground">
          {JSON.stringify(values).slice(0, 120)}
        </p>
      )}
    </form>
  );
}

function ActionList({ title, items }: z.infer<typeof actionListProps>) {
  return (
    <div className="rounded-xl border border-border bg-card p-2">
      {title && <div className="px-1.5 pb-1 pt-0.5 text-caption font-semibold text-foreground">{title}</div>}
      <ul className="space-y-0.5">
        {items.map((item, i) => (
          <li key={i}>
            <button
              type="button"
              className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted"
              onClick={() => {
                if (item.actionId) void getClientKernel().actions.runAction(item.actionId, item.params ?? {});
              }}
            >
              <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block text-xs font-medium text-foreground">{item.label}</span>
                {item.description && (
                  <span className="block text-caption leading-relaxed text-muted-foreground">{item.description}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const CALLOUT_TONES = {
  info: 'border-primary/40 bg-primary/5 text-primary',
  success: 'border-success/40 bg-success/5 text-success',
  warning: 'border-warning/40 bg-warning/5 text-warning',
  danger: 'border-destructive/40 bg-destructive/5 text-destructive',
} as const;

function ProgressBar({ label, value, display }: z.infer<typeof progressProps>) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-3">
      {(label || display) && (
        <div className="flex items-baseline justify-between gap-2">
          {label && <div className="text-caption font-medium text-foreground">{label}</div>}
          {display && <div className="font-mono text-caption tabular-nums text-muted-foreground">{display}</div>}
        </div>
      )}
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="mt-1 text-right font-mono text-tiny text-muted-foreground">{Math.round(clamped)}%</div>
    </div>
  );
}

function Timeline({ title, items }: z.infer<typeof timelineProps>) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      {title && <div className="mb-2 text-caption font-semibold text-foreground">{title}</div>}
      <ol className="relative space-y-3 border-l border-border pl-4">
        {items.map((item, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[21.5px] top-1 h-2 w-2 rounded-full border-2 border-card bg-primary" />
            <div className="flex flex-wrap items-baseline gap-x-2">
              {item.time && (
                <span className="font-mono text-tiny uppercase tracking-wide text-muted-foreground">{item.time}</span>
              )}
              <span className="text-xs font-semibold text-foreground">{item.title}</span>
            </div>
            {item.description && (
              <p className="mt-0.5 text-caption leading-relaxed text-muted-foreground">{item.description}</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

const TAG_TONES = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  warning: 'bg-warning/10 text-warning',
  success: 'bg-success/10 text-success',
} as const;

function TagList({ title, tags, tone = 'default' }: z.infer<typeof tagListProps>) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      {title && <div className="mb-2 text-caption font-semibold text-foreground">{title}</div>}
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium',
              TAG_TONES[tone],
            )}
          >
            #{t}
          </span>
        ))}
      </div>
    </div>
  );
}

function Callout({ tone, title, text }: z.infer<typeof calloutProps>) {
  return (
    <div className={cn('rounded-xl border px-3 py-2.5', CALLOUT_TONES[tone])}>
      {title && <div className="text-xs font-semibold">{title}</div>}
      <div className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">{text}</div>
    </div>
  );
}

/** 横向滑动视频墙：封面 + 播放按钮，点击卡片内联播放（preload=metadata），支持左右滑动多视频。 */
function VideoScroll({ title, videos }: z.infer<typeof videoScrollProps>) {
  const [playing, setPlaying] = useState<string | null>(null);
  return (
    <div className="rounded-xl border border-border bg-card p-2">
      {title && (
        <div className="flex items-center gap-1.5 px-1 pb-1.5 pt-0.5 text-caption font-semibold text-foreground">
          <Video className="h-3.5 w-3.5 text-primary" />
          {title}
          <span className="ml-auto font-mono text-tiny text-muted-foreground">{videos.length} 条</span>
        </div>
      )}
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
        {videos.map((v, i) => {
          const isPlaying = playing === (v.id ?? `${i}`);
          return (
            <div
              key={v.id ?? `${i}`}
              className="group w-44 shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-muted/40"
            >
              {isPlaying ? (
                <video
                  src={v.url}
                  poster={v.cover}
                  controls
                  autoPlay
                  className="aspect-[3/4] w-full bg-black object-cover"
                  onEnded={() => setPlaying(null)}
                />
              ) : (
                <button
                  type="button"
                  className="relative block aspect-[3/4] w-full overflow-hidden"
                  onClick={() => setPlaying(v.id ?? `${i}`)}
                  aria-label={`播放 ${v.title ?? `视频 ${i + 1}`}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.cover} alt={v.title ?? ''} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/40">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-primary shadow-md">
                      <Play className="ml-0.5 h-4 w-4 fill-current" />
                    </span>
                  </span>
                  {v.durationS != null && (
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 font-mono text-tiny text-white">
                      {Math.round(v.durationS)}s
                    </span>
                  )}
                  {v.badge && (
                    <span className="absolute left-1 top-1 rounded bg-primary/90 px-1.5 py-0.5 text-tiny font-semibold text-primary-foreground">
                      {v.badge}
                    </span>
                  )}
                </button>
              )}
              <div className="p-1.5">
                {v.brand && <div className="truncate text-tiny font-semibold text-primary">{v.brand}</div>}
                <div className="line-clamp-2 text-tiny leading-snug text-muted-foreground">{v.title}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Agent 向人类提问并提供选项：单选/多选，提交后答案作为下一条用户消息回传给 Agent 继续。 */
function Question({
  title,
  text,
  options,
  multiple = false,
  submitLabel,
  onAnswer,
}: z.infer<typeof questionProps> & { onAnswer?: (answer: string) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (value: string) => {
    setSelected((prev) =>
      multiple
        ? prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
        : prev[0] === value ? [] : [value],
    );
  };
  const submit = () => {
    if (selected.length === 0 || !onAnswer) return;
    const answer = selected.join('、');
    onAnswer(answer);
    setSelected([]);
  };
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
      {title && <div className="text-tiny font-semibold uppercase tracking-wide text-primary">{title}</div>}
      <div className="mt-1 text-xs font-semibold leading-relaxed text-foreground">{text}</div>
      <div className="mt-2.5 flex flex-col gap-1.5">
        {options.map((o) => {
          const value = o.value ?? o.label;
          const on = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggle(value)}
              className={cn(
                'flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors',
                on ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-card text-foreground hover:border-primary/50',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border',
                  on && 'border-primary bg-primary text-primary-foreground',
                )}
              >
                {on && <span className="text-[9px] font-bold leading-none">✓</span>}
              </span>
              <span className="min-w-0">
                <span className="block font-medium">{o.label}</span>
                {o.hint && <span className="block text-caption text-muted-foreground">{o.hint}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <Button size="sm" className="mt-2.5 h-7 w-full text-caption" disabled={selected.length === 0} onClick={submit}>
        {submitLabel ?? (multiple ? '提交选择' : '回答')}
      </Button>
    </div>
  );
}

/** 排行榜：名次 + 名称 + 数值 + 趋势箭头（适合热搜词/销量榜/达人榜）。 */
function Ranking({ title, unit, items }: z.infer<typeof rankingProps>) {
  const medal = ['text-amber-500', 'text-slate-400', 'text-amber-700'];
  return (
    <div className="rounded-xl border border-border bg-card p-2">
      {title && <div className="px-1.5 pb-1 pt-0.5 text-caption font-semibold text-foreground">{title}</div>}
      <ol className="space-y-0.5">
        {items.map((it, i) => {
          const rank = it.rank ?? i + 1;
          const up = it.delta?.trim().startsWith('+');
          const down = it.delta?.trim().startsWith('-');
          return (
            <li key={`${rank}-${it.label}`} className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-muted/60">
              <span className={cn('w-5 shrink-0 text-center font-mono text-caption font-bold', medal[i] ?? 'text-muted-foreground')}>
                {rank}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-foreground">{it.label}</span>
              <span className="shrink-0 font-mono text-caption font-semibold tabular-nums text-foreground">
                {it.value}{unit ?? ''}
              </span>
              {it.delta && (
                <span className={cn('flex shrink-0 items-center gap-0.5 text-caption font-semibold', up && 'text-success', down && 'text-destructive')}>
                  {up ? <ArrowUpRight className="h-3 w-3" /> : down ? <ArrowDownRight className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                  {it.delta}
                </span>
              )}
              {it.hint && <span className="hidden shrink-0 text-tiny text-muted-foreground sm:block">{it.hint}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** 左右对比卡：多维度 A vs B，可标记每维胜出方。 */
function Compare({ title, left, right, rows }: z.infer<typeof compareProps>) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {title && <div className="border-b border-border bg-muted/60 px-3 py-1.5 text-caption font-semibold text-foreground">{title}</div>}
      <table className="w-full text-caption">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-2 py-1.5 font-medium">维度</th>
            <th className="px-2 py-1.5 text-right font-semibold text-foreground">{left}</th>
            <th className="px-2 py-1.5 text-right font-semibold text-foreground">{right}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border/60 last:border-0">
              <td className="px-2 py-1.5 text-muted-foreground">{r.label}</td>
              <td className={cn('px-2 py-1.5 text-right font-mono tabular-nums', r.winner === 'left' ? 'font-bold text-primary' : 'text-foreground/90')}>
                {r.left}
              </td>
              <td className={cn('px-2 py-1.5 text-right font-mono tabular-nums', r.winner === 'right' ? 'font-bold text-primary' : 'text-foreground/90')}>
                {r.right}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 指标网格：多个 stat-card 的紧凑组合（一排 2 个）。 */
function MetricGrid({ title, metrics }: z.infer<typeof metricGridProps>) {
  const tones = {
    default: 'text-foreground',
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-destructive',
  } as const;
  return (
    <div className="rounded-xl border border-border bg-card p-2">
      {title && <div className="px-1 pb-1.5 pt-0.5 text-caption font-semibold text-foreground">{title}</div>}
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m) => {
          const up = m.delta?.trim().startsWith('+');
          const down = m.delta?.trim().startsWith('-');
          return (
            <div key={m.label} className="rounded-lg border border-border/70 bg-muted/30 px-2.5 py-2">
              <div className="text-caption text-muted-foreground">{m.label}</div>
              <div className={cn('mt-0.5 text-lg font-bold tabular-nums leading-none', tones[m.tone as keyof typeof tones] ?? 'text-foreground')}>{m.value}</div>
              {m.delta && (
                <div className={cn('mt-0.5 flex items-center gap-0.5 text-caption font-semibold', up && 'text-success', down && 'text-destructive')}>
                  {up ? <ArrowUpRight className="h-3 w-3" /> : down ? <ArrowDownRight className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                  {m.delta}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 注册表 + 渲染入口 ───────────────────────────────────────────────

export const componentDefs: ComponentDef[] = [
  {
    id: 'stat-card',
    description: '单指标卡片：指标名 + 数值 + 涨跌 delta + 补充说明',
    propsSchema: statCardProps,
    render: (props) => <StatCard {...(props as z.infer<typeof statCardProps>)} />,
  },
  {
    id: 'line-chart',
    description: '折线图：data=[{label,value}] 展示趋势走向',
    propsSchema: z.object(axisProps),
    render: (props) => <ChartBlock kind="line" {...chartProps(props)} />,
  },
  {
    id: 'bar-chart',
    description: '柱状图：data=[{label,value}] 展示对比',
    propsSchema: z.object(axisProps),
    render: (props) => <ChartBlock kind="bar" {...chartProps(props)} />,
  },
  {
    id: 'area-chart',
    description: '面积图：data=[{label,value}] 强调累计量与趋势（折线下带渐变填充）',
    propsSchema: z.object(axisProps),
    render: (props) => <ChartBlock kind="area" {...chartProps(props)} />,
  },
  {
    id: 'pie-chart',
    description: '环形饼图：data=[{label,value}] 展示占比构成（份额/来源/分类占比）',
    propsSchema: z.object(axisProps),
    render: (props) => <ChartBlock kind="pie" {...chartProps(props)} />,
  },
  {
    id: 'radar-chart',
    description: '雷达图：data=[{label,value}] 展示多维度横向对比（如多个竞品在若干指标上的强弱）',
    propsSchema: z.object(axisProps),
    render: (props) => <ChartBlock kind="radar" {...chartProps(props)} />,
  },
  {
    id: 'data-table',
    description: '数据表格：columns 表头 + rows 行',
    propsSchema: dataTableProps,
    render: (props) => <DataTable {...(props as z.infer<typeof dataTableProps>)} />,
  },
  {
    id: 'progress',
    description: '进度条：label + value(0-100) + 右侧 display 文本',
    propsSchema: progressProps,
    render: (props) => <ProgressBar {...(props as z.infer<typeof progressProps>)} />,
  },
  {
    id: 'timeline',
    description: '时间线：items=[{time?,title,description?}] 展示阶段/步骤/事件序列',
    propsSchema: timelineProps,
    render: (props) => <Timeline {...(props as z.infer<typeof timelineProps>)} />,
  },
  {
    id: 'tag-list',
    description: '关键词标签：tags=[string] 展示趋势词/品类词/卖点标签（常与 line/bar/pie 图搭配）',
    propsSchema: tagListProps,
    render: (props) => <TagList {...(props as z.infer<typeof tagListProps>)} />,
  },
  {
    id: 'form',
    description: '轻量表单：fields 字段定义，提交后在卡片内回显值',
    propsSchema: formProps,
    render: (props) => <GeneratedForm {...(props as z.infer<typeof formProps>)} />,
  },
  {
    id: 'action-list',
    description: '可点击动作列表：每项可携带 actionId 触发已注册 UI 动作',
    propsSchema: actionListProps,
    render: (props) => <ActionList {...(props as z.infer<typeof actionListProps>)} />,
  },
  {
    id: 'callout',
    description: '语义提示块：info/success/warning/danger 四色',
    propsSchema: calloutProps,
    render: (props) => <Callout {...(props as z.infer<typeof calloutProps>)} />,
  },
  {
    id: 'video-scroll',
    description: '横向滑动视频墙：多段竞品广告/素材视频，点封面内联播放（封面+标题+时长+角标）',
    propsSchema: videoScrollProps,
    render: (props) => <VideoScroll {...(props as z.infer<typeof videoScrollProps>)} />,
  },
  {
    id: 'question',
    description: '向人类提问并给出选项：单选/多选，提交后答案作为下一条用户消息回传给 Agent 继续决策（人在环中）',
    propsSchema: questionProps,
    render: (props, ctx) => <Question {...(props as z.infer<typeof questionProps>)} onAnswer={ctx?.onInteract} />,
  },
  {
    id: 'ranking',
    description: '排行榜：名次+名称+数值+趋势箭头（热搜词/销量榜/达人榜等）',
    propsSchema: rankingProps,
    render: (props) => <Ranking {...(props as z.infer<typeof rankingProps>)} />,
  },
  {
    id: 'compare',
    description: '左右对比卡：多维度 A vs B，可标记每维胜出方（方案对比/竞品对比/地区对比）',
    propsSchema: compareProps,
    render: (props) => <Compare {...(props as z.infer<typeof compareProps>)} />,
  },
  {
    id: 'metric-grid',
    description: '指标网格：多个关键数字指标紧凑组合（一排两个，含趋势）',
    propsSchema: metricGridProps,
    render: (props) => <MetricGrid {...(props as z.infer<typeof metricGridProps>)} />,
  },
];

/** 图表 props 转换：schema 用 data，charts.tsx 用 points（避免与 recharts 命名冲突） */
function chartProps(props: Record<string, unknown>): Omit<ChartBlockProps, 'kind'> {
  return {
    title: typeof props.title === 'string' ? props.title : undefined,
    points: Array.isArray(props.data) ? (props.data as { label: string; value: number }[]) : [],
    seriesName: typeof props.seriesName === 'string' ? props.seriesName : undefined,
  };
}

interface ChartBlockProps {
  kind: 'line' | 'bar' | 'area' | 'pie' | 'radar';
  title?: string;
  points: { label: string; value: number }[];
  seriesName?: string;
}

/** 图表壳：标题 + 拆包加载的 recharts 实现 */
function ChartBlock({ kind, title, points, seriesName }: ChartBlockProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-2">
      {title && <div className="px-1 pb-1 pt-0.5 text-caption font-semibold text-foreground">{title}</div>}
      {kind === 'line' ? (
        <LineChartGenerated points={points} seriesName={seriesName} />
      ) : kind === 'bar' ? (
        <BarChartGenerated points={points} seriesName={seriesName} />
      ) : kind === 'area' ? (
        <AreaChartGenerated points={points} seriesName={seriesName} />
      ) : kind === 'pie' ? (
        <PieChartGenerated points={points} seriesName={seriesName} />
      ) : (
        <RadarChartGenerated points={points} />
      )}
    </div>
  );
}

/**
 * 白名单动态组件渲染入口（抽屉消息流/页面插槽共用）。
 * props 必须已通过对应 schema 校验（校验在 onToolCall 处统一做）。
 */
export function GeneratedComponent({
  id,
  props,
  onInteract,
}: {
  id: string;
  props: Record<string, unknown>;
  onInteract?: (answer: unknown) => void;
}) {
  const def = componentDefs.find((d) => d.id === id);
  const boxRef = useRef<HTMLDivElement>(null);
  const animatedRef = useRef(false);
  // GSAP 灵动出现：缩放 + 上浮 + 淡入（一次，组件重挂载才重播）
  useEffect(() => {
    if (!boxRef.current || animatedRef.current) return;
    animatedRef.current = true;
    gsap.fromTo(
      boxRef.current,
      { opacity: 0, y: 10, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: 'power2.out' },
    );
  }, []);
  if (!def) {
    return <p className="text-xs text-destructive">未注册的白名单组件：{id}</p>;
  }
  return (
    <div ref={boxRef} className="mt-1 max-w-[96%]">
      {def.render(props, { onInteract })}
    </div>
  );
}

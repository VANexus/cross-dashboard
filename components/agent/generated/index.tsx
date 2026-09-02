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
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { z } from 'zod';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
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

const calloutProps = z.object({
  tone: z.enum(['info', 'success', 'warning', 'danger']).describe('语义色调'),
  title: z.string().optional(),
  text: z.string().describe('正文（支持多行）'),
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

function Callout({ tone, title, text }: z.infer<typeof calloutProps>) {
  return (
    <div className={cn('rounded-xl border px-3 py-2.5', CALLOUT_TONES[tone])}>
      {title && <div className="text-xs font-semibold">{title}</div>}
      <div className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">{text}</div>
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
    id: 'data-table',
    description: '数据表格：columns 表头 + rows 行',
    propsSchema: dataTableProps,
    render: (props) => <DataTable {...(props as z.infer<typeof dataTableProps>)} />,
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
  kind: 'line' | 'bar';
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
      ) : (
        <BarChartGenerated points={points} seriesName={seriesName} />
      )}
    </div>
  );
}

/**
 * 白名单动态组件渲染入口（抽屉消息流/页面插槽共用）。
 * props 必须已通过对应 schema 校验（校验在 onToolCall 处统一做）。
 */
export function GeneratedComponent({ id, props }: { id: string; props: Record<string, unknown> }) {
  const def = componentDefs.find((d) => d.id === id);
  if (!def) {
    return <p className="text-xs text-destructive">未注册的白名单组件：{id}</p>;
  }
  return <div className="mt-1 max-w-[96%]">{def.render(props)}</div>;
}

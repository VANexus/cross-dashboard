'use client';

/**
 * 生成式 UI 白名单图表组件（M3 component-kit）
 *
 * recharts 经 ChartContainer（shadcn chart 封装）渲染折线/柱状图。
 * 本文件被 index.tsx 以 next/dynamic(ssr:false) 拆包加载——recharts 不进首屏 bundle。
 */
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

/** 共享数据形状：[{ label, value }]（zod schema 见 ../registry） */
export interface ChartPoint {
  label: string;
  value: number;
}

const chartConfig = {
  value: { label: 'value', color: 'var(--chart-1)' },
} satisfies ChartConfig;

/** 饼图切片色板（对齐 CSS chart-N 变量） */
const SLICE_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
];

function toData(points: ChartPoint[], seriesName?: string) {
  return points.map((p) => ({ label: p.label, value: p.value, seriesName: seriesName ?? 'value' }));
}

export function LineChartGenerated({ points, seriesName }: { points: ChartPoint[]; seriesName?: string }) {
  const data = toData(points, seriesName);
  return (
    <ChartContainer config={chartConfig} className="h-44 w-full">
      <LineChart data={data} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} width={44} />
        <ChartTooltip content={<ChartTooltipContent labelKey="label" nameKey="seriesName" />} />
        <ChartLegend content={<ChartLegendContent nameKey="seriesName" />} />
        <Line dataKey="value" name={seriesName ?? 'value'} type="monotone" strokeWidth={2} dot={false} stroke="var(--color-value)" />
      </LineChart>
    </ChartContainer>
  );
}

export function BarChartGenerated({ points, seriesName }: { points: ChartPoint[]; seriesName?: string }) {
  const data = toData(points, seriesName);
  return (
    <ChartContainer config={chartConfig} className="h-44 w-full">
      <BarChart data={data} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} width={44} />
        <ChartTooltip content={<ChartTooltipContent labelKey="label" nameKey="seriesName" />} />
        <ChartLegend content={<ChartLegendContent nameKey="seriesName" />} />
        <Bar dataKey="value" name={seriesName ?? 'value'} fill="var(--color-value)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

export function AreaChartGenerated({ points, seriesName }: { points: ChartPoint[]; seriesName?: string }) {
  const data = toData(points, seriesName);
  return (
    <ChartContainer config={chartConfig} className="h-44 w-full">
      <AreaChart data={data} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="flow-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} width={44} />
        <ChartTooltip content={<ChartTooltipContent labelKey="label" nameKey="seriesName" />} />
        <ChartLegend content={<ChartLegendContent nameKey="seriesName" />} />
        <Area
          dataKey="value"
          name={seriesName ?? 'value'}
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={2}
          fill="url(#flow-area-fill)"
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function PieChartGenerated({ points, seriesName }: { points: ChartPoint[]; seriesName?: string }) {
  const data = toData(points, seriesName);
  return (
    <ChartContainer config={chartConfig} className="h-48 w-full">
      <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <ChartTooltip content={<ChartTooltipContent labelKey="label" nameKey="seriesName" />} />
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius={42}
          outerRadius={66}
          paddingAngle={2}
          strokeWidth={2}
        >
          {data.map((d, i) => (
            <Cell key={d.label} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="label" className="justify-center" />} />
      </PieChart>
    </ChartContainer>
  );
}

export function RadarChartGenerated({ points }: { points: ChartPoint[] }) {
  const data = points.map((p) => ({ subject: p.label, A: p.value }));
  return (
    <ChartContainer config={chartConfig} className="h-48 w-full">
      <RadarChart data={data} outerRadius="62%">
        <PolarGrid />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="line" labelKey="subject" nameKey="seriesName" />}
        />
        <Radar name="value" dataKey="A" stroke="var(--color-value)" fill="var(--color-value)" fillOpacity={0.32} />
      </RadarChart>
    </ChartContainer>
  );
}

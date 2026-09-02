'use client';

/**
 * 生成式 UI 白名单图表组件（M3 component-kit）
 *
 * recharts 经 ChartContainer（shadcn chart 封装）渲染折线/柱状图。
 * 本文件被 index.tsx 以 next/dynamic(ssr:false) 拆包加载——recharts 不进首屏 bundle。
 */
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
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

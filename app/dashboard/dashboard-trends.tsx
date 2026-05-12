"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

const AnimatedNumber = dynamic(
  () => import("@/components/ui/animated-number").then((m) => ({ default: m.AnimatedNumber })),
  { ssr: false }
);

const Sparkline = dynamic(
  () => import("@/components/ui/sparkline").then((m) => ({ default: m.Sparkline })),
  { ssr: false }
);

interface DashboardTrendsProps {
  trends: {
    sales: number[];
    acos: number[];
    conversion: number[];
  };
}

function calcChange(data: number[]) {
  if (data.length < 2) return 0;
  return Math.round(((data[data.length - 1] - data[0]) / data[0]) * 100);
}

export function DashboardTrends({ trends }: DashboardTrendsProps) {
  const { sales, acos, conversion } = trends;
  const salesChange = calcChange(sales);
  const acosChange = calcChange(acos);
  const conversionChange = calcChange(conversion);

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">近7天销售额</CardTitle>
            <TrendingUp className="h-3 w-3 text-emerald-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <AnimatedNumber value={sales[sales.length - 1] || 0} prefix="$" className="text-2xl font-bold" />
            <Sparkline data={sales} width={100} height={32} color="var(--success)" />
          </div>
          <p className="text-[11px] text-emerald-500 mt-1">
            {salesChange >= 0 ? "↑" : "↓"} {Math.abs(salesChange)}% vs 上周
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">平均 ACOS</CardTitle>
            <TrendingUp className="h-3 w-3 text-emerald-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <AnimatedNumber value={acos[acos.length - 1] || 0} suffix="%" className="text-2xl font-bold" />
            <Sparkline data={acos} width={100} height={32} color="var(--primary)" />
          </div>
          <p className="text-[11px] text-emerald-500 mt-1">
            ↓ {Math.abs(acosChange)}% vs 上月
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">转化率</CardTitle>
            <TrendingUp className="h-3 w-3 text-emerald-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <AnimatedNumber value={conversion[conversion.length - 1] || 0} suffix="%" decimals={1} className="text-2xl font-bold" />
            <Sparkline data={conversion} width={100} height={32} color="var(--info)" />
          </div>
          <p className="text-[11px] text-emerald-500 mt-1">
            {conversionChange >= 0 ? "↑" : "↓"} {Math.abs(conversionChange)}% vs 上月
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

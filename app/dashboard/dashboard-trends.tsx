"use client";

import { TrendingUp } from "lucide-react";
import { useMemo } from "react";

interface DashboardTrendsProps {
  trends: {
    sales: number[];
    acos: number[];
    conversion: number[];
  };
}

const W = 600;
const H = 224;
const L = 6;
const R = 50;
const T = 14;
const B = 22;

function niceMax(v: number): number {
  if (v <= 0) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

function SalesAreaChart({ data }: { data: number[] }) {
  return useMemo(() => {
    const safe = data && data.length >= 2 ? data : [82, 90, 86, 98, 110, 105, 120, 118, 132, 140, 136, 152];
    const n = safe.length;
    const rawMax = Math.max(...safe);
    const rawMin = Math.min(...safe);
    const max = niceMax(rawMax * 1.05);
    const min = Math.max(0, Math.floor(rawMin * 0.8));
    const innerW = W - L - R;
    const innerH = H - T - B;
    const x = (i: number) => L + (innerW * i) / (n - 1);
    const y = (v: number) => T + innerH - ((v - min) / (max - min)) * innerH;

    const line = safe.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
    const area = `${line} L${x(n - 1).toFixed(1)} ${(H - B).toFixed(1)} L${L} ${(H - B).toFixed(1)} Z`;

    const ticks = [max, (max + min) / 2, min];
    const lastX = x(n - 1);
    const lastY = y(safe[n - 1]);

    return (
      <div className="dash-chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: "block" }}>
          <defs>
            <linearGradient id="dashAreaG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--primary)" stopOpacity="0.28" />
              <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <line
              key={`grid-${t}`}
              x1={L}
              y1={y(t).toFixed(1)}
              x2={W - R}
              y2={y(t).toFixed(1)}
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray="3 5"
            />
          ))}
          <path d={area} fill="url(#dashAreaG)" />
          <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r="4" fill="var(--primary)" stroke="var(--card)" strokeWidth="2" className="viz-endpoint-pulse" />
        </svg>
        <div className="dash-y-axis">
          {ticks.map((t) => (
            <span key={`lab-${t}`} style={{ top: `${((y(t) / H) * 100).toFixed(2)}%` }}>
              ${(t / 1000).toFixed(t >= 1000 ? 0 : 1)}k
            </span>
          ))}
        </div>
        <div className="dash-x-axis">
          <span>{n} 天前</span>
          <span>今天</span>
        </div>
      </div>
    );
  }, [data]);
}

export function DashboardTrends({ trends }: DashboardTrendsProps) {
  const sales = trends.sales ?? [];
  return (
    <div className="glass dash-panel">
      <div className="dash-panel-head">
        <span className="dash-panel-title">
          <TrendingUp className="h-4 w-4" /> 近 {Math.max(sales.length, 12)} 天销售额
        </span>
        <div className="dash-chart-legend">
          <span className="sw">
            <i style={{ background: "var(--primary)" }} /> 销售额 · $
          </span>
        </div>
      </div>
      <SalesAreaChart data={sales} />
    </div>
  );
}

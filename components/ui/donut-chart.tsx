"use client";

import { useEffect, useState } from "react";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  centerValue?: string;
  centerLabel?: string;
  size?: number;
  thickness?: number;
}

/** 轻量 SVG 环形图：填充编码 + 入场描边动画 */
export function DonutChart({ data, centerValue, centerLabel, size = 148, thickness = 14 }: DonutChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const total = data.reduce((acc, d) => acc + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  const { slices } = data.reduce<{
    slices: Array<DonutSlice & { len: number; dashOffset: number }>;
    offset: number;
  }>(
    (acc, d) => {
      const ratio = d.value / total;
      const len = Math.max(0, ratio * c - 2);
      return {
        slices: [...acc.slices, { ...d, len, dashOffset: -acc.offset }],
        offset: acc.offset + ratio * c,
      };
    },
    { slices: [], offset: 0 }
  );

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {slices.map((s, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={`${mounted ? s.len : 0} ${c}`}
            strokeDashoffset={s.dashOffset}
            strokeLinecap="round"
            className="transition-[stroke-dasharray] duration-1000 ease-out"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {centerValue != null && (
          <span className="font-heading text-2xl font-bold leading-none tracking-tight">{centerValue}</span>
        )}
        {centerLabel && (
          <span className="mt-1 font-mono text-[10px] text-muted-foreground">{centerLabel}</span>
        )}
      </div>
    </div>
  );
}

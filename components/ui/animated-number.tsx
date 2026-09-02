"use client";

// KPI 数字滚动 — number-flow（Vercel 风格，零依赖、无障碍、tabular-nums 内建）。
// 保留既有 AnimatedNumber 接口，内部由手搓 rAF count-up 换为 number-flow。
import NumberFlow from "@number-flow/react";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  /** 兼容旧签名（number-flow 自带 spring 动效），无实际作用 */
  duration?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
}: AnimatedNumberProps) {
  return (
    <NumberFlow
      value={value}
      prefix={prefix}
      suffix={suffix}
      format={
        decimals > 0
          ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
          : undefined
      }
      transformTiming={{ duration: 600, easing: "cubic-bezier(0.25, 1, 0.5, 1)" }}
      willChange
      className={cn("metric-value tabular-nums", className)}
    />
  );
}

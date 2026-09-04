"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * 仪表盘入场动效：
 * - KPI 卡片依次上滑淡入
 * - 面板 stagger 上浮
 * - 仅首次 mount 播放一次
 */
export function DashboardEntryAnim() {
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    if (hasPlayedRef.current) return;
    hasPlayedRef.current = true;

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // 1. KPI 卡片 — 从下方 12px 滑入 + 淡入
    const kpiCards = document.querySelectorAll(".dash-kpi");
    if (kpiCards.length) {
      tl.from(kpiCards, {
        y: 14,
        opacity: 0,
        duration: 0.5,
        stagger: 0.08,
      }, 0.05);
    }

    // 2. 面板 — 稍晚一点，更慢的 stagger
    const panels = document.querySelectorAll('[data-animate="panel"]');
    if (panels.length) {
      tl.from(panels, {
        y: 18,
        opacity: 0,
        duration: 0.55,
        stagger: 0.07,
      }, 0.12);
    }

    return () => {
      tl.kill();
    };
  }, []);

  return null;
}

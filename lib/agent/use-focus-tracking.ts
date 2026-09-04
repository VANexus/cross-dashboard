// lib/agent/use-focus-tracking.ts
'use client';
// 追焦船台的侦测端：对 main#app-main 内带 data-agent-context / data-agent-action 的元素
// 做一个单 IntersectionObserver 的「可见份额投票」，选出份额最高(≥0.35)者为当前焦点模块，
// 写入 presence.focus。路由变化时重建观察；滚动时仅 rAF 节流刷新焦点元素 rect（船台平滑跟随）。
// 业务侧零侵入：只需在关键模块容器加 data-agent-context / data-agent-action，无需引本 hook。
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { usePresence, type FocusTarget } from '@/stores/agent-presence';

const OBS_LIMIT = 64; // 观测上限护栏：防止超大表格/长列表吞性能
const MIN_SHARE = 0.35; // 可见份额达标才认为「聚焦」

export function useFocusTracking(): void {
  const setFocus = usePresence((s) => s.setFocus);
  const clearFocus = usePresence((s) => s.clearFocus);
  const pathname = usePathname();
  const sharesRef = useRef<Map<Element, number>>(new Map());
  const ioRef = useRef<IntersectionObserver | null>(null);
  const scheduleRef = useRef<number | null>(null);
  const activeElRef = useRef<Element | null>(null);
  const rectTickRef = useRef(0);

  useEffect(() => {
    clearFocus();
    activeElRef.current = null;
    sharesRef.current.clear();
    ioRef.current?.disconnect();
    if (scheduleRef.current) window.clearTimeout(scheduleRef.current);

    const main = document.querySelector('main#app-main');
    if (!main || typeof IntersectionObserver === 'undefined') return;
    const targets = Array.from(
      main.querySelectorAll<HTMLElement>('[data-agent-context],[data-agent-action]'),
    ).slice(0, OBS_LIMIT);

    const emit = () => {
      scheduleRef.current = null;
      // 用同步 for...of 而非 forEach(回调)：回调内给外层 best 赋值不参与窄化，
      // for...of 在同一作用域内，判空后可正常收窄为非 null Element。
      let best: Element | null = null;
      let bestShare = 0;
      for (const [el, share] of sharesRef.current) {
        if (share >= MIN_SHARE && share > bestShare) {
          best = el;
          bestShare = share;
        }
      }
      if (!best) {
        activeElRef.current = null;
        clearFocus();
        return;
      }
      activeElRef.current = best;
      const module = best.getAttribute('data-agent-context') ?? '';
      const action = best.getAttribute('data-agent-action') ?? undefined;
      const label = module || action || '当前模块';
      const r = best.getBoundingClientRect();
      setFocus({
        module: module || label,
        label,
        annotatedAction: action,
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      } satisfies FocusTarget);
    };
    const schedule = () => {
      if (scheduleRef.current) window.clearTimeout(scheduleRef.current);
      scheduleRef.current = window.setTimeout(emit, 120); // 批量回调 + debounce，防每帧 setState
    };

    const io = new IntersectionObserver(
      (batches) => {
        for (const b of batches) {
          sharesRef.current.set(b.target, Math.max(0, Math.min(1, b.intersectionRatio)));
        }
        schedule();
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    targets.forEach((t) => io.observe(t));
    ioRef.current = io;

    // 滚动只刷新当前焦点元素 rect（rAF 节流），不重算 winner，避免 layout thrash + 高频 setState
    const onScroll = () => {
      if (rectTickRef.current) return;
      rectTickRef.current = window.requestAnimationFrame(() => {
        rectTickRef.current = 0;
        const el = activeElRef.current;
        if (!el) return;
        const prev = usePresence.getState().focus;
        if (!prev) return;
        const r = el.getBoundingClientRect();
        setFocus({ ...prev, rect: { x: r.x, y: r.y, w: r.width, h: r.height } });
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      io.disconnect();
      ioRef.current = null;
      if (scheduleRef.current) window.clearTimeout(scheduleRef.current);
      window.removeEventListener('scroll', onScroll);
      clearFocus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
}
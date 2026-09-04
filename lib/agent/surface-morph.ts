// lib/agent/surface-morph.ts
// 三面一体（dock ⇄ sidebar ⇄ stage）状态交换的 GSAP 形变基建：
// - rememberDockRect / takeDockRect：灵动岛被点击时记下自己的屏幕矩形，
//   抽屉打开瞬间的 FLIP 幽灵从「岛的原位」生长成面板——观感上岛就是面板的种子。
// - islandAnchorRect：收起方向的目标锚（底部居中，岛回归点）。
// - morphGhost：驱动共享幽灵矩形（无内容纯色圆角块，缩放不扭曲内容）完成
//   「岛 → 面板 / 面板 → 岛」的连续补间；抽屉本体只做淡入/淡出跟随。
// 幽灵是纯装饰（pointer-events-none），无障碍不受影响。
import { gsap } from 'gsap';

export interface MorphRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

let dockRect: MorphRect | null = null;
let dockRectAt = 0;
const DOCK_RECT_TTL = 2500; // ms：只有新鲜的岛矩形才作为形变原点

/** 灵动岛（或任意触发面）记录自己的屏幕矩形，供随后的面板展开做 FLIP 原点。 */
export function rememberDockRect(el: HTMLElement | null): void {
  if (!el || typeof el.getBoundingClientRect !== 'function') return;
  const r = el.getBoundingClientRect();
  dockRect = { left: r.left, top: r.top, width: r.width, height: r.height };
  dockRectAt = Date.now();
}

/** 取走（一次性消费）新鲜的岛矩形；过期/缺失返回 null，调用方回退为普通滑入。 */
export function takeDockRect(): MorphRect | null {
  if (!dockRect || Date.now() - dockRectAt > DOCK_RECT_TTL) {
    dockRect = null;
    return null;
  }
  const r = dockRect;
  dockRect = null;
  return r;
}

/** 岛回归锚点：底部居中的近似位置（收起时面板向该点收缩、岛随后弹出）。 */
export function islandAnchorRect(): MorphRect {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  return { left: vw / 2 - 90, top: vh - 68, width: 180, height: 36 };
}

/** 把幽灵从 fromRect 补间到 toRect。
 *  幽灵始终摆放在 toRect（面板矩形），transformOrigin 钉在 fromRect（岛）的中心：
 *  绕岛中心纯缩放 → 起止视觉矩形与「岛矩形 ⇄ 面板矩形」精确吻合（不需要位移分量）。
 *  forward = 展开（岛 → 面板，expo.out 弹性生长）；
 *  reverse = 收起（面板 → 岛，power3.inOut 收拢），结束时 onComplete 收尾。 */
export function morphGhost(
  ghost: HTMLElement,
  fromRect: MorphRect,
  toRect: MorphRect,
  opts: { reverse?: boolean; onComplete?: () => void } = {},
): void {
  const { reverse = false, onComplete } = opts;
  // 岛中心在面板坐标系里的百分比原点（可为负/超 100：岛在面板左侧时原点悬于面板外，合法）
  const ox = ((fromRect.left + fromRect.width / 2) - toRect.left) / toRect.width;
  const oy = ((fromRect.top + fromRect.height / 2) - toRect.top) / toRect.height;
  const sx = Math.max(0.02, fromRect.width / toRect.width);
  const sy = Math.max(0.02, fromRect.height / toRect.height);
  gsap.set(ghost, { transformOrigin: `${ox * 100}% ${oy * 100}%`, x: 0, y: 0 });
  if (reverse) {
    // 收起：从面板矩形缩回岛矩形，中途即淡出（岛本体随后弹出接力）
    gsap
      .timeline({ onComplete })
      .fromTo(
        ghost,
        { scaleX: 1, scaleY: 1, opacity: 0 },
        { opacity: 1, duration: 0.12, ease: 'power1.out' },
      )
      .to(ghost, {
        scaleX: sx,
        scaleY: sy,
        opacity: 0,
        borderRadius: 999,
        duration: 0.4,
        ease: 'power3.inOut',
      });
  } else {
    // 展开：岛矩形长成面板矩形，尾段淡出让位给真实面板
    gsap
      .timeline({ onComplete })
      .fromTo(
        ghost,
        { scaleX: sx, scaleY: sy, opacity: 1, borderRadius: 999 },
        {
          scaleX: 1,
          scaleY: 1,
          borderRadius: 12,
          duration: 0.55,
          ease: 'expo.out',
        },
      )
      .to(ghost, { opacity: 0, duration: 0.18, ease: 'power1.out' }, '-=0.18');
  }
}

/**
 * FlowMind — 技能领域配色
 *
 * 领域色 key → 静态 Tailwind 类（字面量，保证 Tailwind JIT 能扫描到）。
 * chip 用于图标底/文字，bar 用于进度条/状态点。
 */

/** 领域色 key → 前缀（配合 Tailwind `text-*` / `bg-*` 类） */
export const DOMAIN_TO_WF: Record<string, string> = {
  product: "wf-product",
  imaging: "wf-imaging",
  ad: "wf-ad",
  listing: "wf-listing",
  inventory: "wf-inventory",
  competitor: "wf-competitor",
  localize: "wf-localize",
};

export interface DomainStyle {
  chip: string;
  bar: string;
}

export const DOMAIN_STYLE: Record<string, DomainStyle> = {
  product: { chip: "bg-wf-product/15 text-wf-product", bar: "bg-wf-product" },
  imaging: { chip: "bg-wf-imaging/15 text-wf-imaging", bar: "bg-wf-imaging" },
  ad: { chip: "bg-wf-ad/15 text-wf-ad", bar: "bg-wf-ad" },
  listing: { chip: "bg-wf-listing/15 text-wf-listing", bar: "bg-wf-listing" },
  inventory: { chip: "bg-wf-inventory/15 text-wf-inventory", bar: "bg-wf-inventory" },
  competitor: { chip: "bg-wf-competitor/15 text-wf-competitor", bar: "bg-wf-competitor" },
  localize: { chip: "bg-wf-localize/15 text-wf-localize", bar: "bg-wf-localize" },
  primary: { chip: "bg-primary/15 text-primary", bar: "bg-primary" },
};

/** 取领域样式（未知领域回退主色） */
export function domainStyle(domain?: string): DomainStyle {
  return DOMAIN_STYLE[domain ?? "primary"] ?? DOMAIN_STYLE.primary;
}

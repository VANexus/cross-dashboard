/**
 * FlowMind — 内容平台元数据（xhs / wechat / douyin）
 * 与 rak-flowmind `_content_common.PLATFORMS` 对齐（展示层镜像）。
 */
import type { ContentPlatform, ContentPlatformMeta } from "@/lib/shared/types";

export const PLATFORMS: ContentPlatformMeta[] = [
  { id: "xhs", label: "小红书", color: "#ff2442", hint: "图文笔记 · 3:4", imageAspect: "3:4" },
  { id: "wechat", label: "微信公众号", color: "#07c160", hint: "长文 · 16:9 头图", imageAspect: "16:9" },
  { id: "douyin", label: "抖音", color: "#00d0ff", hint: "短视频 · 9:16 口播", imageAspect: "9:16" },
];

export function getPlatform(id: ContentPlatform): ContentPlatformMeta {
  return PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[0];
}

export function isPlatform(v: string): v is ContentPlatform {
  return PLATFORMS.some((p) => p.id === v);
}

/**
 * lib/server/services/creations.service.ts — 统一成果库（豆包式「我的生成」）
 *
 * 把分散在多个模块的 AI 生成产物聚合到一个统一视图：
 *   - 文案草稿（wf_content_drafts）
 *   - 创意选题（wf_content_ideas）
 *   - 生图（wf_generated_images，含 AI 作图与内容配图）
 *   - Agent 动态生成页（wf_page_specs）
 * 归一为 CreationItem，供 /creations 统一浏览、搜索、回看。
 */
import { prisma } from "@/lib/server/db";
import {
  getDrafts,
  getIdeas,
} from "@/lib/server/repositories/content.repository";

export const CREATION_TYPES = [
  "draft",
  "idea",
  "image",
  "page",
] as const;
export type CreationType = (typeof CREATION_TYPES)[number];

/** 成果库统一单条结构（前端 /creations 用）。 */
export interface CreationItem {
  id: string;
  type: CreationType;
  title: string;
  /** 摘要：文案正文 / 创意角度 / 图片 colormetric / 页面简介 */
  summary: string;
  /** 图片类可显示缩略图；其他为空 */
  url?: string;
  platform?: string;
  createdAt: string;
  updatedAt: string;
  /** 关联跳转（回看动作）,如 /content-studio、/p/:slug */
  href?: string;
}

function iso(v: Date | string | null | undefined): string {
  if (v == null) return new Date().toISOString();
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

export class CreationsService {
  /** 聚合全部生成产物（倒序，limit 条）. */
  async list(limit = 100): Promise<CreationItem[]> {
    const [drafts, ideas, images, pages] = await Promise.all([
      this.loadDrafts(limit),
      this.loadIdeas(limit),
      this.loadImages(limit),
      this.loadPages(limit),
    ]);
    const all: CreationItem[] = [...drafts, ...ideas, ...images, ...pages];
    // 跨类型按更新时间倒序（图片/页面 createdAt 为 Date，归一后统一比较）
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
  }

  private async loadDrafts(limit: number): Promise<CreationItem[]> {
    try {
      const rows = await getDrafts(limit);
      return rows.map((d) => ({
        id: d.id,
        type: "draft" as const,
        title: d.title || "未命名草稿",
        summary: d.body.slice(0, 120),
        platform: d.platform,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        href: "/content-studio",
      }));
    } catch {
      return [];
    }
  }

  private async loadIdeas(limit: number): Promise<CreationItem[]> {
    try {
      const rows = await getIdeas(undefined, limit);
      return rows.map((i) => ({
        id: i.id,
        type: "idea" as const,
        title: i.title || "未命名创意",
        summary: `${i.angle} · ${i.subject}`,
        platform: i.platform,
        createdAt: i.createdAt,
        updatedAt: i.createdAt,
        href: "/content-studio",
      }));
    } catch {
      return [];
    }
  }

  private async loadImages(limit: number): Promise<CreationItem[]> {
    try {
      const rows = await prisma.wf_generated_images.findMany({
        orderBy: { created_at: "desc" },
        take: limit,
      });
      return rows.map((r) => ({
        id: r.id,
        type: "image" as const,
        title: (r.prompt || "生成图片").slice(0, 40),
        summary: r.model ? `模型 ${r.model}` : "AI 生成图片",
        url: r.url || undefined,
        platform: r.platform || undefined,
        createdAt: r.created_at,
        updatedAt: r.created_at,
        href: "/workflows/ai-imaging",
      }));
    } catch {
      return [];
    }
  }

  private async loadPages(limit: number): Promise<CreationItem[]> {
    try {
      const rows = await prisma.wf_page_specs.findMany({
        orderBy: { updated_at: "desc" },
        take: limit,
      });
      return rows.map((p) => ({
        id: p.id,
        type: "page" as const,
        title: p.title || "动态页面",
        summary: "Agent 动态生成页面",
        createdAt: iso(p.created_at),
        updatedAt: iso(p.updated_at),
        href: `/p/${p.id}`,
      }));
    } catch {
      return [];
    }
  }

  /** 按类型统计（成果库侧栏分组数）. */
  async counts(): Promise<Record<CreationType, number>> {
    const [drafts, ideas, images, pages] = await Promise.all([
      getDrafts(500).then((r) => r.length).catch(() => 0),
      getIdeas(undefined, 500).then((r) => r.length).catch(() => 0),
      prisma.wf_generated_images.count().catch(() => 0),
      prisma.wf_page_specs.count().catch(() => 0),
    ]);
    return { draft: drafts, idea: ideas, image: images, page: pages };
  }
}
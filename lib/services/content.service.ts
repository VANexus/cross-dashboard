/**
 * FlowMind — 内容创作中心 Service
 *
 * 业务编排层：调 flowmind MCP 技能（content_*）+ 落库 + 状态上报。
 * 所有 AI 逻辑与密钥都在 flowmind（Python），本层零密钥，只做「调用 + 持久化」。
 *
 * 错误语义：MCP 不可达/技能失败抛 ContentMCPError（结构化分类），
 * 由 API route 转 error() envelope；hot_topics 的降级是 SkillResult.ok=True 的正常路径。
 */
import { ContentMCPClient, ContentMCPError } from "@/lib/content/mcp-client";
import { PLATFORMS } from "@/lib/content/platforms";
import { getDb } from "@/lib/db";
import { updateWorkflowStatus, getWorkflowStatuses } from "@/lib/repositories/workflow.repository";
import {
  clearHotTopics, deleteDraft, getDraft, getDrafts, getHotTopics, getIdeas,
  getRulesByPlatform, insertDraft, insertHotTopic, insertIdea, updateDraft,
} from "@/lib/repositories/content.repository";
import type { RuleRow } from "@/lib/repositories/content.repository";
import { getTasks } from "@/lib/repositories/localize.repository";
import type {
  AuditResult, ContentIdea, ContentImageResult, ContentPlatform,
  ContentPlatformMeta, ContentWorks, CopyDraft, HotTopic, HotTopicsResult,
} from "@/lib/types";

interface Bumpable {
  status?: string;
  lastRun?: string;
  runCount?: number;
}

export class ContentService {
  private mcp = new ContentMCPClient();

  // ── 只读 ──

  getPlatforms(): ContentPlatformMeta[] {
    return PLATFORMS;
  }

  getIdeas(platform?: ContentPlatform): ContentIdea[] {
    return getIdeas(platform);
  }

  getHotTopics(platform: ContentPlatform): HotTopic[] {
    return getHotTopics(platform);
  }

  getRules(platform?: ContentPlatform): RuleRow[] {
    return getRulesByPlatform(platform);
  }

  /** 成果库：文案草稿 ∪ 本地化视频。 */
  getWorks(): ContentWorks {
    return {
      drafts: getDrafts(50),
      videos: getTasks().filter((t) => t.status === "completed"),
    };
  }

  // ── 思路设计 ──

  async generateIdeas(input: { platform: ContentPlatform; subject: string; count?: number }): Promise<ContentIdea[]> {
    this.bump("idea-design", "running");
    try {
      const result = await this.mcp.call<{
        ideas: Array<{ angle: string; title: string; reason?: string }>;
      }>("content_idea_design", {
        platform: input.platform,
        subject: input.subject,
        count: input.count ?? 3,
      });
      const ideas: ContentIdea[] = [];
      for (const idea of result.ideas ?? []) {
        const id = `idea-${Date.now()}-${ideas.length}`;
        insertIdea({
          id, platform: input.platform,
          angle: idea.angle ?? "综合", title: idea.title, subject: input.subject,
        });
        ideas.push({ id, platform: input.platform, angle: idea.angle ?? "综合", title: idea.title, subject: input.subject, createdAt: new Date().toISOString() });
      }
      return ideas;
    } finally {
      this.bump("idea-design", "idle");
    }
  }

  // ── 热点雷达 ──

  async fetchHotTopics(input: { platform: ContentPlatform; refresh?: boolean }): Promise<HotTopicsResult> {
    const cached = this.getHotTopics(input.platform);
    if (!input.refresh && cached.length > 0) {
      return { platform: input.platform, source: "cache", endpoint: "", degraded: false, topics: cached };
    }

    this.bump("hot-topic", "running");
    try {
      const result = await this.mcp.call<HotTopicsResult>("content_hot_topics", {
        platform: input.platform,
        limit: 20,
      });
      // 落库（每次刷新覆盖旧快照）
      clearHotTopics(input.platform);
      for (const t of result.topics) {
        insertHotTopic({
          id: `ht-${input.platform}-${Date.now()}-${t.word.slice(0, 8)}`,
          platform: input.platform,
          word: t.word, heat: t.heat, delta: t.delta, url: t.url, source: t.source,
        });
      }
      return result;
    } finally {
      this.bump("hot-topic", "idle");
    }
  }

  // ── 生成文案 ──

  async generateCopy(input: {
    platform: ContentPlatform; subject: string; angle?: string; tone?: string; keywords?: string[];
  }): Promise<CopyDraft> {
    this.bump("copywriting", "running");
    try {
      const result = await this.mcp.call<{ title: string; body: string; tags: string[] }>("content_copywrite", {
        platform: input.platform,
        subject: input.subject,
        angle: input.angle,
        tone: input.tone,
        keywords: input.keywords ?? [],
      });
      const id = `draft-${Date.now()}`;
      const tags = Array.isArray(result.tags) ? result.tags.slice(0, 6) : [];
      insertDraft({ id, platform: input.platform, title: result.title, body: result.body, tags });
      const draft = getDraft(id);
      if (!draft) throw new Error("草稿写入失败");
      return draft;
    } finally {
      this.bump("copywriting", "idle");
    }
  }

  // ── 平台规则审计 ──

  async auditDraft(input: { id: string }): Promise<AuditResult> {
    const draft = getDraft(input.id);
    if (!draft) throw new Error("草稿不存在");
    this.bump("compliance-audit", "running");
    try {
      const result = await this.mcp.call<AuditResult>("content_audit", {
        platform: draft.platform,
        title: draft.title,
        body: draft.body,
        tags: draft.tags,
      });
      updateDraft(input.id, { auditPassed: result.passed, auditResult: result.findings });
      return result;
    } finally {
      this.bump("compliance-audit", "idle");
    }
  }

  // ── AI 配图 ──

  async generateImages(input: {
    draftId: string; platform: ContentPlatform; prompt: string; count?: number;
  }): Promise<ContentImageResult> {
    this.bump("image-gen", "running");
    try {
      const result = await this.mcp.call<ContentImageResult>("content_image_gen", {
        platform: input.platform,
        prompt: input.prompt,
        count: input.count ?? 1,
      });
      // 落库到 wf_generated_images（挂接 draft_id/platform）
      const db = getDb();
      const base = `gen-${Date.now()}`;
      for (const img of result.images) {
        db.run(
          `INSERT INTO wf_generated_images (id, type, url, prompt, model, platform, draft_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [`${base}-${img.index}`, "content", img.url, input.prompt, result.backendUsed, input.platform, input.draftId] as unknown[],
        );
      }
      const draft = getDraft(input.draftId);
      if (draft) updateDraft(input.draftId, { imageCount: (draft.imageCount ?? 0) + result.images.length });
      return result;
    } finally {
      this.bump("image-gen", "idle");
    }
  }

  // ── 草稿管理 ──

  updateDraft(id: string, data: { title?: string; body?: string; tags?: string[]; status?: CopyDraft["status"] }): CopyDraft | null {
    const existing = getDraft(id);
    if (!existing) return null;
    updateDraft(id, data);
    return getDraft(id);
  }

  removeDraft(id: string): boolean {
    return deleteDraft(id);
  }

  // ── 状态上报（对齐 WorkflowService.bumpWorkflowStatus） ──

  private bump(workflowId: string, status: "running" | "idle"): void {
    try {
      const current = getWorkflowStatuses().find((w) => w.id === workflowId);
      const newRuns = (current?.runs ?? 0) + (status === "idle" ? 1 : 0);
      const data: Bumpable = { status };
      if (status === "idle") {
        data.lastRun = new Date().toISOString();
        data.runCount = newRuns;
      }
      updateWorkflowStatus(workflowId, data);
    } catch {
      // 非关键，不阻断流程
    }
  }
}

export { ContentMCPError };

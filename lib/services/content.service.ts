/**
 * FlowMind — 内容创作中心 Service
 *
 * 业务编排层：调 flowmind MCP 技能（content_*）+ 落库 + 状态上报。
 * 所有 AI 逻辑与密钥都在 flowmind（Python），本层零密钥，只做「调用 + 持久化」。
 *
 * 错误语义：MCP 不可达/技能失败抛 ContentMCPError（结构化分类），
 * 由 API route 转 error() envelope；hot_topics 的降级是 SkillResult.ok=True 的正常路径。
 *
 * 可靠性：
 *   - 每个 MCP 调用方法自带降级策略（缓存 / 空结果 / 明确错误）
 *   - 调用前检查断路器状态，避免无谓等待
 *   - 落库失败不阻断返回（非关键路径）
 */
import { ContentMCPClient, ContentMCPError } from "@/lib/content/mcp-client";
import { PLATFORMS } from "@/lib/content/platforms";
import { runHotEngine, type HotBoardRaw, type HotEngineResult } from "@/lib/content/hot-engine";
import { getSupabase } from "@/lib/db";
import { updateWorkflowStatus, getWorkflowStatuses } from "@/lib/repositories/workflow.repository";
import {
  clearHotTopics, deleteDraft, getDraft, getDrafts, getHotTopics, getIdeas,
  getRulesByPlatform, insertDraft, insertHotTopic, insertIdea, updateDraft,
} from "@/lib/repositories/content.repository";
import { getTasks } from "@/lib/repositories/localize.repository";
import type { RuleRow } from "@/lib/repositories/content.repository";
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

  /** 暴露 MCP 运行时状态（健康检查端点用）。 */
  getMCPStatus() {
    return this.mcp.getStats();
  }

  /** 探活 MCP 服务（健康检查端点用）。 */
  async checkMCPHealth(): Promise<boolean> {
    return this.mcp.ping();
  }

  // ── 只读 ──

  getPlatforms(): ContentPlatformMeta[] {
    return PLATFORMS;
  }

  async getIdeas(platform?: ContentPlatform): Promise<ContentIdea[]> {
    return await getIdeas(platform);
  }

  async getHotTopics(platform: ContentPlatform): Promise<HotTopic[]> {
    return await getHotTopics(platform);
  }

  async getRules(platform?: ContentPlatform): Promise<RuleRow[]> {
    return await getRulesByPlatform(platform);
  }

  /** 成果库：文案草稿 ∪ 本地化视频。 */
  async getWorks(): Promise<ContentWorks> {
    return {
      drafts: await getDrafts(50),
      videos: (await getTasks()).filter((t) => t.status === "completed"),
    };
  }

  // ── 思路设计 ──

  async generateIdeas(input: { platform: ContentPlatform; subject: string; count?: number }): Promise<ContentIdea[]> {
    this.bump("idea-design", "running").catch(console.error);
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
        }).catch(console.error);
        ideas.push({ id, platform: input.platform, angle: idea.angle ?? "综合", title: idea.title, subject: input.subject, createdAt: new Date().toISOString() });
      }
      return ideas;
    } finally {
      this.bump("idea-design", "idle").catch(console.error);
    }
  }

  // ── 热点雷达 ──

  async fetchHotTopics(input: { platform: ContentPlatform; refresh?: boolean }): Promise<HotTopicsResult> {
    const cached = await this.getHotTopics(input.platform);
    if (!input.refresh && cached.length > 0) {
      return { platform: input.platform, source: "cache", endpoint: "", degraded: false, topics: cached };
    }

    this.bump("hot-topic", "running").catch(console.error);
    try {
      const result = await this.mcp.call<HotTopicsResult>("content_hot_topics", {
        platform: input.platform,
        limit: 20,
      });
      this.safePersistHotTopics(input.platform, result.topics).catch(console.error);
      return result;
    } catch (err) {
      if (cached.length > 0) {
        return {
          platform: input.platform,
          source: "cache_stale",
          endpoint: "",
          degraded: true,
          degradationReason: err instanceof ContentMCPError ? err.message : "MCP 服务暂时不可用",
          topics: cached,
        };
      }
      throw err;
    } finally {
      this.bump("hot-topic", "idle").catch(console.error);
    }
  }

  // ── 热榜引擎（多榜：综合/垂类/话题/灵感）──

  async fetchHotBoards(input: {
    platform: ContentPlatform; categories?: string[]; boards?: string[]; limit?: number;
  }): Promise<HotEngineResult> {
    this.bump("hot-board", "running").catch(console.error);
    try {
      const boards = input.boards && input.boards.length > 0
        ? input.boards
        : ["general", "vertical", "topic", "inspiration"];
      const raw = await this.mcp.call<{ boards: HotBoardRaw[] }>("content_hot_boards", {
        platform: input.platform,
        boards,
        limit: input.limit ?? 20,
      });
      return runHotEngine(input.platform, raw.boards ?? [], { categories: input.categories });
    } catch (err) {
      // 技能不可达时也返回空引擎结果（不抛假数据），由前端显示降级态
      return runHotEngine(input.platform, [], { categories: input.categories });
    } finally {
      this.bump("hot-board", "idle").catch(console.error);
    }
  }

  // ── 生成文案 ──

  async generateCopy(input: {
    platform: ContentPlatform; subject: string; angle?: string; tone?: string; keywords?: string[];
  }): Promise<CopyDraft> {
    this.bump("copywriting", "running").catch(console.error);
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
      await insertDraft({ id, platform: input.platform, title: result.title, body: result.body, tags });
      const draft = await getDraft(id);
      if (!draft) throw new Error("草稿写入失败");
      return draft;
    } finally {
      this.bump("copywriting", "idle").catch(console.error);
    }
  }

  // ── 平台规则审计 ──

  async auditDraft(input: { id: string }): Promise<AuditResult> {
    const draft = await getDraft(input.id);
    if (!draft) throw new Error("草稿不存在");
    this.bump("compliance-audit", "running").catch(console.error);
    try {
      const result = await this.mcp.call<AuditResult>("content_audit", {
        platform: draft.platform,
        title: draft.title,
        body: draft.body,
        tags: draft.tags,
      });
      this.safeUpdateDraft(input.id, { auditPassed: result.passed, auditResult: result.findings }).catch(console.error);
      return result;
    } finally {
      this.bump("compliance-audit", "idle").catch(console.error);
    }
  }

  // ── AI 配图 ──

  async generateImages(input: {
    draftId: string; platform: ContentPlatform; prompt: string; count?: number;
  }): Promise<ContentImageResult> {
    this.bump("image-gen", "running").catch(console.error);
    try {
      const result = await this.mcp.call<ContentImageResult>("content_image_gen", {
        platform: input.platform,
        prompt: input.prompt,
        count: input.count ?? 1,
      });
      this.safePersistImages(result, input).catch(console.error);
      this.safeUpdateDraft(input.draftId, {
        imageCount: ((await getDraft(input.draftId))?.imageCount ?? 0) + result.images.length,
      }).catch(console.error);
      return result;
    } finally {
      this.bump("image-gen", "idle").catch(console.error);
    }
  }

  // ── 草稿管理 ──

  async updateDraft(id: string, data: { title?: string; body?: string; tags?: string[]; status?: CopyDraft["status"] }): Promise<CopyDraft | null> {
    const existing = await getDraft(id);
    if (!existing) return null;
    await updateDraft(id, data);
    return await getDraft(id);
  }

  async removeDraft(id: string): Promise<boolean> {
    return await deleteDraft(id);
  }

  // ── 内部辅助 ──

  /** 安全落库热点（失败不抛）。 */
  private async safePersistHotTopics(platform: ContentPlatform, topics: HotTopic[]): Promise<void> {
    try {
      await clearHotTopics(platform);
      for (const t of topics) {
        await insertHotTopic({
          id: `ht-${platform}-${Date.now()}-${t.word.slice(0, 8)}`,
          platform,
          word: t.word, heat: t.heat, delta: t.delta, url: t.url, source: t.source,
        });
      }
    } catch {
      // 非关键路径，静默降级
    }
  }

  /** 安全更新草稿（失败不抛）。 */
  private async safeUpdateDraft(id: string, data: Record<string, unknown>): Promise<void> {
    try {
      await updateDraft(id, data);
    } catch {
      // 非关键路径
    }
  }

  /** 安全落库图片（失败不抛）。 */
  private async safePersistImages(result: ContentImageResult, input: { draftId: string; platform: ContentPlatform; prompt: string }): Promise<void> {
    try {
      const sb = getSupabase();
      const base = `gen-${Date.now()}`;
      const rows = result.images.map((img, idx) => ({
        id: `${base}-${idx}`,
        type: "content",
        url: img.url,
        prompt: input.prompt,
        model: result.backendUsed,
        platform: input.platform,
        draft_id: input.draftId,
      }));
      await sb.from("wf_generated_images").insert(rows);
    } catch {
      // 非关键路径
    }
  }

  // ── 状态上报（对齐 WorkflowService.bumpWorkflowStatus） ──

  private async bump(workflowId: string, status: "running" | "idle"): Promise<void> {
    try {
      const current = (await getWorkflowStatuses()).find((w) => w.id === workflowId);
      const newRuns = (current?.runs ?? 0) + (status === "idle" ? 1 : 0);
      const data: Bumpable = { status };
      if (status === "idle") {
        data.lastRun = new Date().toISOString();
        data.runCount = newRuns;
      }
      await updateWorkflowStatus(workflowId, data);
    } catch {
      // 非关键，不阻断流程
    }
  }
}

export { ContentMCPError };

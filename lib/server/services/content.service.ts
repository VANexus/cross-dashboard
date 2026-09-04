/**
 * FlowMind — 内容创作中心 Service
 *
 * 业务编排层（已自举：DailyHotApi 热榜 + 云 LLM 文案/创意/审核 + 生图 API，无后端依赖）。
 * 所有 AI 逻辑在 Next.js 全栈内（content.selfhost.ts），本层只做「调用 + 落库 + 状态上报」。
 *
 * 错误语义：selfhost 失败抛 SelfhostError（结构化分类），
 * 由 API route 转 error() envelope；hot_topics 的降级是正常路径（degraded 空态）。
 *
 * 可靠性：
 *   - 每个调用自带降级策略（缓存 / 空结果 / 明确错误）
 *   - 落库失败不阻断返回（非关键路径）
 */
import { ContentSelfhostService } from "@/lib/server/services/content.selfhost";
import { PLATFORMS } from "@/lib/content/platforms";
import { runHotEngine, type HotBoardRaw, type HotEngineResult } from "@/lib/content/hot-engine";
import { prisma } from "@/lib/server/db";
import { updateWorkflowStatus, getWorkflowStatuses } from "@/lib/server/repositories/workflow.repository";
import {
  clearHotTopics, deleteDraft, getDraft, getDrafts, getHotTopics, getIdeas,
  getRulesByPlatform, insertDraft, insertHotTopic, insertIdea, updateDraft,
} from "@/lib/server/repositories/content.repository";
import { getTasks } from "@/lib/server/repositories/localize.repository";
import type { RuleRow } from "@/lib/server/repositories/content.repository";
import type {
  AuditResult, ContentIdea, ContentImageResult, ContentPlatform,
  ContentPlatformMeta, ContentWorks, CopyDraft, HotTopic, HotTopicsResult,
} from "@/lib/shared/types";

interface Bumpable {
  status?: string;
  lastRun?: string;
  runCount?: number;
}

export class ContentService {
  private selfhost = new ContentSelfhostService();

  /** 暴露自举运行时状态（健康检查端点用）。 */
  getMCPStatus() {
    return { status: "selfhost" as const, circuitState: "CLOSED" };
  }

  /** 探活自举服务（健康检查端点用）。 */
  async checkMCPHealth(): Promise<boolean> {
    return true;
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
      const result = await this.selfhost.ideaDesign({
        platform: input.platform,
        subject: input.subject,
        count: input.count ?? 3,
      });
      const ideas: ContentIdea[] = [];
      for (const idea of result.ideas ?? []) {
        const id = `idea-${Date.now()}-${ideas.length}`;
        // 落库等待：成果库依赖它持久化；失败抛错（不再 fire-and-forget 静默吞，杜绝"生成完刷新就没了"）
        await insertIdea({
          id, platform: input.platform,
          angle: idea.angle ?? "综合", title: idea.title, subject: input.subject,
        });
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
      const result = await this.selfhost.hotTopics(input.platform, 20);
      this.safePersistHotTopics(input.platform, result.topics).catch(console.error);
      return result;
    } catch (err) {
      if (cached.length > 0) {
        return {
          platform: input.platform,
          source: "cache_stale",
          endpoint: "",
          degraded: true,
          degradationReason: err instanceof Error ? err.message : "热榜服务暂时不可用",
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
      const boards = (input.boards && input.boards.length > 0
        ? input.boards
        : ["general", "vertical", "topic", "inspiration"]) as HotBoardRaw["id"][];
      const raw = await this.selfhost.hotBoards(boards, input.limit ?? 20);
      return runHotEngine(input.platform, raw.boards ?? [], { categories: input.categories });
    } catch (err) {
      // 数据源不可达时也返回空引擎结果（不抛假数据），由前端显示降级态
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
      const result = await this.selfhost.copywrite({
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
      const result = await this.selfhost.audit({
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
      const result = await this.selfhost.imageGen({
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
      if (rows.length > 0) {
        await prisma.wf_generated_images.createMany({ data: rows });
      }
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

// 兼容导出：既有路由仍 import ContentMCPError 做错误分类（语义同 SelfhostError）
export { ContentMCPError } from "@/lib/mcp/client";

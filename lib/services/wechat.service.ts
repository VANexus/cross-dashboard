/**
 * FlowMind — 微信公众号端到端发布 Service
 *
 * 业务编排层：账号保险库（加密落库）+ 调 flowmind MCP 技能（content_typeset /
 * content_wechat_publish / content_wechat_account_test / content_wechat_publish_status）。
 *
 * 安全：明文凭证只在创建 / 测试 / 提交时于服务端出现并即时传给 flowmind，
 * 绝不落前端状态、绝不随列表返回。
 */
import { ContentMCPClient, ContentMCPError } from "@/lib/content/mcp-client";
import {
  createWechatAccount, createWechatJob, deleteWechatAccount, deleteWechatJob,
  getWechatAccountSecret, getWechatJob, listWechatAccounts, listWechatJobs,
  setDefaultWechatAccount, updateWechatAccount, updateWechatJob,
} from "@/lib/repositories/wechat.repository";
import type {
  WechatAccount, WechatAccountTestResult, WechatChannel, WechatPublishJob,
  WechatPublishSubmitResult, WechatTypesetResult, WechatTypesetTheme,
} from "@/lib/types";

/** 内置排版主题（与 rak-flowmind content_typeset 的 THEME_PRESETS 对齐） */
export const WECHAT_THEMES: WechatTypesetTheme[] = [
  { id: "default", label: "经典", primary: "#07C160" },
  { id: "grace", label: "优雅", primary: "#9C6ADE" },
  { id: "simple", label: "简约", primary: "#1F6FEB" },
];

export class WechatService {
  private mcp = new ContentMCPClient();

  // ── 账号管理 ──

  async getAccounts(): Promise<WechatAccount[]> {
    return await listWechatAccounts();
  }

  async createAccount(input: { label: string; appId: string; appSecret: string }): Promise<WechatAccount> {
    return await createWechatAccount(input);
  }

  async updateAccount(
    id: string,
    patch: { label?: string; appId?: string; appSecret?: string; status?: WechatAccount["status"] },
  ): Promise<void> {
    await updateWechatAccount(id, patch);
  }

  async removeAccount(id: string): Promise<boolean> {
    return await deleteWechatAccount(id);
  }

  async makeDefaultAccount(id: string): Promise<void> {
    await setDefaultWechatAccount(id);
  }

  /** 测试连接：账号 id（解密凭证）优先，否则用显式传入的凭证（供「填了就测」）。 */
  async testAccount(input: {
    id?: string; appId?: string; appSecret?: string;
  }): Promise<WechatAccountTestResult> {
    let appId = input.appId;
    let appSecret = input.appSecret;
    if (input.id) {
      const sec = await getWechatAccountSecret(input.id);
      if (sec) {
        appId = sec.appId;
        appSecret = sec.appSecret;
      }
    }
    return await this.mcp.call<WechatAccountTestResult>("content_wechat_account_test", {
      app_id: appId,
      app_secret: appSecret,
    });
  }

  // ── 排版 ──

  getThemes(): WechatTypesetTheme[] {
    return WECHAT_THEMES;
  }

  async typeset(input: { markdown: string; theme?: string; primaryColor?: string; fontSize?: string }): Promise<WechatTypesetResult> {
    return await this.mcp.call<WechatTypesetResult>("content_typeset", {
      markdown: input.markdown,
      theme: input.theme ?? "default",
      primary_color: input.primaryColor,
      font_size: input.fontSize,
    });
  }

  // ── 发布任务 ──

  async createJob(input: {
    title: string; bodyHtml: string; accountId?: string | null; summary?: string;
    author?: string; thumbUrl?: string; channel?: WechatChannel; theme?: string; publishTime?: number | null;
  }): Promise<WechatPublishJob> {
    return await createWechatJob(input);
  }

  async getJob(id: string): Promise<WechatPublishJob | null> {
    return await getWechatJob(id);
  }

  async listJobs(): Promise<WechatPublishJob[]> {
    return await listWechatJobs(50);
  }

  async updateJob(id: string, patch: Record<string, unknown>): Promise<void> {
    await updateWechatJob(id, patch as never);
  }

  async removeJob(id: string): Promise<boolean> {
    return await deleteWechatJob(id);
  }

  /**
   * 提交发布/群发：解析账号凭证（DB 解密，无则走 env）→ 调 MCP → 更新任务状态。
   * 返回 flowmind 原始发布结果，供前端展示。
   */
  async submitJob(
    id: string,
    input: {
      accountId?: string | null;
      title: string; summary?: string; author?: string; bodyHtml: string; thumbUrl?: string;
      channel: WechatChannel; theme?: string; publishTime?: number | null; publish?: boolean;
    },
  ): Promise<WechatPublishSubmitResult> {
    const job = await getWechatJob(id);
    if (!job) throw new Error("发布任务不存在");

    // 解析账号凭证（仅服务端）
    let appId: string | undefined;
    let appSecret: string | undefined;
    const accountId = input.accountId ?? job.accountId;
    if (accountId) {
      const sec = await getWechatAccountSecret(accountId);
      if (sec) {
        appId = sec.appId;
        appSecret = sec.appSecret;
      }
    }

    // 落库任务信息（正文/账号/设置）
    await updateWechatJob(id, {
      accountId,
      title: input.title,
      summary: input.summary ?? job.summary,
      author: input.author ?? job.author,
      bodyHtml: input.bodyHtml,
      thumbUrl: input.thumbUrl ?? job.thumbUrl,
      channel: input.channel,
      theme: input.theme ?? job.theme,
      publishTime: input.publishTime ?? null,
      status: "publishing",
      step: "done",
    });

    const result = await this.mcp.call<WechatPublishSubmitResult>("content_wechat_publish", {
      title: input.title,
      content: input.bodyHtml,
      thumb_image_url: input.thumbUrl || "",
      summary: input.summary,
      author: input.author,
      publish: input.publish ?? true,
      channel: input.channel,
      publish_time: input.publishTime ?? null,
      app_id: appId,
      app_secret: appSecret,
    });

    await this.applySubmitResult(id, result);
    return result;
  }

  /** 轮询发布/群发状态并回写任务。 */
  async refreshJobStatus(id: string): Promise<WechatPublishJob | null> {
    const job = await getWechatJob(id);
    if (!job) return null;
    if (!job.publishId && !job.msgId) return job;

    const accountId = job.accountId;
    let appId: string | undefined;
    let appSecret: string | undefined;
    if (accountId) {
      const sec = await getWechatAccountSecret(accountId);
      if (sec) {
        appId = sec.appId;
        appSecret = sec.appSecret;
      }
    }

    try {
      const st = await this.mcp.call<{
        kind: string; statusText: string; statusCode?: number | null; articleUrl?: string | null;
      }>("content_wechat_publish_status", {
        publish_id: job.publishId ?? undefined,
        msg_id: job.msgId ?? undefined,
        app_id: appId,
        app_secret: appSecret,
      });
      await updateWechatJob(id, {
        articleUrl: st.articleUrl ?? null,
        warning: st.kind === "unknown" ? (st as unknown as { warning?: string }).warning ?? "" : "",
      });
      return await getWechatJob(id);
    } catch {
      return job;
    }
  }

  // ── 内部 ──

  private async applySubmitResult(
    id: string, result: WechatPublishSubmitResult,
  ): Promise<void> {
    const patch: Record<string, unknown> = {
      mediaId: result.mediaId ?? "",
      publishId: result.publishId ?? null,
      msgId: result.msgId ?? null,
      status: result.status === "published" ? "published"
        : result.status === "mass_sent" ? "mass_sent"
        : result.status === "drafted" ? "drafted" : "failed",
      warning: result.warning ?? "",
    };
    if (result.status === "failed") patch.step = "confirm";
    await updateWechatJob(id, patch);
  }
}

export { ContentMCPError };

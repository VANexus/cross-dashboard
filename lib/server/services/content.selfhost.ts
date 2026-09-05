/**
 * lib/server/services/content.selfhost.ts — 内容创作中心 自举 Provider 层
 *
 * 把原本走 flowmind MCP（content_hot_topics / content_hot_boards / content_copywrite /
 * content_idea_design / content_audit / content_image_gen）的六个能力，
 * 直接在 Next.js 全栈进程内实现：
 *
 *  - hot_topics / hot_boards → DailyHotApi 公开热榜聚合协议（https://api-hot.imsyy.top，无鉴权）
 *  - copywrite / idea_design → 云 LLM 结构化生成（复用 getAISDKModel，走 AI_LLM_* 网关）
 *  - audit                  → 本地规则 + LLM 复核（规则层零外部依赖）
 *  - image_gen              → OpenAI 兼容 images/generations（AI_IMAGE_*，SiliconFlow）
 *
 * 返回结构与后端 skill 输出同构，使 content.service.ts 的编排/落库层零改动。
 * 密钥只从 env 读取，不落库、不落前端。
 */
import { generateText } from "ai";
import { getAISDKModel } from "@/lib/server/ai";
import { SelfhostError } from "@/lib/server/services/b2b.selfhost";
import { generateImages as selfhostGenerateImages } from "@/lib/server/services/b2b.selfhost";
import { HOT_BOARD_LABELS, type HotBoardRaw, type HotBoardType } from "@/lib/content/hot-engine";
import type {
  AuditFinding, AuditResult, ContentImageResult, ContentPlatform, HotTopic, HotTopicsResult,
} from "@/lib/shared/types";

// ── LLM 辅助（对齐 selfhost-tools.ts）───────────────────────────

async function llmJson<T>(system: string, prompt: string): Promise<T> {
  const model = await getAISDKModel();
  for (let i = 0; i < 2; i++) {
    try {
      const res = await generateText({ model, system, prompt, temperature: 0.4 });
      const text = res.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start < 0 || end < start) throw new Error("no json object");
      return JSON.parse(text.slice(start, end + 1)) as T;
    } catch (e) {
      if (i === 1) throw e;
    }
  }
  throw new Error("llmJson failed");
}

function aiErrorHint(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ── DailyHotApi 热榜客户端（公开聚合 API，无鉴权）────────────────
// 端点统一走 env：HOT_TOPIC_API_BASE 是唯一入口（可指向自托管 DailyHotApi/代理）。
// 严格环境变量化：不写死 fallback——未配置时给出结构化错误，由上层优雅降级（degraded 空态），
// 避免"某台机器默认指向错误公网端点"的隐性分裂。
const HOT_API_BASE = process.env.HOT_TOPIC_API_BASE?.trim();
/** 平台 → DailyHotApi 端点（小红书/公众号无公开热榜，代理微博/头条）。 */
const HOT_TOPIC_ENDPOINTS: Record<string, string> = {
  xhs: "weibo",
  wechat: "toutiao",
  douyin: "douyin",
};
/** 榜型 → DailyHotApi 端点（inspiration 用知乎热榜：内容型灵感更贴合创作选题，baidu 榜量过少且多被过滤）。 */
const HOT_BOARD_ENDPOINTS: Record<string, string> = {
  general: "thepaper",
  vertical: "douyin",
  topic: "toutiao",
  inspiration: "zhihu",
};

function parseHeat(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return Math.trunc(raw);
  const m = String(raw).trim().match(/^(\d+(?:\.\d+)?)\s*([万w亿eKk]?)/);
  if (!m) return 0;
  let base = parseFloat(m[1]);
  const unit = (m[2] || "").toLowerCase();
  if (unit === "万" || unit === "w") base *= 10_000;
  else if (unit === "亿" || unit === "e") base *= 100_000_000;
  else if (unit === "k") base *= 1000;
  return Math.trunc(base);
}

/** 抓取单榜（DailyHotApi 协议）→ [{word,heat,delta:null,url,source}] */
async function fetchHotList(endpoint: string, limit: number): Promise<HotTopic[]> {
  if (!HOT_API_BASE) {
    throw new SelfhostError(
      "environment",
      "热榜接口未配置：请在 .env 设置 HOT_TOPIC_API_BASE（自托管 DailyHotApi 地址）。",
    );
  }
  const url = `${HOT_API_BASE}/${endpoint}`;
  let resp: Response;
  try {
    resp = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  } catch (err) {
    throw new SelfhostError("timeout", `热榜接口网络异常：${err instanceof Error ? err.message : "未知"}`);
  }
  if (resp.status >= 500) throw new SelfhostError("timeout", `热榜服务暂不可用（HTTP ${resp.status}）。`);
  if (resp.status >= 400) throw new SelfhostError("unknown", `热榜接口错误（HTTP ${resp.status}）。`);
  let payload: { data?: unknown; name?: string; title?: string };
  try {
    payload = (await resp.json()) as typeof payload;
  } catch {
    throw new SelfhostError("unknown", `热榜接口返回非 JSON（HTTP ${resp.status}）。`);
  }
  const items = Array.isArray(payload.data) ? payload.data : [];
  const source = String(payload.name ?? payload.title ?? endpoint);
  const out: HotTopic[] = [];
  for (const it of items.slice(0, limit)) {
    if (!it || typeof it !== "object") continue;
    const d = it as Record<string, unknown>;
    const word = String(d.title ?? d.name ?? "").trim();
    if (!word) continue;
    const heat = parseHeat(d.hotValue ?? d.hot ?? d.rank);
    out.push({
      word,
      heat,
      delta: null,
      url: String(d.url ?? d.mobilUrl ?? ""),
      source,
    });
  }
  return out;
}

// ── 生图 ───────────────────────────────────────────────────────

async function genImages(prompt: string, count: number): Promise<{ images: Array<{ index: number; url: string }>; backendUsed: string }> {
  const result = await selfhostGenerateImages({
    prompt,
    aspectRatio: "1:1",
    numVariants: Math.min(4, Math.max(1, count)),
  });
  return {
    images: result.images.map((img) => ({ index: img.index, url: img.url })),
    backendUsed: "siliconflow",
  };
}

// ── 审核规则（对齐后端 content_audit 规则层）───────────────────

const AUDIT_BLOCKLIST = ["赌博", "色情", "毒品", "代开发票", "刷单", "虚假宣传", "医疗功效"];
const AUDIT_SENSITIVE = ["政治敏感", "种族歧视", "宗教攻击"];
const AUDIT_EXTREMES = ["最", "第一", "顶级", "国家级", "100%", "绝对"];
const AUDIT_AD_BANNED = ["根治", "包治", "永不复发", "全网最低", "史上最强"];

// ── 自举服务 ──────────────────────────────────────────────────

export class ContentSelfhostService {
  /** 平台热榜（DailyHotApi，小红书/公众号走代理端点）。 */
  async hotTopics(platform: ContentPlatform, limit = 20): Promise<HotTopicsResult> {
    const endpoint = HOT_TOPIC_ENDPOINTS[platform] ?? "weibo";
    try {
      const topics = await fetchHotList(endpoint, limit);
      return {
        platform,
        source: "dailyhot",
        endpoint: `${HOT_API_BASE}/${endpoint}`,
        degraded: topics.length === 0,
        topics,
      };
    } catch (err) {
      return {
        platform,
        source: "dailyhot",
        endpoint: `${HOT_API_BASE}/${endpoint}`,
        degraded: true,
        degradationReason: err instanceof Error ? err.message : "热榜不可用",
        topics: [],
      };
    }
  }

  /** 多榜热榜引擎（general/vertical/topic/inspiration → 聚合 API 各榜，单榜失败只降级该榜）。 */
  async hotBoards(boards: HotBoardType[], limit = 20): Promise<{ boards: HotBoardRaw[] }> {
    const results = await Promise.all(
      boards.map(async (id) => {
        const endpoint = HOT_BOARD_ENDPOINTS[id] ?? "thepaper";
        try {
          const topics = await fetchHotList(endpoint, limit);
          return {
            id,
            label: HOT_BOARD_LABELS[id],
            endpoint: `${HOT_API_BASE}/${endpoint}`,
            source: "dailyhot",
            degraded: topics.length === 0,
            topics: topics.map((t, i) => ({
              board: id,
              title: t.word,
              heat: t.heat,
              rank: i + 1,
              source: t.source,
              url: t.url,
              fetchedAt: new Date().toISOString(),
            })),
          };
        } catch (err) {
          return {
            id,
            label: HOT_BOARD_LABELS[id],
            endpoint: `${HOT_API_BASE}/${endpoint}`,
            source: "dailyhot",
            degraded: true,
            failureCategory: err instanceof SelfhostError ? err.category : "unknown",
            retriable: err instanceof SelfhostError ? err.retriable : false,
            warning: err instanceof Error ? err.message : "热榜不可用",
            topics: [],
          };
        }
      }),
    );
    return { boards: results };
  }

  /** 平台文案（LLM 多版本）。返回 {title, body, tags}（对齐 content_copywrite 输出）。 */
  async copywrite(input: {
    platform: ContentPlatform; subject: string; angle?: string; tone?: string; keywords?: string[];
  }): Promise<{ title: string; body: string; tags: string[] }> {
    try {
      const sys =
        "你是资深跨境电商内容运营。基于平台、主题、角度与卖点生成一篇可直接发布的营销文案。输出 JSON：{\"title\":\"...\",\"body\":\"...\",\"tags\":[\"...\"]}，只输出 JSON。";
      const p = `平台：${input.platform}\n主题：${input.subject}\n角度：${input.angle ?? "综合"}\n风格：${input.tone ?? "种草"}\n关键词：${(input.keywords ?? []).join("、") || "无"}`;
      const out = await llmJson<{ title: string; body: string; tags: string[] }>(sys, p);
      return {
        title: String(out.title ?? "").trim() || input.subject,
        body: String(out.body ?? "").trim(),
        tags: Array.isArray(out.tags) ? out.tags.slice(0, 6).map((t) => String(t)) : [],
      };
    } catch (e) {
      throw new SelfhostError("unknown", `文案生成失败：${aiErrorHint(e)}`);
    }
  }

  /** 创意点子（LLM）。返回 {ideas:[{angle,title,reason?}]}。 */
  async ideaDesign(input: {
    platform: ContentPlatform; subject: string; count?: number;
  }): Promise<{ ideas: Array<{ angle: string; title: string; reason?: string }> }> {
    try {
      const sys =
        "你是内容创意策划。基于平台与主题产出多个差异化创意方向。输出 JSON：{\"ideas\":[{\"angle\":\"角度\",\"title\":\"标题\",\"reason\":\"为什么\"}]}，只输出 JSON。";
      const p = `平台：${input.platform}\n主题：${input.subject}\n数量：${input.count ?? 3}`;
      const out = await llmJson<{ ideas: Array<{ angle?: string; title?: string; reason?: string }> }>(sys, p);
      return {
        ideas: (out.ideas ?? [])
          .filter((x) => x && typeof x === "object" && (x.title || x.angle))
          .map((x) => ({
            angle: String(x.angle ?? "综合"),
            title: String(x.title ?? "").trim(),
            reason: x.reason ? String(x.reason) : undefined,
          })),
      };
    } catch (e) {
      throw new SelfhostError("unknown", `创意生成失败：${aiErrorHint(e)}`);
    }
  }

  /** 内容审核（规则 + LLM 复核）。对齐 content_audit 返回。 */
  async audit(input: { platform: ContentPlatform; title: string; body: string; tags: string[] }): Promise<AuditResult> {
    const text = `${input.title}\n${input.body}\n${(input.tags ?? []).join("、")}`;
    const findings: AuditFinding[] = [];
    const push = (category: string, severity: "error" | "warning", message: string, matchedText: string, suggestion: string) => {
      findings.push({ category, severity, message, suggestion, matchedText });
    };
    for (const w of AUDIT_BLOCKLIST) if (text.includes(w)) push("违禁词", "error", `命中违禁词「${w}」`, w, "删除或替换该词后发布");
    for (const w of AUDIT_SENSITIVE) if (text.includes(w)) push("敏感词", "error", `命中敏感词「${w}」`, w, "移除敏感表述");
    for (const w of AUDIT_EXTREMES) if (text.includes(w)) push("极限词", "warning", `命中极限/夸大词「${w}」`, w, "核实是否有证明依据");
    for (const w of AUDIT_AD_BANNED) if (text.includes(w)) push("广告法禁用", "error", `命中广告法禁用词「${w}」`, w, "替换为合规表述");

    const ruleFindingCount = findings.length;
    let llmReviewed = false;
    let llmFindingCount = 0;
    try {
      const sys =
        "你是内容合规审核员。只对给定文本做风险复核。输出 JSON：{\"passed\":true|false,\"findings\":[{\"category\":\"\",\"severity\":\"error|warning\",\"message\":\"\",\"suggestion\":\"\"}]}，只输出 JSON。";
      const out = await llmJson<{ passed?: boolean; findings?: Array<AuditFinding> }>(
        sys,
        `场景：${input.platform}\n文本：${text.slice(0, 2000)}\n规则命中：${findings.map((f) => `${f.category}:${f.matchedText}`).join("; ") || "无"}`,
      );
      llmReviewed = true;
      llmFindingCount = Array.isArray(out.findings) ? out.findings.length : 0;
      for (const f of Array.isArray(out.findings) ? out.findings : []) {
        if (f && typeof f === "object" && f.message) {
          findings.push({
            category: String(f.category ?? "LLM复核"),
            severity: f.severity === "error" ? "error" : "warning",
            message: String(f.message),
            suggestion: String(f.suggestion ?? ""),
          });
        }
      }
    } catch {
      /* 规则层已足够，LLM 复核失败不阻断 */
    }

    return {
      platform: input.platform,
      passed: !findings.some((f) => f.severity === "error"),
      findings,
      llmReviewed,
      ruleFindingCount,
      llmFindingCount,
    };
  }

  /** AI 配图（OpenAI 兼容 images/generations）。 */
  async imageGen(input: { platform: ContentPlatform; prompt: string; count?: number }): Promise<ContentImageResult> {
    try {
      const { images, backendUsed } = await genImages(input.prompt, input.count ?? 1);
      return {
        platform: input.platform,
        width: 1024,
        height: 1024,
        backendUsed,
        images,
      };
    } catch (e) {
      throw new SelfhostError("unknown", `配图生成失败：${aiErrorHint(e)}`);
    }
  }
}

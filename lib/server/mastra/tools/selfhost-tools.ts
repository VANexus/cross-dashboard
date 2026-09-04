/**
 * lib/mastra/tools/selfhost-tools.ts — Next.js 全栈自举能力包
 *
 * 把 flowmind 后端（flowmind-mcp）中「纯 LLM + 规则 + 本地数据」即可完成的能力
 * 原生移植到 Next.js 全栈内，彻底不再依赖 Python 后端：
 *   - content_copywrite     平台文案生成（LLM）
 *   - content_idea_design   创意点子（LLM）
 *   - content_audit         内容审核（规则 + LLM 复核）
 *   - image_prompt_reverse  图片反向 prompt（视觉 LLM）
 *   - inventory_risk        库存风险（本地 PG 数据 + 确定性规则）
 *   - b2b_daily_digest      每日业务摘要（本地 PG 聚合 + LLM）
 *
 * 与 local-tools 同样用 @mastra/core createTool，注册进 kernel tool-registry 后
 * 对 Agent 对话 / plan_workflow 白名单自动可用。LLM 统一走 getAISDKModel（SiliconFlow env）。
 */
import { createTool } from '@mastra/core/tools';
import { generateText } from 'ai';
import { z } from 'zod';
import { getAISDKModel, AIConfigError } from '@/lib/server/ai';
import { prisma } from '@/lib/server/db';

// ── LLM 辅助 ─────────────────────────────────────────────────

/** 调本地 LLM（SiliconFlow）；AIConfigError 时抛出可读错误，规则类工具自行兜底。 */
async function llm(system: string, prompt: string): Promise<string> {
  const model = await getAISDKModel();
  const res = await generateText({ model, system, prompt, temperature: 0.7 });
  return res.text.trim();
}

/** 结构化 JSON 输出（带一次重试）。 */
async function llmJson<T>(system: string, prompt: string): Promise<T> {
  const model = await getAISDKModel();
  for (let i = 0; i < 2; i++) {
    try {
      const res = await generateText({ model, system, prompt, temperature: 0.4 });
      const text = res.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start < 0 || end < start) throw new Error('no json object');
      return JSON.parse(text.slice(start, end + 1)) as T;
    } catch (e) {
      if (i === 1) throw e;
    }
  }
  throw new Error('llmJson failed');
}

function aiErrorHint(e: unknown): string {
  if (e instanceof AIConfigError) return `LLM 未配置：${e.message}`;
  return e instanceof Error ? e.message : String(e);
}

// ── 1. content_copywrite：平台文案 ───────────────────────────

export const contentCopywriteTool = createTool({
  id: 'content_copywrite',
  description:
    '生成跨境/社媒营销文案（平台文案）。支持小红书/公众号/抖音/产品详情等多平台，基于产品卖点与目标人群用 LLM 生成多版本，含标题与正文。纯 LLM，Next.js 自举，不依赖后端。',
  inputSchema: z.object({
    platform: z.enum(['xhs', 'wechat', 'douyin', 'product', 'ads']).describe('目标平台：xhs 小红书 / wechat 公众号 / douyin 抖音 / product 产品详情 / ads 广告'),
    product: z.string().min(1).describe('产品/主题描述'),
    sellingPoints: z.array(z.string()).optional().describe('卖点列表'),
    audience: z.string().optional().describe('目标人群'),
    tone: z.string().optional().describe('语气风格，如：种草、专业、活泼'),
    count: z.number().min(1).max(4).optional().describe('生成版本数（默认 2）'),
  }),
  execute: async ({ platform, product, sellingPoints, audience, tone, count }) => {
    try {
      const sys = '你是资深跨境电商内容运营。输出结构化为 JSON：{"title":"...","body":"...","cta":"...","hashtags":["..."]}，只输出 JSON。';
      const p = `平台：${platform}\n产品：${product}\n卖点：${(sellingPoints ?? []).join('、') || '未提供'}\n人群：${audience ?? '泛众'}\n风格：${tone ?? '种草'}\n生成 ${count ?? 2} 个版本。`;
      const versions = [];
      for (let i = 0; i < (count ?? 2); i++) {
        const v = await llmJson<{ title: string; body: string; cta: string; hashtags: string[] }>(sys, `${p}\n版本 ${i + 1}：`);
        versions.push(v);
      }
      return { ok: true, platform, product, versions };
    } catch (e) {
      return { ok: false, error: aiErrorHint(e), platform, product };
    }
  },
});

// ── 2. content_idea_design：创意点子 ─────────────────────────

export const contentIdeaDesignTool = createTool({
  id: 'content_idea_design',
  description:
    '基于产品/主题生成内容创意方案（角度、脚本大纲、标题钩子、互动点）。适合小红书/公众号/短视频的选题与创意。纯 LLM，Next.js 自举。',
  inputSchema: z.object({
    product: z.string().min(1).describe('产品/主题'),
    platform: z.enum(['xhs', 'wechat', 'douyin']).optional().describe('目标平台'),
    count: z.number().min(1).max(5).optional().describe('创意数量（默认 3）'),
  }),
  execute: async ({ product, platform, count }) => {
    try {
      const sys =
        '你是创意策划。输出 JSON：{"ideas":[{"angle":"创意角度","hook":"标题钩子","outline":["步骤1","步骤2"],"interaction":"互动设计"}]}，只输出 JSON。';
      const p = `产品/主题：${product}\n平台：${platform ?? '不限'}\n生成 ${count ?? 3} 个创意。`;
      const out = await llmJson<{ ideas: Array<{ angle: string; hook: string; outline: string[]; interaction: string }> }>(sys, p);
      return { ok: true, product, ideas: out.ideas ?? [] };
    } catch (e) {
      return { ok: false, error: aiErrorHint(e), product };
    }
  },
});

// ── 3. content_audit：内容审核（规则 + LLM 复核） ────────────

const AUDIT_BLOCKLIST = ['赌博', '色情', '毒品', '代开发票', '刷单', '虚假宣传', '医疗功效'];
const AUDIT_SENSITIVE = ['政治敏感', '种族歧视', '宗教攻击'];

export const contentAuditTool = createTool({
  id: 'content_audit',
  description:
    '内容发布前审核：先本地规则命中（违禁词/敏感词/夸大功效/极限词），再用 LLM 复核风险并给出处置建议。Next.js 自举，规则层不依赖任何外部服务。',
  inputSchema: z.object({
    text: z.string().min(1).describe('待审核内容'),
    scene: z.enum(['xhs', 'wechat', 'ads', 'listing']).optional().describe('发布场景'),
  }),
  execute: async ({ text, scene }) => {
    const findings: Array<{ rule: string; severity: 'high' | 'medium' | 'low'; matched: string }> = [];
    for (const w of AUDIT_BLOCKLIST) if (text.includes(w)) findings.push({ rule: '违禁词', severity: 'high', matched: w });
    for (const w of AUDIT_SENSITIVE) if (text.includes(w)) findings.push({ rule: '敏感词', severity: 'high', matched: w });
    const extremes = ['最', '第一', '顶级', '国家级', '100%', '绝对'];
    for (const w of extremes) if (text.includes(w)) findings.push({ rule: '极限词/夸大', severity: 'medium', matched: w });
    // 广告法禁止词
    const adBanned = ['根治', '包治', '永不复发', '全网最低', '史上最强'];
    for (const w of adBanned) if (text.includes(w)) findings.push({ rule: '广告法禁用', severity: 'high', matched: w });

    let llmOpinion: string | null = null;
    try {
      const sys = '你是内容合规审核员。只对给定文本做风险复核，输出 JSON：{"verdict":"pass|review|block","risk":"...","suggestion":"..."}';
      const out = await llmJson<{ verdict: string; risk: string; suggestion: string }>(
        sys,
        `场景：${scene ?? '通用'}\n文本：${text.slice(0, 2000)}\n本地规则命中：${findings.map((f) => f.rule + ':' + f.matched).join('; ') || '无'}`,
      );
      llmOpinion = JSON.stringify(out);
    } catch {
      /* 规则层已足够，LLM 复核失败不阻断 */
    }

    const hasHigh = findings.some((f) => f.severity === 'high');
    return {
      ok: true,
      scene: scene ?? 'generic',
      verdict: hasHigh ? 'block' : findings.length ? 'review' : 'pass',
      findings,
      llmOpinion,
      suggestion: hasHigh ? '存在高风险词，建议修改后再发布' : findings.length ? '存在中风险词，建议人工确认' : '通过，可直接发布',
    };
  },
});

// ── 4. image_prompt_reverse：图片反向 prompt ─────────────────

export const imagePromptReverseTool = createTool({
  id: 'image_prompt_reverse',
  description:
    '给定图片 URL/简短描述，反向生成可用于 AI 绘图的高质量提示词（主体、风格、构图、光影、质感）。纯 LLM 视觉理解，Next.js 自举。',
  inputSchema: z.object({
    image: z.string().optional().describe('图片 URL（可选；未提供时按 description 反推）'),
    description: z.string().optional().describe('图片简短描述（无 URL 时使用）'),
    style: z.string().optional().describe('目标绘图风格倾向，如：写实电商、二次元、3D'),
  }),
  execute: async ({ image, description, style }) => {
    try {
      const sys =
        '你是 AI 绘图提示词工程师。根据图片描述输出 JSON：{"prompt":"完整英文提示词","negative":"负面提示词","tags":["..."],"suggestedModel":"seedream|sd|mj"}，只输出 JSON。';
      const p = `图片URL：${image ?? '无'}\n描述：${description ?? '未知'}\n风格倾向：${style ?? '不限定'}`;
      const out = await llmJson<{ prompt: string; negative: string; tags: string[]; suggestedModel: string }>(sys, p);
      return { ok: true, ...out };
    } catch (e) {
      return { ok: false, error: aiErrorHint(e) };
    }
  },
});

// ── 5. inventory_risk：库存风险（本地数据 + 规则） ───────────

export const inventoryRiskTool = createTool({
  id: 'inventory_risk',
  description:
    '库存风险扫描：读本地 wf_inventory 数据，按确定性规则判定断货/积压/库销比异常风险并给出处置建议。纯本地 PG 数据 + 规则，零外部依赖。',
  inputSchema: z.object({
    sku: z.string().optional().describe('指定 SKU（缺省扫描全部）'),
    thresholdDays: z.number().min(3).max(90).optional().describe('断货预警天数阈值（默认 14）'),
  }),
  execute: async ({ sku, thresholdDays }) => {
    const threshold = thresholdDays ?? 14;
    const rows = await prisma.wf_inventory.findMany({
      where: sku ? { sku } : undefined,
      orderBy: { stock: 'asc' },
      take: 200,
    });
    const risks = [];
    for (const r of rows) {
      const days = r.daily_sales > 0 ? Math.round((r.stock / r.daily_sales) * 10) / 10 : Infinity;
      let level: 'critical' | 'warning' | 'ok' = 'ok';
      let note = '';
      if (r.stock <= 0) { level = 'critical'; note = '已断货'; }
      else if (days <= threshold) { level = 'warning'; note = `预计 ${days} 天后断货`; }
      else if (days >= 90) { level = 'warning'; note = `库销比过高（${days} 天），存在积压`; }
      risks.push({
        sku: r.sku,
        name: r.name,
        stock: r.stock,
        dailySales: r.daily_sales,
        coverDays: days === Infinity ? null : days,
        level,
        note,
        restockQty: r.restock_qty,
        stockoutDate: r.stockout_date,
      });
    }
    const critical = risks.filter((x) => x.level === 'critical').length;
    const warning = risks.filter((x) => x.level === 'warning').length;
    return {
      ok: true,
      summary: `扫描 ${risks.length} 个 SKU：断货风险 ${critical} 个，异常 ${warning} 个`,
      risks: risks.filter((x) => x.level !== 'ok').slice(0, 20),
      thresholdDays: threshold,
    };
  },
});

// ── 6. b2b_daily_digest：每日业务摘要（本地聚合 + LLM） ───────

export const B2bDailyDigestTool = createTool({
  id: 'b2b_daily_digest',
  description:
    '每日业务摘要：聚合本地 PG 业务数据（库存/广告/任务/风控）后用 LLM 生成经营日报要点。Next.js 自举，数据全本地。',
  inputSchema: z.object({
    focus: z.string().optional().describe('关注点，如：库存、广告、风险'),
    date: z.string().optional().describe('日期（YYYY-MM-DD，缺省今天）'),
  }),
  execute: async ({ focus, date }) => {
    const [inv, ad, tasks, risks] = await Promise.all([
      prisma.wf_inventory.findMany().catch(() => []),
      prisma.wf_ad_keywords.findMany().catch(() => []),
      prisma.tasks.findMany().catch(() => []),
      prisma.risk_events.findMany({ where: { resolved: 0 } }).catch(() => []),
    ]);
    const stockShort = inv.filter((r) => r.stock > 0 && r.daily_sales > 0 && r.stock / r.daily_sales <= 14).length;
    const stockout = inv.filter((r) => r.stock <= 0).length;
    const adSpend = ad.reduce((s, r) => s + (r.spend ?? 0), 0);
    const adSales = ad.reduce((s, r) => s + (r.sales ?? 0), 0);
    const taskDone = tasks.filter((t) => t.status === 'completed').length;
    const taskFail = tasks.filter((t) => t.status === 'failed').length;
    const riskOpen = risks.length;

    const stats = {
      date: date ?? new Date().toISOString().slice(0, 10),
      inventory: { total: inv.length, stockShort, stockout },
      ads: { keywords: ad.length, spend: Math.round(adSpend), sales: Math.round(adSales), roi: adSpend > 0 ? Math.round((adSales / adSpend) * 10) / 10 : 0 },
      tasks: { total: tasks.length, done: taskDone, failed: taskFail },
      risk: { open: riskOpen },
      focus: focus ?? '全览',
    };

    try {
      const digest = await llm(
        stats.focus === '全览' ? '你是经营分析师，把结构化经营数据写成简明日报要点（3-5 条，中文，含数字与建议）。纯文本输出。' : `你是经营分析师，聚焦「${stats.focus}」把结构化经营数据写成简明日报要点（3-5 条，中文，含数字与建议）。纯文本输出。`,
        `关注点：${stats.focus}\n数据：${JSON.stringify(stats)}\n请输出日报要点。`,
      );
      return { ok: true, stats, digest };
    } catch (e) {
      return { ok: true, stats, digest: `（LLM 摘要不可用：${aiErrorHint(e)}）`, llmOffline: true };
    }
  },
});

/** 自举能力包注册表：合并进 kernel tool-registry 的 mastra 工具集。 */
export const selfhostTools = {
  content_copywrite: contentCopywriteTool,
  content_idea_design: contentIdeaDesignTool,
  content_audit: contentAuditTool,
  image_prompt_reverse: imagePromptReverseTool,
  inventory_risk: inventoryRiskTool,
  b2b_daily_digest: B2bDailyDigestTool,
};

import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { generateText } from "ai";
import { z } from "zod";
import { getKernel } from "@/src/kernel";
import { getAISDKModel, AIConfigError } from "@/lib/server/ai";

/**
 * AI 生成组件候选（感知现有页面上下文）—— POST /api/agent/pages/[id]/generate
 * body: { prompt: string }
 * 服务端读取该页当前组件树 → 注入 LLM → 生成一个白名单组件候选（不落库，返回待确认）；
 * 前端预览并通过 PATCH append 确认后才落库。/p/[slug] 刷新即时体现。
 */

// 与 chat 路由的 render 白名单保持一致（如增改需同步该常量）
const COMPONENT_IDS = [
  "stat-card", "line-chart", "bar-chart", "area-chart", "pie-chart", "radar-chart",
  "data-table", "progress", "timeline", "tag-list", "form", "action-list", "callout",
  "video-scroll", "question", "ranking", "compare", "metric-grid",
  "html", "html-app", "compose",
] as const;

const COMPONENT_SHAPES =
  "stat-card{title,value,delta?,hint?}；line/bar/area-chart{title?,data:[{label,value}],seriesName?}；pie-chart{title?,data:[{label,value}]}；data-table{title?,columns,rows}；timeline{title?,items:[{time?,title,description?}]}；tag-list{title?,tags}；callout{tone,title?,text}；ranking{title?,items:[{label,value,delta?,hint?}]}；compare{title?,left,right,rows}；metric-grid{title?,metrics}；progress/form/action-list/question/video-scroll/html/html-app/compose 按组件白名单 zod 为准";

const candidateSchema = z.object({
  id: z.string().min(1).max(64),
  component: z.enum(COMPONENT_IDS),
  props: z.record(z.string(), z.unknown()).optional(),
});

export const POST = withDb(async (request: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  let prompt = "";
  try {
    const body = (await request.json()) as { prompt?: string };
    prompt = body.prompt?.trim() ?? "";
  } catch {
    return badRequest("body 必须是 JSON");
  }
  if (!prompt) return badRequest("prompt 不能为空（一句话描述想要的新组件）");

  const kernel = await getKernel();
  const row = await kernel.specs.getPageSpec(id).catch(() => null);
  if (!row) return error(`页面 ${id} 不存在，请先用 generate_page 创建`, 404);

  // ── 上下文感知：把当前组件树摘要注入 prompt（含已占用 id，避免重名）──
  const existingComps = row.spec?.components ?? [];
  const existing = existingComps
    .map((c, i) => `${i}. ${c.component}(id=${c.id}) ${JSON.stringify(c.props ?? {}).slice(0, 160)}`)
    .join("\n");
  const usedIds = existingComps.map((c) => c.id);

  try {
    const model = await getAISDKModel();
    let lastRaw = "";
    for (let attempt = 0; attempt < 3 && !lastRaw; attempt++) {
      const res = await generateText({
        model,
        system:
          "你是 FlowMind 动态看板页面（M5）的组件设计师。根据用户指令与页面现有组件，设计一个风格一致的新组件，只输出一个 JSON 对象（不含 markdown 围栏、不含任何解释）。" +
          "\n组件白名单：" + COMPONENT_IDS.join("、") +
          "\n组件形状：" + COMPONENT_SHAPES +
          "\n已占用组件 id：" + (usedIds.join("、") || "（无）") + "——新组件的 id 必须是全新的，不得与已占用 id 重复。" +
          '\n输出格式：{"id":"英文短横线id","component":"白名单id","props":{该组件的字段}}',
        prompt: `【页面现有组件】\n${existing || "（空页面）"}\n【用户指令】\n${prompt}\n请设计新组件。`,
        temperature: 0.3,
      });
      const raw = res.text?.trim() ?? "";
      if (raw) lastRaw = raw;
    }
    const raw = lastRaw.replace(/^```(?:json)?\s*|\s*```$/g, "");
    if (!raw) return error("模型返回空内容，请稍后重试", 422);
    console.error("[generate-page] raw:", raw.slice(0, 400));
    // 健壮解析：从第一个 { 向后逐级找合法 }（容忍模型输出后的尾随文本/注释）
    const parseJson = (): unknown => {
      const open = raw.indexOf("{");
      if (open < 0) return null;
      for (let end = raw.lastIndexOf("}"); end >= open; end = raw.lastIndexOf("}", end - 1)) {
        try {
          return JSON.parse(raw.slice(open, end + 1));
        } catch {
          /* 继续找下一个 } */
        }
      }
      return null;
    };
    const obj = parseJson();
    if (!obj) return error("模型未返回有效 JSON，请换一种说法重试", 422);
    const parsed = candidateSchema.safeParse(obj);
    if (!parsed.success) {
      return error(`生成的组件不合法：${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`, 422);
    }
    // 服务端兜底：id 撞车（React key 冲突）时自动加后缀，保证唯一
    let id = parsed.data.id;
    if (usedIds.includes(id)) {
      let n = 2;
      while (usedIds.includes(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    return success({ candidate: { ...parsed.data, id }, pageTitle: row.title, componentCount: existingComps.length });
  } catch (e) {
    if (e instanceof AIConfigError) return error(`模型未配置：${e.message}`, 400);
    return error(`组件生成失败：${e instanceof Error ? e.message : String(e)}`, 500);
  }
});

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as DELETE };
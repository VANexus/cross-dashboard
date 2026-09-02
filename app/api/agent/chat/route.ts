/**
 * Web Agent 统一对话端点（P1b — 前端即 Agent）
 *
 * POST /api/agent/chat
 * body: { messages: UIMessage[], pageContext?: { route, title, snapshot, state?, actions } }
 * 响应：AI SDK UIMessage stream（result.toUIMessageStreamResponse()）。
 *
 * - system prompt：运营助手人设 + pageContext 注入（页面上下文 / UI 状态 / 可用页面动作）；
 * - tools：
 *   - ui_action：client-side tool（不定义 execute）——模型发起调用后随流下发，
 *     由前端 addToolResult 回传执行结果再发起下一轮请求；
 *   - 业务工具：后端内核 tool-registry（本地 WorkflowService 直连 + flowmind MCP 技能）。
 */
import { NextRequest } from "next/server";
import {
  streamText,
  convertToModelMessages,
  tool,
  stepCountIs,
  type UIMessage,
  type LanguageModel,
  type ToolSet,
} from "ai";
import { z } from "zod";
import { withDb } from "@/lib/api-helpers";
import { AIConfigError } from "@/lib/ai";
import { getKernel } from "@/src/kernel";
import { workflowSpecSchema } from "@/src/kernel/plugins/spec-store";
import { topoSortSpecSteps } from "@/src/kernel/plugins/mastra-engine";

// pi 深度子代理 + 业务工具链放宽上限（token 不设限）
export const maxDuration = 300;

/**
 * 成本闸（P0 上线硬约束④）：单轮对话最多续跑的模型步数。
 * 每一步都可能触发一次工具调用 + 一次模型调用，步数失控 = token 成本失控。
 * L2 动作会在前端挂起等用户，回传后仍计入步数，故上限需容纳「工具→确认→续推」。
 */
const MAX_AGENT_STEPS = 12;

interface PageAction {
  id: string;
  description: string;
  riskLevel?: 'L0' | 'L1' | 'L2';
}

interface PageContext {
  route?: string;
  title?: string;
  snapshot?: string;
  state?: Record<string, unknown>;
  actions?: PageAction[];
}

interface ChatBody {
  messages?: UIMessage[];
  pageContext?: PageContext;
}

const BASE_PERSONA = `你是 FlowMind 跨境电商系统的运营助手，当前服务「TikTok Shop + 阿里国际站铺货」场景。用简体中文交流，结论先行，可用 ①②③ 列点。
不要编造数据；缺少数据时明确说明，并建议用户前往对应页面查看或补充。外部接口降级/缓存/缺 Key 时如实说明数据状态，不得把降级数据包装成实时结果。
用户的问题可能涉及当前页面内容与页面上的可执行动作。

## 动作权限三级模型（人在环中，必须遵守）
页面动作带风险等级标记：
- [L0] 只读/导航：查询、跳转、高亮，可直接调用；
- [L1] 本地可逆：筛选、填表、生成草稿/Listing/图片等只落在本页或草稿库的动作，可直接调用，用户可自行不采纳；
- [L2] 对外/不可逆：如「上传国际站/发布/删除/导入凭证/花费」等，你只能发起调用，前端会挂起并向用户弹确认卡，用户批准后才真正执行；你不得声称它已经执行成功，只有收到执行结果回传后才能下结论；用户取消时不得重试，应询问下一步。
发起 L2 动作前先用一句话向用户说明它会对外产生什么影响。

你可以在对话中动态渲染白名单 UI 组件（render_component 工具，由前端渲染）：
stat-card 单指标卡片 / line-chart 折线图 / bar-chart 柱状图 / data-table 表格 / form 表单 / action-list 动作列表 / callout 语义提示块。
当回答涉及对比、趋势、排行等结构化信息时优先用组件呈现（props 严格按工具 schema 传），渲染成功后再用一两句话点评。`;

/** client-side tool：不定义 execute，调用权在前端（前端 addToolResult 回传）。 */
const uiActionTool = tool({
  description: "执行用户当前页面上的 UI 操作",
  inputSchema: z.object({
    id: z.string().describe("页面动作 id，取自 system 提示中的「可调用页面动作」列表"),
    params: z.record(z.string(), z.unknown()).optional().describe("动作参数（可选）"),
  }),
});

// 生成式 UI 白名单（M3 component-kit）：与 components/agent/generated 的 propsSchema 形状一致
const COMPONENT_IDS = [
  "stat-card",
  "line-chart",
  "bar-chart",
  "data-table",
  "form",
  "action-list",
  "callout",
] as const;

const renderComponentTool = tool({
  description:
    "在对话中动态渲染白名单 UI 组件（前端渲染）。适合把对比/趋势/排行等结构化结论可视化。渲染成功后你会收到「已渲染组件 xxx」结果，再补一句简短点评。",
  inputSchema: z.object({
    component: z.enum(COMPONENT_IDS).describe("白名单组件 id"),
    props: z.record(z.string(), z.unknown()).describe("组件 props，形状必须符合对应 schema：stat-card{title,value,delta?,hint?}；line-chart/bar-chart{title?,data:[{label,value}],seriesName?}；data-table{title?,columns:[string],rows:[[cell]]}；form{title?,submitLabel?,fields:[{name,label,type?,placeholder?,options?}]}；action-list{title?,items:[{label,description?,actionId?,params?}]}；callout{tone:info|success|warning|danger,title?,text}"),
  }),
});

// M1 插件化：模型与工具统一从后端内核取（aiModel / tools service）。
// tools = ui_action（client tool）+ tool-registry 全部业务工具（本地 + flowmind MCP）。

function buildSystemPrompt(pageContext?: PageContext): string {
  if (!pageContext) return BASE_PERSONA;

  const lines: string[] = [
    BASE_PERSONA,
    "",
    "## 用户当前页面",
    `用户当前在「${pageContext.title ?? "未知页面"}」(${pageContext.route ?? "未知路由"})。`,
  ];

  if (pageContext.snapshot) {
    lines.push("页面数据摘要：", pageContext.snapshot);
  }
  if (pageContext.state && Object.keys(pageContext.state).length > 0) {
    lines.push("页面 UI 状态：", JSON.stringify(pageContext.state, null, 2));
  }
  if (pageContext.actions && pageContext.actions.length > 0) {
    lines.push(
      "可调用以下页面动作（通过 ui_action 工具触发，由前端在页面上执行，不要编造列表之外的 id；方括号为风险等级，[L2] 需用户确认）：",
      ...pageContext.actions.map((a) => `- [${a.riskLevel ?? 'L1'}] ${a.id} — ${a.description}`),
    );
  }

  return lines.join("\n");
}

export const POST = withDb(async (request: NextRequest) => {
  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    body = {};
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return Response.json({ error: "messages is required" }, { status: 400 });
  }

  let model: LanguageModel;
  const kernel = await getKernel();
  try {
    model = await kernel.aiModel.get();
  } catch (err) {
    if (err instanceof AIConfigError) {
      return Response.json({ error: "AI_CONFIG", message: err.message }, { status: 400 });
    }
    throw err;
  }

  // deep_task：派发长任务给 pi 深度子代理（M2）。多步执行 + 自动压缩上下文 +
  // 桥接工具白名单（趋势/长尾/Listing/生图），同步等待完成后返回最终摘要。
  const deepTaskTool = tool({
    description:
      '派发长任务给 pi 深度子代理：适合需要多步执行/连续调用多个业务工具/产出长报告的复杂任务（如"调研 TikTok 美妆趋势并生成选品报告"）。不适合简单问答。完成后返回子代理最终文本摘要。',
    inputSchema: z.object({
      task: z.string().min(1).describe("自然语言任务描述，要具体、可独立执行"),
    }),
    execute: async ({ task }) => {
      const kernel = await getKernel();
      const summary = await kernel.pi.spawn(task);
      return { summary };
    },
  });

  // M4 动态工作流：plan_workflow（模型自己规划 spec 并落库）+ run_workflow（按 slug 执行）。
  // 步骤白名单 = tool-registry 全量工具；DAG 合法性（引用存在 + 无环）在保存前校验。
  const planWorkflowTool = tool({
    description: `把一个可重复执行的多步任务规划为动态工作流 spec 并落库。由你直接规划步骤（每步调用一个白名单工具，可用工具 id：${Object.keys(kernel.tools.mastra).join("、")}），不要编造列表之外的工具。适合用户说"以后每次都帮我做…"或需要固化为流程的任务。`,
    inputSchema: z.object({
      id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, "slug 只能是小写字母/数字/连字符，2-63 字符").describe("工作流 slug，如 daily-trend-push"),
      title: z.string().min(1).max(80).describe("工作流标题"),
      goal: z.string().min(1).describe("生成该工作流的自然语言目标（原样记录用户意图）"),
      steps: workflowSpecSchema.shape.steps.describe("步骤 DAG，dependsOn 声明依赖"),
    }),
    execute: async ({ id, title, goal, steps }) => {
      topoSortSpecSteps(steps); // 引用存在 + 无环，不合法直接抛错给模型重试
      await kernel.specs.saveWorkflowSpec(id, title, goal, { steps });
      return {
        ok: true,
        id,
        stepCount: steps.length,
        message: `工作流「${title}」已保存（${steps.length} 步），可用 run_workflow 工具执行。`,
      };
    },
  });

  const runWorkflowTool = tool({
    description:
      "按 slug 执行已保存的动态工作流（plan_workflow 保存的 spec）。步骤按依赖拓扑序执行，单步失败会记录并继续，整体返回每步结果摘要。",
    inputSchema: z.object({
      id: z.string().min(1).describe("plan_workflow 保存时的工作流 slug"),
    }),
    execute: async ({ id }) => {
      const row = await kernel.specs.getWorkflowSpec(id);
      if (!row) {
        const list = await kernel.specs.listWorkflowSpecs(20);
        return {
          ok: false,
          message: `未找到工作流 ${id}。已保存的有：${list.map((w) => w.id).join("、") || "（无）"}`,
        };
      }
      const result = await kernel.mastra.runSpec(row.spec);
      return {
        ok: result.status === "success",
        id,
        title: row.title,
        status: result.status,
        steps: result.steps,
      };
    },
  });

  // M5 动态页面：generate_page（模型生成白名单组件树 spec 并落库 → /p/[slug] 渲染，
  // 侧边栏「AI 动态页面」分组自动出现导航入口）。props 形状约定同 render_component。
  const generatePageTool = tool({
    description: `生成一个全新的 AI 动态页面并发布（持久化，导航自动出现入口）。组件白名单：${COMPONENT_IDS.join("、")}，props 形状与 render_component 相同（stat-card{title,value,delta?,hint?}；line-chart/bar-chart{title?,data:[{label,value}],seriesName?}；data-table{title?,columns,rows}；form{title?,submitLabel?,fields}；action-list{title?,items}；callout{tone,title?,text}）。适合用户要"做一个 xx 页/看板/灵感页"类需求。成功后把返回的 url 告知用户，可建议用 navigate 动作打开。`,
    inputSchema: z.object({
      id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, "slug 只能是小写字母/数字/连字符，2-63 字符").describe("页面 slug（即 /p/ 路由名），如 autumn-pick-inspiration"),
      title: z.string().min(1).max(80).describe("页面标题"),
      components: z
        .array(
          z.object({
            id: z.string().min(1).max(64).describe("组件实例 id，如 hero-callout"),
            component: z.enum(COMPONENT_IDS).describe("白名单组件 id"),
            props: z.record(z.string(), z.unknown()).optional().describe("组件 props"),
          }),
        )
        .min(1)
        .max(30)
        .describe("页面组件树（自上而下排列）"),
    }),
    execute: async ({ id, title, components }) => {
      await kernel.specs.savePageSpec(id, title, { components });
      return {
        ok: true,
        url: `/p/${id}`,
        componentCount: components.length,
        message: `页面「${title}」已发布到 ${`/p/${id}`}，导航稍后自动出现。`,
      };
    },
  });

  const tools: ToolSet = {
    ui_action: uiActionTool,
    deep_task: deepTaskTool,
    render_component: renderComponentTool,
    plan_workflow: planWorkflowTool,
    run_workflow: runWorkflowTool,
    generate_page: generatePageTool,
    ...kernel.tools.toAiSdkTools(),
  };

  const result = streamText({
    model,
    system: buildSystemPrompt(body.pageContext),
    messages: await convertToModelMessages(messages, { tools }),
    tools,
    // 服务端工具（deep_task/业务工具）执行完自动续跑下一步；
    // ui_action 是 client tool（无 execute），仍会暂停等前端回传。
    // MAX_AGENT_STEPS 为成本闸：超过步数强制停止，防止工具环导致 token 失控。
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error("[agent/chat]", error);
      return error instanceof AIConfigError ? error.message : "生成失败，请稍后重试";
    },
  });
});

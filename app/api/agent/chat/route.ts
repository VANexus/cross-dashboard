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
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
  type LanguageModel,
  type ToolSet,
} from "ai";
import { pipeJsonRender } from "@json-render/core";
import { z } from "zod";
import { withDb } from "@/lib/server/api-helpers";
import { AIConfigError } from "@/lib/server/ai";
import { prisma } from "@/lib/server/db";
import { getKernel } from "@/src/kernel";
import { publish, WORKFLOW_TOPIC } from "@/lib/server/mastra/event-bus";
import { workflowSpecSchema } from "@/src/kernel/plugins/spec-store";
import { topoSortSpecSteps } from "@/src/kernel/plugins/mastra-engine";
import { MemoryService } from "@/lib/server/services/memory.service";
import { ConversationService } from "@/lib/server/services/conversation.service";
import { buildMemoryAugment, resolveAgentIdentity, recordToolOutcome } from "@/lib/server/agent/memory-augment";
import {
  buildSystemPrompt,
  extractLastUserText,
  type PageContext,
} from "@/lib/server/agent/chat-context";
import {
  generateAgentFromPrompt,
  persistGeneratedAgent,
  generateTeamFromPrompt,
} from "@/lib/server/agent-runtime/agent-factory";
import { ensurePresetTemplates } from "@/lib/server/agent-runtime/templates";
import * as teamRepo from "@/lib/server/repositories/team.repository";
import { buildGenUISystem } from "@/lib/server/agent/genui-prompt";

// pi 深度子代理 + 业务工具链放宽上限（token 不设限）
export const maxDuration = 300;

/**
 * 成本闸（P0 上线硬约束④）：单轮对话最多续跑的模型步数。
 * 每一步都可能触发一次工具调用 + 一次模型调用，步数失控 = token 成本失控。
 * L2 动作会在前端挂起等用户，回传后仍计入步数，故上限需容纳「工具→确认→续推」。
 */
const MAX_AGENT_STEPS = 12;

interface ChatBody {
  messages?: UIMessage[];
  pageContext?: PageContext;
  /** 可选：绑定具体 Agent 对话（按 /agents/[id] 页面自动携带）。注入其人格/目标 + 语义召回记忆 + 自进化能力。 */
  agentId?: string;
  /** 可选：会话 id（AI-Native 对话历史持久化）。未提供则不落库（兼容旧调用）。 */
  conversationId?: string;
}

/** client-side tool：不定义 execute，调用权在前端（前端 addToolResult 回传）。 */
const uiActionTool = tool({
  description:
    "执行用户当前页面上的 UI 操作。id 必须与 system 提示中的「可调用页面动作」列表逐字精确匹配（如 startJourney、advanceJourney、focusCard，不要写成 start-journey 等连字符变体）；列表里没有的动作不要编造，改用 readKpi 读指标或直接向用户说明。",
  inputSchema: z.object({
    id: z.string().describe("页面动作 id，逐字取自 system 提示中的「可调用页面动作」列表"),
    params: z.record(z.string(), z.unknown()).optional().describe("动作参数（可选）"),
  }),
});

// 生成式 UI 白名单（M3 component-kit）：与 components/agent/generated 的 propsSchema 形状一致
const COMPONENT_IDS = [
  "stat-card",
  "line-chart",
  "bar-chart",
  "area-chart",
  "pie-chart",
  "radar-chart",
  "data-table",
  "progress",
  "timeline",
  "tag-list",
  "form",
  "action-list",
  "callout",
  "video-scroll",
  "question",
  "ranking",
  "compare",
  "metric-grid",
  "html",
  "html-app",
  "compose",
] as const;

const COMPONENT_SHAPES =
  "stat-card{title,value,delta?,hint?}；line-chart/bar-chart/area-chart{title?,data:[{label,value}],seriesName?}；pie-chart{title?,data:[{label,value}],seriesName?}；radar-chart{title?,data:[{label,value}]}；data-table{title?,columns:[string],rows:[[cell]]}；progress{label?,value:0-100,display?}；timeline{title?,items:[{time?,title,description?}]}；tag-list{title?,tags:[string],tone?}；form{title?,submitLabel?,fields:[{name,label,type?,placeholder?,options?}]}；action-list{title?,items:[{label,description?,actionId?,params?}]}；callout{tone:info|success|warning|danger,title?,text}；video-scroll{title?,videos:[{title?,cover,url,durationS?,brand?,badge?}]}（竞品广告素材横向滑动视频墙）；question{title?,text,options:[{label,value?,hint?}],multiple?,submitLabel?}（向人类提问并回传答案）；ranking{title?,unit?,items:[{rank?,label,value,delta?,hint?}]}；compare{title?,left,right,rows:[{label,left,right,winner?}]}；metric-grid{title?,metrics:[{label,value,delta?,tone?}]}；html{title?,html:受控HTML片段}（markdown 表达不了的自由富布局，渲染前 DOMPurify 消毒；只输出纯展示 HTML，禁止 script/iframe/on* 事件/style url()/javascript: 链接）；html-app{title?,html:完整HTML片段(含style/script),height?,data?}（AHTML 自由完整页面：任意未预设 UI、CSS 动画、内联 JS 交互、看板/卡片墙，沙箱 iframe 安全渲染；读 window.__AHTML__.data 拿上下文，window.parent.postMessage 回传事件）；compose{title?,layout:grid|stack|tabs|columns,cols?,data?,cells:[{title?,component,props?,span?}]}（组装式布局容器：用现成白名单组件快速拼装成看板/概览；props 值可含 ${data.字段} 从 data 绑定）";

const renderComponentTool = tool({
  description:
    "在对话中动态渲染白名单 UI 组件（前端渲染）。适合把对比/趋势/排行/占比/流程/多维度等结构化结论可视化。渲染成功后你会收到「已渲染组件 xxx」结果，再补一句简短点评。",
  inputSchema: z.object({
    component: z.enum(COMPONENT_IDS).describe("白名单组件 id"),
    props: z.record(z.string(), z.unknown()).describe(`组件 props，形状必须符合对应 schema：${COMPONENT_SHAPES}`),
  }),
});

// M1 插件化：模型与工具统一从后端内核取（aiModel / tools service）。
// tools = ui_action（client tool）+ tool-registry 全部业务工具（本地 + flowmind MCP）。

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

  // ── AI-Native 对话历史持久化：本轮 user 消息先落库（会话恢复/记忆语料源） ──
  const conversationService = new ConversationService();
  const conversationId = body.conversationId?.trim() || null;
  const lastUserTextForPersist = extractLastUserText(messages);
  if (conversationId) {
    try {
      await conversationService.appendMessage(conversationId, { role: "user", content: lastUserTextForPersist });
      await conversationService.ensureTitle(conversationId, lastUserTextForPersist);
    } catch (e) {
      console.error("[chat] persist user msg failed:", (e as Error).message);
    }
  }

  // ── 记忆/自进化/Agent 赋能：解析绑定 Agent，注入语义召回记忆 + 已进化能力 ──
  const lastUserText = extractLastUserText(messages);
  const identity = await resolveAgentIdentity(body.agentId);
  const augment = await buildMemoryAugment({ identity, query: lastUserText });
  const memoryService = new MemoryService();

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
  // 子代理实时进展（thinking/tool_start/tool_end/done/error）经 event-bus 推给
  // /api/agent/stream SSE → 抽屉遥测面板实时滚动，避免用户干等长任务。
  const deepTaskTool = tool({
    description:
      '派发长任务给 pi 深度子代理：适合需要多步执行/连续调用多个业务工具/产出长报告的复杂任务（如"调研 TikTok 美妆趋势并生成选品报告"）。不适合简单问答。完成后返回子代理最终文本摘要。',
    inputSchema: z.object({
      task: z.string().min(1).describe("自然语言任务描述，要具体、可独立执行"),
    }),
    execute: async ({ task }) => {
      const kernel = await getKernel();
      const summary = await kernel.pi.spawn(task, {
        onEvent: (ev) => {
          if (ev.type === 'delta') return; // 增量文本太频繁，跳过
          const brief = ev.text.replace(/\s+/g, ' ').trim().slice(0, 80);
          const label =
            ev.type === 'thinking' ? `深度子代理 · 正在思考：${brief}`
            : ev.type === 'tool_start' ? `深度子代理 · 正在调用工具：${brief}`
            : ev.type === 'tool_end' ? `深度子代理 · 工具完成：${brief}`
            : ev.type === 'done' ? '深度子代理 · 任务完成，正在汇总结论'
            : ev.type === 'error' ? `深度子代理 · 任务失败：${brief}`
            : `深度子代理 · ${brief}`;
          publish(WORKFLOW_TOPIC, { type: 'telemetry', agent: '深度子代理', text: label });
        },
      });
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
      // 真实运行日志：执行前落 running，完成后回写状态/每步结果（供「工作流状态」面板展示真实数据）
      const runId = `wfrun-${Date.now()}`;
      await prisma.wf_workflow_runs
        .create({
          data: { id: runId, workflow_id: id, status: "running", steps: "[]", summary: "", created_by: "agent" },
        })
        .catch((e) => console.error("[run_workflow] create run log", e?.message));
      try {
        const result = await kernel.mastra.runSpec(row.spec);
        await prisma.wf_workflow_runs
          .update({
            where: { id: runId },
            data: {
              status: result.status,
              steps: JSON.stringify(result.steps ?? []),
              summary:
                (result.steps ?? [])
                  .map((s) => `${s.id}:${s.ok ? "ok" : "fail"}`)
                  .join("; ") || "",
              completed_at: new Date().toISOString(),
            },
          })
          .catch((e) => console.error("[run_workflow] update run log", e?.message));
        return {
          ok: result.status === "success",
          id,
          title: row.title,
          status: result.status,
          steps: result.steps,
        };
      } catch (e) {
        await prisma.wf_workflow_runs
          .update({
            where: { id: runId },
            data: { status: "failed", completed_at: new Date().toISOString() },
          })
          .catch(() => {});
        throw e;
      }
    },
  });

  // M5 动态页面：generate_page（模型生成白名单组件树 spec 并落库 → /p/[slug] 渲染，
  // 侧边栏「AI 动态页面」分组自动出现导航入口）。props 形状约定同 render_component。
  const generatePageTool = tool({
    description: `生成一个全新的 AI 动态页面并发布（持久化，导航自动出现入口）。组件白名单：${COMPONENT_IDS.join("、")}，props 形状与 render_component 相同（${COMPONENT_SHAPES}）。适合用户要"做一个 xx 页/看板/灵感页"类需求。成功后把返回的 url 告知用户，可建议用 navigate 动作打开。`,
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

  // ── 记忆赋能工具：对话中可查询/沉淀记忆（Milvus 混合检索 + 三库写回）──
  const memorySearchTool = tool({
    description:
      "在 FlowMind 记忆系统（PG 事实源 + Milvus dense+BM25 混合检索 + Mongo 版本历史）中做语义检索，返回带相关度的历史记忆（Agent 反思/进化能力/过往运营结论）。回答前需要回忆历史经验、或用户问「你记得…吗」时使用。",
    inputSchema: z.object({
      query: z.string().describe("检索关键词或问题"),
      agentId: z.string().optional().describe("限定某 Agent 的记忆（可选，默认全部）"),
      limit: z.number().int().min(1).max(20).optional().describe("返回条数，默认 5"),
    }),
    execute: async ({ query, agentId, limit }) => {
      const mem = await memoryService.search(query, { limit: limit ?? 5, agentId });
      return {
        total: mem.length,
        hits: mem.map((m) => ({
          id: m.id,
          title: m.title,
          content: (m.content ?? "").slice(0, 300),
          score: m.score,
          tags: m.tags ?? [],
          agentId: m.agentId ?? null,
        })),
      };
    },
  });

  const memoryStoreTool = tool({
    description:
      "把一条值得沉淀的经验/结论写入记忆系统（PG 事实源 + Milvus 语义索引 + Mongo 版本历史），供后续所有 Agent 语义召回。适合对话/工具执行产生了重要运营结论、经验教训、能力要点时调用，让知识随工作积累。",
    inputSchema: z.object({
      title: z.string().describe("记忆标题（简洁，如「瑜伽垫 6 月选品结论」）"),
      content: z.string().describe("记忆内容（结论/经验，要具体可复用）"),
      type: z.enum(["insight", "tip", "skill", "prompt"]).optional().describe("类型，默认 insight"),
      tags: z.array(z.string()).optional().describe("标签（可加 agent/领域关键词）"),
      agentId: z.string().optional().describe("归属 Agent（可选）"),
    }),
    execute: async ({ title, content, type, tags, agentId }) => {
      const entry = await memoryService.create({
        zone: "agent",
        title,
        content,
        type: type ?? "insight",
        tags: [...(tags ?? []), "chat"],
        agentId,
      });
      return { id: entry.id, title: entry.title, version: entry.version, ok: true };
    },
  });

  // ── Agent 动态组建：主 Agent 一句话创建新 Agent / 组建团队 ──
  // 现有 6 个预设人格作为模板参考；生成后立即接入运行时节律，组成协同拓扑。
  const createAgentTool = tool({
    description:
      "一句话动态创建一个新的 Agent（拥有完整独立人格提示词）。适合用户说「帮我创建一个负责 xx 的 Agent」时。生成后自动启动运行时节律，可在 Agent 管理页与协同拓扑看到。",
    inputSchema: z.object({
      prompt: z.string().min(2).describe("一句话描述想要的 Agent 职责/定位"),
      referenceTemplateIds: z.array(z.string()).optional().describe("重点参考的预设模板 id（可选）"),
    }),
    execute: async ({ prompt, referenceTemplateIds }) => {
      await ensurePresetTemplates();
      const g = await generateAgentFromPrompt(prompt, { referenceTemplateIds });
      const id = await persistGeneratedAgent(g);
      return {
        ok: true,
        id,
        name: g.name,
        type: g.type,
        description: g.description,
        systemPrompt: g.config.persona.systemPrompt,
        message: `Agent「${g.name}」已创建并启动（${id}），正在进入运行时节律。`,
      };
    },
  });

  const createTeamTool = tool({
    description:
      "一句话动态组建一个 Agent 团队：LLM 根据目标生成 2~4 个职责互补的 Agent 并组队。适合用户说「组建一个团队来做 xx」时。团队成员自动进入运行时节律并形成协同拓扑。",
    inputSchema: z.object({
      prompt: z.string().min(2).describe("一句话描述团队目标"),
    }),
    execute: async ({ prompt }) => {
      await ensurePresetTemplates();
      const { team, agents } = await generateTeamFromPrompt(prompt);
      const memberIds: string[] = [];
      for (const g of agents) memberIds.push(await persistGeneratedAgent(g));
      const t = await teamRepo.createTeam({
        name: team.name,
        goal: team.goal,
        memberAgentIds: memberIds,
        leaderAgentId: memberIds[0] ?? null,
      });
      return {
        ok: true,
        team: { id: t.id, name: t.name, goal: t.goal },
        members: agents.map((a, i) => ({ id: memberIds[i], name: a.name, type: a.type })),
        message: `团队「${t.name}」已组建：${agents.map((a) => a.name).join("、")}（${t.id}）。`,
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
    memory_search: memorySearchTool,
    memory_store: memoryStoreTool,
    create_agent: createAgentTool,
    create_team: createTeamTool,
    // 业务工具：执行成功自动沉淀 outcome 记忆（工作流 → 记忆反馈闭环）
    ...kernel.tools.toAiSdkTools((name, _input, output) => {
      const summary =
        typeof output === "string"
          ? output
          : (() => {
              try {
                return JSON.stringify(output);
              } catch {
                return String(output);
              }
            })();
      void recordToolOutcome({
        toolName: name,
        agentId: identity?.agentId,
        title: `工具执行 · ${name}`,
        summary: summary.slice(0, 600),
      });
    }),
  };

  const system = (buildSystemPrompt(body.pageContext) + augment.block + "\n\n" + buildGenUISystem()).trim();

  // 对话开始时把全局 presence 置 busy（球/顶栏/心跳同一数据源），结束时复位 idle
  publish(WORKFLOW_TOPIC, { type: 'state', state: 'busy', activity: 0.7 });

  const result = streamText({
    model,
    system,
    messages: await convertToModelMessages(messages, { tools }),
    tools,
    // 服务端工具（deep_task/业务工具）执行完自动续跑下一步；
    // ui_action 是 client tool（无 execute），仍会暂停等前端回传。
    // MAX_AGENT_STEPS 为成本闸：超过步数强制停止，防止工具环导致 token 失控。
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    onFinish: ({ text }) => {
      publish(WORKFLOW_TOPIC, { type: 'state', state: 'idle', activity: 0.12 });
      // AI-Native 对话历史：助手回复落库（与 user 消息成对，支撑会话恢复/记忆语料）
      if (conversationId && text) {
        conversationService.appendMessage(conversationId, { role: "assistant", content: text })
          .catch((e) => console.error("[chat] persist assistant msg failed:", (e as Error).message));
        // 记忆融合：对话产生实质结论时自动沉淀到记忆系统（PG + Milvus + Mongo 三库），
        // 供后续所有 Agent 语义召回——对话不再是孤岛，知识随工作积累。
        const trimmed = text.trim();
        if (trimmed.length > 120) {
          memoryService.create({
            zone: "conversation",
            title: `${lastUserTextForPersist.slice(0, 16)} · 对话结论`,
            content: `【用户】${lastUserTextForPersist}\n【Agent 结论】${trimmed.slice(0, 500)}`,
            type: "insight",
            tags: ["chat", "conversation", "auto"],
          }).catch((e) => console.warn("[chat] auto-memory failed:", (e as Error).message));
        }
      }
    },
  });

  // json-render Inline：把 UIMessage 流经 pipeJsonRender 包装，抽出行级 JSONL patches 为 data part
  // （客户端 useJsonRenderMessage 编译成 spec → <Renderer> 渲染）。工具调用/文本/数据原样穿透。
  // 同时 tee 一份流，收集 data-spec parts 用于会话持久化（历史恢复时组件能重现）。
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const piped = pipeJsonRender(result.toUIMessageStream());
      const [a, b] = piped.tee();
      writer.merge(a);
      // 收集 data-spec parts（data 载荷为 JSONL patch 数组，可序列化 → 落库供恢复）
      const collectedParts: unknown[] = [];
      const reader = b.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && (value as { type?: string }).type === 'data-spec') {
            const data = (value as { data?: unknown }).data;
            if (Array.isArray(data)) collectedParts.push(...data);
          }
        }
      } finally {
        reader.releaseLock();
      }
      // 流结束后把 data-spec parts 随消息落库（content 已由 onFinish 落 text）
      if (conversationId && collectedParts.length > 0) {
        conversationService
          .appendMessage(conversationId, {
            role: "assistant",
            content: "",
            parts: collectedParts.map((p) => ({ type: "data", data: p })),
          })
          .catch((e) => console.error("[chat] persist genui parts failed:", (e as Error).message));
      }
    },
    onError: (error) => {
      console.error("[agent/chat]", error);
      // 出错同样复位（否则球/顶栏卡在 busy）
      publish(WORKFLOW_TOPIC, { type: 'state', state: 'idle', activity: 0.12 });
      return error instanceof AIConfigError ? error.message : "生成失败，请稍后重试";
    },
  });
  return createUIMessageStreamResponse({ stream });
});

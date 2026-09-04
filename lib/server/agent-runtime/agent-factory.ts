/**
 * FlowMind RAK — Agent 工厂（一句话动态生成）
 * 主 Agent（web 对话内核）或用户一句话 → LLM 生成完整独立人格配置 → 落库 + 启动运行时节律。
 * 现有 6 个预设模板作为参考底座传入，保证生成质量与结构一致。
 * 零 mock：模型未配置抛 AIConfigError，绝不返回假 Agent。
 */
import { generateText } from "ai";
import { z } from "zod";
import { getAISDKModel, AIConfigError } from "../ai";
import { getDefaultConfig } from "./personas";
import { listTemplates } from "./templates";
import * as agentRepo from "../repositories/agent.repository";
import { agentRuntime } from "./runtime";
import type { AgentConfig, AgentType } from "@/lib/shared/types";

// ── 生成结果的 zod 校验（结构质量门，防止 LLM 输出残缺配置） ──
export const generatedAgentSchema = z.object({
  name: z.string().min(1).max(50),
  type: z
    .string()
    .min(1)
    .max(40)
    .regex(
      /^[\p{L}\p{N}_-]{1,40}$/u,
      "type 仅允许字母/数字/下划线/连字符（含中文，会规范化为 slug）",
    )
    .transform((s) =>
      s
        .toLowerCase()
        .trim()
        .replace(/[\s.]+/g, "-")
        .replace(/[^\p{L}\p{N}_-]/gu, "")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40),
    ),
  description: z.string().min(1).max(200),
  config: z.object({
    persona: z.object({
      systemPrompt: z.string().min(20, "systemPrompt 太短，请写完整独立提示词"),
      communicationStyle: z.string().min(1),
      expertise: z.array(z.string().min(1)).min(1).max(10),
    }),
    goals: z
      .array(
        z.object({
          text: z.string().min(2),
          priority: z.enum(["high", "medium", "low"]),
        }),
      )
      .min(1)
      .max(5),
    mood: z.object({
      // LLM 可能输出枚举外情绪词（neutral/calm...），放宽为字符串，落库时映射回 6 态
      state: z.string().min(1).max(20),
      energy: z.number().min(0).max(1),
    }),
    cycleConfig: z
      .object({
        intervalMs: z.number().int().min(5000).max(3600000).optional(),
        enabled: z.boolean().optional(),
      })
      .optional(),
  }),
});

export type GeneratedAgent = z.infer<typeof generatedAgentSchema>;

function buildTemplateExamples(): string {
  const templates = PRESET_EXAMPLES;
  return templates
    .map(
      (t) =>
        `- 模板「${t.name}」（type=${t.type}）：
  职责：${t.description}
  systemPrompt：${t.config.persona.systemPrompt.slice(0, 120)}…
  expertise：${t.config.persona.expertise.join("、")}
  goals：${t.config.goals.map((g) => `${g.text}[${g.priority}]`).join("；")}`,
    )
    .join("\n");
}

// 供 prompt 使用的精简示例（避免每次读库；与 templates.ts 种子一致）
const PRESET_EXAMPLES: AgentTemplateLike[] = [
  {
    name: "哨兵 Agent",
    type: "sentinel",
    description: "安全哨兵：监控系统健康、检测异常、预防威胁",
    config: getDefaultConfig("sentinel", "sentinel-example"),
  },
  {
    name: "运营 Agent",
    type: "operations",
    description: "跨境电商运营专家：选品、库销比、Listing",
    config: getDefaultConfig("operations", "operations-example"),
  },
  {
    name: "营销 Agent",
    type: "marketing",
    description: "广告与营销优化：PPC、关键词、A+ 内容",
    config: getDefaultConfig("marketing", "marketing-example"),
  },
  {
    name: "风控 Agent",
    type: "risk_control",
    description: "风控专家：反欺诈、合规审计、预警建模",
    config: getDefaultConfig("risk_control", "risk-example"),
  },
];

interface AgentTemplateLike {
  name: string;
  type: string;
  description: string;
  config: AgentConfig;
}

const GENERATE_SYSTEM = `你是 FlowMind 的「Agent 设计师」。用户用一句话描述想要的 Agent，你需要把它设计成一套完整的、可独立运行的 Agent 人格配置，只输出一个 JSON，不要任何其他文字、不要 markdown 代码块。

参考以下预设模板，保持同样的结构与质量水准：
${buildTemplateExamples()}

输出 JSON 结构（严格）：
{
  "name": "中文名（如 物流时效监控 Agent）",
  "type": "英文 slug（小写/数字/连字符，如 logistics-monitor）",
  "description": "一句话职责说明",
  "config": {
    "persona": {
      "systemPrompt": "按以下分节写（每节用 ## 标题，共 200~350 字，具体可执行，禁止套话）：
        ## 角色定位 —— 你是谁、服务于什么业务场景
        ## 核心职责 —— 2~4 条明确职责，每条可落地为具体动作
        ## 工作方式 —— 拿到任务先做什么、数据缺失怎么处理、失败如何上报
        ## 边界与协作 —— 只做什么、明确不做什么、结果产出给谁、哪些步骤需要人确认",
      "communicationStyle": "沟通风格",
      "expertise": ["3-6 个专业领域标签"]
    },
    "goals": [{"text": "目标描述", "priority": "high|medium|low"}],
    "mood": {"state": "focused|alert|tired|stressed|curious|satisfied", "energy": 0.6~0.95}
  }
}
不要编造通用套话，要针对用户需求具体化；systemPrompt 必须包含「边界与协作」节，明确哪些动作要交给用户确认。`;

const TEAM_SYSTEM = `你是 FlowMind 的「团队架构师」。用户用一句话描述团队目标，你需要设计一个分工明确、可协同的 Agent 团队：1 个团队 + 2~4 个不同职责的 Agent（每个都要完整人格配置）。只输出一个 JSON，不要任何其他文字、不要 markdown 代码块。

参考预设模板保持质量：
${buildTemplateExamples()}

输出 JSON 结构（严格）：
{
  "team": { "name": "团队中文名", "goal": "团队目标一句话" },
  "agents": [
    {
      "name": "Agent 中文名",
      "type": "英文 slug",
      "description": "职责一句话",
      "config": {
        "persona": { "systemPrompt": "按 GENERATE_SYSTEM 同样的分节写法（## 角色定位 / ## 核心职责 / ## 工作方式 / ## 边界与协作），200~350 字", "communicationStyle": "风格", "expertise": ["领域"] },
        "goals": [{"text": "目标", "priority": "high|medium|low"}],
        "mood": {"state": "focused", "energy": 0.8}
      }
    }
  ]
}
团队成员要职责互补、覆盖目标所需的关键能力，避免同质化；每个 Agent 的「边界与协作」要写明：产出交接给哪个 Agent / 哪个环节必须由用户确认。`;

async function model() {
  try {
    return await getAISDKModel();
  } catch (e) {
    if (e instanceof AIConfigError) throw e;
    throw e;
  }
}

async function llmJson(system: string, user: string, retries = 1): Promise<string> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const m = await model();
      const res = await generateText({
        model: m,
        system,
        prompt: user,
        temperature: 0.6,
        maxOutputTokens: 2600,
      });
      const raw = res.text.trim();
      if (!raw) {
        lastErr = new Error(`模型返回空内容（attempt ${attempt + 1}）`);
        continue;
      }
      // 容错：去掉可能的 ```json 围栏
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
      if (!cleaned) {
        lastErr = new Error(`模型返回空 JSON（attempt ${attempt + 1}）`);
        continue;
      }
      return cleaned;
    } catch (e) {
      lastErr = e as Error;
      if (attempt < retries) continue;
      throw lastErr;
    }
  }
  throw lastErr ?? new Error("LLM 调用失败");
}

/**
 * 一句话生成单个 Agent。
 * @param prompt 用户的一句话需求
 * @param referenceTemplates 可选的参考模板 id 列表（默认全部）
 */
export async function generateAgentFromPrompt(
  prompt: string,
  opts: { referenceTemplateIds?: string[] } = {},
): Promise<GeneratedAgent> {
  void opts;
  const templates = await listTemplates();
  const ref =
    opts.referenceTemplateIds && opts.referenceTemplateIds.length > 0
      ? templates.filter((t) => opts.referenceTemplateIds!.includes(t.id))
      : templates;
  const system =
    GENERATE_SYSTEM +
    (ref.length > 0
      ? `\n用户指定重点参考以下模板：${ref.map((t) => `${t.name}(${t.type})`).join("、")}。`
      : "");
  const raw = await llmJson(system, prompt);
  const parsed = generatedAgentSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`Agent 生成配置不合法：${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  }
  return parsed.data;
}

/**
 * 一句话生成一个团队（团队 + 多个 Agent）。
 */
export async function generateTeamFromPrompt(prompt: string): Promise<{
  team: { name: string; goal: string };
  agents: GeneratedAgent[];
}> {
  const raw = await llmJson(TEAM_SYSTEM, prompt);
  const obj = JSON.parse(raw) as {
    team?: { name?: string; goal?: string };
    agents?: unknown[];
  };
  if (!obj.team || !Array.isArray(obj.agents) || obj.agents.length < 1) {
    throw new Error("团队生成结果不合法：缺少 team 或 agents");
  }
  const team = {
    name: String(obj.team.name ?? "未命名团队").slice(0, 50),
    goal: String(obj.team.goal ?? prompt).slice(0, 200),
  };
  const agents = obj.agents.map((a) => {
    const p = generatedAgentSchema.safeParse(a);
    if (!p.success) {
      throw new Error(`团队成员配置不合法：${p.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    }
    return p.data;
  });
  return { team, agents };
}

const MOOD_STATES = new Set(["focused", "alert", "tired", "stressed", "curious", "satisfied"] as const);
function mapMoodState(s: string): "focused" | "alert" | "tired" | "stressed" | "curious" | "satisfied" {
  return MOOD_STATES.has(s as never) ? (s as never) : "focused";
}

/** 由生成结果落库并启动运行时节律。 */
export async function persistGeneratedAgent(g: GeneratedAgent): Promise<AgentType> {
  const id = `${g.type}-${Date.now().toString().slice(-6)}`;
  const config: AgentConfig = {
    persona: {
      systemPrompt: g.config.persona.systemPrompt,
      communicationStyle: g.config.persona.communicationStyle,
      expertise: g.config.persona.expertise,
    },
    goals: g.config.goals.map((goal, i) => ({
      id: `${id}-g${i + 1}`,
      text: goal.text,
      progress: 0.05 + Math.random() * 0.15,
      priority: goal.priority,
    })),
    mood: {
      state: mapMoodState(g.config.mood.state),
      energy: g.config.mood.energy,
      lastUpdated: new Date().toISOString(),
    },
    cycleConfig: {
      intervalMs: g.config.cycleConfig?.intervalMs ?? 45000,
      enabled: g.config.cycleConfig?.enabled ?? true,
    },
  };
  await agentRepo.createAgent({
    id,
    name: g.name,
    type: g.type,
    description: g.description,
    config,
    status: "online",
  });
  // 立即接入运行时节律
  void agentRuntime.startAgent(id).catch(console.error);
  return id;
}

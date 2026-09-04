/**
 * FlowMind RAK — 预设 Agent 模板
 * 现有 6 个人格从「写死定住的实例」固化为「模板」：一句话动态生成时可参考，
 * 也可一键实例化为运行中的 Agent。模板落 agent_templates 表。
 */
import { prisma } from "../db";
import { getDefaultConfig } from "./personas";
import type { AgentTemplate } from "@/lib/shared/types";

interface TemplateSeed {
  id: string;
  type: string;
  name: string;
  description: string;
}

/** 6 个预设模板（与 personas.ts 的默认人格一一对应） */
export const PRESET_TEMPLATES: TemplateSeed[] = [
  {
    id: "sentinel",
    type: "sentinel",
    name: "哨兵 Agent",
    description: "安全哨兵：监控系统健康、检测异常行为、预防安全威胁、保障系统稳定",
  },
  {
    id: "dispatch",
    type: "dispatch",
    name: "调度 Agent",
    description: "总调度师：任务分解、资源调度、Agent 编组、DAG 编排、负载均衡",
  },
  {
    id: "operations",
    type: "operations",
    name: "运营 Agent",
    description: "跨境电商运营专家：选品分析、库销比监控、Listing 优化、BSR 分析",
  },
  {
    id: "risk_control",
    type: "risk_control",
    name: "风控 Agent",
    description: "风控专家：反欺诈检测、合规审计、风险评估、预警建模、支付安全",
  },
  {
    id: "legal",
    type: "legal",
    name: "法务 Agent",
    description: "跨境电商法务顾问：知识产权保护、CE 认证、品牌保护、合规审查",
  },
  {
    id: "marketing",
    type: "marketing",
    name: "营销 Agent",
    description: "广告与营销优化专家：PPC 广告、关键词优化、AI 制图、A+ 内容、转化优化",
  },
];

function toTemplate(seed: TemplateSeed, sort: number): AgentTemplate {
  return {
    id: seed.id,
    type: seed.type,
    name: seed.name,
    description: seed.description,
    config: getDefaultConfig(seed.type as Parameters<typeof getDefaultConfig>[0], `${seed.id}-template`),
    sort,
  };
}

/** 幂等：把 6 个预设人格同步进 agent_templates 表（重复 id 用新配置覆盖）。 */
export async function ensurePresetTemplates(): Promise<number> {
  let count = 0;
  for (let i = 0; i < PRESET_TEMPLATES.length; i++) {
    const t = toTemplate(PRESET_TEMPLATES[i], i);
    await prisma.agent_templates.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        type: t.type,
        name: t.name,
        description: t.description,
        config: JSON.stringify(t.config),
        sort: t.sort,
      },
      update: {
        type: t.type,
        name: t.name,
        description: t.description,
        config: JSON.stringify(t.config),
        sort: t.sort,
      },
    });
    count++;
  }
  return count;
}

/** 读取全部模板（按 sort 排序）。 */
export async function listTemplates(): Promise<AgentTemplate[]> {
  const rows = await prisma.agent_templates.findMany({ orderBy: { sort: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    description: r.description,
    config: parseTemplateConfig(r.config),
    sort: r.sort,
  }));
}

function parseTemplateConfig(raw: string): AgentTemplate["config"] {
  try {
    const c = JSON.parse(raw);
    return {
      persona: c.persona ?? { systemPrompt: "", communicationStyle: "", expertise: [] },
      goals: c.goals ?? [],
      mood: c.mood ?? { state: "focused", energy: 0.8, lastUpdated: new Date().toISOString() },
      cycleConfig: c.cycleConfig ?? { intervalMs: 45000, enabled: true },
    };
  } catch {
    return {
      persona: { systemPrompt: "", communicationStyle: "", expertise: [] },
      goals: [],
      mood: { state: "focused", energy: 0.8, lastUpdated: new Date().toISOString() },
      cycleConfig: { intervalMs: 45000, enabled: true },
    };
  }
}

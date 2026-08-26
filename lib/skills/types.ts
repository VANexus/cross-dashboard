/**
 * FlowMind — 技能自动发现类型定义
 *
 * 定义后端 REST 发现的技能结构（DiscoveredSkill）及运行时信封。
 * 外部模块应从此文件导入类型，避免直接依赖发现客户端散布。
 *
 * 对齐 flowmind REST API：
 *   GET /api/v1/manifest      -> { skills: DiscoveredSkill[] }
 *   GET /api/v1/manifest/{id} -> DiscoveredSkill（404 -> { error, available }）
 *   GET /api/v1/health        -> { status, skill_count, version }
 */

// ── JSON Schema 最小子集（技能入参/出参描述） ──

/** JSON Schema 兼容结构（仅描述发现接口返回的字段，不做完整校验） */
export interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  [k: string]: unknown;
}

// ── 技能发现核心类型 ──

/** 技能可靠性画像（决定调度策略与 UI 展示） */
export interface ReliabilityProfile {
  /** 是否确定性输出（确定性技能可缓存、可重放） */
  deterministic: boolean;
  /** 是否输出推理链（reasoning chain，用于 UI 折叠展示） */
  emits_reasoning_chain: boolean;
  /** 典型延迟（ms），用于超时预算与加载提示 */
  typical_latency_ms: number;
  /** 置信度 0..1（路由参考） */
  confidence: number;
}

/** 已发现的技能（运行时从后端 REST API 拉取，不再硬编码） */
export interface DiscoveredSkill {
  /** 技能唯一标识（与后端注册名一致） */
  id: string;
  /** 技能展示名 */
  name: string;
  /** 语义化版本 */
  version: string;
  /** 技能描述（中文） */
  description: string;
  /** 标签（用于意图路由评分与 UI 展示，后端可缺省） */
  tags?: string[];
  /** 入参 JSON Schema（null 表示无结构化入参） */
  input_schema: JSONSchema | null;
  /** 出参 JSON Schema（null 表示无结构化出参） */
  output_schema: JSONSchema | null;
  /** 可靠性画像 */
  reliability_profile: ReliabilityProfile;
}

/** 技能清单信封（GET /api/v1/manifest） */
export interface SkillManifest {
  skills: DiscoveredSkill[];
}

/** 健康检查信封（GET /api/v1/health） */
export interface SkillHealth {
  status: string;
  skill_count: number;
  version: string;
}

// ── 配置 ──

/** 读取 flowmind 后端 base URL */
export function getFlowmindUrl(): string {
  return process.env.NEXT_PUBLIC_FLOWMIND_URL ?? "http://127.0.0.1:8001";
}

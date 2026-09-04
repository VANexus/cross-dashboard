/**
 * FlowMind — 通用服务发现契约（服务发现plus）
 *
 * 规范化契约：无论后端走 MCP / A2A / REST 哪种协议，
 * 前端都通过统一的 ServiceManifest / DiscoveredSkill 形状消费。
 * 协议适配器负责把后端特有格式映射到这个规范形状。
 *
 * 这是"通用前端"的地基——前端不再硬编码工作流，
 * 而是从连接的后端动态发现服务并渲染。
 */

// ── 协议类型 ──

/** 后端支持的协议类型 */
export type DiscoveryProtocol = "mcp" | "a2a" | "rest";

/** 后端连接状态 */
export type ServiceHealth = "connected" | "degraded" | "unreachable" | "checking";

// ── JSON Schema 子集（技能输入/输出描述） ──

/** 简化的 JSON Schema 描述（足以驱动动态 UI 生成） */
export interface SkillJsonSchema {
  type?: string;
  properties?: Record<string, SkillJsonSchema>;
  required?: string[];
  items?: SkillJsonSchema;
  enum?: unknown[];
  description?: string;
  default?: unknown;
  $ref?: string;
  $defs?: Record<string, SkillJsonSchema>;
  [key: string]: unknown;
}

// ── 规范化技能描述 ──

/** 规范化后的技能描述（协议无关） */
export interface DiscoveredSkill {
  /** 技能唯一 id（后端原始 id） */
  id: string;
  /** 技能显示名 */
  name: string;
  /** 技能描述 */
  description: string;
  /** 版本号 */
  version: string;
  /** 标签（用于意图匹配 / 分组） */
  tags: string[];
  /** 输入参数 JSON Schema（可空） */
  inputSchema: SkillJsonSchema | null;
  /** 输出结果 JSON Schema（可空） */
  outputSchema: SkillJsonSchema | null;
  /** 可靠性画像 */
  reliability: {
    deterministic: boolean;
    emitsReasoningChain: boolean;
    typicalLatencyMs: string;
    confidence: number;
  };
  /** 所属后端服务 id */
  serviceId: string;
  /** UI 分组（由适配器或注册表推断） */
  category: string;
  /** 图标名（lucide icon name，可选） */
  icon?: string;
  /** 原始协议（调试用） */
  protocol: DiscoveryProtocol;
}

// ── 规范化服务清单 ──

/** 单个后端服务的发现清单 */
export interface ServiceManifest {
  /** 服务唯一 id（由注册表分配或 URL 派生） */
  serviceId: string;
  /** 服务显示名 */
  serviceName: string;
  /** 服务协议 */
  protocol: DiscoveryProtocol;
  /** 服务基础 URL */
  baseUrl: string;
  /** 服务版本 */
  version: string;
  /** 连接状态 */
  health: ServiceHealth;
  /** 发现的技能列表 */
  skills: DiscoveredSkill[];
  /** 服务级元数据（透传） */
  metadata: Record<string, unknown>;
  /** 最近一次发现时间戳 ms */
  lastDiscoveredAt: number;
  /** 最近一次错误（如有） */
  lastError?: string;
}

// ── 后端连接配置 ──

/** 后端连接配置（用户在前端配置或预设） */
export interface ServiceEndpoint {
  /** 服务 id */
  id: string;
  /** 显示名 */
  name: string;
  /** 协议 */
  protocol: DiscoveryProtocol;
  /** 连接 URL */
  url: string;
  /** 可选认证头 */
  authHeaders?: Record<string, string>;
  /** 是否启用 */
  enabled: boolean;
  /** 超时 ms */
  timeout?: number;
}

// ── 意图路由 ──

/** 意图匹配结果 */
export interface IntentMatch {
  /** 匹配到的技能 */
  skill: DiscoveredSkill;
  /** 匹配置信度 0-1 */
  confidence: number;
  /** 匹配到的关键词 */
  matchedKeywords: string[];
}

// ── 技能执行 ──

/** 技能执行参数 */
export interface SkillExecutionRequest {
  serviceId: string;
  skillId: string;
  args: Record<string, unknown>;
}

/** 技能执行结果 */
export interface SkillExecutionResult<T = unknown> {
  ok: boolean;
  data: T;
  error?: { code?: string; message?: string };
  metrics?: { degraded?: boolean; degradationReason?: string | null };
  /** 执行耗时 ms */
  durationMs: number;
}

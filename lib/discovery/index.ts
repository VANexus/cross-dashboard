/**
 * FlowMind — 通用服务发现层（服务发现plus）统一导出
 *
 * 使用方只需从 "@/lib/discovery" 导入，无需关心内部协议。
 */
// ── 类型 ──
export type {
  DiscoveryProtocol,
  ServiceHealth,
  SkillJsonSchema,
  DiscoveredSkill,
  ServiceManifest,
  ServiceEndpoint,
  IntentMatch,
  SkillExecutionRequest,
  SkillExecutionResult,
} from "./types";

// ── 协议适配器 ──
export type { ProtocolAdapter } from "./protocol-adapter";
export { MCPAdapter } from "./mcp-adapter";
export { A2AAdapter } from "./a2a-adapter";
export { RESTAdapter } from "./rest-adapter";
export { createAdapter, PROTOCOL_META } from "./adapter-registry";

// ── 注册表 Store ──
export { useServiceRegistry } from "./service-registry";

// ── 意图路由器 ──
export { routeIntent, findSkill } from "./intent-router";

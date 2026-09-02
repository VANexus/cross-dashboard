/**
 * FlowMind — 适配器注册表（工厂）
 *
 * 按协议分发适配器实例。新增协议只需在此注册一行。
 */
import type { ProtocolAdapter } from "./protocol-adapter";
import type { DiscoveryProtocol, ServiceEndpoint } from "./types";
import { MCPAdapter } from "./mcp-adapter";
import { A2AAdapter } from "./a2a-adapter";
import { RESTAdapter } from "./rest-adapter";

/** 按协议创建适配器实例 */
export function createAdapter(endpoint: ServiceEndpoint): ProtocolAdapter {
  switch (endpoint.protocol) {
    case "mcp":
      return new MCPAdapter(endpoint);
    case "a2a":
      return new A2AAdapter(endpoint);
    case "rest":
      return new RESTAdapter(endpoint);
    default:
      // 未知协议退化为 REST（最低门槛）
      return new RESTAdapter(endpoint);
  }
}

/** 协议显示元数据（UI 用） */
export const PROTOCOL_META: Record<
  DiscoveryProtocol,
  { label: string; description: string; color: string }
> = {
  mcp: {
    label: "MCP",
    description: "Model Context Protocol（推荐）",
    color: "text-info",
  },
  a2a: {
    label: "A2A",
    description: "Agent-to-Agent（流式 SSE）",
    color: "text-viz-2",
  },
  rest: {
    label: "REST",
    description: "通用 HTTP（最低门槛）",
    color: "text-success",
  },
};

/**
 * FlowMind — A2A 协议适配器
 *
 * 连接走 Google A2A 协议的后端（AgentCard + SSE）。
 * 把 AgentCard.skills 映射到 DiscoveredSkill。
 *
 * 注意：当前 rak-flowmind 实际只暴露 MCP，A2A 端口 8002 无服务端。
 * 此适配器保留给支持 A2A 的第三方后端（如未来接入的外部 Agent 网络）。
 */
import type { ProtocolAdapter } from "./protocol-adapter";
import type {
  ServiceEndpoint,
  ServiceManifest,
  DiscoveredSkill,
  SkillExecutionRequest,
  SkillExecutionResult,
} from "./types";

/** A2A AgentCard 最小子集（仅本适配器依赖的字段） */
interface A2ACardLike {
  name: string;
  description?: string;
  version?: string;
  skills?: A2ASkillLike[];
}

interface A2ASkillLike {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  category?: string;   // A2A 扩展字段（非协议标准，但允许后端声明）
  version?: string;
  inputModes?: string[];
  outputModes?: string[];
}

export class A2AAdapter implements ProtocolAdapter {
  readonly protocol = "a2a" as const;
  private endpoint: ServiceEndpoint;

  constructor(endpoint: ServiceEndpoint) {
    this.endpoint = endpoint;
  }

  async discover(endpoint: ServiceEndpoint): Promise<ServiceManifest> {
    const discoveredAt = Date.now();
    const cardUrl = `${endpoint.url.replace(/\/$/, "")}/.well-known/agent.json`;

    try {
      const res = await fetch(cardUrl, {
        headers: { accept: "application/json", ...endpoint.authHeaders },
        signal: AbortSignal.timeout(endpoint.timeout ?? 10000),
      });

      if (!res.ok) {
        return this.unreachableManifest(
          endpoint,
          `AgentCard 返回 HTTP ${res.status}`,
          discoveredAt,
        );
      }

      const card = (await res.json()) as A2ACardLike;
      const skills: DiscoveredSkill[] = (card.skills ?? []).map((s) => ({
        id: s.id,
        name: s.name ?? s.id,
        description: s.description ?? "",
        version: s.version ?? card.version ?? "0.0.0",
        tags: s.tags ?? inferTagsFromModes(s.inputModes, s.outputModes),
        inputSchema: modesToSchema(s.inputModes),
        outputSchema: modesToSchema(s.outputModes),
        reliability: {
          deterministic: false,
          emitsReasoningChain: true,
          typicalLatencyMs: "<500",
          confidence: 0.7,
        },
        serviceId: endpoint.id,
        // A2A 协议本身不携带 category，默认"通用"
        // （A2A 后端若需自定义分组，应在 skill 描述中体现，
        //  由意图路由器通过语义匹配处理）
        category: s.category ?? "通用",
        protocol: "a2a",
      }));

      return {
        serviceId: endpoint.id,
        serviceName: card.name ?? endpoint.name,
        protocol: "a2a",
        baseUrl: endpoint.url,
        version: card.version ?? "0.0.0",
        health: "connected",
        skills,
        metadata: {
          agentDescription: card.description,
          skillCount: skills.length,
        },
        lastDiscoveredAt: discoveredAt,
      };
    } catch (err) {
      return this.unreachableManifest(
        endpoint,
        err instanceof Error ? err.message : String(err),
        discoveredAt,
      );
    }
  }

  async execute(request: SkillExecutionRequest): Promise<SkillExecutionResult> {
    // A2A execute 需走 SSE 流式，此处返回降级提示。
    // 完整实现需引入 A2AClient 的流式消费（参见 lib/a2a/edge-agent.ts）。
    const start = Date.now();
    return {
      ok: false,
      data: null,
      error: {
        code: "NOT_IMPLEMENTED",
        message: `A2A 技能执行需流式 SSE，请通过 EdgeAgent 路径调用（skill: ${request.skillId}）`,
      },
      durationMs: Date.now() - start,
    };
  }

  async ping(endpoint: ServiceEndpoint): Promise<boolean> {
    try {
      const cardUrl = `${endpoint.url.replace(/\/$/, "")}/.well-known/agent.json`;
      const res = await fetch(cardUrl, {
        headers: { accept: "application/json", ...endpoint.authHeaders },
        signal: AbortSignal.timeout(endpoint.timeout ?? 5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private unreachableManifest(
    endpoint: ServiceEndpoint,
    lastError: string,
    discoveredAt: number,
  ): ServiceManifest {
    return {
      serviceId: endpoint.id,
      serviceName: endpoint.name,
      protocol: "a2a",
      baseUrl: endpoint.url,
      version: "0.0.0",
      health: "unreachable",
      skills: [],
      metadata: {},
      lastDiscoveredAt: discoveredAt,
      lastError,
    };
  }
}

// ── 辅助 ──

function inferTagsFromModes(
  inputModes?: string[],
  outputModes?: string[],
): string[] {
  const tags = new Set<string>();
  const all = [...(inputModes ?? []), ...(outputModes ?? [])];
  for (const mode of all) {
    if (mode.includes("text")) tags.add("text");
    if (mode.includes("image")) tags.add("image");
    if (mode.includes("audio")) tags.add("audio");
    if (mode.includes("video")) tags.add("video");
    if (mode.includes("file")) tags.add("file");
  }
  return [...tags];
}

function modesToSchema(modes?: string[]): DiscoveredSkill["inputSchema"] {
  if (!modes?.length) return null;
  return {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: `支持模式：${modes.join(", ")}`,
      },
    },
    required: ["content"],
  };
}


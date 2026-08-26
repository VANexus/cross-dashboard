/**
 * FlowMind — MCP 协议适配器
 *
 * 连接走 MCP 的后端（如 rak-flowmind）。
 *
 * 发现路径：复用后端的 REST 发现端点（/api/v1/manifest），
 * 这是 MCP 生态的惯例——工具清单走 REST，调用走 MCP。
 * 执行路径：通过 MCP Streamable HTTP 调用 callTool。
 *
 * 复用 ContentMCPClient 的连接复用 + 断路器模式。
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ProtocolAdapter } from "./protocol-adapter";
import type {
  ServiceEndpoint,
  ServiceManifest,
  DiscoveredSkill,
  SkillJsonSchema,
  SkillExecutionRequest,
  SkillExecutionResult,
} from "./types";

/** 后端 /api/v1/manifest 响应形状 */
interface RawManifest {
  skills: Array<{
    id: string;
    name: string;
    version: string;
    description: string;
    category?: string;   // 后端声明，前端只渲染不推断
    tags?: string[];     // 后端声明，供意图路由用
    input_schema: SkillJsonSchema | null;
    output_schema: SkillJsonSchema | null;
    reliability_profile: {
      deterministic: boolean;
      emits_reasoning_chain: boolean;
      typical_latency_ms: string;
      confidence: number;
    };
  }>;
}

/** MCP tool 列表响应中的工具形状（最小子集） */
interface MCPToolLike {
  name: string;
  description?: string;
  inputSchema?: SkillJsonSchema;
}

export class MCPAdapter implements ProtocolAdapter {
  readonly protocol = "mcp" as const;

  private endpoint: ServiceEndpoint;
  private mcpClient: Client | null = null;
  private connecting: Promise<Client> | null = null;

  constructor(endpoint: ServiceEndpoint) {
    this.endpoint = endpoint;
  }

  // ── 发现 ──

  async discover(endpoint: ServiceEndpoint): Promise<ServiceManifest> {
    const baseUrl = endpoint.url.replace(/\/mcp\/?$/, "");
    const manifestUrl = `${baseUrl}/api/v1/manifest`;
    const discoveredAt = Date.now();

    try {
      const res = await fetch(manifestUrl, {
        headers: endpoint.authHeaders,
        signal: AbortSignal.timeout(endpoint.timeout ?? 10000),
      });

      if (!res.ok) {
        return this.unreachableManifest(
          endpoint,
          `manifest 返回 HTTP ${res.status}`,
          discoveredAt,
        );
      }

      const raw = (await res.json()) as RawManifest;
      const skills: DiscoveredSkill[] = (raw.skills ?? []).map((s) => ({
        id: s.id,
        name: s.name ?? s.id,
        description: s.description ?? "",
        version: s.version ?? "0.0.0",
        // 后端是 source of truth：category/tags 由后端显式声明
        tags: s.tags ?? [],
        inputSchema: s.input_schema,
        outputSchema: s.output_schema,
        reliability: {
          deterministic: s.reliability_profile?.deterministic ?? true,
          emitsReasoningChain: s.reliability_profile?.emits_reasoning_chain ?? false,
          typicalLatencyMs: s.reliability_profile?.typical_latency_ms ?? "<100",
          confidence: s.reliability_profile?.confidence ?? 0.8,
        },
        serviceId: endpoint.id,
        category: s.category ?? "通用",
        protocol: "mcp",
      }));

      return {
        serviceId: endpoint.id,
        serviceName: endpoint.name,
        protocol: "mcp",
        baseUrl,
        version: skills[0]?.version ?? "0.0.0",
        health: "connected",
        skills,
        metadata: { skillCount: skills.length },
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

  // ── 执行 ──

  async execute(request: SkillExecutionRequest): Promise<SkillExecutionResult> {
    const start = Date.now();
    try {
      const client = await this.ensureConnected();
      const result = await client.callTool(
        { name: request.skillId, arguments: { inp: request.args } },
        undefined,
        { timeout: this.endpoint.timeout ?? 30000 },
      );

      if (result.isError) {
        const msg = extractText(result.content) ?? `${request.skillId}：技能执行返回错误`;
        return {
          ok: false,
          data: null,
          error: { code: "SKILL_ERROR", message: msg },
          durationMs: Date.now() - start,
        };
      }

      const raw = (result.structuredContent ?? parseTextContent(
        result.content as Array<{ type?: string; text?: string }>,
      )) as { ok?: boolean; data?: unknown; error?: { code?: string; message?: string } } | null;

      if (!raw || typeof raw.ok !== "boolean") {
        // 非信封结构，直接透传
        return { ok: true, data: raw, durationMs: Date.now() - start };
      }

      return {
        ok: raw.ok,
        data: raw.data as never,
        error: raw.error ?? undefined,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        ok: false,
        data: null,
        error: {
          code: "EXECUTION_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
        durationMs: Date.now() - start,
      };
    }
  }

  // ── 探活 ──

  async ping(endpoint: ServiceEndpoint): Promise<boolean> {
    try {
      const baseUrl = endpoint.url.replace(/\/mcp\/?$/, "");
      const res = await fetch(`${baseUrl}/api/v1/health`, {
        headers: endpoint.authHeaders,
        signal: AbortSignal.timeout(endpoint.timeout ?? 5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── 内部 ──

  private async ensureConnected(): Promise<Client> {
    if (this.mcpClient) return this.mcpClient;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const client = new Client(
        { name: "flowmind-discovery", version: "1.0.0" },
        { capabilities: {} },
      );
      const transport = new StreamableHTTPClientTransport(
        new URL(this.endpoint.url),
      );
      await client.connect(transport);
      this.mcpClient = client;
      return client;
    })();

    try {
      return await this.connecting;
    } finally {
      this.connecting = null;
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
      protocol: "mcp",
      baseUrl: endpoint.url.replace(/\/mcp\/?$/, ""),
      version: "0.0.0",
      health: "unreachable",
      skills: [],
      metadata: {},
      lastDiscoveredAt: discoveredAt,
      lastError,
    };
  }
}

// ── 辅助函数 ──

/** 从 MCP content 数组提取文本 */
function extractText(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  const block = content.find((c) => c && typeof c === "object" && "text" in c);
  if (block && typeof block.text === "string") return block.text;
  return null;
}

/** 解析 MCP text content 为 JSON */
function parseTextContent(content: Array<{ type?: string; text?: string }>): unknown {
  const block = content.find((c) => c.type === "text" && c.text);
  if (!block?.text) return null;
  try {
    return JSON.parse(block.text);
  } catch {
    return block.text;
  }
}

/**
 * FlowMind — 通用 REST 协议适配器
 *
 * 用于走纯 REST 发现的后端（无 MCP、无 A2A）。
 * 约定：
 *   GET /api/v1/manifest        → 技能清单
 *   GET /api/v1/manifest/{id}   → 单个技能
 *   GET /api/v1/health          → 健康探针
 *   POST /api/v1/invoke/{id}    → 技能执行（可选）
 *
 * 这是最低门槛的协议——任何 HTTP 服务都能接入。
 */
import type { ProtocolAdapter } from "./protocol-adapter";
import type {
  ServiceEndpoint,
  ServiceManifest,
  DiscoveredSkill,
  SkillJsonSchema,
  SkillExecutionRequest,
  SkillExecutionResult,
} from "./types";

interface RawSkill {
  id: string;
  name?: string;
  version?: string;
  description?: string;
  category?: string;   // 后端声明，前端只渲染
  tags?: string[];
  input_schema?: SkillJsonSchema | null;
  output_schema?: SkillJsonSchema | null;
  reliability_profile?: {
    deterministic?: boolean;
    emits_reasoning_chain?: boolean;
    typical_latency_ms?: string;
    confidence?: number;
  };
}

interface RawManifest {
  skills?: RawSkill[];
}

export class RESTAdapter implements ProtocolAdapter {
  readonly protocol = "rest" as const;
  private endpoint: ServiceEndpoint;

  constructor(endpoint: ServiceEndpoint) {
    this.endpoint = endpoint;
  }

  async discover(endpoint: ServiceEndpoint): Promise<ServiceManifest> {
    const baseUrl = endpoint.url.replace(/\/$/, "");
    const discoveredAt = Date.now();

    try {
      const res = await fetch(`${baseUrl}/api/v1/manifest`, {
        headers: { accept: "application/json", ...endpoint.authHeaders },
        signal: AbortSignal.timeout(endpoint.timeout ?? 10000),
      });

      if (!res.ok) {
        return this.unreachableManifest(endpoint, `HTTP ${res.status}`, discoveredAt);
      }

      const raw = (await res.json()) as RawManifest;
      const rawSkills = raw.skills ?? [];
      const skills: DiscoveredSkill[] = rawSkills.map((s) => ({
        id: s.id,
        name: s.name ?? s.id,
        description: s.description ?? "",
        version: s.version ?? "0.0.0",
        tags: s.tags ?? [],
        inputSchema: s.input_schema ?? null,
        outputSchema: s.output_schema ?? null,
        reliability: {
          deterministic: s.reliability_profile?.deterministic ?? true,
          emitsReasoningChain: s.reliability_profile?.emits_reasoning_chain ?? false,
          typicalLatencyMs: s.reliability_profile?.typical_latency_ms ?? "<200",
          confidence: s.reliability_profile?.confidence ?? 0.8,
        },
        serviceId: endpoint.id,
        category: s.category ?? "通用",
        protocol: "rest",
      }));

      return {
        serviceId: endpoint.id,
        serviceName: endpoint.name,
        protocol: "rest",
        baseUrl,
        version: "0.0.0",
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

  async execute(request: SkillExecutionRequest): Promise<SkillExecutionResult> {
    const start = Date.now();
    const baseUrl = this.endpoint.url.replace(/\/$/, "");

    try {
      const res = await fetch(`${baseUrl}/api/v1/invoke/${request.skillId}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...this.endpoint.authHeaders,
        },
        body: JSON.stringify(request.args),
        signal: AbortSignal.timeout(this.endpoint.timeout ?? 30000),
      });

      if (!res.ok) {
        return {
          ok: false,
          data: null,
          error: { code: `HTTP_${res.status}`, message: `技能执行返回 HTTP ${res.status}` },
          durationMs: Date.now() - start,
        };
      }

      const raw = (await res.json()) as {
        ok?: boolean;
        data?: unknown;
        error?: { code?: string; message?: string };
      };

      return {
        ok: raw.ok ?? true,
        data: raw.data as never,
        error: raw.error,
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

  async ping(endpoint: ServiceEndpoint): Promise<boolean> {
    try {
      const baseUrl = endpoint.url.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/v1/health`, {
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
      protocol: "rest",
      baseUrl: endpoint.url.replace(/\/$/, ""),
      version: "0.0.0",
      health: "unreachable",
      skills: [],
      metadata: {},
      lastDiscoveredAt: discoveredAt,
      lastError,
    };
  }
}

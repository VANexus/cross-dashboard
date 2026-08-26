/**
 * FlowMind — flowmind MCP 客户端（Streamable HTTP）
 *
 * 连接 rak-flowmind 的 MCP 服务（flowmind-mcp-http），调用 content_* 技能。
 * Web 端零密钥：所有 AI 逻辑与云密钥都在 flowmind，本客户端只做「调用 + 结构化解析」。
 *
 * 配置走环境变量：
 *   FLOWMIND_MCP_URL   默认 http://127.0.0.1:8001/mcp
 *
 * 错误分类（对齐 VLError 语义）：
 *   environment   连接/握手失败（MCP 服务未启动）
 *   skill         技能执行失败（SkillResult.ok=false，携带 error.code/message）
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export type ContentMCPErrorCategory = "environment" | "skill" | "unknown";

export class ContentMCPError extends Error {
  category: ContentMCPErrorCategory;
  skillCode?: string;

  constructor(category: ContentMCPErrorCategory, message: string, skillCode?: string) {
    super(message);
    this.name = "ContentMCPError";
    this.category = category;
    this.skillCode = skillCode;
  }
}

export interface ContentMCPConfig {
  url: string;
}

export function getMCPConfig(): ContentMCPConfig {
  return {
    url: process.env.FLOWMIND_MCP_URL ?? "http://127.0.0.1:8001/mcp",
  };
}

/** flowmind 技能返回的 SkillResult 信封（对齐 contracts.py）。 */
interface SkillResultEnvelope<T> {
  ok: boolean;
  skill?: string;
  data: T;
  error?: { code?: string; message?: string } | null;
  metrics?: { degraded?: boolean; degradation_reason?: string | null };
}

function isSkillEnvelope(v: unknown): v is SkillResultEnvelope<unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    "ok" in (v as Record<string, unknown>) &&
    "data" in (v as Record<string, unknown>)
  );
}

export class ContentMCPClient {
  private cfg: ContentMCPConfig;

  constructor(cfg?: ContentMCPConfig) {
    this.cfg = cfg ?? getMCPConfig();
  }

  get url(): string {
    return this.cfg.url;
  }

  /** 探活：tools/list 握手。失败抛 ContentMCPError(environment)。 */
  async ping(): Promise<boolean> {
    try {
      await this.listTools();
      return true;
    } catch (err) {
      if (err instanceof ContentMCPError) throw err;
      return false;
    }
  }

  /** 调用 content_* 技能。入参按 flowmind 约定包一层 `inp`。返回技能业务 data。 */
  async call<T>(tool: string, args: Record<string, unknown>): Promise<T> {
    const client = new Client(
      { name: "flowmind-web", version: "1.0.0" },
      { capabilities: {} },
    );

    let transport: StreamableHTTPClientTransport | null = null;
    try {
      transport = new StreamableHTTPClientTransport(new URL(this.cfg.url));
      await client.connect(transport);
      const result = await client.callTool({
        name: tool,
        arguments: { inp: args },
      });

      const raw = result.structuredContent ??
        this.parseTextContent(result.content as Array<{ type?: string; text?: string }>);
      if (!isSkillEnvelope(raw)) {
        throw new ContentMCPError("unknown", `技能 ${tool} 返回结构异常`);
      }
      if (!raw.ok) {
        const code = raw.error?.code ?? "INTERNAL";
        const msg = raw.error?.message ?? "技能执行失败";
        throw new ContentMCPError("skill", `${tool}：${msg}`, code);
      }
      return raw.data as T;
    } catch (err) {
      if (err instanceof ContentMCPError) throw err;
      const cause = err instanceof Error ? err.message : String(err);
      throw new ContentMCPError("environment", `连接 flowmind MCP 失败（${tool}）：${cause}`);
    } finally {
      try {
        await client.close();
      } catch {
        /* transport may already be closed */
      }
    }
  }

  /** 列出 MCP 工具名（探活用）。 */
  async listTools(): Promise<string[]> {
    const client = new Client(
      { name: "flowmind-web", version: "1.0.0" },
      { capabilities: {} },
    );
    const transport = new StreamableHTTPClientTransport(new URL(this.cfg.url));
    try {
      await client.connect(transport);
      const res = await client.listTools();
      return res.tools.map((t) => t.name);
    } finally {
      try {
        await client.close();
      } catch {
        /* ignore */
      }
    }
  }

  private parseTextContent(
    content: Array<{ type?: string; text?: string }>,
  ): unknown {
    const block = content.find((c) => c.type === "text" && c.text);
    if (!block?.text) return null;
    try {
      return JSON.parse(block.text);
    } catch {
      return block.text;
    }
  }
}

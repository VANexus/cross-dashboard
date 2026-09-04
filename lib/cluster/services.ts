/**
 * FlowMind — 集群服务目录（Zero-Config Service Catalog）
 *
 * 设计文档：docs/architecture/2026-09-03-cluster-native-service-architecture.md §3
 *
 * 全仓**唯一**的基础设施端点解析入口。规则：
 *   1. 解析优先级：显式 env 覆盖（逃生门） > 运行形态自动检测（cluster/dev） > 目录内置默认；
 *   2. 凭据只声明「读哪个 env key」，目录不携带任何密钥值；值由
 *      cluster = K8s Secret 注入 / dev = 工作区 .env 提供；
 *   3. 业务代码禁止再写 `process.env.X ?? "http://…"散装默认值——新增外部依赖 = 目录加一行；
 *   4. UI 设置页不允许出现任何基础设施端点/密钥输入框（只读状态展示走 publicServiceView）。
 */
import { clusterMode, meshHost, type ClusterMode } from "./runtime";

export type ServiceLayer = "app" | "data" | "ai" | "search" | "obs";

export interface ClusterServiceSpec {
  /** 稳定 ID（`域.名字`），resolveUrl 的键 */
  id: string;
  /** 中文显示名（设置页/面板用） */
  name: string;
  layer: ServiceLayer;
  /** 集群内 svc 地址（cluster 形态默认） */
  inClusterUrl: string;
  /** 开发机默认地址（mesh NodePort / 本机回环）；null = 无开发机入口（内网专属） */
  devUrl: string | null;
  /** 显式覆盖 env（逃生门，开发调试用；生产不设置） */
  envKey?: string;
  /** 浏览器可直达地址（仅边缘同源反代路径有意义）；cluster 形态给同源 path */
  browserPath?: string;
  /** 内部专属：不对公网暴露（auth 模型 v2），dev 形态若 devUrl=null 则不可达 */
  internalOnly?: boolean;
  /** 消费此服务的凭据 env 名（只名不值） */
  credentialEnvKeys?: string[];
  /** 待核实说明（如 LiteLLM mesh NodePort） */
  note?: string;
}

export const CLUSTER_SERVICES: readonly ClusterServiceSpec[] = [
  {
    id: "flowmind.mcp",
    name: "FlowMind MCP（技能后端）",
    layer: "app",
    inClusterUrl: "http://flowmind-mcp.core-api.svc:8001/mcp",
    devUrl: "http://127.0.0.1:8001/mcp",
    envKey: "FLOWMIND_MCP_URL",
    browserPath: "/backend-mcp/mcp",
    note: "rak-flowmind（Python FastMCP），云密钥唯一持有者；发现面 /api/v1/manifest",
  },
  {
    id: "flowmind.api",
    name: "FlowMind API（后端服务）",
    layer: "app",
    inClusterUrl: "http://flowmind-api.core-api.svc:8080",
    devUrl: "http://127.0.0.1:8080",
    envKey: "FLOWMIND_API_URL",
    internalOnly: true,
    note: "P2 前后端分离后承接 /api/*（边缘同源反代）",
  },
  {
    id: "data.postgres",
    name: "PostgreSQL（pg-main）",
    layer: "data",
    inClusterUrl: "tcp://pg-main-rw.database.svc:5432/flowmind",
    devUrl: null, // 开发机走 mesh NodePort，见 postgresConfig()
    envKey: "PGDATABASE_URL",
    internalOnly: true,
    credentialEnvKeys: ["PGUSER", "PGPASSWORD"],
    note: "P1 数据层迁移目标库；dev 连接 = meshHost:30432",
  },
  {
    id: "data.redis",
    name: "Redis（缓存/租约锁）",
    layer: "data",
    inClusterUrl: "redis://redis.database.svc:6379",
    devUrl: null, // meshHost:30379，见 redisUrl()
    envKey: "REDIS_URL",
    internalOnly: true,
    credentialEnvKeys: ["REDIS_PASSWORD"],
  },
  {
    id: "data.mongodb",
    name: "MongoDB（文档/审计库）",
    layer: "data",
    inClusterUrl: "mongodb://mongo.database.svc:27017",
    devUrl: null, // meshHost:30417，见 mongoUrl()
    envKey: "MONGODB_URL",
    internalOnly: true,
    credentialEnvKeys: ["MONGODB_USER", "MONGODB_PASSWORD"],
    note: "记忆版本历史 / 进化阶段审计 / 召回日志等文档型数据",
  },
  {
    id: "data.milvus",
    name: "Milvus（向量检索）",
    layer: "data",
    inClusterUrl: "http://milvus-standalone.milvus.svc:19530",
    devUrl: null, // meshHost:31953，见 milvusUrl()
    envKey: "MILVUS_URL",
    internalOnly: true,
    note: "记忆系统语义检索：dense(本地/网关向量) + sparse(BM25 内置全文)",
  },
  {
    id: "data.minio",
    name: "MinIO（S3 对象存储）",
    layer: "data",
    inClusterUrl: "http://minio-api.minio.svc:9000",
    devUrl: "https://s3.app.xrak.top",
    envKey: "S3_ENDPOINT",
    internalOnly: true,
    credentialEnvKeys: ["S3_ACCESS_KEY", "S3_SECRET_KEY"],
    note: "集群内注意坑#5（minio-api svc 端口）；dev 走公网 S3 层域名",
  },
  {
    id: "ai.litellm",
    name: "LiteLLM 模型网关",
    layer: "ai",
    inClusterUrl: "http://litellm.agentic.svc:4000/v1",
    devUrl: "http://${mesh}:4000/v1", // 字面量占位符，resolveService 时替换为 meshHost()
    envKey: "AI_LLM_BASE_URL",
    credentialEnvKeys: ["LITELLM_MASTER_KEY"],
    note: "dev NodePort 待核实；未配 env 时 AI 层回落 ai_config 覆盖",
  },
  {
    id: "search.searx",
    name: "SearXNG（内网搜索）",
    layer: "search",
    inClusterUrl: "http://searx.agentic.svc:8080",
    devUrl: null,
    envKey: "SEARX_URL",
    internalOnly: true,
    note: "无登录系统·内网专属（公网 404），开发机不可直连",
  },
  {
    id: "obs.otel",
    name: "OTel Collector",
    layer: "obs",
    inClusterUrl: "http://otel-collector.monitoring.svc:4317",
    devUrl: null, // meshHost:4317
    envKey: "OTEL_EXPORTER_OTLP_ENDPOINT",
    internalOnly: true,
  },
] as const;

// ── 解析 ─────────────────────────────────────────────────────

export interface ResolvedService {
  spec: ClusterServiceSpec;
  mode: ClusterMode;
  /** 服务端消费地址；内网专属服务在 dev 无入口时为 null */
  url: string | null;
}

const SPEC_BY_ID = new Map(CLUSTER_SERVICES.map((s) => [s.id, s]));

export function getServiceSpec(id: string): ClusterServiceSpec {
  const spec = SPEC_BY_ID.get(id);
  if (!spec) throw new Error(`[cluster-catalog] 未登记的服务：${id}（新增外部依赖请先在目录加一行）`);
  return spec;
}

function devBaseUrl(spec: ClusterServiceSpec): string | null {
  if (spec.devUrl === null) {
    // data 层特例：PG/Redis/OTel 的 dev 入口 = mesh NodePort
    switch (spec.id) {
      case "data.postgres":
        return `tcp://${meshHost()}:30432/flowmind`;
      case "data.redis":
        return `redis://${meshHost()}:30379`;
      case "data.mongodb":
        return `mongodb://${meshHost()}:30417`;
      case "data.milvus":
        return `http://${meshHost()}:31953`;
      case "obs.otel":
        return `http://${meshHost()}:4317`;
      default:
        return null;
    }
  }
  return spec.devUrl.replace("${mesh}", meshHost());
}

export function resolveService(id: string): ResolvedService {
  const spec = getServiceSpec(id);
  const mode = clusterMode();
  if (spec.envKey && process.env[spec.envKey]?.trim()) {
    return { spec, mode, url: process.env[spec.envKey]!.trim() };
  }
  const url = mode === "cluster" ? spec.inClusterUrl : devBaseUrl(spec);
  return { spec, mode, url };
}

/** 取服务端消费地址；dev 形态无入口（内网专属）时抛带指引的错误。 */
export function resolveUrl(id: string): string {
  const r = resolveService(id);
  if (!r.url) {
    throw new Error(
      `[cluster-catalog] ${r.spec.name} 在 ${r.mode} 形态无可用端点。` +
        (r.spec.envKey ? `开发机请设置 ${r.spec.envKey}（或 RAK_RUNTIME=cluster 确认在集群内）。` : "该服务仅限集群内访问。"),
    );
  }
  return r.url;
}

export function tryResolveUrl(id: string): string | null {
  const r = resolveService(id);
  return r.url;
}

// ── 便捷访问器（业务代码用这些，不手拼 URL） ─────────────────

/** flowmind MCP（Streamable HTTP）端点。env: FLOWMIND_MCP_URL。 */
export function flowmindMcpUrl(): string {
  return resolveUrl("flowmind.mcp");
}

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

/** 集群 PG（pg-main）连接参数；P1 数据层迁移后唯一 DB 入口。 */
export function postgresConfig(): PostgresConfig {
  const mode = clusterMode();
  const password = process.env.PGPASSWORD?.trim();
  if (!password) {
    throw new Error(
      "[cluster-catalog] PG 凭据缺失：集群内由 Secret flowmind-api-env 注入 PGPASSWORD；开发机写入工作区 .env（密码见 Vaultwarden「rak 集群」）",
    );
  }
  return {
    host: process.env.PGHOST?.trim() || (mode === "cluster" ? "pg-main-rw.database.svc" : meshHost()),
    port: Number(process.env.PGPORT || (mode === "cluster" ? 5432 : 30432)),
    database: process.env.PGDATABASE?.trim() || "flowmind",
    user: process.env.PGUSER?.trim() || "flowmind",
    password,
  };
}

/** Redis URL（密码内嵌）。 */
export function redisUrl(): string {
  const env = process.env.REDIS_URL?.trim();
  if (env) return env;
  const mode = clusterMode();
  const pass = process.env.REDIS_PASSWORD?.trim();
  const host = mode === "cluster" ? "redis.database.svc" : meshHost();
  const port = mode === "cluster" ? 6379 : 30379;
  return `redis://${pass ? `:${pass}@` : ""}${host}:${port}`;
}

/** MongoDB URL（凭据内嵌；dev 用 mesh NodePort / cluster 用 svc）。 */
export function mongoUrl(): string {
  const env = process.env.MONGODB_URL?.trim();
  if (env) return env;
  const mode = clusterMode();
  const user = process.env.MONGODB_USER?.trim() ?? "";
  const pass = process.env.MONGODB_PASSWORD?.trim() ?? "";
  const auth = user ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : "";
  const host = mode === "cluster" ? "mongo.database.svc" : meshHost();
  const port = mode === "cluster" ? 27017 : 30417;
  return `mongodb://${auth}${host}:${port}`;
}

/** Milvus 端点（gRPC；env MILVUS_URL 逃生门，否则 dev=mesh:31953 / cluster=svc）。 */
export function milvusUrl(): string {
  const env = process.env.MILVUS_URL?.trim();
  if (env) return env;
  const mode = clusterMode();
  const host = mode === "cluster" ? "milvus-standalone.milvus.svc" : meshHost();
  const port = mode === "cluster" ? 19530 : 31953;
  return `${host}:${port}`;
}

/** Embedding 网关配置：EMBEDDING_* env 逃生门 > LiteLLM 网关。未配置 key 时返回空（上层回落本地确定性向量器）。 */
export function embeddingConfig(): { baseUrl: string; apiKey: string; model: string } {
  const baseUrl = process.env.EMBEDDING_BASE_URL?.trim() || process.env.AI_LLM_BASE_URL?.trim() || "";
  const apiKey = process.env.EMBEDDING_API_KEY?.trim() || process.env.LITELLM_MASTER_KEY?.trim() || "";
  const model = process.env.EMBEDDING_MODEL?.trim() || "";
  if (baseUrl && apiKey) return { baseUrl, apiKey, model };
  try {
    const gw = litellmConfig();
    if (gw.baseUrl && gw.apiKey) return { baseUrl: gw.baseUrl, apiKey: gw.apiKey, model };
  } catch {
    /* 集群目录不可用 → 返回空，上层回落 */
  }
  return { baseUrl: "", apiKey: "", model };
}

export interface S3Config {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  forcePathStyle: boolean;
}

/** MinIO S3（图片/产物存储）。 */
export function s3Config(bucket = "flowmind"): S3Config {
  return {
    endpoint: resolveUrl("data.minio"),
    accessKey: process.env.S3_ACCESS_KEY?.trim() ?? "",
    secretKey: process.env.S3_SECRET_KEY?.trim() ?? "",
    bucket,
    forcePathStyle: true,
  };
}

/** LiteLLM 网关（统一模型入口）。未配置 key 时返回空串由上层决定回落。 */
export function litellmConfig(): { baseUrl: string; apiKey: string } {
  return {
    baseUrl: resolveUrl("ai.litellm"),
    apiKey: process.env.LITELLM_MASTER_KEY?.trim() ?? "",
  };
}

// ── 浏览器脱敏视图（/api/cluster/services 消费） ─────────────

export interface PublicServiceView {
  id: string;
  name: string;
  layer: ServiceLayer;
  mode: ClusterMode;
  /** dev 形态给本机地址便于排障；cluster 形态隐藏内网 svc 地址 */
  url: string | null;
  /** 浏览器直达地址（同源反代绝对化）；无则为 null */
  browserUrl: string | null;
  internalOnly: boolean;
  note?: string;
}

/**
 * 设置页/诊断面板用的只读视图。
 * @param origin 当前请求来源（把 browserPath 相对路径绝对化，如 https://flowmind.xrak.top）
 */
export function publicServiceView(origin?: string): PublicServiceView[] {
  return CLUSTER_SERVICES.map((spec) => {
    const r = resolveService(spec.id);
    let browserUrl: string | null = null;
    if (r.mode === "cluster") {
      // 集群形态：只有边缘同源反代路径是浏览器可达的
      if (spec.browserPath) {
        browserUrl = origin ? new URL(spec.browserPath, origin).toString() : spec.browserPath;
      }
    } else if (r.url && !spec.internalOnly) {
      // 开发机形态：本机服务地址浏览器直达（同源反代 path 不适用）
      browserUrl = r.url;
    }
    return {
      id: spec.id,
      name: spec.name,
      layer: spec.layer,
      mode: r.mode,
      url: r.mode === "dev" ? r.url : null,
      browserUrl,
      internalOnly: Boolean(spec.internalOnly),
      note: spec.note,
    };
  });
}

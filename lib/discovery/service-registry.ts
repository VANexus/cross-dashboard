/**
 * FlowMind — 服务注册表（Zustand Store）
 *
 * 全局中枢：管理所有后端连接、发现结果、技能执行。
 *
 * 架构：
 *   endpoints（配置）→ discover() → manifests（发现结果）
 *   executeSkill() → 按 serviceId 路由到对应适配器
 *
 * 前端任何组件都可订阅此 store，响应已连接服务的变化。
 * 这是"通用前端"的状态心脏——导航、路由、UI 都从这里消费。
 */
import { create } from "zustand";
import type { ProtocolAdapter } from "./protocol-adapter";
import { createAdapter } from "./adapter-registry";
import type {
  ServiceEndpoint,
  ServiceManifest,
  DiscoveredSkill,
  SkillExecutionRequest,
  SkillExecutionResult,
} from "./types";

interface ServiceRegistryState {
  // ── 配置 ──
  /** 已配置的后端端点列表 */
  endpoints: ServiceEndpoint[];
  /** 是否已初始化（加载过预设） */
  initialized: boolean;

  // ── 发现结果 ──
  /** serviceId → manifest */
  manifests: Record<string, ServiceManifest>;
  /** 是否正在发现中 */
  discovering: boolean;
  /** 上次发现时间戳 */
  lastDiscoveredAt: number | null;

  // ── Actions ──
  /** 加载预设端点（从环境变量 / 配置） */
  initialize: () => Promise<void>;
  /** 添加后端端点 */
  addEndpoint: (endpoint: ServiceEndpoint) => void;
  /** 移除后端端点 */
  removeEndpoint: (serviceId: string) => void;
  /** 更新端点配置 */
  updateEndpoint: (serviceId: string, patch: Partial<ServiceEndpoint>) => void;
  /** 发现单个后端 */
  discoverOne: (serviceId: string) => Promise<void>;
  /** 发现全部已启用后端 */
  discoverAll: () => Promise<void>;
  /** 执行技能 */
  executeSkill: (
    request: SkillExecutionRequest,
  ) => Promise<SkillExecutionResult>;

  // ── 派生选择器 ──
  /** 所有已发现的技能（跨服务聚合） */
  getAllSkills: () => DiscoveredSkill[];
  /** 按分组聚合的技能 */
  getSkillsByCategory: () => Record<string, DiscoveredSkill[]>;
  /** 健康的服务数量 */
  getHealthyCount: () => number;
}

/** 适配器缓存（避免重复创建） */
const adapterCache = new Map<string, ProtocolAdapter>();

function getAdapter(endpoint: ServiceEndpoint): ProtocolAdapter {
  let adapter = adapterCache.get(endpoint.id);
  if (!adapter) {
    adapter = createAdapter(endpoint);
    adapterCache.set(endpoint.id, adapter);
  }
  return adapter;
}

/** 从环境变量解析预设端点 */
function loadPresetEndpoints(): ServiceEndpoint[] {
  const endpoints: ServiceEndpoint[] = [];

  // 主后端（MCP）— 默认 rak-flowmind
  const mcpUrl = process.env.NEXT_PUBLIC_FLOWMIND_URL ?? "http://127.0.0.1:8001/mcp";
  endpoints.push({
    id: "flowmind-primary",
    name: "FlowMind 主服务",
    protocol: "mcp",
    url: mcpUrl,
    enabled: true,
  });

  // A2A 边缘（可选）
  const a2aUrl = process.env.NEXT_PUBLIC_A2A_URL;
  if (a2aUrl) {
    endpoints.push({
      id: "a2a-edge",
      name: "A2A 边缘智能体",
      protocol: "a2a",
      url: a2aUrl,
      enabled: true,
    });
  }

  return endpoints;
}

export const useServiceRegistry = create<ServiceRegistryState>((set, get) => ({
  // ── 初始状态 ──
  endpoints: [],
  initialized: false,
  manifests: {},
  discovering: false,
  lastDiscoveredAt: null,

  // ── Actions ──

  initialize: async () => {
    const presets = loadPresetEndpoints();
    set({ endpoints: presets, initialized: true });
    // 静默发现，不阻塞 UI
    void get().discoverAll();
  },

  addEndpoint: (endpoint) => {
    set((s) => ({
      endpoints: [...s.endpoints.filter((e) => e.id !== endpoint.id), endpoint],
    }));
  },

  removeEndpoint: (serviceId) => {
    set((s) => ({
      endpoints: s.endpoints.filter((e) => e.id !== serviceId),
      manifests: { ...s.manifests, [serviceId]: undefined as never },
    }));
    adapterCache.delete(serviceId);
  },

  updateEndpoint: (serviceId, patch) => {
    set((s) => ({
      endpoints: s.endpoints.map((e) =>
        e.id === serviceId ? { ...e, ...patch } : e,
      ),
    }));
    // 配置变化后清除缓存适配器
    if (patch.url || patch.protocol) {
      adapterCache.delete(serviceId);
    }
  },

  discoverOne: async (serviceId) => {
    const endpoint = get().endpoints.find((e) => e.id === serviceId);
    if (!endpoint?.enabled) return;

    const adapter = getAdapter(endpoint);
    const manifest = await adapter.discover(endpoint);
    set((s) => ({
      manifests: { ...s.manifests, [serviceId]: manifest },
      lastDiscoveredAt: Date.now(),
    }));
  },

  discoverAll: async () => {
    set({ discovering: true });
    const { endpoints } = get();
    const enabled = endpoints.filter((e) => e.enabled);

    // 并行发现所有后端
    const results = await Promise.all(
      enabled.map(async (endpoint) => {
        const adapter = getAdapter(endpoint);
        try {
          return await adapter.discover(endpoint);
        } catch {
          // discover 内部已处理错误，此处兜底
          return {
            serviceId: endpoint.id,
            serviceName: endpoint.name,
            protocol: endpoint.protocol,
            baseUrl: endpoint.url,
            version: "0.0.0",
            health: "unreachable",
            skills: [],
            metadata: {},
            lastDiscoveredAt: Date.now(),
            lastError: "发现过程异常",
          } satisfies ServiceManifest;
        }
      }),
    );

    const manifests: Record<string, ServiceManifest> = {};
    for (const m of results) {
      manifests[m.serviceId] = m;
    }

    set({ manifests, discovering: false, lastDiscoveredAt: Date.now() });
  },

  executeSkill: async (request) => {
    const endpoint = get().endpoints.find((e) => e.id === request.serviceId);
    if (!endpoint) {
      return {
        ok: false,
        data: null,
        error: { code: "UNKNOWN_SERVICE", message: `未知服务：${request.serviceId}` },
        durationMs: 0,
      };
    }

    const adapter = getAdapter(endpoint);
    return adapter.execute(request);
  },

  // ── 派生选择器 ──

  getAllSkills: () => {
    const { manifests } = get();
    return Object.values(manifests).flatMap((m) => m.skills ?? []);
  },

  getSkillsByCategory: () => {
    const { manifests } = get();
    const grouped: Record<string, DiscoveredSkill[]> = {};
    for (const m of Object.values(manifests)) {
      for (const skill of m.skills ?? []) {
        const cat = skill.category ?? "通用";
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(skill);
      }
    }
    return grouped;
  },

  getHealthyCount: () => {
    const { manifests } = get();
    return Object.values(manifests).filter(
      (m) => m.health === "connected" || m.health === "degraded",
    ).length;
  },
}));

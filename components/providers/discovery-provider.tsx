/**
 * FlowMind — 服务发现全局 Provider
 *
 * 跨页面共享已发现的服务与技能，实现"通用前端"体验：
 *   - 启动时自动发现所有已配置后端
 *   - 导航栏从发现结果动态构建
 *   - 任意组件可订阅已连接服务的技能列表
 *   - 提供统一的技能执行入口
 *
 * 类比 EdgeAgentProvider，但不再绑定 A2A 单一协议，
 * 而是协议无关的服务发现中枢。
 */
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import {
  useServiceRegistry,
  routeIntent,
  type DiscoveredSkill,
  type IntentMatch,
  type SkillExecutionResult,
  type ServiceManifest,
} from "@/lib/discovery";

interface DiscoveryContextValue {
  /** 是否已初始化 */
  initialized: boolean;
  /** 是否正在发现 */
  discovering: boolean;
  /** 所有服务清单 */
  manifests: Record<string, ServiceManifest>;
  /** 所有已发现技能（跨服务聚合） */
  allSkills: DiscoveredSkill[];
  /** 健康服务数量 */
  healthyCount: number;
  /** 重新发现全部 */
  rediscover: () => Promise<void>;
  /** 路由意图到技能 */
  routeIntent: (intent: string, limit?: number) => IntentMatch[];
  /** 执行技能 */
  executeSkill: (
    serviceId: string,
    skillId: string,
    args: Record<string, unknown>,
  ) => Promise<SkillExecutionResult>;
}

const DiscoveryContext = createContext<DiscoveryContextValue | null>(null);

export function useDiscovery(): DiscoveryContextValue {
  const ctx = useContext(DiscoveryContext);
  if (!ctx) {
    throw new Error("useDiscovery 必须在 <DiscoveryProvider> 内使用");
  }
  return ctx;
}

export function DiscoveryProvider({ children }: { children: ReactNode }) {
  const registry = useServiceRegistry;
  const { initialized, discovering, manifests, healthyCount } = registry((s) => ({
    initialized: s.initialized,
    discovering: s.discovering,
    manifests: s.manifests,
    healthyCount: s.getHealthyCount(),
  }));

  // 派生：所有技能
  const allSkills = useMemo(() => {
    return Object.values(manifests).flatMap((m) => m.skills ?? []);
  }, [manifests]);

  // 启动时初始化
  useEffect(() => {
    if (!initialized) {
      void registry.getState().initialize();
    }
  }, [initialized, registry]);

  const rediscover = useCallback(async () => {
    await registry.getState().discoverAll();
  }, [registry]);

  const routeIntentCallback = useCallback(
    (intent: string, limit = 5): IntentMatch[] => {
      return routeIntent(intent, allSkills, limit);
    },
    [allSkills],
  );

  const executeSkill = useCallback(
    async (
      serviceId: string,
      skillId: string,
      args: Record<string, unknown>,
    ) => {
      return registry.getState().executeSkill({ serviceId, skillId, args });
    },
    [registry],
  );

  const value = useMemo(
    () => ({
      initialized,
      discovering,
      manifests,
      allSkills,
      healthyCount,
      rediscover,
      routeIntent: routeIntentCallback,
      executeSkill,
    }),
    [
      initialized,
      discovering,
      manifests,
      allSkills,
      healthyCount,
      rediscover,
      routeIntentCallback,
      executeSkill,
    ],
  );

  return (
    <DiscoveryContext.Provider value={value}>
      {children}
    </DiscoveryContext.Provider>
  );
}

/**
 * FlowMind — 技能自动发现 React Hook
 *
 * 在运行时从 flowmind REST API 拉取技能清单，替代硬编码技能列表。
 * 基于 useFetch 风格：返回 data/loading/error/refetch。
 *
 * 使用方式：
 *   const { skills, loading, error, health, refetch, getSkill } = useSkillDiscovery();
 *
 * 设计要点：
 *   - 单例客户端：useRef 持有 SkillDiscoveryClient，避免重复创建与缓存失效
 *   - 自动拉取：autoFetch=true 时挂载即请求 manifest + health
 *   - getSkill(id) 复用客户端缓存（TTL 内不重复请求）
 */
"use client";

import { useCallback, useEffect, useRef, startTransition, useState } from "react";
import {
  SkillDiscoveryClient,
  SkillDiscoveryError,
  getSkillDiscoveryConfig,
} from "@/lib/skills";
import type { DiscoveredSkill, SkillHealth } from "@/lib/skills";

export interface UseSkillDiscoveryOptions {
  /** 是否挂载时自动拉取清单（默认 true） */
  autoFetch?: boolean;
}

export interface UseSkillDiscoveryReturn {
  /** 技能清单 */
  skills: DiscoveredSkill[];
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 后端健康状态 */
  health: SkillHealth | null;
  /** 强制刷新清单（同时清空客户端缓存） */
  refetch: () => Promise<void>;
  /** 获取单个技能（复用客户端缓存，404 抛 SkillDiscoveryError(notFound=true)） */
  getSkill: (id: string) => Promise<DiscoveredSkill | null>;
}

export function useSkillDiscovery(
  options: UseSkillDiscoveryOptions = {},
): UseSkillDiscoveryReturn {
  const { autoFetch = true } = options;

  const [skills, setSkills] = useState<DiscoveredSkill[]>([]);
  const [health, setHealth] = useState<SkillHealth | null>(null);
  const [loading, setLoading] = useState<boolean>(autoFetch);
  const [error, setError] = useState<string | null>(null);

  // 单例客户端：useRef 保持实例稳定，缓存跨渲染复用
  const clientRef = useRef<SkillDiscoveryClient | null>(null);
  const getClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = new SkillDiscoveryClient(getSkillDiscoveryConfig());
    }
    return clientRef.current;
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const client = getClient();
    try {
      const [manifest, healthResult] = await Promise.all([
        client.getManifest(),
        client.health(),
      ]);
      setSkills(manifest.skills);
      setHealth(healthResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : "技能发现请求失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  useEffect(() => {
    if (autoFetch) {
      // 与 useFetch 一致：用 startTransition 包裹，避免级联渲染
      startTransition(() => {
        void fetchAll();
      });
    }
  }, [autoFetch, fetchAll]);

  const getSkill = useCallback(
    async (id: string): Promise<DiscoveredSkill | null> => {
      const client = getClient();
      try {
        return await client.getSkill(id);
      } catch (err) {
        if (err instanceof SkillDiscoveryError && err.notFound) {
          // 404 不抛，返回 null 由调用方处理
          return null;
        }
        throw err;
      }
    },
    [getClient],
  );

  return {
    skills,
    loading,
    error,
    health,
    refetch: fetchAll,
    getSkill,
  };
}

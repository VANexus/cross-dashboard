/**
 * FlowMind — Edge Agent React Hook
 *
 * 管理浏览器端 A2A 边缘智能体的完整生命周期：
 *   - 消费 AsyncGenerator 流式响应（非 EventSource，因 A2A 需认证头）
 *   - 暴露 messages / streaming / sendMessage / taskStatus / agentCard
 *   - 自动重连 + 错误恢复
 *
 * 使用方式：
 *   const { messages, streaming, sendMessage, status } = useEdgeAgent();
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { EdgeAgent } from "@/lib/a2a/edge-agent";
import type { EdgeMessage, EdgeAgentStatus } from "@/lib/a2a/types";

export interface UseEdgeAgentOptions {
  /** 是否自动连接 Agent Card（默认 true） */
  autoConnect?: boolean;
  /** 自定义 A2AClient 实例（测试用） */
  edgeAgent?: EdgeAgent;
}

export interface UseEdgeAgentReturn {
  /** 消息历史 */
  messages: EdgeMessage[];
  /** 是否正在流式传输 */
  streaming: boolean;
  /** 发送消息（触发流式响应） */
  sendMessage: (content: string) => Promise<void>;
  /** 使用指定技能发送消息 */
  sendMessageWithSkill: (content: string, skillId: string) => Promise<void>;
  /** 清空消息历史 */
  clearHistory: () => void;
  /** 运行时状态 */
  status: EdgeAgentStatus | null;
  /** 错误信息 */
  error: string | null;
  /** 重新连接 */
  reconnect: () => Promise<void>;
}

export function useEdgeAgent(options: UseEdgeAgentOptions = {}): UseEdgeAgentReturn {
  const { autoConnect = true } = options;

  const [messages, setMessages] = useState<EdgeMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<EdgeAgentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 使用 ref 保存 EdgeAgent 实例，避免重复创建
  const agentRef = useRef<EdgeAgent | null>(options.edgeAgent ?? null);

  // 懒初始化 EdgeAgent
  const getAgent = useCallback(() => {
    if (!agentRef.current) {
      agentRef.current = new EdgeAgent();
    }
    return agentRef.current;
  }, []);

  // 更新状态
  const refreshStatus = useCallback(() => {
    const agent = getAgent();
    setStatus(agent.getStatus());
  }, [getAgent]);

  // 自动连接 Agent Card
  useEffect(() => {
    if (!autoConnect) return;

    const agent = getAgent();
    agent
      .getClient()
      .fetchAgentCard()
      .then(() => {
        refreshStatus();
      })
      .catch((err) => {
        // 连接失败不阻塞 UI，状态会反映断路器状态
        refreshStatus();
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [autoConnect, getAgent, refreshStatus]);

  // 发送消息
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || streaming) return;

      const agent = getAgent();
      setStreaming(true);
      setError(null);

      try {
        // 消费 AsyncGenerator
        for await (const msg of agent.sendMessage(content)) {
          setMessages((prev) => {
            // 更新或追加消息
            const idx = prev.findIndex((m) => m.id === msg.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = msg;
              return next;
            }
            return [...prev, msg];
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setStreaming(false);
        refreshStatus();
      }
    },
    [getAgent, refreshStatus, streaming],
  );

  // 使用指定技能发送消息
  const sendMessageWithSkill = useCallback(
    async (content: string, skillId: string) => {
      if (!content.trim() || streaming) return;

      const agent = getAgent();
      setStreaming(true);
      setError(null);

      try {
        for await (const msg of agent.sendMessageWithSkill(content, skillId)) {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === msg.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = msg;
              return next;
            }
            return [...prev, msg];
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setStreaming(false);
        refreshStatus();
      }
    },
    [getAgent, refreshStatus, streaming],
  );

  // 清空历史
  const clearHistory = useCallback(() => {
    const agent = getAgent();
    agent.clearHistory();
    setMessages([]);
  }, [getAgent]);

  // 重新连接
  const reconnect = useCallback(async () => {
    const agent = getAgent();
    await agent.disconnect();
    setError(null);

    try {
      await agent.getClient().fetchAgentCard();
      refreshStatus();
    } catch (err) {
      refreshStatus();
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [getAgent, refreshStatus]);

  return {
    messages,
    streaming,
    sendMessage,
    sendMessageWithSkill,
    clearHistory,
    status,
    error,
    reconnect,
  };
}

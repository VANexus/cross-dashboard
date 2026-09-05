/* A3：Agent 详情页实时事件订阅 —— 收敛到统一 SSE 通道 /api/agent/stream?agentId=xxx
   （原 /api/agents/[id]/stream 已并入 /api/agent/stream）。presence/工作流帧
   （state/telemetry/plan_step/card）在此被过滤，只保留 Agent 本体事件。 */
import { useState, useEffect, useRef, useCallback } from "react";
import type { AgentEvent } from "@/lib/shared/types";

interface AgentStreamState {
  events: AgentEvent[];
  connected: boolean;
  latestThought: AgentEvent | null;
  latestMood: AgentEvent | null;
}

/** 只关心 Agent 本体事件；presence/工作流帧一律忽略。 */
const AGENT_EVENT_TYPES = new Set([
  "thought",
  "decision",
  "observation",
  "reflection",
  "mood_change",
  "memory_created",
]);

export function useAgentStream(agentId: string | null) {
  const [state, setState] = useState<AgentStreamState>({
    events: [],
    connected: false,
    latestThought: null,
    latestMood: null,
  });
  const sourceRef = useRef<EventSource | null>(null);
  const eventsRef = useRef<AgentEvent[]>([]);
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (!agentId) return;
    if (sourceRef.current) sourceRef.current.close();

    const source = new EventSource(`/api/agent/stream?agentId=${encodeURIComponent(agentId)}`);
    sourceRef.current = source;

    source.onopen = () => {
      setState((prev) => ({ ...prev, connected: true }));
    };

    source.onmessage = (e) => {
      try {
        const raw = JSON.parse(e.data);
        if (!raw?.type || !AGENT_EVENT_TYPES.has(raw.type)) return; // 跳过 presence/工作流帧
        const event = raw as AgentEvent;

        eventsRef.current = [event, ...eventsRef.current].slice(0, 200);

        setState((prev) => ({
          ...prev,
          events: eventsRef.current,
          latestThought: event.type === "thought" || event.type === "observation" ? event : prev.latestThought,
          latestMood: event.type === "mood_change" ? event : prev.latestMood,
        }));
      } catch { /* ignore parse errors */ }
    };

    source.onerror = () => {
      setState((prev) => ({ ...prev, connected: false }));
      source.close();
      // Auto-reconnect after 3s
      setTimeout(() => connectRef.current(), 3000);
    };
  }, [agentId]);

  useEffect(() => {
    // Keep the ref in sync with the latest connect function
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [connect]);

  const clearEvents = useCallback(() => {
    eventsRef.current = [];
    setState((prev) => ({ ...prev, events: [] }));
  }, []);

  return { ...state, clearEvents };
}

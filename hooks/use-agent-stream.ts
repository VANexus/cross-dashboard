"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { AgentEvent } from "@/lib/shared/types";

interface AgentStreamState {
  events: AgentEvent[];
  connected: boolean;
  latestThought: AgentEvent | null;
  latestMood: AgentEvent | null;
}

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

    const source = new EventSource(`/api/agents/${agentId}/stream`);
    sourceRef.current = source;

    source.onopen = () => {
      setState((prev) => ({ ...prev, connected: true }));
    };

    source.onmessage = (e) => {
      try {
        const raw = JSON.parse(e.data);
        if (raw.type === "connected") return;
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

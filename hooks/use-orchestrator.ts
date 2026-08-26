/**
 * FlowMind AI Orchestrator — Client Hook
 *
 * Manages the orchestrator conversation state and SSE streaming.
 * Consumes POST /api/orchestrate and maintains message history.
 */

"use client";

import { useState, useCallback, useRef } from "react";
import type { OrchestratorBlock, StreamEvent } from "@/lib/orchestrator/types";

export interface OrchestratorMessage {
  id: string;
  role: "user" | "assistant" | "system";
  blocks: OrchestratorBlock[];
  timestamp: number;
  finished: boolean;
}

export interface UseOrchestratorReturn {
  messages: OrchestratorMessage[];
  streaming: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  selectOption: (blockId: string, optionId: string, params?: Record<string, unknown>) => Promise<void>;
  clearHistory: () => void;
}

export function useOrchestrator(): UseOrchestratorReturn {
  const [messages, setMessages] = useState<OrchestratorMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || streaming) return;

    setError(null);
    setStreaming(true);

    // Add user message immediately
    const userMsg: OrchestratorMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      blocks: [{ type: "text", text: content }],
      timestamp: Date.now(),
      finished: true,
    };
    setMessages((prev) => [...prev, userMsg]);
    historyRef.current = [...historyRef.current, { role: "user", content }];

    // Create assistant message placeholder
    const assistantId = `asst-${Date.now()}`;
    const assistantMsg: OrchestratorMessage = {
      id: assistantId,
      role: "assistant",
      blocks: [],
      timestamp: Date.now(),
      finished: false,
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      abortRef.current = new AbortController();

      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          history: historyRef.current.slice(-10),
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`API error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data || data === "{}") continue;

          try {
            const event = JSON.parse(data) as StreamEvent;

            if (event.finished) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, finished: true } : m,
                ),
              );
              continue;
            }

            // Append blocks to assistant message
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                return {
                  ...m,
                  blocks: [...m.blocks, ...event.blocks],
                };
              }),
            );

            // Track text for history
            for (const block of event.blocks) {
              if (block.type === "text" && block.text) {
                assistantText += block.text;
              }
            }
          } catch {
            // Skip malformed events
          }
        }
      }

      // Update history with assistant response
      if (assistantText) {
        historyRef.current = [
          ...historyRef.current,
          { role: "assistant", content: assistantText },
        ];
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // User cancelled
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [streaming]);

  const selectOption = useCallback(async (blockId: string, optionId: string, _params?: Record<string, unknown>) => {
    setError(null);
    setStreaming(true);

    // Add user message showing selection
    const userMsg: OrchestratorMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      blocks: [{ type: "text", text: `选择: ${optionId}` }],
      timestamp: Date.now(),
      finished: true,
    };
    setMessages((prev) => [...prev, userMsg]);

    // Create assistant placeholder
    const assistantId = `asst-${Date.now()}`;
    const assistantMsg: OrchestratorMessage = {
      id: assistantId,
      role: "assistant",
      blocks: [],
      timestamp: Date.now(),
      finished: false,
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      abortRef.current = new AbortController();

      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `用户选择了「${optionId}」，请继续执行。`,
          history: historyRef.current.slice(-10),
          selectedOption: { blockId, optionId },
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`API error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data || data === "{}") continue;

          try {
            const event = JSON.parse(data) as StreamEvent;

            if (event.finished) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, finished: true } : m,
                ),
              );
              continue;
            }

            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                return { ...m, blocks: [...m.blocks, ...event.blocks] };
              }),
            );

            for (const block of event.blocks) {
              if (block.type === "text" && block.text) {
                assistantText += block.text;
              }
            }
          } catch {
            // Skip
          }
        }
      }

      if (assistantText) {
        historyRef.current = [
          ...historyRef.current,
          { role: "assistant", content: assistantText },
        ];
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    historyRef.current = [];
    setError(null);
  }, []);

  return {
    messages,
    streaming,
    error,
    sendMessage,
    selectOption,
    clearHistory,
  };
}

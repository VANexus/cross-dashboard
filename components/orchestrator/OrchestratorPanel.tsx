/**
 * FlowMind AI Orchestrator Panel
 *
 * Full conversational orchestration canvas. Replaces the old AISidebar.
 * Features:
 * - Rich block rendering (text, tool cards, charts, tables, options, ideas)
 * - Streaming SSE consumption
 * - Auto-scroll to latest
 * - Quick-start suggestion chips
 * - Keyboard shortcuts
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, X, Trash2, Sparkles, Bot, Maximize2, Minimize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useOrchestrator } from "@/hooks/use-orchestrator";
import { BlockRenderer } from "./BlockRenderer";
import type { OrchestratorBlock } from "@/lib/orchestrator/types";

interface OrchestratorPanelProps {
  open: boolean;
  onClose: () => void;
}

const QUICK_SUGGESTIONS = [
  "分析竞品 B08N5WRWNW",
  "优化广告关键词",
  "生成 Listing",
  "查看库存补货建议",
];

export function OrchestratorPanel({ open, onClose }: OrchestratorPanelProps) {
  const { messages, streaming, error, sendMessage, selectOption, clearHistory } = useOrchestrator();
  const [input, setInput] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || streaming) return;
    setInput("");
    await sendMessage(content);
  }, [input, streaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleSelectOption = useCallback(
    async (blockId: string, optionId: string) => {
      await selectOption(blockId, optionId);
    },
    [selectOption],
  );

  const handleIdeaAction = useCallback(
    async (_blockId: string) => {
      // Idea bubbles trigger a follow-up message
      await sendMessage("继续执行刚才的建议");
    },
    [sendMessage],
  );

  const handleQuickStart = useCallback(
    async (text: string) => {
      if (streaming) return;
      await sendMessage(text);
    },
    [streaming, sendMessage],
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.aside
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={cn(
              "fixed right-0 top-0 z-50 flex h-full flex-col border-l border-border/50 bg-background/95 backdrop-blur-xl",
              isFullscreen ? "left-0 w-full border-l-0" : "w-[480px]",
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">AI 编排助手</h3>
                  <p className="text-[10px] text-muted-foreground">
                    {streaming ? "正在执行..." : "智能工具编排 · 后端驱动"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                  title={isFullscreen ? "退出全屏" : "全屏"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
                <button
                  onClick={clearHistory}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                  title="清空对话"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                  title="关闭"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4">
              {messages.length === 0 ? (
                <EmptyState onQuickStart={handleQuickStart} streaming={streaming} />
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      onSelectOption={handleSelectOption}
                      onIdeaAction={handleIdeaAction}
                      disabled={streaming}
                    />
                  ))}
                  {streaming && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pl-2">
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                      <span>AI 正在思考...</span>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border/50 p-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="描述你想做的事...（Enter 发送）"
                    className="min-h-[44px] max-h-[120px] w-full resize-none rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/50"
                    rows={1}
                    disabled={streaming}
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || streaming}
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all",
                    input.trim() && !streaming
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                      : "bg-muted text-muted-foreground cursor-not-allowed",
                  )}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Empty State ──────────────────────────────────────────────────

function EmptyState({ onQuickStart, streaming }: { onQuickStart: (text: string) => void; streaming: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
        <Bot className="h-8 w-8 text-primary" />
      </div>
      <div>
        <h4 className="text-sm font-medium">AI 编排助手</h4>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground leading-relaxed">
          告诉我你想做什么，我会自动选择最合适的工具来完成。支持竞品分析、广告优化、Listing 生成、AI 作图、库存管理和选品调研。
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {QUICK_SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onQuickStart(s)}
            disabled={streaming}
            className="rounded-full border border-border/50 bg-background/50 px-3 py-1.5 text-xs transition-colors hover:bg-primary/5 hover:border-primary/30 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Message Bubble ───────────────────────────────────────────────

interface MessageBubbleProps {
  message: {
    id: string;
    role: "user" | "assistant" | "system";
    blocks: OrchestratorBlock[];
    finished: boolean;
  };
  onSelectOption: (blockId: string, optionId: string) => void;
  onIdeaAction: (blockId: string, params?: Record<string, unknown>) => void;
  disabled: boolean;
}

function MessageBubble({ message, onSelectOption, onIdeaAction, disabled }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[95%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted/40 border border-border/30 rounded-bl-md",
        )}
      >
        {isUser ? (
          <p className="text-sm">{message.blocks[0]?.type === "text" ? message.blocks[0].text : ""}</p>
        ) : (
          <BlockRenderer
            blocks={message.blocks}
            onSelectOption={onSelectOption}
            onIdeaAction={onIdeaAction}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}

"use client";

// dashboard 会话条：+ 新建对话 / 聊天记录列表切换（与抽屉共享 CONV_STORAGE_KEY 持久化会话）。
import { useEffect, useRef, useState } from "react";
import { Plus, History, MessageSquare, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONV_STORAGE_KEY } from "@/lib/agent/chat-contract";

interface ConvItem {
  id: string;
  title: string;
  message_count: number;
  updated_at: string;
}

/** 会话条 → dashboard-chat 的自定义事件（同页同窗内通信）。 */
export const CONV_EVENTS = {
  NEW: "fm:conv-new",
  LOAD: "fm:conv-load",
} as const;

export function ChatSessionBar() {
  const [list, setList] = useState<ConvItem[]>([]);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const refresh = () => {
    fetch("/api/agent/conversations")
      .then((r) => r.json())
      .then((j: { success?: boolean; data?: ConvItem[] }) => {
        if (j?.success && Array.isArray(j.data)) {
          setList(j.data);
          setActiveId((typeof localStorage !== "undefined" ? localStorage.getItem(CONV_STORAGE_KEY) : null) ?? null);
        }
      })
      .catch(() => {});
  };
  useEffect(refresh, []);

  // 点击外部关闭下拉
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const newConv = async () => {
    const res = await fetch("/api/agent/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "新对话" }),
    });
    const j = (await res.json().catch(() => null)) as { success?: boolean; data?: { id: string } } | null;
    if (j?.success && j.data?.id) {
      localStorage.setItem(CONV_STORAGE_KEY, j.data.id);
      window.dispatchEvent(new CustomEvent(CONV_EVENTS.NEW, { detail: j.data.id }));
      setActiveId(j.data.id);
      setOpen(false);
      refresh();
    }
  };

  const switchTo = (id: string) => {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    localStorage.setItem(CONV_STORAGE_KEY, id);
    window.dispatchEvent(new CustomEvent(CONV_EVENTS.LOAD, { detail: id }));
    setActiveId(id);
    setOpen(false);
  };

  return (
    <div className="mb-3 flex items-center gap-2 px-1">
      <div ref={boxRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <History className="h-3.5 w-3.5" />
          聊天记录
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="absolute left-0 top-full z-30 mt-1.5 w-72 rounded-xl border border-border bg-card/95 p-1.5 shadow-lg backdrop-blur-xl">
            <div className="no-scrollbar max-h-72 overflow-y-auto">
              {list.length === 0 && (
                <div className="px-2.5 py-2 text-xs text-muted-foreground">暂无历史对话</div>
              )}
              {list.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => switchTo(c.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-muted/60",
                    activeId === c.id && "bg-muted/50",
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{c.title || "新对话"}</span>
                  {activeId === c.id && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={newConv}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
      >
        <Plus className="h-3.5 w-3.5" />
        新建对话
      </button>
    </div>
  );
}
/**
 * FlowMind — 技能选择器
 *
 * 展示 DiscoveredSkill 列表，支持搜索过滤 + 手动选择。
 * 替代旧的 SkillSelector（基于 AgentSkill[]）。
 * 玻璃面板风格，与 EdgeAgentPanel 设计系统一致。
 */
"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Search, Sparkles, ChevronDown, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { DiscoveredSkill } from "@/lib/skills/types";

interface SkillPickerProps {
  /** 可用技能列表 */
  skills: DiscoveredSkill[];
  /** 当前选中的 skillId，null 表示「自动路由」 */
  selectedId: string | null;
  /** 选择回调（null = 自动路由） */
  onSelect: (skillId: string | null) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 可选：skillId -> 置信度，传入时展示置信度徽章 */
  confidences?: Record<string, number>;
}

export function SkillPicker({
  skills,
  selectedId,
  onSelect,
  disabled,
  confidences,
}: SkillPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selectedSkill = skills.find((s) => s.id === selectedId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [skills, query]);

  if (skills.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      {/* 触发按钮 */}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-1.5 text-xs transition-colors",
          "hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <Sparkles className="h-3 w-3 shrink-0" />
        <span className="max-w-[120px] truncate">
          {selectedSkill ? selectedSkill.name : "自动路由"}
        </span>
        <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {/* 下拉面板 */}
      {open && (
        <div
          className="absolute bottom-full left-0 z-20 mb-1 w-72 overflow-hidden rounded-xl border border-border bg-popover shadow-xl"
          role="listbox"
          aria-label="选择技能"
        >
          {/* 搜索框 */}
          <div className="border-b border-border/50 p-2">
            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/60 px-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索技能..."
                aria-label="搜索技能"
                className="h-8 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <ScrollArea className="max-h-72">
            <div className="p-1">
              {/* 自动路由选项 */}
              <button
                type="button"
                role="option"
                aria-selected={selectedId === null}
                onClick={() => {
                  onSelect(null);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  selectedId === null ? "bg-accent" : "hover:bg-accent/50",
                )}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">自动路由</div>
                  <div className="truncate text-xs text-muted-foreground">根据意图自动匹配技能</div>
                </div>
                {selectedId === null && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>

              {/* 技能列表 */}
              {filtered.map((skill) => {
                const confidence = confidences?.[skill.id];
                return (
                  <button
                    key={skill.id}
                    type="button"
                    role="option"
                    aria-selected={selectedId === skill.id}
                    onClick={() => {
                      onSelect(skill.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      selectedId === skill.id ? "bg-accent" : "hover:bg-accent/50",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{skill.name}</span>
                        {confidence !== undefined && (
                          <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
                            {Math.round(confidence * 100)}%
                          </Badge>
                        )}
                      </div>
                      {skill.description && (
                        <div className="truncate text-xs text-muted-foreground">
                          {skill.description}
                        </div>
                      )}
                    </div>
                    {selectedId === skill.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })}

              {filtered.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  无匹配技能
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

/**
 * FlowMind — 技能详情面板
 *
 * 展示技能描述 + 可折叠的 JSON Schema 查看器（input_schema / output_schema）。
 * 用于「检视技能」的 inspect 体验。玻璃面板风格。
 */
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, FileJson } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { DiscoveredSkill, JSONSchema } from "@/lib/skills/types";

interface SkillDetailProps {
  /** 要展示的技能，null 时展示空提示 */
  skill: DiscoveredSkill | null;
}

export function SkillDetail({ skill }: SkillDetailProps) {
  if (!skill) {
    return (
      <div className="glass-panel flex h-full items-center justify-center rounded-2xl p-8 text-center">
        <p className="text-sm text-muted-foreground">选择一个技能以查看详情</p>
      </div>
    );
  }

  return (
    <div className="glass-panel flex h-full flex-col overflow-hidden rounded-2xl">
      {/* 头部 */}
      <div className="border-b border-border/50 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold">{skill.name}</h3>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            v{skill.version}
          </Badge>
        </div>
        {skill.description && (
          <p className="mt-1 text-xs text-muted-foreground">{skill.description}</p>
        )}
        {(skill.tags?.length ?? 0) > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {skill.tags!.map((tag) => (
              <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Schema 区域 */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-4">
          <SchemaSection title="入参 Schema" schema={skill.input_schema} />
          <SchemaSection title="出参 Schema" schema={skill.output_schema} />
        </div>
      </ScrollArea>
    </div>
  );
}

/** 单个可折叠的 Schema 查看器 */
function SchemaSection({ title, schema }: { title: string; schema: JSONSchema | null }) {
  const [open, setOpen] = useState(false);

  if (!schema) {
    return (
      <div className="rounded-lg border border-border/50">
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
          <FileJson className="h-3.5 w-3.5" />
          {title}
          <span className="ml-auto text-[10px]">无</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition-colors",
          "hover:bg-accent/50",
        )}
      >
        <FileJson className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">{title}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border/50 bg-black/20 p-3">
          <pre className="max-h-64 overflow-auto text-[11px] leading-relaxed text-muted-foreground">
            <code>{JSON.stringify(schema, null, 2)}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * FlowMind — 技能卡片
 *
 * 可点击的卡片，展示技能名称、描述、版本 + 可靠性置信度进度条。
 * 用于未来技能市场 / 网格视图。玻璃面板风格。
 */
import { cn } from "@/lib/utils";
import { Gauge } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { DiscoveredSkill } from "@/lib/skills/types";

interface SkillCardProps {
  /** 要展示的技能 */
  skill: DiscoveredSkill;
  /** 点击回调 */
  onClick?: () => void;
  /** 紧凑模式（用于网格中的小卡片） */
  compact?: boolean;
}

export function SkillCard({ skill, onClick, compact }: SkillCardProps) {
  const confidence = skill.reliability_profile?.confidence ?? 0;
  const confidencePct = Math.round(confidence * 100);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`技能 ${skill.name}，置信度 ${confidencePct}%`}
      className={cn(
        "glass-panel flex w-full flex-col rounded-2xl text-left transition-all",
        "hover:border-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        onClick && "cursor-pointer",
        compact ? "gap-2 p-3" : "gap-3 p-4",
      )}
    >
      {/* 头部：名称 + 版本 */}
      <div className="flex items-start justify-between gap-2">
        <h4 className={cn("font-semibold leading-snug", compact ? "text-xs" : "text-sm")}>
          {skill.name}
        </h4>
        <span className="shrink-0 text-tiny text-muted-foreground">v{skill.version}</span>
      </div>

      {/* 描述 */}
      {skill.description && (
        <p
          className={cn(
            "line-clamp-2 text-muted-foreground",
            compact ? "text-caption" : "text-xs",
          )}
        >
          {skill.description}
        </p>
      )}

      {/* 置信度进度条 */}
      <div className={cn("flex items-center gap-2", compact ? "mt-auto pt-1" : "mt-auto pt-2")}>
        <Gauge className="h-3 w-3 shrink-0 text-primary/70" />
        <Progress value={confidencePct} className="h-1.5 flex-1" />
        <span className="shrink-0 text-tiny tabular-nums text-muted-foreground">
          {confidencePct}%
        </span>
      </div>
    </button>
  );
}

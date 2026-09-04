"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Sparkles,
  Radar,
  Boxes,
  Megaphone,
  FileText,
  ShieldCheck,
  Bot,
  GitBranch,
  MousePointerClick,
  Layers,
  BrainCircuit,
  Users,
  Cpu,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sendAgentCommand } from "@/lib/agent/agent-bus";

export interface Capability {
  id: string;
  name: string;
  category: "business" | "orchestrate" | "memory" | "agent" | "selfhost";
  description: string;
  prompt: string;
  consoleHref?: string;
  humanDecision?: string;
}

const CATEGORY_META: Record<
  Capability["category"],
  { label: string; icon: typeof Cpu; desc: string; tone: string }
> = {
  selfhost: {
    label: "本地自举能力",
    icon: Cpu,
    desc: "Next.js 全栈原生 · 不依赖 flowmind-mcp 后端",
    tone: "text-emerald-400",
  },
  business: {
    label: "业务能力",
    icon: Radar,
    desc: "内核真实工具 · 9 项，由主 Agent 一句话驱动",
    tone: "text-primary",
  },
  orchestrate: {
    label: "编排能力",
    icon: GitBranch,
    desc: "Agent 如何驱动工作流、把 UI 编排进人机交互",
    tone: "text-info",
  },
  memory: {
    label: "记忆能力",
    icon: BrainCircuit,
    desc: "三库写回（PG + Mongo + Milvus），让 Agent 有记忆",
    tone: "text-success",
  },
  agent: {
    label: "Agent 组建",
    icon: Users,
    desc: "一句话创建 Agent / 组建团队，动态形成协同拓扑",
    tone: "text-warning",
  },
};

const CATEGORY_ORDER: Capability["category"][] = ["selfhost", "business", "orchestrate", "memory", "agent"];

/** Agent 能力中心：真实能力清单（来自内核工具注册表），每项一键交棒主 Agent 编排。 */
export function DashboardCapabilities() {
  const [caps, setCaps] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/capabilities", { cache: "no-store" });
      const json = (await res.json()) as { success: boolean; data?: Capability[] };
      if (json.success && json.data) setCaps(json.data);
    } catch {
      /* 保留 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = CATEGORY_ORDER.map((cat) => ({
    ...CATEGORY_META[cat],
    category: cat,
    items: caps.filter((c) => c.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="glass dash-panel">
      <div className="dash-panel-head">
        <span className="dash-panel-title">
          <Sparkles className="h-4 w-4" /> Agent 能力中心
          <span className="ml-2 text-[10px] font-normal text-muted-foreground/60">
            一切由主 Agent 编排 · 人在环中决策 · 现有 UI 是能力工作台
          </span>
        </span>
      </div>

      {loading && (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">正在读取真实能力清单…</div>
      )}

      <div className="space-y-5 px-4 pb-4">
        {groups.map((g) => {
          const Icon = g.icon;
          return (
            <div key={g.category}>
              <div className="mb-2 flex items-center gap-2">
                <Icon className={cn("h-3.5 w-3.5", g.tone)} />
                <span className="text-xs font-semibold tracking-wide">{g.label}</span>
                <span className="text-[10px] text-muted-foreground/60">{g.desc}</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {g.items.map((c) => (
                  <div
                    key={c.id}
                    className="group flex flex-col gap-1.5 rounded-lg border border-border/60 bg-background/40 p-3 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-foreground">
                        <span className="mr-1.5 font-mono text-[10px] text-muted-foreground/60">{c.id}</span>
                        {c.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => sendAgentCommand(c.prompt)}
                        className="flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20"
                        title={`让主 Agent 编排：${c.prompt}`}
                      >
                        让 Agent 编排 <ArrowUpRight className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{c.description}</p>
                    {c.humanDecision && (
                      <p className="text-[10px] leading-snug text-muted-foreground/50">
                        <span className="text-warning/80">人在环中 · </span>
                        {c.humanDecision}
                      </p>
                    )}
                    {c.consoleHref && (
                      <a
                        href={c.consoleHref}
                        className="mt-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-primary"
                      >
                        <Boxes className="h-3 w-3" /> 打开能力工作台
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * FlowMind — 能力中心客户端（通用技能页入口）
 *
 * 运行时从 flowmind 后端发现技能；后端不可达时回退到演示清单，
 * 保证「通用技能页」始终能渲染出多样、丰富的模块组合。
 */
"use client";

import { useMemo, useState } from "react";
import { useSkillDiscovery } from "@/hooks/use-skill-discovery";
import { getDemoSkills, getDemoSkill, domainStyle, type DemoSkill } from "@/lib/skills/demo-manifest";
import { SkillPage, type SkillPageSkill } from "@/components/skills/SkillPage";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, Sparkles, Gauge, ArrowRight, RefreshCw } from "lucide-react";
import type { DiscoveredSkill } from "@/lib/skills";

const DOMAIN_ICON: Record<string, React.ReactNode> = {
  product: <Search className="h-4 w-4" />,
  imaging: <Sparkles className="h-4 w-4" />,
  ad: <Gauge className="h-4 w-4" />,
  listing: <Sparkles className="h-4 w-4" />,
  inventory: <Gauge className="h-4 w-4" />,
  competitor: <Search className="h-4 w-4" />,
  localize: <Sparkles className="h-4 w-4" />,
};

/** 把发现的技能 + 演示技能合并为可渲染的统一形态 */
function toPageSkill(s: DiscoveredSkill, demo?: DemoSkill): SkillPageSkill {
  return { ...s, domain: demo?.domain, demoOutput: demo?.demoOutput };
}

export function SkillsClient() {
  const { skills, loading, error, refetch } = useSkillDiscovery();
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // 后端返回空或出错 → 演示模式
  const isDemo = skills.length === 0;
  const list: SkillPageSkill[] = useMemo(() => {
    if (isDemo) {
      return getDemoSkills().map((s) => toPageSkill(s, s));
    }
    return skills.map((s) => toPageSkill(s, getDemoSkill(s.id)));
  }, [skills, isDemo]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || (s.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [list, query]);

  const active = selected ? list.find((s) => s.id === selected) ?? null : null;

  if (active) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4 rotate-180" /> 返回能力中心
        </button>
        <SkillPage skill={active} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 页头 */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-xs text-muted-foreground">FlowMind / 能力中心</div>
          <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight">能力中心</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            后端注册的全部技能，由通用渲染器按 Schema 自动生成参数表单与输出模块。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isDemo ? "warning" : "success"}>
            {isDemo ? "演示数据" : "实时发现"}
          </Badge>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            刷新
          </button>
        </div>
      </div>

      {/* 搜索 */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索技能、标签、描述…"
          className="pl-9"
        />
      </div>

      {/* 加载 / 错误 / 空 */}
      {loading && list.length === 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      )}
      {error && isDemo && (
        <p className="rounded-lg bg-warning/10 px-4 py-2 text-sm text-warning">
          技能发现服务不可达（{error}），当前展示演示清单。
        </p>
      )}

      {/* 技能网格 */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => {
            const style = domainStyle(s.domain);
            const icon = s.domain ? (DOMAIN_ICON[s.domain] ?? <Sparkles className="h-4 w-4" />) : <Sparkles className="h-4 w-4" />;
            const conf = Math.round((s.reliability_profile?.confidence ?? 0) * 100);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelected(s.id)}
                className="glass group flex flex-col gap-3 rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5 hover:border-ring/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", style.chip)}>
                    {icon}
                  </span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {s.version}
                  </Badge>
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold">{s.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                </div>
                <div className="mt-auto flex flex-col gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-3 w-3 text-primary/70" />
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", style.bar)} style={{ width: `${conf}%` }} />
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">{conf}%</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(s.tags ?? []).map((t) => (
                      <span key={t} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">未找到匹配的技能。</p>
      )}
    </div>
  );
}

/**
 * FlowMind — 能力中心客户端（通用技能页入口）
 *
 * 运行时从 flowmind 后端发现技能；后端不可达时展示结构化错误（无演示回退）。
 */
"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useMemo, useState } from "react";
import { useSkillDiscovery } from "@/hooks/use-skill-discovery";
import { domainStyle } from "@/lib/skills/domain-style";
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

function toPageSkill(s: DiscoveredSkill): SkillPageSkill {
  return { ...s };
}

export function SkillsClient() {
  const { skills, loading, error, refetch } = useSkillDiscovery();
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const list: SkillPageSkill[] = useMemo(() => skills.map(toPageSkill), [skills]);

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
      <PageHeader
        breadcrumb={<><span>FlowMind</span> / <b>能力中心</b></>}
        title="能力中心"
        description="后端注册的全部技能，由通用渲染器按 Schema 自动生成参数表单与输出模块。"
        actions={<div className="flex items-center gap-2">
          <Badge variant={error ? "warning" : "success"}>
            {error ? "服务不可达" : "实时发现"}
          </Badge>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            刷新
          </button>
        </div>}
      />

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
      {error && (
        <p className="rounded-lg bg-warning/10 px-4 py-2 text-sm text-warning">
          技能发现服务不可达（{error}），请确认 flowmind 后端已启动后点击刷新。
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
                  <Badge variant="outline" className="font-mono text-tiny">
                    {s.version}
                  </Badge>
                </div>
                <div>
                  <h3 className="text-base font-semibold">{s.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                </div>
                <div className="mt-auto flex flex-col gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-3 w-3 text-primary/70" />
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", style.bar)} style={{ width: `${conf}%` }} />
                    </div>
                    <span className="font-mono text-tiny text-muted-foreground">{conf}%</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(s.tags ?? []).map((t) => (
                      <span key={t} className="rounded-full border border-border px-2 py-0.5 text-tiny text-muted-foreground">
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

/**
 * FlowMind — 通用技能页（Schema 驱动）
 *
 * 取代「一技能一专属页」：任何后端发现的技能都能用这一套页面渲染，
 * 并根据 input_schema / output_schema / reliability_profile / 示例输出
 * 自动生成不同形态的参数表单与输出模块（多样、功能丰富）。
 */
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SchemaForm } from "./SchemaForm";
import { SkillOutput } from "./SkillOutput";
import { domainStyle } from "@/lib/skills/domain-style";
import { cn } from "@/lib/utils";
import { Play, Loader2, Sparkles, Gauge, Clock, Brain, Zap } from "lucide-react";
import type { DiscoveredSkill } from "@/lib/skills";

export interface SkillPageSkill extends DiscoveredSkill {
  domain?: string;
}

const DOMAIN_ICON: Record<string, React.ReactNode> = {
  product: <Sparkles className="h-4 w-4" />,
  imaging: <Sparkles className="h-4 w-4" />,
  ad: <Zap className="h-4 w-4" />,
  listing: <Sparkles className="h-4 w-4" />,
  inventory: <Brain className="h-4 w-4" />,
  competitor: <Zap className="h-4 w-4" />,
  localize: <Zap className="h-4 w-4" />,
};

export function SkillPage({ skill }: { skill: SkillPageSkill }) {
  const [input, setInput] = useState<Record<string, unknown>>(() => {
    // 用 default 预填
    const init: Record<string, unknown> = {};
    if (skill.input_schema?.properties) {
      for (const [k, prop] of Object.entries(skill.input_schema.properties)) {
        if (prop && typeof prop === "object" && "default" in prop) init[k] = (prop as { default: unknown }).default;
      }
    }
    return init;
  });
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<unknown | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [showSchema, setShowSchema] = useState(false);

  const rp = skill.reliability_profile;
  const style = domainStyle(skill.domain);
  const icon = skill.domain ? (DOMAIN_ICON[skill.domain] ?? <Sparkles className="h-4 w-4" />) : <Sparkles className="h-4 w-4" />;

  // 真实执行：POST /api/skills/run → flowmind A2A 编排器；失败展示结构化错误，不出假数据
  const handleRun = async () => {
    if (running) return;
    setRunning(true);
    setOutput(null);
    setRunError(null);
    try {
      const res = await fetch("/api/skills/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: skill.id, input }),
      });
      const data = await res.json();
      if (data.success) {
        setOutput(data.data.output);
      } else {
        setRunError(data.message ?? "技能执行失败");
      }
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 页头 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", style.chip)}>
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-2xl font-bold tracking-tight">{skill.name}</h1>
              <Badge variant="outline" className="font-mono text-tiny">
                {skill.version}
              </Badge>
            </div>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{skill.description}</p>
            {(skill.tags?.length ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {skill.tags!.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 可靠性画像 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-background/50 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" /> 置信度
          </div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums">
            {Math.round(rp.confidence * 100)}
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background/50 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> 典型时延
          </div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums">
            {(rp.typical_latency_ms / 1000).toFixed(1)}
            <span className="text-sm text-muted-foreground">s</span>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background/50 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Brain className="h-3.5 w-3.5" /> 输出类型
          </div>
          <div className="mt-1.5 text-sm font-semibold">{rp.deterministic ? "确定性" : "生成式"}</div>
        </div>
        <div className="rounded-xl border border-border bg-background/50 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> 推理链
          </div>
          <div className="mt-1.5 text-sm font-semibold">{rp.emits_reasoning_chain ? "可折叠展示" : "无"}</div>
        </div>
      </div>

      {/* 参数 + 输出 */}
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="glass rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">运行参数</h2>
            <button
              type="button"
              onClick={() => setShowSchema((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showSchema ? "隐藏 Schema" : "查看 Schema"}
            </button>
          </div>
          {showSchema && skill.input_schema ? (
            <pre className="max-h-72 overflow-auto rounded-lg bg-muted/60 p-3 font-mono text-caption leading-relaxed text-muted-foreground">
              {JSON.stringify(skill.input_schema, null, 2)}
            </pre>
          ) : (
            <SchemaForm schema={skill.input_schema} value={input} onChange={setInput} disabled={running} />
          )}
          <Button className="mt-5 w-full" onClick={handleRun} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? "运行中…" : "运行工作流"}
          </Button>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">输出结果</h2>
            {runError ? <Badge variant="warning">执行失败</Badge> : output !== null ? <Badge variant="success">已完成</Badge> : null}
          </div>
          {running ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              正在编排 Agent 协同执行…
            </div>
          ) : runError ? (
            <p className="rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">{runError}</p>
          ) : (
            <SkillOutput data={output ?? {}} />
          )}
        </div>
      </div>
    </div>
  );
}

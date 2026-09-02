"use client";

/**
 * TeamSopPanel —— M4「保存为团队 SOP」最小用户可见入口
 *
 * - 列出已保存的团队 SOP（GET /api/agent/workflows，表缺失时降级为空）
 * - 对内置模板的旅程提供「保存当前旅程为团队 SOP」（POST 落 wf_workflow_specs）
 * - 每条 SOP 可「重跑」（POST /api/agent/workflows/[id]/run），展示每步成功/失败
 *
 * 产品边界：SOP 只自动跑分析/草稿/生图等可自动执行工具；渠道上架等 L2 对外动作
 * 不进入自动 SOP，仍须在页面内由人确认，避免"一键重跑"变成"一键对外发布"。
 */
import { useCallback, useEffect, useState } from "react";
import { BookmarkPlus, Loader2, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

type SopSummary = { id: string; title: string; goal: string; updated_at: string };
type SopStepResult = { id: string; tool: string; ok: boolean; summary: string };

/** 旅程 → 可固化为 SOP 的步骤模板（工具 id 必须在 tool-registry 白名单内）。 */
const SOP_TEMPLATES: Record<string, { id: string; title: string; goal: string; steps: Array<{ id: string; tool: string; args?: Record<string, unknown>; dependsOn?: string[] }> }> = {
  "listing-launch": {
    id: "tiktok-alibaba-listing-sop",
    title: "TikTok·国际站铺货 SOP",
    goal: "以一个种子词跑通 TikTok 热词→长尾→英文 Listing 草稿→侵权词检测→主图生成（渠道上架为 L2，不在自动 SOP 内，须人工确认发布）",
    steps: [
      { id: "fetch-tiktok-trends", tool: "b2b_trends", args: { platform: "tiktok" } },
      { id: "longtail-words", tool: "b2b_longtail", args: { industry: "cross-border", seedKeywords: ["tiktok pick"], limit: 20 }, dependsOn: ["fetch-tiktok-trends"] },
      { id: "listing-draft", tool: "listing_generate", args: { keyword: "tiktok pick", language: "en" }, dependsOn: ["longtail-words"] },
      { id: "infringement-check", tool: "listing_infringement", args: { text: "listing draft" }, dependsOn: ["listing-draft"] },
      { id: "main-image", tool: "imaging_generate", args: { prompt: "product main image on clean white background, e-commerce", type: "main", count: 3 }, dependsOn: ["infringement-check"] },
    ],
  },
};

export function TeamSopPanel({ journeyId }: { journeyId: string }) {
  const template = SOP_TEMPLATES[journeyId];
  const [sops, setSops] = useState<SopSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, SopStepResult[]>>({});

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/workflows", { cache: "no-store" });
      const json = (await res.json()) as { success: boolean; data?: SopSummary[] };
      setSops(json.success && Array.isArray(json.data) ? json.data : []);
    } catch {
      setSops([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 挂载时订阅式拉取（setState 只发生在 fetch 异步回调，符合 effect 只做外部同步的约定）
  useEffect(() => {
    let cancelled = false;
    fetch("/api/agent/workflows", { cache: "no-store" })
      .then((r) => r.json())
      .then((json: { success: boolean; data?: SopSummary[] }) => {
        if (!cancelled) setSops(json.success && Array.isArray(json.data) ? json.data : []);
      })
      .catch(() => {
        if (!cancelled) setSops([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    if (!template) return;
    setSaving(true);
    try {
      const res = await fetch("/api/agent/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      });
      const json = (await res.json()) as { success: boolean; data?: { stepCount: number }; error?: string };
      if (!res.ok || !json.success) {
        toast.error("SOP 保存失败", { description: json.error ?? "请稍后重试" });
        return;
      }
      toast.success("已保存为团队 SOP", { description: `共 ${json.data?.stepCount ?? template.steps.length} 步，可对新词重跑` });
      await refresh();
    } catch {
      toast.error("SOP 保存失败", { description: "网络错误" });
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async (id: string) => {
    setRunningId(id);
    try {
      const res = await fetch(`/api/agent/workflows/${encodeURIComponent(id)}/run`, { method: "POST" });
      const json = (await res.json()) as { success: boolean; data?: { status: string; steps: SopStepResult[] }; error?: string };
      if (!res.ok || !json.success || !json.data) {
        toast.error("SOP 重跑失败", { description: json.error ?? "请稍后重试" });
        return;
      }
      setResults((prev) => ({ ...prev, [id]: json.data!.steps }));
      const failed = json.data.steps.filter((s) => !s.ok).length;
      if (failed === 0) toast.success("SOP 重跑完成", { description: `${json.data.steps.length} 步全部成功` });
      else toast.warning("SOP 重跑完成（含失败步）", { description: `${json.data.steps.length - failed} 成功 / ${failed} 失败` });
    } catch {
      toast.error("SOP 重跑失败", { description: "网络错误" });
    } finally {
      setRunningId(null);
    }
  };

  return (
    <Card className="workflow-card mt-6 py-0" data-testid="team-sop-panel">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-sm font-semibold">团队 SOP · 可复用打法（M4）</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              把这条旅程固化为可重跑的工作流；只自动跑分析/草稿/生图，对外发布仍须逐次人工确认。
            </p>
          </div>
          {template && (
            <Button size="sm" variant="outline" className="ml-auto" onClick={handleSave} disabled={saving} data-testid="save-sop">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
              保存当前旅程为团队 SOP
            </Button>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {loading ? (
            <p className="text-xs text-muted-foreground">加载已保存 SOP…</p>
          ) : sops.length === 0 ? (
            <p className="text-xs text-muted-foreground" data-testid="sop-empty">
              暂无已保存 SOP{template ? "，点右上角把当前铺货旅程固化为 SOP。" : "。"}
            </p>
          ) : (
            sops.map((s) => (
              <div key={s.id} className="rounded-md border bg-surface-1 px-3 py-2.5" data-testid={`sop-row-${s.id}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body font-medium">{s.title}</span>
                  <span className="font-mono text-caption text-muted-foreground">{s.id}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-7 px-2.5 text-xs"
                    disabled={runningId === s.id}
                    onClick={() => handleRun(s.id)}
                    data-testid={`rerun-sop-${s.id}`}
                  >
                    {runningId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    重跑
                  </Button>
                  <RefreshCw className="h-3 w-3 text-muted-foreground" />
                </div>
                <p className="mt-1 text-caption text-muted-foreground">{s.goal}</p>
                {results[s.id] && (
                  <ol className="mt-2 space-y-1" data-testid={`sop-result-${s.id}`}>
                    {results[s.id].map((st) => (
                      <li key={st.id} className="flex items-center gap-2 font-mono text-caption">
                        <span className={st.ok ? "text-success" : "text-destructive"}>{st.ok ? "✓" : "✗"}</span>
                        <span>{st.id}</span>
                        <span className="text-muted-foreground">→ {st.tool}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { PageTransition } from "@/components/ui/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AdMaterial } from "@/lib/types";
import {
  BarChart3, Search, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronRight,
  Zap, Target, Download, Loader2, Play, ExternalLink, Info,
} from "lucide-react";

const AnimatedNumber = dynamic(() => import("@/components/ui/animated-number").then((m) => ({ default: m.AnimatedNumber })), { ssr: false });

function compact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}
function fmtDuration(s: number | null | undefined): string {
  if (!s) return "—";
  const m = Math.floor(s / 60), sec = Math.round(s % 60);
  return m ? `${m}:${String(sec).padStart(2, "0")}` : `${sec}s`;
}

export interface AiAdvertisingClientProps {
  recentAnalyses?: Array<{ id: string; keyword: string; resultJson: unknown; createdAt: string }>;
}

export function AiAdvertisingClient({ recentAnalyses = [] }: AiAdvertisingClientProps) {
  const router = useRouter();
  const initialKw = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("kw") || "skincare"
    : "skincare";
  const [keyword, setKeyword] = useState(initialKw);
  const [mode, setMode] = useState<"premium" | "bulk">("premium");
  const [orderBy, setOrderBy] = useState<"for_you" | "likes">("likes");
  const [period, setPeriod] = useState(180);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<AdMaterial[]>([]);
  const [total, setTotal] = useState(0);
  const [warn, setWarn] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ highCtr: true, longVideo: false, weak: false });
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>(() => {
    if (recentAnalyses.length > 0) {
      const r = recentAnalyses[0].resultJson;
      return typeof r === "string" ? r : JSON.stringify(r, null, 2);
    }
    return "";
  });

  const search = useCallback(async () => {
    const kw = keyword.trim();
    if (!kw) { setWarn("请输入投放关键词"); return; }
    setLoading(true); setWarn(null);
    try {
      const res = await fetch("/api/b2b/ad-intel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search_ads", keyword: kw, limit: 20, orderBy, period }),
      });
      const j = await res.json();
      const d = j.data;
      if (!d) throw new Error(j.error || "查询失败");
      if (d.degraded) { setMaterials([]); setWarn(d.warning || "广告库不可用"); return; }
      setMaterials(d.materials ?? []);
      setTotal(d.pagination?.total ?? 0);
      if ((d.materials ?? []).length === 0) setWarn(`「${kw}」近 ${period} 天无在投广告参考`);
    } catch (e) {
      setWarn(e instanceof Error ? e.message : "查询失败");
    } finally { setLoading(false); }
  }, [keyword, orderBy, period]);

  // 挂载即拉取真实竞品广告（延迟到定时器回调，避免 effect 体内同步 setState）
  useEffect(() => {
    const t = setTimeout(() => void search(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const ctrs = materials.filter((m) => typeof m.ctr === "number");
    const brands = new Set(materials.map((m) => m.brand).filter(Boolean));
    const likes = materials.reduce((a, b) => a + (b.likes ?? 0), 0);
    return {
      count: materials.length,
      avgCtr: ctrs.length ? ctrs.reduce((a, b) => a + (b.ctr ?? 0), 0) / ctrs.length : null,
      brands: brands.size,
      likes,
    };
  }, [materials]);

  // 按真实 CTR 分层，供投放参考
  const groups = useMemo(() => {
    const sorted = [...materials].sort((a, b) => (b.ctr ?? 0) - (a.ctr ?? 0));
    return [
      { key: "highCtr" as const, label: "高 CTR 标杆（优先拆解）", icon: CheckCircle2, color: "text-success", items: sorted.filter((m) => (m.ctr ?? 0) >= (stats.avgCtr ?? 0) && m.ctr != null).slice(0, 10) },
      { key: "longVideo" as const, label: "长素材（>20s，讲卖点）", icon: Zap, color: "text-info", items: materials.filter((m) => (m.durationS ?? 0) > 20).slice(0, 10) },
      { key: "weak" as const, label: "低互动素材（规避方向）", icon: XCircle, color: "text-zinc-400", items: sorted.filter((m) => (m.likes ?? 0) < 50).slice(0, 10) },
    ];
  }, [materials, stats.avgCtr]);

  const handleAnalyze = async () => {
    if (materials.length === 0) return;
    setAnalyzing(true); setAnalysisResult("");
    try {
      const res = await fetch("/api/workflows/ai-advertising/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, competitorAds: materials.slice(0, 12), mode }),
      });
      const j = await res.json();
      if (j.success) {
        setAnalysisResult(typeof j.data === "string" ? j.data : JSON.stringify(j.data, null, 2));
        router.refresh();
      } else setAnalysisResult("分析失败: " + (j.error || "未知错误"));
    } catch (e) {
      setAnalysisResult("请求失败: " + (e instanceof Error ? e.message : "网络错误"));
    } finally { setAnalyzing(false); }
  };

  return (
    <PageTransition className="space-y-4">
      <PageHeader
        title="AI 广告投放"
        description="基于 TikTok 真实在投竞品广告做投放参考 — 素材拆解 + AI 策略（自有账户投放数据走官方 MCP）"
        icon={<BarChart3 className="h-6 w-6 text-wf-ad" />}
      />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">投放策略配置</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex rounded-lg bg-muted/50 p-0.5">
                <button onClick={() => setMode("premium")} className={cn("flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all", mode === "premium" ? "bg-[var(--wf-ad)] text-white shadow-sm" : "text-muted-foreground")}>精品模式</button>
                <button onClick={() => setMode("bulk")} className={cn("flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all", mode === "bulk" ? "bg-[var(--wf-ad)] text-white shadow-sm" : "text-muted-foreground")}>精铺模式</button>
              </div>

              <div>
                <p className="text-xs font-medium mb-1.5">投放关键词</p>
                <Input value={keyword} onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()} className="h-9 text-xs" placeholder="如 skincare、leggings" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-caption text-muted-foreground mb-1">排序</p>
                  <select value={orderBy} onChange={(e) => setOrderBy(e.target.value as "for_you" | "likes")}
                    className="h-9 w-full rounded-lg border border-input bg-background/60 px-2 text-xs">
                    <option value="likes">点赞优先</option>
                    <option value="for_you">推荐</option>
                  </select>
                </div>
                <div>
                  <p className="text-caption text-muted-foreground mb-1">时间窗</p>
                  <select value={period} onChange={(e) => setPeriod(Number(e.target.value))}
                    className="h-9 w-full rounded-lg border border-input bg-background/60 px-2 text-xs">
                    <option value={7}>近 7 天</option>
                    <option value={30}>近 30 天</option>
                    <option value={180}>近 180 天</option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><Target className="h-3.5 w-3.5 text-[var(--wf-ad)]" />
                  <span>{mode === "premium" ? "精品：聚焦高 CTR 标杆素材深度拆解" : "精铺：批量铺词，参考低互动素材规避雷区"}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2 h-9" onClick={search} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} 拉取竞品广告
                </Button>
                <Button className="flex-1 gap-2 h-9 bg-[var(--wf-ad)] hover:bg-[var(--wf-ad)]/90" onClick={handleAnalyze} disabled={analyzing || materials.length === 0}>
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} AI 策略
                </Button>
              </div>

              {analysisResult && (
                <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                  <p className="font-medium mb-1">AI 策略结果</p>
                  <pre className="whitespace-pre-wrap text-muted-foreground max-h-48 overflow-auto scrollbar-thin">{analysisResult}</pre>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">竞品素材概览</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">在投广告总量</span><AnimatedNumber value={total} className="font-bold" /></div>
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">本页素材</span><span className="font-bold">{stats.count}</span></div>
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">平均 CTR</span>
                <span className="font-bold text-success">{stats.avgCtr !== null ? `${stats.avgCtr.toFixed(2)}%` : "—"}</span></div>
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">在投品牌数</span><span className="font-bold">{stats.brands}</span></div>
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">累计点赞</span><span className="font-bold">{compact(stats.likes)}</span></div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 min-w-0">
          <div className="flex items-start gap-2 rounded-lg border border-info/20 bg-info/5 p-2.5 text-caption text-muted-foreground">
            <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
            <span>下表为 TikTok Creative Center 真实在投竞品广告（非自有账户花费数据）。花费/ACOS 等自有投放指标需授权广告账户后走官方 TikTok for Business 连接器。</span>
          </div>

          {warn && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /><span>{warn}</span>
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">竞品广告素材池</CardTitle>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs"
                  onClick={() => {
                    const csv = "brand\ttitle\tctr\tlikes\tduration\tobjective\turl\n" +
                      materials.map((m) => `${m.brand ?? ""}\t"${(m.title ?? "").replace(/"/g, '""')}"\t${m.ctr ?? ""}\t${m.likes ?? ""}\t${m.durationS ?? ""}\t${m.objective ?? ""}\t${m.videoUrl ?? ""}`).join("\n");
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(new Blob([csv], { type: "text/tab-separated-values;charset=utf-8" }));
                    a.download = "competitor-ads.tsv"; a.click();
                  }}>
                  <Download className="h-3 w-3" /> 导出
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading && materials.length === 0 ? (
                <div className="flex items-center justify-center py-20 gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> 拉取真实在投广告…</div>
              ) : (
                <div className="overflow-x-auto scrollbar-thin max-h-[460px]">
                  <table className="w-full text-xs">
                    <thead className="table-glass-head sticky top-0">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">品牌 / 文案</th>
                        <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">CTR</th>
                        <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">点赞</th>
                        <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">时长</th>
                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">目标</th>
                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">素材</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materials.map((m) => (
                        <tr key={m.id} onClick={() => setSelected(selected === m.id ? null : m.id)}
                          className={cn("row-rail border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors [--rail:var(--wf-ad)]", selected === m.id && "bg-muted/50")}>
                          <td className="px-3 py-2 max-w-[320px]">
                            <div className="font-medium">{m.brand || "未知品牌"}</div>
                            <div className="text-muted-foreground line-clamp-1">{m.title || "（无文案）"}</div>
                          </td>
                          <td className="px-3 py-2 text-right font-medium">{typeof m.ctr === "number" ? `${m.ctr.toFixed(2)}%` : "—"}</td>
                          <td className="px-3 py-2 text-right">{compact(m.likes)}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{fmtDuration(m.durationS)}</td>
                          <td className="px-3 py-2 text-center">{m.objective ? <Badge variant="outline" className="text-tiny capitalize">{m.objective}</Badge> : "—"}</td>
                          <td className="px-3 py-2 text-center">
                            {m.videoUrl ? (
                              <a href={m.videoUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-[var(--wf-ad)] hover:underline">
                                <Play className="h-3 w-3" />看 <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            {groups.map((g) => {
              const Icon = g.icon;
              const isOpen = expanded[g.key];
              return (
                <Card key={g.key} className="border-l-2 border-l-current">
                  <CardContent className="p-3">
                    <button className="flex items-center justify-between w-full" onClick={() => setExpanded((p) => ({ ...p, [g.key]: !p[g.key] }))}>
                      <div className="flex items-center gap-2"><Icon className={cn("h-4 w-4", g.color)} /><span className="text-xs font-medium">{g.label}</span></div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-xs">{g.items.length}</Badge>
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="mt-2 space-y-1 pt-2 border-t max-h-48 overflow-auto">
                        {g.items.length === 0 && <p className="text-caption text-muted-foreground">无符合素材</p>}
                        {g.items.map((m) => (
                          <div key={m.id} className="flex items-center justify-between text-caption py-0.5 gap-2">
                            <span className="text-muted-foreground truncate">{m.brand || "未知"} · {m.title?.slice(0, 24) || "无文案"}</span>
                            <span className="font-medium shrink-0">{typeof m.ctr === "number" ? `${m.ctr.toFixed(1)}%` : compact(m.likes)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

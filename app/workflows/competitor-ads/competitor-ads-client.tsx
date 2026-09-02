"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AdMaterial } from "@/lib/types";
import {
  Eye, BarChart3, Target, Zap, Loader2, Search, Play, ExternalLink, AlertTriangle,
} from "lucide-react";

const AnimatedNumber = dynamic(() => import("@/components/ui/animated-number").then((m) => ({ default: m.AnimatedNumber })), { ssr: false });

interface FilterDict {
  industry: Array<{ id: string; label: string; parentId: number | null }>;
  objective: Array<{ id: string; label: string; parentId: number | null }>;
}

export interface CompetitorAdsClientProps {
  recentAnalyses?: Array<{ id: string; asins: string[]; resultJson: unknown; createdAt: string }>;
}

function compact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDuration(s: number | null | undefined): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `${sec}s`;
}

export function CompetitorAdsClient({ recentAnalyses = [] }: CompetitorAdsClientProps) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("skincare");
  const [industry, setIndustry] = useState("");
  const [objective, setObjective] = useState("");
  const [orderBy, setOrderBy] = useState<"for_you" | "likes">("for_you");
  const [period, setPeriod] = useState(180);
  const [filters, setFilters] = useState<FilterDict>({ industry: [], objective: [] });

  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<AdMaterial[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>(() => {
    if (recentAnalyses.length > 0) {
      const r = recentAnalyses[0].resultJson;
      return typeof r === "string" ? r : JSON.stringify(r, null, 2);
    }
    return "";
  });

  // 首次加载行业/目标字典（失败不阻塞搜索）
  useEffect(() => {
    fetch("/api/b2b/ad-intel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "filters" }),
    }).then((r) => r.json()).then((j) => {
      if (j.data?.filters) setFilters(j.data.filters);
    }).catch(() => { /* 字典非关键 */ });
  }, []);

  const runSearch = useCallback(async (targetPage = 1) => {
    const kw = keyword.trim();
    if (!kw) { setWarning("请输入竞品/品类关键词，如 skincare、leggings"); return; }
    setLoading(true);
    setWarning(null);
    try {
      const res = await fetch("/api/b2b/ad-intel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "search_ads", keyword: kw, page: targetPage, limit: 20,
          orderBy, period,
          industry: industry || undefined,
          objective: objective ? Number(objective) : undefined,
        }),
      });
      const json = await res.json();
      const data = json.data;
      if (!data) throw new Error(json.error || "查询失败");
      if (data.degraded) {
        setMaterials([]); setTotal(0); setHasMore(false);
        setWarning(data.warning || "广告库当前不可用，请稍后重试");
      } else {
        setMaterials(data.materials ?? []);
        setTotal(data.pagination?.total ?? (data.materials ?? []).length);
        setHasMore(Boolean(data.pagination?.hasMore));
        setPage(targetPage);
        if ((data.materials ?? []).length === 0) setWarning(`关键词「${kw}」近 ${period} 天没有检索到在投广告，换个更商业的词试试`);
      }
      setSearched(true);
    } catch (err) {
      setWarning(err instanceof Error ? err.message : "广告库查询失败");
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  }, [keyword, orderBy, period, industry, objective]);

  // 首次自动搜一次（默认词 skincare；延迟到定时器回调，避免 effect 体内同步 setState）
  useEffect(() => {
    const t = setTimeout(() => void runSearch(1), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 品牌聚合（真实在投品牌分布）
  const brandStats = useMemo(() => {
    const m = new Map<string, number>();
    materials.forEach((x) => { const b = x.brand || "未知品牌"; m.set(b, (m.get(b) ?? 0) + 1); });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [materials]);

  const avgCtr = useMemo(() => {
    const xs = materials.filter((m) => typeof m.ctr === "number");
    if (!xs.length) return null;
    return xs.reduce((a, b) => a + (b.ctr ?? 0), 0) / xs.length;
  }, [materials]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisResult("");
    try {
      const asins = materials.slice(0, 3).map((m) => m.id);
      const res = await fetch("/api/workflows/competitor-ads/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asins, marketplace: "US", materials: materials.slice(0, 10) }),
      });
      const json = await res.json();
      if (json.success) {
        setAnalysisResult(typeof json.data?.result === "string" ? json.data.result : JSON.stringify(json.data?.result, null, 2));
      } else {
        setAnalysisResult(`分析失败: ${json.error}`);
      }
    } catch (err) {
      setAnalysisResult(`分析失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <PageTransition className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-wf-competitor/10">
          <Eye className="h-4 w-4 text-wf-competitor" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">竞品广告创意库</h1>
          <p className="text-xs text-muted-foreground">TikTok Creative Center 真实在投广告 — 搜素材 / 看文案 / 拆解 CTR 与打法</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="text-[11px] text-muted-foreground">关键词（品牌/品类/卖点）</label>
              <Input value={keyword} onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch(1)} placeholder="如 skincare、leggings、coffee maker" className="mt-1 h-9" />
            </div>
            <div className="w-44">
              <label className="text-[11px] text-muted-foreground">行业</label>
              <select value={industry} onChange={(e) => setIndustry(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background/60 px-2 text-sm">
                <option value="">全部行业</option>
                {filters.industry.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
              </select>
            </div>
            <div className="w-36">
              <label className="text-[11px] text-muted-foreground">营销目标</label>
              <select value={objective} onChange={(e) => setObjective(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background/60 px-2 text-sm">
                <option value="">全部目标</option>
                {filters.objective.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div className="w-32">
              <label className="text-[11px] text-muted-foreground">时间窗</label>
              <select value={period} onChange={(e) => setPeriod(Number(e.target.value))}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background/60 px-2 text-sm">
                <option value={7}>近 7 天</option>
                <option value={30}>近 30 天</option>
                <option value={180}>近 180 天</option>
              </select>
            </div>
            <div className="w-32">
              <label className="text-[11px] text-muted-foreground">排序</label>
              <select value={orderBy} onChange={(e) => setOrderBy(e.target.value as "for_you" | "likes")}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background/60 px-2 text-sm">
                <option value="for_you">推荐</option>
                <option value="likes">点赞优先</option>
              </select>
            </div>
            <Button className="h-9 gap-2 bg-[var(--wf-competitor)] hover:bg-[var(--wf-competitor)]/90"
              onClick={() => runSearch(1)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              搜索广告
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {warning && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{warning}</span>
            </div>
          )}

          {loading && materials.length === 0 && (
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> 正在检索真实在投广告…
            </div>
          )}

          {!loading && materials.length > 0 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {materials.map((ad) => (
                  <Card key={ad.id} className="overflow-hidden flex flex-col">
                    <div className="relative aspect-[9/12] bg-muted group">
                      {ad.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ad.coverUrl} alt={ad.title} loading="lazy"
                          className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">无封面</div>
                      )}
                      {ad.videoUrl && (
                        <a href={ad.videoUrl} target="_blank" rel="noreferrer"
                          className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                          <Play className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" />
                        </a>
                      )}
                      <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                        {fmtDuration(ad.durationS)}
                      </span>
                      {ad.objective && (
                        <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white capitalize">
                          {ad.objective}
                        </span>
                      )}
                    </div>
                    <CardContent className="p-3 space-y-2 flex-1">
                      <p className="text-xs leading-snug line-clamp-2 min-h-[2rem]">{ad.title || "（无广告文案）"}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-muted-foreground truncate">{ad.brand || "未知品牌"}</span>
                        {ad.videoUrl && (
                          <a href={ad.videoUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>CTR <b className="text-foreground metric-value">{typeof ad.ctr === "number" ? `${ad.ctr.toFixed(2)}%` : "—"}</b></span>
                        <span>赞 <b className="text-foreground metric-value">{compact(ad.likes)}</b></span>
                        <span className="ml-auto">#{ad.rank}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">第 {page} 页 · 共 {total.toLocaleString()} 条在投广告</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => runSearch(page - 1)}>上一页</Button>
                  <Button variant="outline" size="sm" disabled={!hasMore || loading} onClick={() => runSearch(page + 1)}>下一页</Button>
                </div>
              </div>
            </>
          )}

          {!loading && searched && materials.length === 0 && !warning && (
            <p className="py-16 text-center text-sm text-muted-foreground">暂无广告素材</p>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">投放概览</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">在投广告总量</span><AnimatedNumber value={total} className="font-medium" /></div>
              <div className="flex justify-between"><span className="text-muted-foreground">本页素材</span><span className="font-medium">{materials.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">平均 CTR</span>
                <span className="font-medium">{avgCtr !== null ? `${avgCtr.toFixed(2)}%` : "—"}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">在投品牌</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {brandStats.length === 0 && <p className="text-xs text-muted-foreground">搜索后展示品牌分布</p>}
              {brandStats.map(([name, count]) => {
                const pct = materials.length ? Math.round((count / materials.length) * 100) : 0;
                return (
                  <div key={name} className="space-y-1">
                    <div className="flex justify-between text-xs"><span className="truncate">{name}</span><span className="metric-value">{count}</span></div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--wf-competitor)]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">快捷操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start gap-2 h-8 text-xs bg-[var(--wf-competitor)] hover:bg-[var(--wf-competitor)]/90"
                onClick={handleAnalyze} disabled={analyzing || materials.length === 0}>
                {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                {analyzing ? "分析中..." : "AI 拆解当前素材"}
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-8 text-xs"
                onClick={() => router.push("/workflows/ai-advertising?kw=" + encodeURIComponent(keyword))}>
                <Target className="h-3.5 w-3.5" /> 用该关键词去投放工作流
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-8 text-xs"
                disabled={materials.length === 0}
                onClick={() => {
                  const content = materials.map((m) => `${m.brand}\t${m.title}\tCTR:${m.ctr ?? ""}\t赞:${m.likes ?? ""}\t${m.videoUrl}`).join("\n");
                  const blob = new Blob(["TikTok 竞品广告素材\n\n" + content], { type: "text/plain;charset=utf-8" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob); a.download = "tiktok-ad-library.txt"; a.click();
                }}>
                <BarChart3 className="h-3.5 w-3.5" /> 导出素材清单
              </Button>
              {analysisResult && (
                <div className="rounded-md bg-muted/50 p-2 text-[10px] font-mono max-h-48 overflow-auto whitespace-pre-wrap">{analysisResult}</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}

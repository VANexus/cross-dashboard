"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { PageTransition } from "@/components/ui/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const Sparkline = dynamic(() => import("@/components/ui/sparkline").then((m) => ({ default: m.Sparkline })), { ssr: false });
import {
  BarChart3,
  Search,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Zap,
  Target,
  Download,
  Lock,
} from "lucide-react";

interface AdKeyword {
  id: string;
  keyword: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  acos: number;
  conversion: number;
  cpc: number;
  tag: "high-acos" | "high-conversion" | "non-precise";
  type: "SP" | "SB" | "SD";
  trend: number[];
}

const tagMeta = {
  "high-acos": { label: "高ACOS", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: AlertTriangle },
  "high-conversion": { label: "高转化", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  "non-precise": { label: "非精准", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20", icon: XCircle },
};

const adTypeMeta = {
  SP: { label: "SP", color: "text-blue-400" },
  SB: { label: "SB", color: "text-purple-400" },
  SD: { label: "SD", color: "text-orange-400" },
};

function formatCurrency(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface AiAdvertisingClientProps {
  adKeywords: AdKeyword[];
  recentAnalyses?: Array<{ id: string; keyword: string; resultJson: unknown; createdAt: string }>;
}

export function AiAdvertisingClient({ adKeywords, recentAnalyses = [] }: AiAdvertisingClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"premium" | "bulk">("premium");
  const [expandedTags, setExpandedTags] = useState<Record<string, boolean>>({});
  const [selectedKw, setSelectedKw] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>(() => {
    if (recentAnalyses.length > 0) {
      const r = recentAnalyses[0].resultJson;
      return typeof r === "string" ? r : JSON.stringify(r, null, 2);
    }
    return "";
  });

  const handleAnalyze = useCallback(async () => {
    if (adKeywords.length === 0) return;
    setAnalyzing(true);
    setAnalysisResult("");
    try {
      const sample = adKeywords[0];
      const res = await fetch("/api/workflows/ai-advertising/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: sample.keyword,
          currentData: {
            impressions: sample.impressions,
            clicks: sample.clicks,
            spend: sample.spend,
            sales: sample.sales,
            acos: sample.acos,
          },
        }),
      });
      const json = await res.json();
      if (json.success) {
        setAnalysisResult(typeof json.data === "string" ? json.data : JSON.stringify(json.data, null, 2));
        router.refresh();
      } else {
        setAnalysisResult("分析失败: " + (json.error || "未知错误"));
      }
    } catch (err) {
      setAnalysisResult("请求失败: " + (err instanceof Error ? err.message : "网络错误"));
    } finally {
      setAnalyzing(false);
    }
  }, [adKeywords, router]);

  const handleExport = useCallback(async () => {
    try {
      const res = await fetch("/api/workflows/ai-advertising/export", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        const csvContent = typeof json.data === "string" ? json.data : JSON.stringify(json.data);
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "ad-keywords-export.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      // silent fail for export
    }
  }, []);

  const highAcos = adKeywords.filter((k) => k.tag === "high-acos");
  const highConv = adKeywords.filter((k) => k.tag === "high-conversion");
  const nonPrecise = adKeywords.filter((k) => k.tag === "non-precise");

  const totalSpend = adKeywords.reduce((a, b) => a + b.spend, 0);
  const totalSales = adKeywords.reduce((a, b) => a + b.sales, 0);
  const avgAcos = totalSales > 0 ? ((totalSpend / totalSales) * 100).toFixed(1) : "0.0";

  const tagGroups = [
    { key: "high-acos", items: highAcos, count: highAcos.length },
    { key: "high-conversion", items: highConv, count: highConv.length },
    { key: "non-precise", items: nonPrecise, count: nonPrecise.length },
  ] as const;

  return (
    <PageTransition className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-wf-ad/10">
          <BarChart3 className="h-4 w-4 text-wf-ad" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">AI 广告管理</h1>
          <p className="text-xs text-muted-foreground">解决广告调整效率问题 — 数据透视 + AI标记 + 精准竞价</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">策略配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex rounded-lg bg-muted/50 p-0.5">
                <button onClick={() => setActiveTab("premium")} className={cn("flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all", activeTab === "premium" ? "bg-[var(--wf-ad)] text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  精品模式
                </button>
                <button onClick={() => setActiveTab("bulk")} className={cn("flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all", activeTab === "bulk" ? "bg-[var(--wf-ad)] text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  精铺模式
                </button>
              </div>

              {activeTab === "premium" ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium mb-2">关键词来源</p>
                    <div className="space-y-1.5">
                      {["卖家精灵", "SIF", "Amazon 前台"].map((src) => (
                        <label key={src} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input type="checkbox" defaultChecked className="rounded" />
                          {src}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium mb-2">广告类型</p>
                    <div className="flex gap-2">
                      {(["SP", "SB", "SD"] as const).map((t) => (
                        <Badge key={t} variant="outline" className={cn("cursor-pointer hover:opacity-80", adTypeMeta[t].color)}>
                          <input type="checkbox" defaultChecked className="mr-1" />
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <p className="text-xs font-medium">竞价规则</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Target className="h-3.5 w-3.5 text-[var(--wf-ad)]" />
                      <span>后台建议价 <span className="text-foreground font-medium">- $0.2</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      <span>建议价 &gt; $1 时 <span className="text-foreground font-medium">固定 $0.5</span></span>
                    </div>
                    <div className="h-px bg-border my-1" />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>广告组规则: <span className="text-foreground font-medium">每词一个广告组</span></span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium mb-2">分析周期</p>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="cursor-pointer bg-[var(--wf-ad)]/10 border-[var(--wf-ad)]/20">新品 14天</Badge>
                      <Badge variant="outline" className="cursor-pointer">老品 7天 (周一)</Badge>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium mb-2">竞品 ASIN</p>
                    <textarea placeholder="B0DFGH456&#10;B0IJKL789&#10;每行一个ASIN..." className="flex min-h-[120px] w-full rounded-md border bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-2">关键词数量</p>
                    <Input type="number" defaultValue="20" className="h-8 text-xs" />
                  </div>
                  <Card className="border-l-2 border-l-amber-500">
                    <CardContent className="p-2">
                      <p className="text-[10px] text-amber-400">⚠ 精铺模式需手动开启广告，AI仅收集关键词</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Button className="w-full gap-2 bg-[var(--wf-ad)] hover:bg-[var(--wf-ad)]/90" onClick={handleAnalyze} disabled={analyzing}>
                <Search className="h-4 w-4" /> {analyzing ? "分析中..." : "开始分析"}
              </Button>
              {analysisResult && (
                <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                  <p className="font-medium mb-1">分析结果</p>
                  <pre className="whitespace-pre-wrap text-muted-foreground max-h-40 overflow-auto scrollbar-thin">{analysisResult}</pre>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">概览</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">总花费</span>
                <span className="text-sm font-bold metric-value">{formatCurrency(totalSpend)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">总销售</span>
                <span className="text-sm font-bold metric-value text-emerald-400">{formatCurrency(totalSales)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">平均ACOS</span>
                <span className={cn("text-sm font-bold metric-value", Number(avgAcos) > 30 ? "text-red-400" : Number(avgAcos) < 20 ? "text-emerald-400" : "text-amber-400")}>{avgAcos}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">关键词数</span>
                <span className="text-sm font-bold metric-value">{adKeywords.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">广告数据透视表</CardTitle>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleExport}>
                  <Download className="h-3 w-3" /> 导出CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto scrollbar-thin max-h-[420px]">
                <table className="w-full text-xs">
                  <thead className="table-glass-head">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">关键词</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">类型</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">展示</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">点击</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">花费</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">销售</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">ACOS</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">转化率</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">CPC</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">趋势</th>
                      <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">AI标记</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adKeywords.map((kw) => (
                      <tr
                        key={kw.id}
                        data-active={selectedKw === kw.id}
                        className={cn(
                          "row-rail border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors",
                          selectedKw === kw.id && "bg-muted/50",
                          kw.tag === "high-conversion" && "[--rail:var(--wf-listing)]",
                          kw.tag === "high-acos" && "[--rail:#ef4444]"
                        )}
                        onClick={() => setSelectedKw(selectedKw === kw.id ? null : kw.id)}
                      >
                        <td className="px-3 py-2">
                          <span className="font-medium">{kw.keyword}</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={adTypeMeta[kw.type].color}>{kw.type}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{kw.impressions.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{kw.clicks.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(kw.spend)}</td>
                        <td className="px-3 py-2 text-right text-emerald-400">{formatCurrency(kw.sales)}</td>
                        <td className={cn("px-3 py-2 text-right font-medium", kw.acos > 30 ? "text-red-400" : kw.acos < 15 ? "text-emerald-400" : "text-amber-400")}>
                          {kw.acos}%
                        </td>
                        <td className={cn("px-3 py-2 text-right font-medium", kw.conversion > 10 ? "text-emerald-400" : kw.conversion < 5 ? "text-red-400" : "text-amber-400")}>
                          {kw.conversion}%
                        </td>
                        <td className="px-3 py-2 text-right">${kw.cpc.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">
                          <Sparkline quiet data={kw.trend} width={60} height={16} color={kw.tag === "high-conversion" ? "#22c55e" : kw.tag === "high-acos" ? "#ef4444" : "#71717a"} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge className={cn("text-[9px] px-1.5 py-0", tagMeta[kw.tag].color)}>
                            {tagMeta[kw.tag].label}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-muted/20 font-medium">
                      <td className="px-3 py-2">汇总</td>
                      <td />
                      <td className="px-3 py-2 text-right">{adKeywords.reduce((a, b) => a + b.impressions, 0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{adKeywords.reduce((a, b) => a + b.clicks, 0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(totalSpend)}</td>
                      <td className="px-3 py-2 text-right text-emerald-400">{formatCurrency(totalSales)}</td>
                      <td className="px-3 py-2 text-right">{avgAcos}%</td>
                      <td className="px-3 py-2 text-right">{(adKeywords.reduce((a, b) => a + b.conversion, 0) / adKeywords.length).toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right">${(adKeywords.reduce((a, b) => a + b.cpc, 0) / adKeywords.length).toFixed(2)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            {tagGroups.map(({ key, items, count }) => {
              const meta = tagMeta[key];
              const Icon = meta.icon;
              const expanded = expandedTags[key];
              return (
                <Card key={key} className="border-l-2 border-l-current" style={{ borderLeftColor: key === "high-acos" ? "#ef4444" : key === "high-conversion" ? "#22c55e" : "#71717a" }}>
                  <CardContent className="p-3">
                    <button className="flex items-center justify-between w-full" onClick={() => setExpandedTags((prev) => ({ ...prev, [key]: !prev[key] }))}>
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-4 w-4", key === "high-acos" ? "text-red-400" : key === "high-conversion" ? "text-emerald-400" : "text-zinc-400")} />
                        <span className="text-xs font-medium">{meta.label}词</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-xs">{count}</Badge>
                        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </div>
                    </button>
                    {expanded && (
                      <div className="mt-2 space-y-1 pt-2 border-t">
                        {items.map((kw) => (
                          <div key={kw.id} className="flex items-center justify-between text-[11px] py-0.5">
                            <span className="text-muted-foreground truncate mr-2">{kw.keyword}</span>
                            <span className="font-medium shrink-0">{kw.acos}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {selectedKw && (() => {
            const kw = adKeywords.find((k) => k.id === selectedKw);
            if (!kw) return null;
            return (
              <Card className="border-l-2 border-l-[var(--wf-ad)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[var(--wf-ad)]" />
                    Google Trends — {kw.keyword}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Sparkline data={kw.trend} width={200} height={40} color="var(--wf-ad)" />
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">近14天走势:</span>
                        {kw.trend[kw.trend.length - 1] > kw.trend[0] ? (
                          <span className="text-emerald-400 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> 上升</span>
                        ) : (
                          <span className="text-red-400 flex items-center gap-1"><TrendingDown className="h-3 w-3" /> 下降</span>
                        )}
                      </div>
                      <p className="text-muted-foreground">热度指数: {kw.trend[kw.trend.length - 1]} / 100</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          <Card className="relative overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" /> 自动调整策略
                <Badge variant="outline" className="text-[10px] ml-auto">灰度功能</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "降价", desc: "高于平均CPC的关键词降价", icon: TrendingDown },
                  { label: "加预算", desc: "高转化关键词增加预算", icon: DollarSign },
                  { label: "否词", desc: "低转化高花费词添加否定", icon: XCircle },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 rounded-lg border p-3 opacity-50">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center">
                <div className="text-center space-y-1">
                  <Lock className="h-5 w-5 text-muted-foreground mx-auto" />
                  <p className="text-xs text-muted-foreground">老品积累数据后自动启用</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}

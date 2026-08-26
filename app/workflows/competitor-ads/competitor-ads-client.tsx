"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { PageTransition } from "@/components/ui/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const AnimatedNumber = dynamic(() => import("@/components/ui/animated-number").then((m) => ({ default: m.AnimatedNumber })), { ssr: false });
const Sparkline = dynamic(() => import("@/components/ui/sparkline").then((m) => ({ default: m.Sparkline })), { ssr: false });
import {
  Eye,
  BarChart3,
  Target,
  Zap,
  Loader2,
} from "lucide-react";

interface KeywordData {
  keyword: string;
  volume: number;
  cpc: number;
  trend: number[];
  type: "core" | "longtail" | "competitor";
}

interface Competitor {
  id: string;
  name: string;
  spCount: number;
  sbCount: number;
  sdCount: number;
  keywords: number;
  rank: number;
  strategy: "offensive" | "complementary" | "defensive";
}

interface AdPosition {
  position: string;
  share: number;
  trend: number[];
}

interface TaggingData {
  root: string;
  core: number;
  longtail: number;
  competitor: number;
  auto: number;
  minus: number;
  primary: string;
  growth: string;
}

export interface CompetitorAdsClientProps {
  keywords: { core: KeywordData[]; longtail: KeywordData[]; competitor: KeywordData[] };
  competitors: Competitor[];
  adPositions: AdPosition[];
  targetingData: TaggingData[];
  recentAnalyses?: Array<{ id: string; asins: string[]; resultJson: unknown; createdAt: string }>;
}

const strategyMeta = {
  offensive: { label: "进攻型", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  complementary: { label: "防守型", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  defensive: { label: "侧翼型", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
};

export function CompetitorAdsClient({ keywords, competitors, adPositions, targetingData, recentAnalyses = [] }: CompetitorAdsClientProps) {
  const router = useRouter();
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>(() => {
    if (recentAnalyses.length > 0) {
      const r = recentAnalyses[0].resultJson;
      return typeof r === "string" ? r : JSON.stringify(r, null, 2);
    }
    return "";
  });

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisResult("");
    try {
      const asins = competitors.slice(0, 3).map((c) => c.id);
      const res = await fetch("/api/workflows/competitor-ads/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asins, marketplace: "US" }),
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

  const coreKeywords = keywords.core;
  const longtailKeywords = keywords.longtail;
  const competitorKeywords = keywords.competitor;

  const totalVolume = [...coreKeywords, ...longtailKeywords, ...competitorKeywords].reduce((a, b) => a + b.volume, 0);
  const totalKeywords = coreKeywords.length + longtailKeywords.length + competitorKeywords.length;

  const handleKeywordClick = (kw: string) => {
    setSelectedKeyword(selectedKeyword === kw ? null : kw);
  };

  const handleTargeting = (row: TaggingData) => {
    return (
      <div className="flex gap-3">
        {row.core > 0 && <span className="text-xs"><span className="text-emerald-400 font-medium">{row.core}</span> 核心</span>}
        {row.longtail > 0 && <span className="text-xs"><span className="text-blue-400 font-medium">{row.longtail}</span> 长尾</span>}
        {row.competitor > 0 && <span className="text-xs"><span className="text-amber-400 font-medium">{row.competitor}</span> 竞品</span>}
        {row.auto > 0 && <span className="text-xs"><span className="text-purple-400 font-medium">{row.auto}</span> 自动</span>}
        {row.minus > 0 && <span className="text-xs text-red-400">-{row.minus} 否定</span>}
      </div>
    );
  };

  return (
    <PageTransition className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--wf-competitor)]/20 to-[var(--wf-competitor)]/5">
          <Eye className="h-5 w-5 text-[var(--wf-competitor)]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">竞品广告分析</h1>
          <p className="text-xs text-muted-foreground">知己知彼 — 关键词全覆盖 + 广告位分析 + 策略建议</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">ASIN 广告透视</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">基于 SP/SB/SD 广告数据的综合分析</p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {totalKeywords} 个关键词
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                      <th className="text-left px-4 py-2.5 font-medium">关键词</th>
                      <th className="text-right px-4 py-2.5 font-medium">搜索量</th>
                      <th className="text-right px-4 py-2.5 font-medium">CPC</th>
                      <th className="text-center px-4 py-2.5 font-medium">趋势</th>
                      <th className="text-center px-4 py-2.5 font-medium">类型</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coreKeywords.map((kw) => (
                      <tr
                        key={kw.keyword}
                        className={cn("border-b hover:bg-muted/50 cursor-pointer transition-colors", selectedKeyword === kw.keyword && "bg-muted/50")}
                        onClick={() => handleKeywordClick(kw.keyword)}
                      >
                        <td className="px-4 py-2.5">
                          <span className="font-medium">{kw.keyword}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right metric-value">{kw.volume.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right metric-value">${kw.cpc.toFixed(2)}</td>
                        <td className="px-4 py-2.5 flex justify-center">
                          <Sparkline quiet data={kw.trend} width={60} height={18} color={kw.trend[kw.trend.length - 1] > kw.trend[0] ? "var(--success)" : "var(--destructive)"} />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge variant="outline" className={cn("text-[10px]",
                            kw.type === "core" && "border-emerald-500/30 text-emerald-400 bg-emerald-500/5",
                            kw.type === "longtail" && "border-blue-500/30 text-blue-400 bg-blue-500/5",
                            kw.type === "competitor" && "border-amber-500/30 text-amber-400 bg-amber-500/5"
                          )}>
                            {kw.type === "core" ? "核心词" : kw.type === "longtail" ? "长尾词" : "竞品词"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">广告类型分布</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {adPositions.map((pos) => (
                  <div key={pos.position} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{pos.position}</span>
                      <span className="font-medium metric-value">{pos.share}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--wf-competitor)] transition-all"
                        style={{ width: `${pos.share}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">广告位趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {adPositions.slice(0, 3).map((pos) => (
                    <div key={pos.position} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-20 truncate">{pos.position}</span>
                      <Sparkline data={pos.trend} width={120} height={24} color="var(--wf-competitor)" />
                      <span className="text-xs font-medium metric-value ml-auto">{pos.share}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">定向策略矩阵</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">基于 {totalKeywords} 个关键词的策略分析</p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {targetingData.reduce((a, b) => a + b.core + b.longtail + b.competitor, 0)} 个关键词
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30 text-muted-foreground">
                    <th className="text-left px-4 py-2 font-medium">词根</th>
                    <th className="text-left px-4 py-2 font-medium">分词</th>
                    <th className="text-left px-4 py-2 font-medium">主打策略</th>
                    <th className="text-left px-4 py-2 font-medium">增长策略</th>
                  </tr>
                </thead>
                <tbody>
                  {targetingData.map((row) => (
                    <tr key={row.root} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{row.root}</td>
                      <td className="px-4 py-2.5">{handleTargeting(row)}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="text-[10px]">{row.primary}</Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={cn("text-[10px]",
                          row.growth === "抢量" ? "border-red-500/30 text-red-400" : "border-emerald-500/30 text-emerald-400"
                        )}>
                          {row.growth}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">竞品情报</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {competitors.map((comp) => {
                const meta = strategyMeta[comp.strategy];
                return (
                  <div
                    key={comp.id}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm",
                      selectedCompetitor === comp.id && "ring-1 ring-[var(--wf-competitor)]/30 bg-[var(--wf-competitor)]/5"
                    )}
                    onClick={() => setSelectedCompetitor(selectedCompetitor === comp.id ? null : comp.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{comp.name}</span>
                      <Badge variant="outline" className={cn("text-[10px]", meta.color, meta.bg, meta.border)}>
                        {meta.label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">SP: </span>
                        <span className="font-medium metric-value">{comp.spCount}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">SB: </span>
                        <span className="font-medium metric-value">{comp.sbCount}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">SD: </span>
                        <span className="font-medium metric-value">{comp.sdCount}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">关键词: </span>
                        <span className="font-medium metric-value">{comp.keywords}</span>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t flex justify-between text-xs text-muted-foreground">
                      <span>排名: <span className="text-foreground font-medium">#{comp.rank}</span></span>
                      <span>核心词: <span className="text-foreground font-medium">{comp.keywords}</span></span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">数据概览</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">总搜索量</span>
                <AnimatedNumber value={totalVolume} className="font-medium" />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">关键词数</span>
                <span className="font-medium">{totalKeywords}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">竞品数</span>
                <span className="font-medium">{competitors.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">快捷操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full justify-start gap-2 h-8 text-xs bg-[var(--wf-competitor)] hover:bg-[var(--wf-competitor)]/90"
                onClick={handleAnalyze}
                disabled={analyzing}
              >
                {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                {analyzing ? "分析中..." : "开始 AI 分析"}
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-8 text-xs" onClick={() => {
                if (selectedCompetitor) {
                  const comp = competitors.find((c) => c.id === selectedCompetitor);
                  if (comp) alert(`竞品: ${comp.name}\n排名: #${comp.rank}\nSP: ${comp.spCount} | SB: ${comp.sbCount} | SD: ${comp.sdCount}\n关键词: ${comp.keywords}\n策略: ${comp.strategy}`);
                } else {
                  alert("请先点击左侧选择一个竞品");
                }
              }}>
                <Eye className="h-3.5 w-3.5" /> 查看竞品详情
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-8 text-xs" onClick={() => {
                const content = competitors.map((c) => `${c.name}\t#${c.rank}\tSP:${c.spCount}\tSB:${c.sbCount}\tSD:${c.sdCount}\t关键词:${c.keywords}\t策略:${c.strategy}`).join("\n");
                const blob = new Blob(["竞品分析报告\n\n" + content], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = "竞品分析报告.txt"; a.click();
                URL.revokeObjectURL(url);
              }}>
                <BarChart3 className="h-3.5 w-3.5" /> 导出分析报告
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-8 text-xs" onClick={() => router.push("/workflows/ai-advertising")}>
                <Target className="h-3.5 w-3.5" /> 发送到广告工作流
              </Button>
              {analysisResult && (
                <div className="rounded-md bg-muted/50 p-2 text-[10px] font-mono max-h-40 overflow-auto whitespace-pre-wrap">
                  {analysisResult}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}

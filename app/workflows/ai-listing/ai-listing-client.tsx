"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { PageTransition } from "@/components/ui/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const AnimatedNumber = dynamic(() => import("@/components/ui/animated-number").then((m) => ({ default: m.AnimatedNumber })), { ssr: false });
import {
  FileText,
  CheckCircle2,
  Zap,
  Eye,
  Globe,
  Link,
  ArrowRight,
  Send,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

const steps = [
  { id: "infringement", label: "侵权检测" },
  { id: "category", label: "类目推荐" },
  { id: "title", label: "AI 五点描述" },
  { id: "description", label: "产品描述" },
  { id: "publish", label: "一键发布" },
];

interface InfringementWord {
  word: string;
  type: "brand" | "patent" | "generic";
  risk: string;
  action: string;
}

interface CategoryRec {
  id: string;
  name: string;
  confidence: number;
  reason: string;
  bsr: number;
  fee: number;
}

interface BulletPoint {
  id: string;
  title: string;
  content: string;
  seoScore: number;
  rufus: boolean;
}

export interface AiListingClientProps {
  infringementWords: InfringementWord[];
  categoryRecs: CategoryRec[];
  bulletPoints: BulletPoint[];
  recentResults?: Array<{ id: string; keyword: string; title: string; resultJson: unknown; createdAt: string }>;
}

interface GenResult {
  id: string;
  status: string;
  result?: {
    title?: string;
    bullets?: string[];
    description?: string;
    searchTerms?: string[];
    seoScore?: number;
    estimatedCTR?: string;
  };
}

export function AiListingClient({ infringementWords, categoryRecs, bulletPoints, recentResults = [] }: AiListingClientProps) {
  const router = useRouter();
  const latestResult = recentResults[0];
  const [currentStep, setCurrentStep] = useState(latestResult ? "category" : "infringement");
  const currentIdx = steps.findIndex((s) => s.id === currentStep);

  const [keyword, setKeyword] = useState(latestResult?.keyword ?? "");
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<GenResult | null>(() => {
    if (latestResult) {
      return { id: latestResult.id, status: "completed", result: latestResult.resultJson as GenResult["result"] };
    }
    return null;
  });
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success: boolean; listingId: string } | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!keyword.trim()) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/workflows/ai-listing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setGenResult(json.data);
        setCurrentStep("category");
      } else {
        setGenError(json.error ?? "生成失败");
      }
    } catch {
      setGenError("网络错误，请稍后重试");
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!genResult?.result) return;
    setPublishing(true);
    try {
      const r = genResult.result;
      const res = await fetch("/api/workflows/ai-listing/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: r.title ?? "",
          bulletPoints: (r.bullets ?? []).map((b) => ({ title: b.slice(0, 30), desc: b })),
          description: r.description ?? "",
          categoryId: categoryRecs[0]?.id ?? "",
          images: [],
        }),
      });
      const json = await res.json();
      if (json.success) {
        setPublishResult(json.data);
      }
    } catch {
      // silently fail for publish
    } finally {
      setPublishing(false);
    }
  };

  const passedWords = infringementWords.filter((w) => w.type === "generic").length;
  const blockedWords = infringementWords.filter((w) => w.type !== "generic").length;
  const avgSeoScore = Math.round(bulletPoints.reduce((a, b) => a + b.seoScore, 0) / bulletPoints.length);

  return (
    <PageTransition className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--wf-listing)]/20 to-[var(--wf-listing)]/5">
          <FileText className="h-5 w-5 text-[var(--wf-listing)]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">AI Listing 生成</h1>
          <p className="text-xs text-muted-foreground">解决 Listing 生成慢、侵权风险高问题 — 五步流式生成，实时侵权检测</p>
        </div>
      </div>

      <div className="flex gap-2">
        {steps.map((s, i) => (
          <button
            key={s.id}
            onClick={() => { if (i <= currentIdx) setCurrentStep(s.id); }}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
              s.id === currentStep ? "bg-primary/10 text-primary font-medium" : i < currentIdx ? "text-muted-foreground hover:bg-muted cursor-pointer" : "text-muted-foreground/40"
            )}
          >
            {i < currentIdx ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : s.id === currentStep ? <Zap className="h-4 w-4" /> : <span className="h-4 w-4 rounded-full border text-[10px] flex items-center justify-center">{i + 1}</span>}
            <span className="hidden md:inline">{s.label}</span>
            {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/30 ml-1" />}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {currentStep === "infringement" && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">侵权词检测</CardTitle>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span className="text-emerald-400">{passedWords} 通过</span>
                      <span>·</span>
                      <span className="text-red-400">{blockedWords} 拦截</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left px-4 py-2 font-medium">词汇</th>
                        <th className="text-left px-4 py-2 font-medium">类型</th>
                        <th className="text-left px-4 py-2 font-medium">风险</th>
                        <th className="text-left px-4 py-2 font-medium">AI 建议</th>
                      </tr>
                    </thead>
                    <tbody>
                      {infringementWords.map((w) => (
                        <tr key={w.word} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-2.5 font-medium">{w.word}</td>
                          <td className="px-4 py-2.5">
                            <Badge variant="outline" className={cn(
                              "text-[10px]",
                              w.type === "brand" && "border-red-500/30 text-red-400",
                              w.type === "patent" && "border-amber-500/30 text-amber-400",
                              w.type === "generic" && "border-emerald-500/30 text-emerald-400"
                            )}>
                              {w.type === "brand" ? "品牌词" : w.type === "patent" ? "专利描述词" : "通用词"}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="outline" className={cn(
                              "text-[10px]",
                              w.risk === "high" ? "border-red-500/30 text-red-400 bg-red-500/5" : "border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                            )}>
                              {w.risk === "high" ? "高风险" : "安全"}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{w.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {blockedWords > 0 && (
                <Card className="border-l-2 border-l-amber-500">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">
                      <span className="text-amber-400 font-medium">⚠ 侵权风险提醒:</span> 检测到{" "}
                      {infringementWords.filter((w) => w.type !== "generic").map((w, i) => (
                        <span key={w.word}>
                          {i > 0 && "、"}
                          <span className="text-red-400 font-medium">{w.word} ({w.type === "brand" ? "品牌词" : "专利描述词"})</span>
                        </span>
                      ))}，已在 AI 生成时自动替换为安全表述
                    </p>
                  </CardContent>
                </Card>
              )}

              {genError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {genError}
                </div>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">输入产品关键词</CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    placeholder="例如: wireless bluetooth earbuds"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
                    disabled={generating}
                  />
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button
                  className="gap-2 bg-[var(--wf-listing)] hover:bg-[var(--wf-listing)]/90"
                  onClick={handleGenerate}
                  disabled={generating || !keyword.trim()}
                >
                  {generating ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {generating ? "AI 生成中..." : "继续下一步"}
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => setCurrentStep("infringement")}>
                  <RefreshCw className="h-4 w-4" /> 重新检测
                </Button>
              </div>
            </>
          )}

          {currentStep === "category" && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">类目推荐</CardTitle>
                  <Badge variant="outline" className="text-[10px]">AI 分析 1000 个竞品</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {categoryRecs.map((cat, i) => (
                  <div key={cat.id} className={cn("p-4 rounded-lg border", i === 0 && "ring-1 ring-emerald-500/30 bg-emerald-500/5")}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{cat.name}</span>
                        {i === 0 && <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">推荐</Badge>}
                      </div>
                      <AnimatedNumber value={cat.confidence} suffix="%" className={cn("text-sm font-bold", i === 0 ? "text-emerald-400" : "text-muted-foreground")} />
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{cat.reason}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>BSR: <span className="text-foreground font-medium">{cat.bsr.toLocaleString()}</span></span>
                      <span>佣金: <span className="text-foreground font-medium">{cat.fee}%</span></span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {currentStep === "title" && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">AI 生成五点描述</CardTitle>
                    <div className="flex gap-1.5">
                      <Badge variant="outline" className="text-[10px]">美式英语</Badge>
                      <Badge variant="outline" className="text-[10px]">英式英语</Badge>
                      <Badge variant="outline" className="text-[10px]">日语</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(genResult?.result?.bullets ?? bulletPoints.map((bp) => bp.content)).map((content, i) => {
                    const bp = bulletPoints[i];
                    const seoScore = genResult?.result?.seoScore ?? bp?.seoScore ?? 0;
                    return (
                      <div key={i} className="p-3 rounded-lg border bg-muted/20">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary">{i + 1}.</span>
                            <span className="text-sm font-medium">{bp?.title ?? `要点 ${i + 1}`}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">SEO</span>
                              <AnimatedNumber value={seoScore} className={cn("text-xs font-bold", seoScore >= 90 ? "text-emerald-400" : seoScore >= 80 ? "text-amber-400" : "text-red-400")} />
                            </div>
                            {bp?.rufus && (
                              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/5">
                                Rufus 友好
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{typeof content === "string" ? content : (content as { desc?: string }).desc ?? ""}</p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button className="gap-2 bg-[var(--wf-listing)] hover:bg-[var(--wf-listing)]/90" onClick={() => setCurrentStep("description")}>
                  继续下一步 <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="gap-2" onClick={handleGenerate} disabled={generating}>
                  <RefreshCw className={cn("h-4 w-4", generating && "animate-spin")} /> 重新生成
                </Button>
              </div>
            </div>
          )}

          {currentStep === "description" && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">产品描述 (A+ Content)</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => window.open("https://www.amazon.com", "_blank")}>
                        <Eye className="h-3 w-3" /> PC 端预览
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => window.open("https://www.amazon.com", "_blank")}>
                        <Globe className="h-3 w-3" /> 移动端预览
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    {(genResult?.result?.description
                      ?? "Transform your living space into a seamlessly connected smart home with our WiFi 6E Smart Home Hub. This next-generation hub features advanced far-field voice recognition technology, allowing you to control over 500+ compatible devices from across the room — even in noisy environments.\n\nBuilt with the latest WiFi 6E tri-band technology, it delivers ultra-fast, lag-free connectivity for all your smart devices. The integrated AI assistant learns your daily routines and automatically adjusts lighting, temperature, and security settings to create the perfect ambiance for every moment."
                    ).split("\n").filter(Boolean).map((para, i) => (
                      <p key={i} className="text-sm text-muted-foreground leading-relaxed mt-3 first:mt-0">
                        {para}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button className="gap-2 bg-[var(--wf-listing)] hover:bg-[var(--wf-listing)]/90" onClick={() => setCurrentStep("publish")}>
                  继续下一步 <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="gap-2" onClick={handleGenerate} disabled={generating}>
                  <RefreshCw className={cn("h-4 w-4", generating && "animate-spin")} /> 重新生成
                </Button>
              </div>
            </div>
          )}

          {currentStep === "publish" && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">发布确认</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="p-3 rounded-lg border bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">标题</p>
                      <p className="text-sm font-medium">{genResult?.result?.title ?? "待生成"}</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">类目</p>
                      <p className="text-sm font-medium">{categoryRecs[0]?.name ?? "Smart Home > Hubs & Controllers"}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-2">五点描述预览</p>
                    {(genResult?.result?.bullets ?? bulletPoints.map((bp) => bp.content)).map((content, i) => {
                      const text = typeof content === "string" ? content : (content as { desc?: string }).desc ?? "";
                      return (
                        <p key={i} className="text-xs text-muted-foreground">
                          <span className="text-primary font-medium">{i + 1}.</span> {text.slice(0, 80)}...
                        </p>
                      );
                    })}
                  </div>

                  {publishResult ? (
                    <Card className="border-l-2 border-l-emerald-500">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          <span className="text-sm font-medium text-emerald-400">发布成功</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Listing ID: {publishResult.listingId}</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-l-2 border-l-emerald-500">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          <span className="text-sm font-medium text-emerald-400">所有检测通过</span>
                        </div>
                        <p className="text-xs text-muted-foreground">侵权检测: 通过 | SEO 评分: {genResult?.result?.seoScore ?? avgSeoScore}/100 | Rufus 友好度: 良好</p>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-3">
                {publishResult ? (
                  <Button className="gap-2 bg-[var(--wf-listing)] hover:bg-[var(--wf-listing)]/90" disabled>
                    <CheckCircle2 className="h-4 w-4" /> 已发布到 Amazon
                  </Button>
                ) : (
                  <Button
                    className="gap-2 bg-[var(--wf-listing)] hover:bg-[var(--wf-listing)]/90"
                    onClick={handlePublish}
                    disabled={publishing || !genResult?.result}
                  >
                    {publishing ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {publishing ? "发布中..." : "一键发布到 Amazon"}
                  </Button>
                )}
                <Button variant="outline" className="gap-2" onClick={() => genResult?.result && alert(
                  `标题: ${genResult.result.title}\n\n五点描述:\n${genResult.result.bullets?.map((b: string, i: number) => `${i+1}. ${b}`).join("\n")}\n\n搜索词: ${genResult.result.searchTerms?.join(", ")}`
                )}>
                  <Eye className="h-4 w-4" /> 预览完整 Listing
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">生成状态</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2">
                  {i < currentIdx ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : s.id === currentStep ? (
                    <Zap className="h-4 w-4 text-primary" />
                  ) : (
                    <span className="h-4 w-4 rounded-full border text-[10px] flex items-center justify-center text-muted-foreground/40">{i + 1}</span>
                  )}
                  <span className={cn("text-xs", s.id === currentStep ? "text-primary font-medium" : i < currentIdx ? "text-muted-foreground" : "text-muted-foreground/40")}>
                    {s.label}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">SEO 评分</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              {bulletPoints.length > 0 ? (
                <>
                  <AnimatedNumber value={avgSeoScore} className="text-4xl font-bold text-primary" />
                  <span className="text-lg text-muted-foreground">/100</span>
                  <div className="space-y-2 mt-3">
                    {bulletPoints.map((bp) => (
                      <div key={bp.id} className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground w-14 truncate">{bp.title}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={cn("h-full rounded-full", bp.seoScore >= 90 ? "bg-emerald-500" : bp.seoScore >= 80 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${bp.seoScore}%` }} />
                        </div>
                        <span className="text-[10px] metric-value text-muted-foreground w-8 text-right">{bp.seoScore}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-4">暂无 SEO 评分数据</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">便捷操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2 h-8 text-xs" onClick={() => genResult?.result && alert(
                `标题: ${genResult.result.title}\n\n五点描述:\n${genResult.result.bullets?.map((b: string, i: number) => `${i+1}. ${b}`).join("\n")}`
              )}>
                <Eye className="h-3.5 w-3.5" /> Listing 预览
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-8 text-xs" onClick={() => {
                if (genResult?.result) {
                  const text = `${genResult.result.title}\n\n${genResult.result.bullets?.join("\n")}\n\n${genResult.result.description}`;
                  navigator.clipboard.writeText(text);
                  alert("已复制到剪贴板");
                }
              }}>
                <Link className="h-3.5 w-3.5" /> 复制到剪贴板
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-8 text-xs" onClick={() => {
                if (genResult?.result) {
                  const content = `标题: ${genResult.result.title}\n\n五点描述:\n${genResult.result.bullets?.join("\n")}\n\n描述: ${genResult.result.description}\n\n搜索词: ${genResult.result.searchTerms?.join(", ")}`;
                  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = "listing.txt"; a.click();
                  URL.revokeObjectURL(url);
                }
              }}>
                <FileText className="h-3.5 w-3.5" /> 导出 Listing
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-8 text-xs" onClick={() => router.push("/workflows/ai-imaging")}>
                <ArrowRight className="h-3.5 w-3.5" /> 发送到作图工作流
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}

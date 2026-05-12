"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { PageTransition } from "@/components/ui/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Radar,
  Play,
  Search,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Factory,
  Package,
  Star,
  Zap,
  Globe,
  Video,
  ShoppingCart,
  BarChart3,
  FileText,
  Eye,
  ExternalLink,
} from "lucide-react";

const AnimatedNumber = dynamic(() => import("@/components/ui/animated-number").then((m) => ({ default: m.AnimatedNumber })), { ssr: false });
const Sparkline = dynamic(() => import("@/components/ui/sparkline").then((m) => ({ default: m.Sparkline })), { ssr: false });

const steps = [
  { id: "collect", label: "数据采集", desc: "配置9大平台数据源" },
  { id: "keywords", label: "热词分析", desc: "关键词趋势与竞争度" },
  { id: "reviews", label: "差评反推", desc: "竞品差评痛点聚类" },
  { id: "ai-suggest", label: "AI 差异化", desc: "专利检测+差异化建议" },
  { id: "proposal", label: "方案生成", desc: "产品定义+外观+卖点" },
];

const iconMap: Record<string, ReactNode> = {
  amazon: <ShoppingCart className="h-4 w-4" />,
  tiktok: <Zap className="h-4 w-4" />,
  youtube: <Video className="h-4 w-4" />,
  "1688": <Factory className="h-4 w-4" />,
  sif: <BarChart3 className="h-4 w-4" />,
  sellerSprite: <Star className="h-4 w-4" />,
  fastmoss: <Globe className="h-4 w-4" />,
  googleTrends: <TrendingUp className="h-4 w-4" />,
  patent: <ShieldAlert className="h-4 w-4" />,
};

const colorMap: Record<string, string> = {
  amazon: "text-orange-400",
  tiktok: "text-pink-400",
  youtube: "text-red-400",
  "1688": "text-amber-400",
  sif: "text-blue-400",
  sellerSprite: "text-emerald-400",
  fastmoss: "text-cyan-400",
  googleTrends: "text-indigo-400",
  patent: "text-red-400",
};

interface DataSource {
  id: string;
  name: string;
  enabled: boolean;
  status: "completed" | "scraping" | "pending";
  progress: number;
}

interface Keyword {
  keyword: string;
  volume: number;
  cpc: number;
  competition: number;
  supplyDemand: number;
  trend: number[];
  aiTag: "potential" | "competitive" | "risky";
}

interface PainPoint {
  category: string;
  count: number;
  pct: number;
  examples: string[];
}

export interface ProductResearchClientProps {
  dataSources: DataSource[];
  keywords: Keyword[];
  painPoints: PainPoint[];
}

export function ProductResearchClient({ dataSources, keywords, painPoints }: ProductResearchClientProps) {
  const [currentStep, setCurrentStep] = useState("collect");
  const currentIdx = steps.findIndex((s) => s.id === currentStep);

  return (
    <PageTransition className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--wf-product)]/20 to-[var(--wf-product)]/5">
          <Radar className="h-5 w-5 text-[var(--wf-product)]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">选品工作流</h1>
          <p className="text-xs text-muted-foreground">解决选品耗时问题 — 多平台数据采集 + AI 差异化分析</p>
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
            {i < currentIdx ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : s.id === currentStep ? <Play className="h-4 w-4" /> : <span className="h-4 w-4 rounded-full border text-[10px] flex items-center justify-center">{i + 1}</span>}
            <span className="hidden md:inline">{s.label}</span>
            {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/30 ml-1" />}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {currentStep === "collect" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {dataSources.map((ds) => (
                  <Card key={ds.id} className="workflow-card">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={colorMap[ds.id] ?? "text-muted-foreground"}>{iconMap[ds.id] ?? <Globe className="h-4 w-4" />}</span>
                          <span className="text-sm font-medium">{ds.name}</span>
                        </div>
                        <Badge variant={ds.enabled ? "default" : "outline"} className={cn("text-[10px] h-5", ds.enabled ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "")}>
                          {ds.enabled ? "已启用" : "未启用"}
                        </Badge>
                      </div>
                      {ds.enabled && (
                        <div className="space-y-1">
                          <Progress value={ds.progress} className="h-1.5" />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>{ds.status === "completed" ? "采集完成" : ds.status === "scraping" ? "采集中..." : "等待中"}</span>
                            <span>{ds.progress}%</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="flex gap-3">
                <Button className="gap-2 bg-primary hover:bg-primary/90">
                  <Play className="h-4 w-4" /> 开始采集
                </Button>
                <Button variant="outline" className="gap-2">
                  <Search className="h-4 w-4" /> 配置参数
                </Button>
              </div>
            </>
          )}

          {currentStep === "keywords" && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">关键词分析结果</CardTitle>
                  <div className="flex gap-1.5">
                    {["高增长", "低竞争", "高供需比", "潜力爆款"].map((f) => (
                      <Badge key={f} variant="outline" className="text-[10px] cursor-pointer hover:bg-primary/10 hover:text-primary hover:border-primary/30">{f}</Badge>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left px-4 py-2 font-medium">关键词</th>
                        <th className="text-right px-4 py-2 font-medium">搜索量</th>
                        <th className="text-right px-4 py-2 font-medium">CPC</th>
                        <th className="text-right px-4 py-2 font-medium">竞争度</th>
                        <th className="text-right px-4 py-2 font-medium">供需比</th>
                        <th className="text-center px-4 py-2 font-medium">趋势</th>
                        <th className="text-center px-4 py-2 font-medium">AI 标注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keywords.map((kw) => (
                        <tr key={kw.keyword} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-2.5 font-medium">{kw.keyword}</td>
                          <td className="px-4 py-2.5 text-right metric-value">{kw.volume.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right metric-value">${kw.cpc.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={cn("metric-value", kw.competition > 0.8 ? "text-red-400" : kw.competition > 0.5 ? "text-amber-400" : "text-emerald-400")}>
                              {(kw.competition * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={cn("metric-value", kw.supplyDemand > 2.5 ? "text-emerald-400" : kw.supplyDemand > 1.5 ? "text-amber-400" : "text-red-400")}>
                              {kw.supplyDemand}x
                            </span>
                          </td>
                          <td className="px-4 py-2.5 flex justify-center">
                            <Sparkline data={kw.trend} width={64} height={20} color={kw.trend[kw.trend.length - 1] > kw.trend[0] ? "var(--success)" : "var(--destructive)"} />
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                kw.aiTag === "potential" && "border-emerald-500/30 text-emerald-400 bg-emerald-500/5",
                                kw.aiTag === "competitive" && "border-amber-500/30 text-amber-400 bg-amber-500/5",
                                kw.aiTag === "risky" && "border-red-500/30 text-red-400 bg-red-500/5"
                              )}
                            >
                              {kw.aiTag === "potential" ? "潜力爆款词" : kw.aiTag === "competitive" ? "竞争激烈" : "风险词"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === "reviews" && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">差评痛点聚类分析</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {painPoints.map((pp) => (
                      <div key={pp.category} className="p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{pp.category}</span>
                          <span className="text-xs metric-value text-muted-foreground">{pp.count} 次提及</span>
                        </div>
                        <Progress value={pp.pct} className="h-2 mb-2" />
                        <div className="flex flex-wrap gap-1">
                          {pp.examples.map((ex) => (
                            <Badge key={ex} variant="outline" className="text-[10px]">{ex}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-2 border-l-amber-500">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    <span className="text-amber-400 font-medium">AI 改进建议:</span> 基于差评分析，建议重点改进出水口设计(加大30%)、采用食品级ABS材质降低塑料味、增加水位LED指示灯、优化静音水泵设计(噪音降至30dB以下)
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === "ai-suggest" && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" /> 市场垄断分析
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="text-center">
                        <AnimatedNumber value={28} suffix="%" className="text-2xl font-bold text-emerald-400" />
                        <p className="text-[10px] text-muted-foreground mt-0.5">头部占比</p>
                      </div>
                      <div className="flex-1">
                        <Progress value={28} className="h-3" />
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                          <span>安全区 (&lt;35%)</span>
                          <span className="text-emerald-400">中小卖家可进入</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">该市场竞争度 <span className="text-emerald-400 font-medium">中等</span>，中小卖家进入难度 <span className="text-emerald-400 font-medium">较低</span></p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="h-4 w-4 text-pink-400" /> 外部流量依赖
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="text-center">
                        <AnimatedNumber value={18} suffix="%" className="text-2xl font-bold text-emerald-400" />
                        <p className="text-[10px] text-muted-foreground mt-0.5">TikTok占比</p>
                      </div>
                      <div className="flex-1">
                        <Progress value={18} className="h-3" />
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                          <span>安全阈值 (&lt;30%)</span>
                          <span className="text-emerald-400">独立站内推广可行</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">该产品 <span className="text-emerald-400 font-medium">不依赖</span> 外部TikTok流量，亚马逊站内可独立推广</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-l-2 border-l-red-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-400" /> 专利风险检测
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { label: "外观专利", status: "warning" as const, detail: "1项相似专利，需差异化设计" },
                      { label: "发明专利", status: "safe" as const, detail: "未发现相关专利" },
                      { label: "商标Trade Mark", status: "safe" as const, detail: "未发现近似商标" },
                    ].map((p) => (
                      <div key={p.label} className={cn("p-3 rounded-lg border", p.status === "warning" ? "border-amber-500/30 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5")}>
                        <div className="flex items-center gap-2 mb-1">
                          {p.status === "warning" ? <AlertTriangle className="h-4 w-4 text-amber-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                          <span className="text-sm font-medium">{p.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{p.detail}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" /> 产品差异化方向
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {["结构改进: 采用双层过滤+可拆卸式水泵设计，方便清洗", "外观设计: 圆角+磨砂质感，避开现有外观专利", "功能叠加: 增加UV杀菌+水温显示+智能提醒换水"].map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-primary font-bold">{i + 1}.</span>
                      <span className="text-muted-foreground">{s}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === "proposal" && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">产品方案概要</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">产品定义</p>
                      <p className="text-sm font-medium">智能静音宠物饮水机 Pro</p>
                      <p className="text-xs text-muted-foreground">目标市场: 北美宠物用品市场 | 价格区间: $29.99-$39.99</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">核心卖点</p>
                      <div className="flex flex-wrap gap-1">
                        {["超静音30dB", "UV杀菌", "可拆洗设计", "水温显示", "智能提醒"].map((s) => (
                          <Badge key={s} variant="outline" className="text-[10px] border-primary/30 text-primary">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">外观风格建议 (ComfyUI/SD 生成)</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {["极简现代", "自然有机", "科技未来"].map((style, i) => (
                        <div key={style} className="relative aspect-square rounded-lg border bg-muted/50 flex items-center justify-center">
                          <div className="text-center">
                            <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">{style}</p>
                          </div>
                          <Badge className="absolute top-2 right-2 text-[10px]">{String.fromCharCode(65 + i)}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button className="gap-2">
                  <FileText className="h-4 w-4" /> 导出 PDF
                </Button>
                <Button variant="outline" className="gap-2">
                  <ArrowRight className="h-4 w-4" /> 发送到 AI 作图
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">采集状态</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">已配置平台</span>
                <span className="font-medium">8 / 9</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">已完成</span>
                <span className="font-medium text-emerald-400">6 / 8</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">预计数据量</span>
                <span className="font-medium">~24,500 条</span>
              </div>
              <Progress value={75} className="h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI 综合评分</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <AnimatedNumber value={85} className="text-4xl font-bold text-primary" />
              <span className="text-lg text-muted-foreground">/100</span>
              <p className="text-xs text-emerald-400 mt-1 font-medium">推荐进入</p>
              <div className="space-y-2 mt-3">
                {[
                  { label: "市场需求", value: 88 },
                  { label: "竞争度", value: 72 },
                  { label: "利润空间", value: 82 },
                  { label: "供应链", value: 90 },
                ].map((d) => (
                  <div key={d.label} className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground w-14">{d.label}</span>
                    <Progress value={d.value} className="flex-1 h-1.5" />
                    <span className="text-[10px] metric-value text-muted-foreground w-8 text-right">{d.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">推荐工厂</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { name: "深圳XX宠物科技", rating: "A+", moq: "500件", area: "广东" },
                { name: "义乌XX宠物用品", rating: "A", moq: "300件", area: "浙江" },
              ].map((f) => (
                <div key={f.name} className="p-2 rounded-lg border text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium">{f.name}</span>
                    <Badge variant="outline" className="text-[10px] h-4">{f.rating}</Badge>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>MOQ: {f.moq}</span>
                    <span>{f.area}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}

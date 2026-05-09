"use client";

import { useState } from "react";
import { PageTransition } from "@/components/ui/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  PackagePlus,
  Search,
  FileText,
  Upload,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Star,
  Eye,
  Monitor,
  Smartphone,
  ArrowRight,
  Shield,
  Sparkles,
  Copy,
  ExternalLink,
  Truck,
} from "lucide-react";

const wizardSteps = [
  { id: 1, label: "输入", icon: Search },
  { id: 2, label: "文案", icon: FileText },
  { id: 3, label: "类目", icon: PackagePlus },
  { id: 4, label: "预览", icon: Eye },
  { id: 5, label: "上架", icon: Truck },
];

const infringementWords = [
  { word: "Stanley", type: "brand" as const, position: "title" },
  { word: "TikTok", type: "brand" as const, position: "bullet" },
  { word: "FDA approved", type: "sensitive" as const, position: "title" },
];

const categoryRecs = [
  { path: "Pet Supplies > Feeding & Watering > Water Fountains", confidence: 92, reason: "类目高度匹配，关键词搜索量集中" },
  { path: "Pet Supplies > Feeding & Watering > Automatic Feeders", confidence: 78, reason: "功能相近，可获得关联推荐流量" },
  { path: "Home & Kitchen > Kitchen & Dining > Water Dispensers", confidence: 45, reason: "跨品类，搜索量较低但竞争小" },
];

const bulletPoints = [
  { title: "Smart UV Sterilization", desc: "Built-in UV-C light eliminates 99.9% of bacteria, keeping your pet's water clean and safe 24/7. No more worrying about harmful microorganisms.", seoScore: 88, rufus: "friendly" as const },
  { title: "Ultra-Quiet Pump Technology", desc: "Our advanced DC brushless motor operates at under 30dB — quieter than a whisper. Perfect for light sleepers and noise-sensitive pets.", seoScore: 92, rufus: "friendly" as const },
  { title: "Real-Time Temperature Display", desc: "LED screen shows water temperature in real-time. Always know if the water is comfortable for your furry friend.", seoScore: 75, rufus: "neutral" as const },
  { title: "Easy Disassembly & Cleaning", desc: "Tool-free design allows complete disassembly in seconds. Every part is dishwasher safe for hassle-free maintenance.", seoScore: 85, rufus: "friendly" as const },
  { title: "Smart Water Level Alert", desc: "Intelligent sensor detects low water levels and sends gentle LED alerts. 3L capacity serves cats and small dogs for up to 2 weeks.", seoScore: 70, rufus: "needs-opt" as const },
];

const rufusMeta = {
  friendly: { label: "🟢 Rufus 友好", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  neutral: { label: "🟡 一般", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  "needs-opt": { label: "🔴 需优化", color: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export default function AiListingPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [selectedVersion, setSelectedVersion] = useState<"A" | "B" | "C">("B");

  return (
    <PageTransition className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--wf-listing)]/20 to-[var(--wf-listing)]/5">
          <PackagePlus className="h-5 w-5 text-[var(--wf-listing)]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">AI 上架</h1>
          <p className="text-xs text-muted-foreground">解决批量上架效率问题 — AI文案 + 侵权检测 + 一键上架</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {wizardSteps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => setCurrentStep(step.id)}
                className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all", isActive ? "bg-[var(--wf-listing)]/10 text-[var(--wf-listing)] border border-[var(--wf-listing)]/20" : isCompleted ? "bg-muted/50 text-foreground" : "text-muted-foreground hover:bg-muted/30")}
              >
                {isCompleted ? <CheckCircle2 className="h-4 w-4 text-[var(--wf-listing)]" /> : <Icon className="h-4 w-4" />}
                {step.label}
              </button>
              {idx < wizardSteps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground/30 mx-1" />}
            </div>
          );
        })}
      </div>

      {currentStep === 1 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">产品信息输入</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium mb-1.5 block">产品关键词</label>
                  <Input placeholder="例如: pet water fountain stainless steel" className="h-9" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block">1688 链接</label>
                  <Input placeholder="粘贴 1688 商品链接..." className="h-9" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block">竞品 ASIN（可选）</label>
                <Textarea placeholder="B0DFGH456&#10;B0IJKL789&#10;每行一个ASIN，用于文案参考" className="min-h-[80px] text-xs" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block">批量模式</label>
                <div className="rounded-lg border-2 border-dashed p-8 text-center hover:border-[var(--wf-listing)]/50 transition-colors cursor-pointer">
                  <Upload className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">拖拽 CSV 文件到此处或点击上传</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">支持批量 100+ SKU 同时上架</p>
                </div>
              </div>
              <Button onClick={() => setCurrentStep(2)} className="bg-[var(--wf-listing)] hover:bg-[var(--wf-listing)]/90 gap-2">
                <Sparkles className="h-4 w-4" /> 开始生成文案
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_2fr_1.2fr]">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs">竞品文案参考</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin">
                {["Petlibro Water Fountain", "Catit Flower Fountain", "Veken Pet Fountain", "Pioneer Swan Fountain"].map((name, i) => (
                  <div key={i} className="rounded-lg border p-2 space-y-1">
                    <p className="text-[11px] font-medium">{name}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">Premium stainless steel pet water fountain with ultra-quiet pump technology...</p>
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-[9px] h-4">#{i + 3}</Badge>
                      <Badge variant="outline" className="text-[9px] h-4">4.{3 + i}★</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">AI 版本:</span>
                {(["A", "B", "C"] as const).map((v) => (
                  <button key={v} onClick={() => setSelectedVersion(v)} className={cn("rounded-md px-3 py-1 text-xs font-medium transition-all", selectedVersion === v ? "bg-[var(--wf-listing)]/10 text-[var(--wf-listing)] border border-[var(--wf-listing)]/20" : "bg-muted/50 text-muted-foreground hover:text-foreground")}>
                    版本 {v}
                  </button>
                ))}
                <Badge className={cn("ml-auto text-[10px]", selectedVersion === "A" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : selectedVersion === "B" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-purple-500/10 text-purple-400 border-purple-500/20")}>
                  SEO: {selectedVersion === "A" ? "82" : selectedVersion === "B" ? "91" : "87"}分
                </Badge>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs">标题 ({selectedVersion === "B" ? "推荐" : ""})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    defaultValue={selectedVersion === "A" ? "Smart Pet Water Fountain, 3L Automatic Cat Dog Water Dispenser with UV Sterilization, Ultra-Quiet Pump, Temperature Display" : selectedVersion === "B" ? "Smart Pet Water Fountain Pro — 3L Stainless Steel Automatic Water Dispenser with UV-C Sterilization, Ultra-Quiet 30dB Pump, Real-Time Temperature Display, Smart Water Level Alert for Cats & Dogs" : "Automatic Pet Water Fountain 3L — UV Sterilization, Quiet Pump, LED Temperature Display, Easy Clean, BPA-Free for Cats & Small Dogs"}
                    className="min-h-[80px] text-xs"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className={cn("text-[10px]", selectedVersion === "B" ? "text-emerald-400" : "text-muted-foreground")}>{selectedVersion === "B" ? "187" : selectedVersion === "A" ? "142" : "165"}/200 字符</span>
                    <div className="flex gap-2">
                      <Badge className={rufusMeta[selectedVersion === "B" ? "friendly" : "neutral"].color}>
                        {rufusMeta[selectedVersion === "B" ? "friendly" : "neutral"].label}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs">5点描述</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin">
                  {bulletPoints.map((bp, i) => (
                    <div key={i} className="rounded-lg border p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium">{bp.title}</span>
                        <div className="flex gap-1.5">
                          <Badge variant="outline" className="text-[9px] h-4">SEO {bp.seoScore}</Badge>
                          <Badge className={cn("text-[9px] h-4", rufusMeta[bp.rufus].color)}>{rufusMeta[bp.rufus].label}</Badge>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{bp.desc}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-3">
              <Card className="border-red-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <Shield className="h-4 w-4 text-red-400" /> 侵权检测
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {infringementWords.map((item, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md bg-red-500/5 border border-red-500/10 px-2.5 py-1.5">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-3.5 w-3.5 text-red-400" />
                        <span className="text-xs font-medium text-red-400">&quot;{item.word}&quot;</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px] h-4 text-red-400 border-red-500/20">
                          {item.type === "brand" ? "品牌词" : "敏感词"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{item.position}</span>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1.5 text-red-400 border-red-500/20 hover:bg-red-500/10">
                    <XCircle className="h-3 w-3" /> 一键清除所有侵权词
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs">SEO 评分面板</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { label: "标题SEO", score: 91 },
                    { label: "5点SEO", score: 85 },
                    { label: "关键词密度", score: 78 },
                    { label: "Rufus友好度", score: 88 },
                    { label: "可读性", score: 92 },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-20 shrink-0">{item.label}</span>
                      <Progress value={item.score} className="h-1.5 flex-1" />
                      <span className={cn("text-[10px] font-bold w-8 text-right", item.score >= 80 ? "text-emerald-400" : item.score >= 60 ? "text-amber-400" : "text-red-400")}>{item.score}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-1">← 返回</Button>
            <Button onClick={() => setCurrentStep(3)} className="bg-[var(--wf-listing)] hover:bg-[var(--wf-listing)]/90 gap-2">
              下一步: 类目匹配 <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">AI 类目推荐</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {categoryRecs.map((cat, i) => (
                <div key={i} className={cn("flex items-center gap-4 rounded-lg border p-4 cursor-pointer transition-all hover:border-[var(--wf-listing)]/50", i === 0 && "border-[var(--wf-listing)]/30 bg-[var(--wf-listing)]/5")}>
                  {i === 0 && <Star className="h-4 w-4 text-[var(--wf-listing)] shrink-0" />}
                  <div className="flex-1">
                    <p className="text-xs font-medium">{cat.path}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{cat.reason}</p>
                  </div>
                  <div className="w-32 shrink-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground">匹配度</span>
                      <span className={cn("text-xs font-bold", cat.confidence >= 80 ? "text-emerald-400" : cat.confidence >= 60 ? "text-amber-400" : "text-red-400")}>{cat.confidence}%</span>
                    </div>
                    <Progress value={cat.confidence} className="h-1.5" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div>
            <label className="text-xs font-medium mb-1.5 block">手动搜索类目</label>
            <Input placeholder="搜索 Amazon 类目..." className="h-9" />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setCurrentStep(2)} className="gap-1">← 返回</Button>
            <Button onClick={() => setCurrentStep(4)} className="bg-[var(--wf-listing)] hover:bg-[var(--wf-listing)]/90 gap-2">
              下一步: Listing 预览 <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">模拟 Amazon 前台展示</span>
            <div className="flex rounded-lg bg-muted/50 p-0.5">
              <button onClick={() => setPreviewMode("desktop")} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-all", previewMode === "desktop" ? "bg-background shadow-sm" : "text-muted-foreground")}>
                <Monitor className="h-3.5 w-3.5" /> 桌面
              </button>
              <button onClick={() => setPreviewMode("mobile")} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-all", previewMode === "mobile" ? "bg-background shadow-sm" : "text-muted-foreground")}>
                <Smartphone className="h-3.5 w-3.5" /> 移动
              </button>
            </div>
          </div>

          <Card className={cn("mx-auto transition-all", previewMode === "mobile" ? "max-w-[375px]" : "max-w-full")}>
            <CardContent className="p-6 space-y-4">
              <div className="flex gap-6">
                <div className={cn("bg-muted/50 rounded-lg flex items-center justify-center shrink-0", previewMode === "mobile" ? "w-full aspect-square" : "w-[300px] h-[300px]")}>
                  <PackagePlus className="h-16 w-16 text-muted-foreground/20" />
                </div>
                {previewMode === "desktop" && (
                  <div className="flex-1 space-y-3">
                    <h2 className="text-sm font-medium leading-relaxed">Smart Pet Water Fountain Pro — 3L Stainless Steel Automatic Water Dispenser with UV-C Sterilization, Ultra-Quiet 30dB Pump, Real-Time Temperature Display</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-400">★★★★☆</span>
                      <span className="text-[10px] text-muted-foreground">(2,847 ratings)</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-red-400">$29.99</span>
                      <span className="text-xs text-muted-foreground line-through">$49.99</span>
                      <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px]">-40%</Badge>
                    </div>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <p><span className="text-foreground font-medium">About this item:</span></p>
                      {bulletPoints.slice(0, 3).map((bp, i) => (
                        <p key={i}><span className="text-foreground font-medium">{bp.title}:</span> {bp.desc}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="pt-3 border-t">
                <p className="text-xs font-medium mb-2">产品详情</p>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <div className="flex gap-2"><span className="text-muted-foreground">Material:</span><span>Stainless Steel</span></div>
                  <div className="flex gap-2"><span className="text-muted-foreground">Capacity:</span><span>3 Liters</span></div>
                  <div className="flex gap-2"><span className="text-muted-foreground">Noise Level:</span><span>Under 30dB</span></div>
                  <div className="flex gap-2"><span className="text-muted-foreground">Power:</span><span>USB-C</span></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="border-l-2 border-l-[var(--wf-listing)]">
              <CardContent className="p-3">
                <p className="text-xs font-medium mb-2">最终侵权检测报告</p>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs text-emerald-400">所有侵权词已清除，0 处风险</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-2 border-l-[var(--wf-listing)]">
              <CardContent className="p-3">
                <p className="text-xs font-medium mb-2">SEO 综合评分</p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-emerald-400 metric-value">89</span>
                  <Progress value={89} className="h-2 flex-1" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setCurrentStep(3)} className="gap-1">← 返回</Button>
            <Button onClick={() => setCurrentStep(5)} className="bg-[var(--wf-listing)] hover:bg-[var(--wf-listing)]/90 gap-2">
              确认并上架 <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {currentStep === 5 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">上架确认</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                {[
                  { label: "标题", status: "pass", value: "SEO 优化完成 (187/200字符)" },
                  { label: "5点描述", status: "pass", value: "5/5 项完成，无侵权词" },
                  { label: "类目", status: "pass", value: "Pet Supplies > Water Fountains" },
                  { label: "侵权检测", status: "pass", value: "0 处风险" },
                  { label: "图片", status: "warning", value: "主图已准备，场景图待补充 (3/7)" },
                  { label: "价格", status: "pass", value: "$29.99 (已设置)" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border p-2.5">
                    <div className="flex items-center gap-2">
                      {item.status === "pass" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
                      <span className="text-xs font-medium">{item.label}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button className="flex-1 bg-[var(--wf-listing)] hover:bg-[var(--wf-listing)]/90 gap-2 h-10">
                  <ExternalLink className="h-4 w-4" /> 推送到 Amazon
                </Button>
                <Button variant="outline" onClick={() => setCurrentStep(4)} className="gap-1 h-10">← 返回修改</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageTransition>
  );
}

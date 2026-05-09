"use client";

import { useState } from "react";
import { PageTransition } from "@/components/ui/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";
import {
  Image as ImageIcon,
  Play,
  Search,
  Download,
  Send,
  RefreshCw,
  Check,
  Star,
  ChevronDown,
  ChevronUp,
  Film,
  Layout,
  Sparkles,
  Camera,
  Monitor,
  Smartphone,
  Zap,
} from "lucide-react";

const imageTabs = [
  { id: "main", label: "主图", desc: "Amazon 规范白底主图" },
  { id: "scene", label: "场景图", desc: "多风格场景展示" },
  { id: "aplus", label: "A+ 页面", desc: "模块化图文组合" },
  { id: "storyboard", label: "视频分镜", desc: "时间轴分镜板" },
];

interface GeneratedImg {
  id: string;
  type: string;
  clipScore: number;
  ctrScore: number;
  overall: number;
  isBest: boolean;
  prompt: string;
  model: string;
  seed: number;
}

const mainImages: GeneratedImg[] = [
  { id: "img-1", type: "main", clipScore: 87, ctrScore: 72, overall: 81, isBest: true, prompt: "white background, product centered, studio lighting", model: "SDXL-1.0", seed: 42156 },
  { id: "img-2", type: "main", clipScore: 82, ctrScore: 85, overall: 83, isBest: true, prompt: "clean white bg, 45-degree angle, soft shadows", model: "SDXL-1.0", seed: 78923 },
  { id: "img-3", type: "main", clipScore: 79, ctrScore: 68, overall: 75, isBest: false, prompt: "pure white, front view, high detail", model: "SDXL-1.0", seed: 34501 },
  { id: "img-4", type: "main", clipScore: 91, ctrScore: 88, overall: 90, isBest: true, prompt: "white bg, hero shot, premium feel", model: "SDXL-1.0", seed: 91234 },
  { id: "img-5", type: "main", clipScore: 76, ctrScore: 63, overall: 71, isBest: false, prompt: "studio white, product detail, macro", model: "SDXL-1.0", seed: 55678 },
  { id: "img-6", type: "main", clipScore: 84, ctrScore: 79, overall: 82, isBest: false, prompt: "clean bg, lifestyle angle, warm tone", model: "SDXL-1.0", seed: 22345 },
];

const sceneImages: GeneratedImg[] = [
  { id: "sc-1", type: "scene", clipScore: 88, ctrScore: 82, overall: 86, isBest: true, prompt: "modern kitchen countertop, morning light", model: "SDXL-1.0", seed: 11111 },
  { id: "sc-2", type: "scene", clipScore: 85, ctrScore: 78, overall: 82, isBest: false, prompt: "cozy living room, warm ambient lighting", model: "SDXL-1.0", seed: 22222 },
  { id: "sc-3", type: "scene", clipScore: 90, ctrScore: 86, overall: 88, isBest: true, prompt: "minimalist office desk, natural daylight", model: "SDXL-1.0", seed: 33333 },
  { id: "sc-4", type: "scene", clipScore: 78, ctrScore: 71, overall: 75, isBest: false, prompt: "outdoor garden, green plants background", model: "SDXL-1.0", seed: 44444 },
];

const storyboardFrames = [
  { id: "sb-1", desc: "产品全景展示", duration: "3s", script: "Introducing the Smart Pet Fountain Pro", camera: "推", source: "亚马逊爆款" },
  { id: "sb-2", desc: "核心功能演示 — UV杀菌", duration: "4s", script: "Built-in UV sterilization keeps water clean", camera: "特写", source: "亚马逊爆款" },
  { id: "sb-3", desc: "静音水泵运行对比", duration: "3s", script: "Ultra-quiet pump at only 30dB", camera: "拉", source: "TikTok爆款" },
  { id: "sb-4", desc: "可拆卸清洗展示", duration: "4s", script: "Easy disassembly for deep cleaning", camera: "摇", source: "TikTok爆款" },
  { id: "sb-5", desc: "水温显示功能", duration: "3s", script: "Real-time water temperature display", camera: "推", source: "亚马逊爆款" },
  { id: "sb-6", desc: "智能提醒换水", duration: "3s", script: "Smart alerts remind you to refill", camera: "移", source: "" },
  { id: "sb-7", desc: "宠物使用场景", duration: "5s", script: "Happy pets love fresh, clean water", camera: "全景", source: "TikTok爆款" },
  { id: "sb-8", desc: "结尾品牌展示", duration: "2s", script: "Smart Pet Fountain Pro — Freshness Redefined", camera: "淡出", source: "" },
];

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

function scoreBarColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}

export default function AiImagingPage() {
  const [expandedImg, setExpandedImg] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState("main");

  const currentImages = selectedTab === "main" ? mainImages : selectedTab === "scene" ? sceneImages : mainImages;
  const bestCount = currentImages.filter((i) => i.isBest).length;
  const avgScore = Math.round(currentImages.reduce((a, b) => a + b.overall, 0) / currentImages.length);

  return (
    <PageTransition className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--wf-imaging)]/20 to-[var(--wf-imaging)]/5">
          <ImageIcon className="h-5 w-5 text-[var(--wf-imaging)]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">AI 作图</h1>
          <p className="text-xs text-muted-foreground">解决AI作图效率低问题 — 一次生成，评分筛选，批量输出</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder="输入产品关键词或 ASIN..." className="h-9" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <select className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm">
                <option>ComfyUI 预设: 产品白底主图</option>
                <option>ComfyUI 预设: 生活场景图</option>
                <option>ComfyUI 预设: A+ 图文模块</option>
                <option>ComfyUI 预设: 视频分镜</option>
              </select>
            </div>
            <Button className="gap-2 bg-[var(--wf-imaging)] hover:bg-[var(--wf-imaging)]/90 h-9">
              <Sparkles className="h-4 w-4" /> 开始生成
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList>
            {imageTabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5">
                {tab.id === "storyboard" ? <Film className="h-3.5 w-3.5" /> : tab.id === "aplus" ? <Layout className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>总计 <span className="font-medium text-foreground">{currentImages.length}</span> 张</span>
          <span>最佳 <span className="font-medium text-emerald-400">{bestCount}</span> 张</span>
          <span>均分 <span className={cn("font-medium", scoreColor(avgScore))}>{avgScore}</span></span>
        </div>
      </div>

      {selectedTab !== "storyboard" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {currentImages.map((img) => (
              <Card key={img.id} className={cn("workflow-card overflow-hidden", img.isBest && "ring-1 ring-emerald-500/30")}>
                <div className="relative aspect-square bg-muted/50 flex items-center justify-center">
                  <div className="text-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground/20 mx-auto mb-2" />
                    <p className="text-[10px] text-muted-foreground/40 font-mono">seed: {img.seed}</p>
                  </div>
                  {img.isBest && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-emerald-500/90 px-2 py-0.5 text-[10px] text-white font-medium">
                      <Star className="h-3 w-3" /> 最佳
                    </div>
                  )}
                </div>

                <CardContent className="p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] text-muted-foreground">CLIP</span>
                        <span className={cn("text-xs font-bold metric-value", scoreColor(img.clipScore))}>{img.clipScore}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", scoreBarColor(img.clipScore))} style={{ width: `${img.clipScore}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] text-muted-foreground">CTR</span>
                        <span className={cn("text-xs font-bold metric-value", scoreColor(img.ctrScore))}>{img.ctrScore}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", scoreBarColor(img.ctrScore))} style={{ width: `${img.ctrScore}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">综合</span>
                      <span className={cn("text-sm font-bold", scoreColor(img.overall))}>{img.overall}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setExpandedImg(expandedImg === img.id ? null : img.id)}
                      >
                        {expandedImg === img.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  {expandedImg === img.id && (
                    <div className="rounded-md bg-muted/50 p-2 text-[10px] space-y-1 font-mono">
                      <p><span className="text-muted-foreground">prompt:</span> {img.prompt}</p>
                      <p><span className="text-muted-foreground">model:</span> {img.model}</p>
                      <p><span className="text-muted-foreground">seed:</span> {img.seed}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" /> 批量下载最佳图片
            </Button>
            <Button variant="outline" className="gap-2">
              <Send className="h-4 w-4" /> 发送到上架工作流
            </Button>
            <Button variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" /> 重新生成低分图
            </Button>
          </div>
        </>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">视频分镜板</CardTitle>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-[10px]">总时长: {storyboardFrames.reduce((a, b) => a + parseInt(b.duration), 0)}s</Badge>
                <Badge variant="outline" className="text-[10px]">{storyboardFrames.length} 个镜头</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {storyboardFrames.map((frame, idx) => (
                <div key={frame.id} className="relative shrink-0 w-[200px]">
                  <div className="rounded-lg border bg-muted/30 overflow-hidden">
                    <div className="aspect-video bg-muted/50 flex items-center justify-center">
                      <Film className="h-8 w-8 text-muted-foreground/20" />
                    </div>
                    <div className="p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">镜头 {idx + 1}</span>
                        <Badge variant="outline" className="text-[10px] h-4">{frame.duration}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{frame.desc}</p>
                      <p className="text-[11px] italic text-foreground/80">&quot;{frame.script}&quot;</p>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] h-4">运镜: {frame.camera}</Badge>
                        {frame.source && (
                          <Badge className={cn("text-[10px] h-4", frame.source === "TikTok爆款" ? "bg-pink-500/10 text-pink-400 border-pink-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20")}>
                            {frame.source}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {idx < storyboardFrames.length - 1 && (
                    <div className="absolute top-1/2 -right-2.5 -translate-y-1/2 text-muted-foreground/30">→</div>
                  )}
                </div>
              ))}
            </div>

            <Card className="mt-4 border-l-2 border-l-[var(--wf-imaging)]">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">
                  <span className="text-[var(--wf-imaging)] font-medium">AI 创意建议:</span> 参考TikTok爆款宠物视频，建议增加宠物与产品互动的真实使用场景，配合ASMR音效和快节奏剪辑，预计CTR可提升25-35%
                </p>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}
    </PageTransition>
  );
}

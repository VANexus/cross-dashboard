"use client";

import { useState } from "react";
import { PageTransition } from "@/components/ui/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Target,
  Search,
  Shield,
  Swords,
  TrendingUp,
  Eye,
  BarChart3,
  ArrowRight,
  Download,
  Zap,
  ChevronRight,
  Hash,
  Crosshair,
  Shuffle,
  ExternalLink,
} from "lucide-react";

interface KeywordItem {
  keyword: string;
  volume: number;
  competition: number;
  type: "core" | "longtail" | "competitor";
}

const keywords: KeywordItem[] = [
  { keyword: "pet water fountain", volume: 85000, competition: 92, type: "core" },
  { keyword: "cat water fountain", volume: 62000, competition: 88, type: "core" },
  { keyword: "automatic pet water dispenser", volume: 34000, competition: 75, type: "core" },
  { keyword: "pet fountain stainless steel", volume: 28000, competition: 82, type: "core" },
  { keyword: "uv pet water fountain", volume: 12000, competition: 45, type: "longtail" },
  { keyword: "quiet cat water fountain 30db", volume: 8500, competition: 38, type: "longtail" },
  { keyword: "smart water fountain temperature display", volume: 5200, competition: 32, type: "longtail" },
  { keyword: "large dog water fountain 3l", volume: 9800, competition: 42, type: "longtail" },
  { keyword: "whisper quiet pet water bowl", volume: 7200, competition: 35, type: "longtail" },
  { keyword: "catit flower fountain", volume: 45000, competition: 85, type: "competitor" },
  { keyword: "petlibro water fountain", volume: 38000, competition: 80, type: "competitor" },
  { keyword: "veken pet fountain filter", volume: 22000, competition: 65, type: "competitor" },
  { keyword: "pioneer swan fountain", volume: 15000, competition: 58, type: "competitor" },
];

interface CompetitorEntry {
  name: string;
  sp: number;
  sb: number;
  sd: number;
  coreKeywords: number;
  topPosition: number;
  targeting: "complement" | "defense" | "offense";
}

const competitors: CompetitorEntry[] = [
  { name: "Petlibro", sp: 45, sb: 30, sd: 25, coreKeywords: 28, topPosition: 65, targeting: "defense" },
  { name: "Catit", sp: 55, sb: 25, sd: 20, coreKeywords: 32, topPosition: 72, targeting: "defense" },
  { name: "Veken", sp: 60, sb: 20, sd: 20, coreKeywords: 22, topPosition: 55, targeting: "complement" },
  { name: "Pioneer", sp: 70, sb: 15, sd: 15, coreKeywords: 18, topPosition: 48, targeting: "complement" },
  { name: "Tomxcute", sp: 50, sb: 35, sd: 15, coreKeywords: 25, topPosition: 58, targeting: "offense" },
  { name: "Wonder Creature", sp: 65, sb: 20, sd: 15, coreKeywords: 15, topPosition: 42, targeting: "complement" },
  { name: "Homty", sp: 40, sb: 35, sd: 25, coreKeywords: 20, topPosition: 50, targeting: "offense" },
  { name: "iPettie", sp: 55, sb: 25, sd: 20, coreKeywords: 12, topPosition: 38, targeting: "complement" },
  { name: "Bergan", sp: 75, sb: 15, sd: 10, coreKeywords: 10, topPosition: 35, targeting: "complement" },
  { name: "Drinkwell", sp: 60, sb: 25, sd: 15, coreKeywords: 20, topPosition: 52, targeting: "defense" },
];

const adPositions = [
  { position: "TOP", percentage: 42, count: 156 },
  { position: "PP", percentage: 35, count: 130 },
  { position: "Other", percentage: 23, count: 86 },
];

const targetingData = {
  complement: {
    label: "互补定向",
    icon: Shuffle,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    count: 15,
    asins: ["B0DFGH456", "B0IJKL789", "B0MNOP012", "B0QRST345", "B0UVWX678"],
    desc: "与自身产品互补的ASIN，如猫粮碗、宠物零食",
  },
  defense: {
    label: "防御定向",
    icon: Shield,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    count: 12,
    asins: ["B0ABCDE12", "B0FGHIJ45", "B0KLMNO78", "B0PQRST90"],
    desc: "自身品牌ASIN，防止竞品抢位",
  },
  offense: {
    label: "进攻定向",
    icon: Swords,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    count: 18,
    asins: ["B0ZXCVB23", "B0BNMAS45", "B0QWERT67", "B0YUIOP89", "B0HJKL012", "B0DFGAS34"],
    desc: "竞品品牌ASIN，抢占竞品流量",
  },
};

const competitorTypeColors = {
  complement: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  defense: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  offense: "text-red-400 bg-red-500/10 border-red-500/20",
};

export default function CompetitorAdsPage() {
  const [activeKeywordType, setActiveKeywordType] = useState<"core" | "longtail" | "competitor">("core");
  const [showStrategy, setShowStrategy] = useState(false);

  const filteredKeywords = keywords.filter((k) => k.type === activeKeywordType);

  return (
    <PageTransition className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--wf-competitor)]/20 to-[var(--wf-competitor)]/5">
          <Target className="h-5 w-5 text-[var(--wf-competitor)]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">竞品广告分析</h1>
          <p className="text-xs text-muted-foreground">解决竞品广告策略不透明问题 — 全维拆解 + 策略输出</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder="输入类目关键词或竞品 ASIN..." className="h-9" />
            </div>
            <Button className="gap-2 bg-[var(--wf-competitor)] hover:bg-[var(--wf-competitor)]/90 h-9">
              <Search className="h-4 w-4" /> 开始分析
            </Button>
            <span className="text-xs text-muted-foreground">自动调取类目前20的广告数据</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">关键词矩阵</CardTitle>
              <div className="flex gap-1">
                {(["core", "longtail", "competitor"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveKeywordType(t)}
                    className={cn("rounded-md px-2.5 py-1 text-[10px] font-medium transition-all", activeKeywordType === t ? "bg-[var(--wf-competitor)]/10 text-[var(--wf-competitor)] border border-[var(--wf-competitor)]/20" : "text-muted-foreground hover:text-foreground")}
                  >
                    {t === "core" ? "核心词" : t === "longtail" ? "长尾词" : "竞品词"} ({keywords.filter((k) => k.type === t).length})
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {filteredKeywords.map((kw) => (
                <Badge
                  key={kw.keyword}
                  variant="outline"
                  className={cn(
                    "cursor-pointer hover:opacity-80 transition-opacity",
                    kw.competition >= 80 ? "border-red-500/30 text-red-400" :
                    kw.competition >= 60 ? "border-amber-500/30 text-amber-400" :
                    "border-emerald-500/30 text-emerald-400"
                  )}
                  style={{ fontSize: `${Math.max(10, Math.min(14, kw.volume / 10000))}px` }}
                >
                  <Hash className="h-3 w-3 mr-1" />
                  {kw.keyword}
                  <span className="ml-1 text-[9px] text-muted-foreground">{(kw.volume / 1000).toFixed(0)}K</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">广告结构 (SP / SB / SD)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { type: "SP", value: 55, color: "bg-blue-500" },
              { type: "SB", value: 25, color: "bg-purple-500" },
              { type: "SD", value: 20, color: "bg-orange-500" },
            ].map((item) => (
              <div key={item.type} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{item.type} 广告</span>
                  <span className="text-xs font-bold metric-value">{item.value}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", item.color)} style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">广告位分析</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {adPositions.map((pos) => (
              <div key={pos.position} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crosshair className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">{pos.position}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{pos.count} 个</span>
                    <span className="text-xs font-bold metric-value">{pos.percentage}%</span>
                  </div>
                </div>
                <Progress value={pos.percentage} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">ASIN 定向分析</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.entries(targetingData).map(([key, data]) => {
                const Icon = data.icon;
                return (
                  <div key={key} className={cn("rounded-lg border p-3 space-y-2", data.bgColor, data.borderColor)}>
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", data.color)} />
                      <span className={cn("text-xs font-medium", data.color)}>{data.label}</span>
                    </div>
                    <p className="text-lg font-bold metric-value">{data.count}</p>
                    <p className="text-[10px] text-muted-foreground">{data.desc}</p>
                    <div className="space-y-0.5">
                      {data.asins.slice(0, 3).map((asin) => (
                        <p key={asin} className="text-[10px] font-mono text-muted-foreground">{asin}</p>
                      ))}
                      {data.asins.length > 3 && <p className="text-[10px] text-muted-foreground">+{data.asins.length - 3} 更多</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">竞品广告策略对比 (Top 10)</CardTitle>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
              <Download className="h-3 w-3" /> 导出
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">#</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">竞品</th>
                  <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">SP</th>
                  <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">SB</th>
                  <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">SD</th>
                  <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">核心词数</th>
                  <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">TOP占比</th>
                  <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">定向类型</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((comp, idx) => (
                  <tr key={comp.name} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium">{comp.name}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-8 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${comp.sp}%` }} />
                        </div>
                        <span>{comp.sp}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-8 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-purple-500" style={{ width: `${comp.sb}%` }} />
                        </div>
                        <span>{comp.sb}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-8 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-orange-500" style={{ width: `${comp.sd}%` }} />
                        </div>
                        <span>{comp.sd}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center font-medium">{comp.coreKeywords}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn("font-medium", comp.topPosition >= 60 ? "text-emerald-400" : comp.topPosition >= 40 ? "text-amber-400" : "text-muted-foreground")}>
                        {comp.topPosition}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Badge className={cn("text-[9px]", competitorTypeColors[comp.targeting])}>
                        {comp.targeting === "complement" ? "互补" : comp.targeting === "defense" ? "防御" : "进攻"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          {
            title: "进攻策略",
            icon: Swords,
            color: "text-red-400",
            borderColor: "border-l-red-500",
            items: [
              "锁定竞品核心词 SP 精准广告",
              "竞品 ASIN 定向 SD 广告",
              "SB 品牌旗舰店广告抢占",
              "视频广告差异化展示",
            ],
          },
          {
            title: "防御策略",
            icon: Shield,
            color: "text-amber-400",
            borderColor: "border-l-amber-500",
            items: [
              "自身品牌词 SP 防御广告",
              "核心产品 ASIN 定向防御",
              "SB 品牌故事强化认知",
              "SD 再营销锁定已访客",
            ],
          },
          {
            title: "差异化策略",
            icon: Zap,
            color: "text-emerald-400",
            borderColor: "border-l-emerald-500",
            items: [
              "长尾词低竞价高转化布局",
              "UV杀菌功能差异化卖点",
              "价格带区间优势定位",
              "场景化关键词拓展",
            ],
          },
        ].map((strategy) => {
          const Icon = strategy.icon;
          return (
            <Card key={strategy.title} className={cn("border-l-2", strategy.borderColor)}>
              <CardHeader className="pb-3">
                <CardTitle className={cn("text-sm flex items-center gap-2", strategy.color)}>
                  <Icon className="h-4 w-4" /> {strategy.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {strategy.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-[10px] text-muted-foreground mt-0.5">{i + 1}.</span>
                      <span className="text-xs">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button className="gap-2 bg-[var(--wf-competitor)] hover:bg-[var(--wf-competitor)]/90">
          <ExternalLink className="h-4 w-4" /> 一键应用到广告工作流
        </Button>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> 导出分析报告
        </Button>
      </div>
    </PageTransition>
  );
}

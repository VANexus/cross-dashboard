"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { PageTransition } from "@/components/ui/page-transition";
import { StatusDot } from "@/components/ui/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Activity,
  Eye,
  Lock,
  Globe,
  Server,
} from "lucide-react";
import type { RiskEvent } from "@/lib/types";

const AnimatedNumber = dynamic(
  () => import("@/components/ui/animated-number").then((m) => ({ default: m.AnimatedNumber })),
  { ssr: false }
);

const Sparkline = dynamic(
  () => import("@/components/ui/sparkline").then((m) => ({ default: m.Sparkline })),
  { ssr: false }
);

const levelConfig: Record<import("@/lib/types").RiskLevel, { label: string; color: string; bg: string; dot: "danger" | "warning" | "info" | "success" }> = {
  level1: { label: "P1", color: "text-red-500", bg: "bg-red-500/10", dot: "danger" },
  level2: { label: "P2", color: "text-amber-500", bg: "bg-amber-500/10", dot: "warning" },
  level3: { label: "P3", color: "text-blue-500", bg: "bg-blue-500/10", dot: "info" },
  safe: { label: "安全", color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "success" },
};

interface RiskClientProps {
  initialEvents: RiskEvent[];
}

export function RiskClient({ initialEvents }: RiskClientProps) {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const healthScore = 87;
  const dimensions = [
    { name: "账号安全", score: 92, icon: Lock },
    { name: "合规性", score: 88, icon: Shield },
    { name: "库存风险", score: 78, icon: Server },
    { name: "竞争风险", score: 85, icon: Globe },
    { name: "政策风险", score: 91, icon: AlertTriangle },
  ];

  const riskIndicators = [
    { name: "库存周转", value: 45, threshold: 60, unit: "天", trend: [48, 52, 50, 47, 45, 43, 45] },
    { name: "退货率", value: 3.2, threshold: 5, unit: "%", trend: [4.1, 3.8, 3.5, 3.3, 3.1, 3.0, 3.2] },
    { name: "差评率", value: 2.1, threshold: 3, unit: "%", trend: [2.8, 2.5, 2.3, 2.2, 2.0, 1.9, 2.1] },
    { name: "侵权投诉", value: 0, threshold: 1, unit: "次", trend: [0, 0, 1, 0, 0, 0, 0] },
    { name: "账号健康度", value: 95, threshold: 80, unit: "分", trend: [92, 93, 94, 95, 94, 95, 95] },
    { name: "政策合规", value: 98, threshold: 90, unit: "分", trend: [96, 97, 97, 98, 98, 98, 98] },
    { name: "竞品威胁", value: 35, threshold: 50, unit: "分", trend: [40, 38, 36, 35, 34, 35, 35] },
  ];

  const timeline = [
    { time: "10:32", type: "danger", message: "ASIN-B001 库存可售天数低于阈值", agent: "风控Agent" },
    { time: "09:15", type: "warning", message: "检测到竞品降价 15%", agent: "哨兵Agent" },
    { time: "08:45", type: "info", message: "账号绩效指标正常", agent: "风控Agent" },
    { time: "昨天", type: "warning", message: "新品牌词疑似侵权", agent: "法务Agent" },
    { time: "昨天", type: "info", message: "库存补货订单已发出", agent: "运营Agent" },
  ];

  const isolationChecklist = [
    { id: "1", text: "每个店铺独立 IP 和浏览器指纹", checked: true },
    { id: "2", text: "收款账户与店铺一一对应", checked: true },
    { id: "3", text: "品牌授权文件完整", checked: true },
    { id: "4", text: "产品图片无跨店重复", checked: false },
    { id: "5", text: "店铺间无关联物流信息", checked: true },
    { id: "6", text: "客服邮箱独立", checked: true },
  ];

  return (
    <PageTransition className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">风控中心</h1>
          <p className="text-muted-foreground text-sm">
            账号安全、合规性与风险监控
          </p>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-3">
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              健康评分
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                  <circle
                    cx="50" cy="50" r="40" fill="none" strokeWidth="8"
                    stroke="currentColor"
                    className="text-emerald-500"
                    strokeDasharray={`${healthScore * 2.51} 251`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <AnimatedNumber value={healthScore} className="text-2xl font-bold" />
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {dimensions.map((dim) => {
                  const Icon = dim.icon;
                  return (
                    <div key={dim.name} className="flex items-center gap-2 text-xs">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                      <span className="flex-1">{dim.name}</span>
                      <span className={cn("font-medium", dim.score >= 90 ? "text-emerald-500" : dim.score >= 80 ? "text-amber-500" : "text-red-500")}>
                        {dim.score}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              风险指标
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {riskIndicators.map((indicator) => {
                const isWarning = indicator.name === "库存周转"
                  ? indicator.value > indicator.threshold
                  : indicator.value > indicator.threshold;
                const isGood = !isWarning;
                return (
                  <div key={indicator.name} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{indicator.name}</span>
                        <span className={cn("text-xs font-medium", isGood ? "text-emerald-500" : "text-amber-500")}>
                          {indicator.value}{indicator.unit}
                        </span>
                      </div>
                      <Sparkline data={indicator.trend} width={80} height={16} color={isGood ? "#22c55e" : "#f59e0b"} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                风险事件
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {initialEvents.filter((e) => !e.resolved).length} 活跃
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {initialEvents.map((event) => {
                const level = levelConfig[event.level];
                const isExpanded = expandedEvent === event.id;
                return (
                  <div key={event.id}>
                    <div
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                    >
                      <StatusDot status={level.dot} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{event.title}</p>
                        <p className="text-xs text-muted-foreground">{event.timestamp}</p>
                      </div>
                      <Badge variant="outline" className={cn(level.color, level.bg, "border-0 text-xs")}>
                        {level.label}
                      </Badge>
                      <Badge variant="outline" className={cn(event.resolved ? "text-emerald-500 bg-emerald-500/10" : "text-red-500 bg-red-500/10", "border-0 text-xs")}>
                        {event.resolved ? "已解决" : "活跃"}
                      </Badge>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-3 pl-10">
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">来源: {event.source}</p>
                        {event.actions.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {event.actions.map((action, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px]">{action}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {initialEvents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mb-2" />
                  <p className="text-sm">暂无风险事件</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              事件时间线
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-4">
                {timeline.map((item, i) => (
                  <div key={i} className="relative flex items-start gap-3 pl-1">
                    <div className={cn("relative z-10 h-3 w-3 rounded-full border-2 border-background", item.type === "danger" ? "bg-red-500" : item.type === "warning" ? "bg-amber-500" : "bg-blue-500")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{item.message}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{item.time}</span>
                        <span className="text-[10px] text-muted-foreground">{item.agent}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            店铺隔离检查
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {isolationChecklist.map((item) => (
              <div
                key={item.id}
                className={cn("flex items-center gap-3 p-3 rounded-lg border transition-colors", item.checked ? "bg-emerald-500/5 border-emerald-500/20" : "bg-amber-500/5 border-amber-500/20")}
              >
                <div className={cn("flex h-5 w-5 items-center justify-center rounded-full", item.checked ? "bg-emerald-500 text-white" : "bg-amber-500 text-white")}>
                  {item.checked ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                </div>
                <span className="text-xs">{item.text}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </PageTransition>
  );
}

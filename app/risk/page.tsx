"use client";

import { useState } from "react";
import { riskEvents } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageTransition } from "@/components/ui/page-transition";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { StatusDot } from "@/components/ui/status-dot";
import { Sparkline } from "@/components/ui/sparkline";
import { cn } from "@/lib/utils";
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Bell,
  Mail,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Settings,
  Eye,
  Activity,
  Lock,
  Monitor,
  CreditCard,
  Phone,
  FileText,
  Keyboard,
  Palette,
} from "lucide-react";

const healthScore = 87;

const dimensions = [
  { label: "订单缺陷率", score: 95, value: "0.8%", threshold: "< 1%", status: "pass" as const, icon: CheckCircle2 },
  { label: "迟发率", score: 88, value: "2.1%", threshold: "< 4%", status: "pass" as const, icon: Clock },
  { label: "侵权风险", score: 72, value: "2 次警告", threshold: "0 次", status: "warning" as const, icon: AlertTriangle },
  { label: "绩效通知", score: 90, value: "1 条待处理", threshold: "0 条", status: "warning" as const, icon: Bell },
  { label: "政策合规", score: 85, value: "良好", threshold: "优秀", status: "pass" as const, icon: Shield },
];

const riskIndicators = [
  { name: "订单缺陷率 (ODR)", current: "0.8%", threshold: "1.0%", status: "safe" as const, trend: [1.2, 1.1, 1.0, 0.9, 0.8, 0.9, 0.8, 0.7, 0.8, 0.8, 0.9, 0.8, 0.7, 0.8] },
  { name: "A-to-Z 索赔率", current: "0.3%", threshold: "0.5%", status: "safe" as const, trend: [0.4, 0.5, 0.3, 0.4, 0.3, 0.2, 0.3, 0.4, 0.3, 0.3, 0.2, 0.3, 0.3, 0.3] },
  { name: "差评率", current: "2.1%", threshold: "3.0%", status: "safe" as const, trend: [3.2, 2.8, 2.5, 2.3, 2.1, 2.2, 2.4, 2.1, 2.0, 2.2, 2.1, 2.3, 2.0, 2.1] },
  { name: "迟发率", current: "2.1%", threshold: "4.0%", status: "safe" as const, trend: [3.5, 3.2, 2.8, 2.5, 2.1, 2.3, 2.0, 2.2, 2.1, 2.3, 2.1, 2.0, 2.2, 2.1] },
  { name: "退货率", current: "4.2%", threshold: "5.0%", status: "warning" as const, trend: [3.8, 4.0, 4.2, 4.5, 4.3, 4.1, 4.4, 4.2, 4.5, 4.3, 4.2, 4.6, 4.4, 4.2] },
  { name: "知识产权投诉", current: "2 次", threshold: "0 次", status: "danger" as const, trend: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 2] },
  { name: "账号健康评分", current: "87", threshold: "≥ 80", status: "safe" as const, trend: [82, 83, 84, 85, 86, 85, 86, 87, 86, 87, 86, 87, 86, 87] },
];

const timeline = [
  { time: "10:30", level: "warning" as const, title: "知识产权投诉 — 外观专利", desc: "产品 B0XYZ789 收到外观专利投诉，需在7天内提交行动计划", action: "查看详情" },
  { time: "09:15", level: "info" as const, title: "绩效通知更新", desc: "账户健康评分更新为 87 分，较上次提升 1 分", action: "查看" },
  { time: "昨天 22:00", level: "critical" as const, title: "退货率接近阈值", desc: "SKU PF-002-WH 退货率达 4.8%，接近 5% 阈值", action: "处理" },
  { time: "昨天 18:30", level: "success" as const, title: "A-to-Z 索赔已解决", desc: "索赔 #AZ-20260508 客户同意撤诉，已恢复信用", action: "查看" },
  { time: "昨天 14:00", level: "warning" as const, title: "差评预警", desc: "24小时内新增 3 条1星差评，涉及产品质量问题", action: "分析" },
];

const levelColors = {
  critical: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", dot: "danger" as const },
  warning: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", dot: "warning" as const },
  info: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", dot: "info" as const },
  success: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", dot: "success" as const },
};

const isolationChecklist = [
  { label: "邮箱隔离", desc: "每个店铺使用独立邮箱地址", checked: true, icon: Mail },
  { label: "浏览器隔离", desc: "使用独立浏览器指纹，无交叉登录", checked: true, icon: Monitor },
  { label: "信用卡隔离", desc: "每个店铺使用独立付款信用卡", checked: true, icon: CreditCard },
  { label: "电话号码隔离", desc: "每个店铺绑定独立手机号", checked: true, icon: Phone },
  { label: "文案风格差异化", desc: "不同店铺使用不同文案风格，避免模式识别", checked: true, icon: Palette },
  { label: "操作手法隔离", desc: "避免相同操作时间、频率、路径模式", checked: false, icon: Keyboard },
];

export default function RiskPage() {
  const [showIsolation, setShowIsolation] = useState(true);
  const [showFeishu, setShowFeishu] = useState(false);

  const scoreColor = healthScore >= 80 ? "text-emerald-400" : healthScore >= 60 ? "text-amber-400" : "text-red-400";
  const scoreRing = healthScore >= 80 ? "stroke-emerald-500" : healthScore >= 60 ? "stroke-amber-500" : "stroke-red-500";

  return (
    <PageTransition className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">风险监控中心</h1>
          <p className="text-xs text-muted-foreground">实时监控账户健康、风险指标与店铺隔离状态</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="workflow-card">
          <CardContent className="p-6 flex flex-col items-center">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" className="stroke-muted/30" />
                <circle
                  cx="60" cy="60" r="52" fill="none" strokeWidth="8"
                  className={scoreRing}
                  strokeLinecap="round"
                  strokeDasharray={`${(healthScore / 100) * 327} 327`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-3xl font-bold metric-value", scoreColor)}>
                  <AnimatedNumber value={healthScore} />
                </span>
                <span className="text-xs text-muted-foreground">/ 100</span>
              </div>
            </div>
            <Badge className="mt-3 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">账户状态: 良好</Badge>
            <p className="text-[10px] text-muted-foreground mt-1">上次更新: 2026-05-09 10:30</p>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-5">
          {dimensions.map((dim) => {
            const Icon = dim.icon;
            return (
              <Card key={dim.label} className="workflow-card">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Icon className={cn("h-4 w-4", dim.status === "pass" ? "text-emerald-400" : "text-amber-400")} />
                    <Badge variant="outline" className={cn("text-[9px] h-4", dim.status === "pass" ? "text-emerald-400 border-emerald-500/20" : "text-amber-400 border-amber-500/20")}>
                      {dim.status === "pass" ? "正常" : "注意"}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{dim.label}</p>
                  <p className="text-sm font-bold metric-value">{dim.value}</p>
                  <Progress value={dim.score} className="h-1.5" />
                  <p className="text-[9px] text-muted-foreground">阈值: {dim.threshold}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">风险指标实时监测</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">指标</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">当前值</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">阈值</th>
                      <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">状态</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">趋势</th>
                      <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riskIndicators.map((ind) => (
                      <tr key={ind.name} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{ind.name}</td>
                        <td className={cn("px-3 py-2 text-right font-medium", ind.status === "safe" ? "text-emerald-400" : ind.status === "warning" ? "text-amber-400" : "text-red-400")}>
                          {ind.current}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{ind.threshold}</td>
                        <td className="px-3 py-2 text-center">
                          <StatusDot status={ind.status === "safe" ? "success" : ind.status === "warning" ? "warning" : "danger"} size="sm" />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Sparkline data={ind.trend} width={60} height={16} color={ind.status === "safe" ? "#22c55e" : ind.status === "warning" ? "#f59e0b" : "#ef4444"} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Button variant="ghost" size="sm" className="h-6 text-[10px]">
                            <Eye className="h-3 w-3 mr-1" /> 详情
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">告警时间线</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {timeline.map((item, idx) => {
                const colors = levelColors[item.level];
                return (
                  <div key={idx} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <StatusDot status={colors.dot} size="sm" />
                      {idx < timeline.length - 1 && <div className="w-px h-full bg-border flex-1 mt-1" />}
                    </div>
                    <div className="flex-1 pb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-muted-foreground">{item.time}</span>
                        <Badge className={cn("text-[9px] h-4", colors.bg, colors.text, colors.border)}>
                          {item.level === "critical" ? "严重" : item.level === "warning" ? "警告" : item.level === "success" ? "已解决" : "信息"}
                        </Badge>
                      </div>
                      <p className="text-xs font-medium">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                      <Button variant="ghost" size="sm" className="h-5 text-[10px] mt-1 px-1">
                        {item.action} →
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <button className="w-full" onClick={() => setShowIsolation(!showIsolation)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Lock className="h-4 w-4 text-amber-400" /> 店铺隔离检查
                  </CardTitle>
                  {showIsolation ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
              </CardHeader>
            </button>
            {showIsolation && (
              <CardContent className="space-y-2">
                {isolationChecklist.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className={cn("flex items-center gap-3 rounded-lg border p-2.5", item.checked ? "border-emerald-500/10 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5")}>
                      <div className={cn("flex h-6 w-6 items-center justify-center rounded", item.checked ? "bg-emerald-500/10" : "bg-amber-500/10")}>
                        {item.checked ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-amber-400" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium">{item.label}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
                <div className="mt-2 rounded-md bg-amber-500/5 border border-amber-500/10 p-2">
                  <p className="text-[10px] text-amber-400 font-medium">⚠ 亚马逊关联规则</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">每个店铺之间不能有任何指纹关联。关联因素: 邮箱 / 文案风格 / 电话 / 信用卡 / 浏览器 / 同个操作手法</p>
                </div>
              </CardContent>
            )}
          </Card>

          <Card>
            <button className="w-full" onClick={() => setShowFeishu(!showFeishu)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bell className="h-4 w-4 text-blue-400" /> 飞书报警配置
                  </CardTitle>
                  {showFeishu ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
              </CardHeader>
            </button>
            {showFeishu && (
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-medium mb-2">推送渠道</p>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs cursor-pointer bg-blue-500/10 text-blue-400 border-blue-500/20">
                      <MessageSquare className="h-3 w-3 mr-1" /> 飞书群
                    </Badge>
                    <Badge variant="outline" className="text-xs cursor-pointer">
                      <Mail className="h-3 w-3 mr-1" /> 邮件
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium">指标报警阈值</p>
                  {[
                    { label: "ODR", value: "0.8%", input: "0.9%" },
                    { label: "退货率", value: "4.2%", input: "4.5%" },
                    { label: "侵权投诉", value: "立即", input: "0" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-16 shrink-0">{item.label}</span>
                      <input type="text" defaultValue={item.input} className="flex h-7 w-20 rounded border bg-transparent px-2 text-[10px] shadow-sm" />
                      <span className="text-[10px] text-muted-foreground">时报警</span>
                    </div>
                  ))}
                </div>
                <Button size="sm" className="w-full h-7 text-xs bg-blue-500 hover:bg-blue-600">
                  保存配置
                </Button>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}

"use client";

import { useState, useMemo } from "react";
import { memoryEntries } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/page-transition";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Sparkline } from "@/components/ui/sparkline";
import { cn } from "@/lib/utils";
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Hash,
  FileCode,
  MessageSquare,
  Cpu,
  Search,
  Filter,
  TrendingUp,
  Clock,
  Zap,
} from "lucide-react";

const typeConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "success" | "warning" | "danger" }> = {
  script: { label: "脚本", variant: "default" },
  code: { label: "代码", variant: "secondary" },
  prompt: { label: "Prompt", variant: "outline" },
  skill: { label: "技能", variant: "success" },
};

const typeIcons: Record<string, typeof Hash> = {
  script: FileCode,
  code: Cpu,
  prompt: MessageSquare,
  skill: Zap,
};

const zoneConfig = [
  {
    id: "preset" as const,
    label: "预设区",
    description: "系统预设，验证率92%",
    icon: Database,
    color: "#10b981",
    bg: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
  },
  {
    id: "dev" as const,
    label: "开发区",
    description: "待验证",
    icon: AlertCircle,
    color: "#0ea5e9",
    bg: "bg-sky-500/10",
    borderColor: "border-sky-500/20",
  },
  {
    id: "prompt" as const,
    label: "Prompt 区",
    description: "系统预设，验证率95%",
    icon: CheckCircle2,
    color: "#f59e0b",
    bg: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
  },
];

const usageData: Record<string, { count: number; trend: number[]; created: string; modified: string; workflows: string[] }> = {
  "1": { count: 47, trend: [12, 15, 18, 22, 28, 35, 47], created: "2026-03-12", modified: "2026-05-01", workflows: ["选品工作流"] },
  "2": { count: 156, trend: [45, 62, 78, 95, 110, 135, 156], created: "2026-02-08", modified: "2026-05-07", workflows: ["选品工作流", "竞品广告"] },
  "3": { count: 23, trend: [5, 8, 10, 14, 18, 20, 23], created: "2026-04-20", modified: "2026-04-29", workflows: ["AI 上架"] },
  "4": { count: 89, trend: [22, 35, 48, 56, 68, 79, 89], created: "2026-03-01", modified: "2026-05-06", workflows: ["AI 广告"] },
  "5": { count: 34, trend: [8, 12, 15, 20, 24, 29, 34], created: "2026-04-05", modified: "2026-05-02", workflows: ["AI 作图"] },
  "6": { count: 67, trend: [15, 22, 30, 40, 48, 58, 67], created: "2026-03-18", modified: "2026-05-04", workflows: ["库销比"] },
};

function formatRelativeTime(dateStr: string) {
  const now = new Date("2026-05-09");
  const date = new Date(dateStr);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  return `${Math.floor(diffDays / 30)}月前`;
}

const allZones = ["all", "preset", "dev", "prompt"] as const;

export default function MemoryPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return memoryEntries.filter((e) => {
      const matchSearch =
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        e.content.toLowerCase().includes(search.toLowerCase()) ||
        e.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
      const matchType = typeFilter === "all" || e.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [search, typeFilter]);

  const zoneCounts = useMemo(() => {
    const counts: Record<string, number> = { preset: 0, dev: 0, prompt: 0 };
    memoryEntries.forEach((e) => { counts[e.zone] = (counts[e.zone] || 0) + 1; });
    return counts;
  }, []);

  const zoneValidation: Record<string, number> = { preset: 92, dev: 0, prompt: 95 };
  const zoneUpdated: Record<string, string> = { preset: "2026-05-07", dev: "2026-04-29", prompt: "2026-05-06" };

  const getZoneColor = (zone: string) => {
    const z = zoneConfig.find((c) => c.id === zone);
    return z?.color || "#6b7280";
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">记忆系统</h1>
          <p className="text-sm text-muted-foreground">管理智能体记忆、技能和知识</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {zoneConfig.map((z) => {
            const Icon = z.icon;
            return (
              <Card key={z.id} className={cn("relative overflow-hidden", z.borderColor)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn("rounded-lg p-1.5", z.bg)}>
                          <Icon className="h-4 w-4" style={{ color: z.color }} />
                        </div>
                        <span className="text-sm font-semibold">{z.label}</span>
                      </div>
                      <div className="text-3xl font-bold tabular-nums" style={{ color: z.color }}>
                        <AnimatedNumber value={zoneCounts[z.id] || 0} />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold" style={{ color: z.color }}>
                        {zoneValidation[z.id]}%
                      </div>
                      <div className="text-[10px] text-muted-foreground">验证率</div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatRelativeTime(zoneUpdated[z.id])}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索标题、内容或标签..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              className="text-xs bg-muted border border-border rounded-md px-2 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-primary/30"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">全部类型</option>
              <option value="script">脚本</option>
              <option value="code">代码</option>
              <option value="prompt">Prompt</option>
              <option value="skill">技能</option>
            </select>
          </div>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">全部 ({filtered.length})</TabsTrigger>
            <TabsTrigger value="preset">预设区 ({filtered.filter((e) => e.zone === "preset").length})</TabsTrigger>
            <TabsTrigger value="dev">开发区 ({filtered.filter((e) => e.zone === "dev").length})</TabsTrigger>
            <TabsTrigger value="prompt">Prompt 区 ({filtered.filter((e) => e.zone === "prompt").length})</TabsTrigger>
          </TabsList>
          {allZones.map((zone) => (
            <TabsContent key={zone} value={zone} className="mt-4 space-y-3">
              {filtered
                .filter((e) => zone === "all" || e.zone === zone)
                .map((entry) => {
                  const tc = typeConfig[entry.type];
                  const zc = zoneConfig.find((z) => z.id === entry.zone);
                  const TypeIcon = typeIcons[entry.type] || Hash;
                  const usage = usageData[entry.id];
                  const zoneColor = getZoneColor(entry.zone);

                  return (
                    <Card
                      key={entry.id}
                      className={cn(
                        "group relative overflow-hidden transition-all hover:border-primary/30",
                        !entry.verified && entry.zone === "dev" && "animate-pulse-border"
                      )}
                    >
                      <div
                        className="absolute left-0 top-0 bottom-0 w-0.5"
                        style={{ backgroundColor: zoneColor }}
                      />
                      <CardContent className="p-4 pl-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="text-sm font-semibold">{entry.title}</h3>
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                v{entry.version}
                              </Badge>
                              <Badge variant={tc?.variant || "default"} className="text-[9px] px-1.5 py-0">
                                <TypeIcon className="h-2.5 w-2.5 mr-0.5" />
                                {tc?.label || entry.type}
                              </Badge>
                              {entry.verified ? (
                                <span className="inline-flex items-center gap-0.5 text-emerald-500">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span className="text-[9px]">已验证</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-amber-500">
                                  <AlertCircle className="h-3 w-3" />
                                  <span className="text-[9px]">待验证</span>
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                              {entry.content}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {entry.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                                >
                                  <Hash className="h-2.5 w-2.5" />
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                创建: {usage?.created || "2026-04-01"}
                              </span>
                              <span>
                                修改: {usage?.modified || entry.updatedAt} ({formatRelativeTime(usage?.modified || entry.updatedAt)})
                              </span>
                              {zc && (
                                <span className="flex items-center gap-1" style={{ color: zoneColor }}>
                                  {zc.label}
                                </span>
                              )}
                              {usage?.workflows && usage.workflows.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Zap className="h-3 w-3 text-amber-500" />
                                  {usage.workflows.join(", ")}
                                </span>
                              )}
                            </div>
                          </div>
                          {usage && (
                            <div className="shrink-0 flex flex-col items-end gap-1">
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <TrendingUp className="h-3 w-3 text-emerald-500" />
                                <span className="text-xs font-medium">本月 {usage.count} 次</span>
                              </div>
                              <Sparkline data={usage.trend} width={64} height={20} color="var(--primary)" />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              {filtered.filter((e) => zone === "all" || e.zone === zone).length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Database className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">暂无记忆条目</p>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </PageTransition>
  );
}

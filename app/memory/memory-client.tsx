"use client";

import { PageHeader } from "@/components/ui/page-header";
import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Brain,
  Search,
  Database,
  Lightbulb,
  FileText,
  Clock,
  Link as LinkIcon,
  BarChart3,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { MemoryEntry } from "@/lib/types";

const AnimatedNumber = dynamic(
  () => import("@/components/ui/animated-number").then((m) => ({ default: m.AnimatedNumber })),
  { ssr: false }
);

const Sparkline = dynamic(
  () => import("@/components/ui/sparkline").then((m) => ({ default: m.Sparkline })),
  { ssr: false }
);

const typeConfig = {
  script: { label: "脚本", icon: Database, color: "text-viz-1", bg: "bg-viz-1/10" },
  code: { label: "代码", icon: FileText, color: "text-viz-4", bg: "bg-viz-4/10" },
  prompt: { label: "提示词", icon: Lightbulb, color: "text-viz-3", bg: "bg-viz-3/10" },
  skill: { label: "技能", icon: BarChart3, color: "text-viz-2", bg: "bg-viz-2/10" },
};

const typeIcons: Record<MemoryEntry["type"], React.ReactNode> = {
  script: <Database className="h-4 w-4" />,
  code: <FileText className="h-4 w-4" />,
  prompt: <Lightbulb className="h-4 w-4" />,
  skill: <BarChart3 className="h-4 w-4" />,
};

const zoneConfig = {
  preset: { label: "预设区", color: "text-viz-1", bg: "bg-viz-1/10" },
  dev: { label: "开发区", color: "text-viz-3", bg: "bg-viz-3/10" },
  prompt: { label: "提示区", color: "text-viz-4", bg: "bg-viz-4/10" },
};

interface MemoryClientProps {
  initialData: MemoryEntry[];
}

export function MemoryClient({ initialData }: MemoryClientProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return initialData.filter((m) => {
      const matchSearch = m.content.toLowerCase().includes(search.toLowerCase()) ||
        m.title.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || m.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [initialData, search, typeFilter]);

  const typeCounts = {
    script: initialData.filter((m) => m.type === "script").length,
    code: initialData.filter((m) => m.type === "code").length,
    prompt: initialData.filter((m) => m.type === "prompt").length,
    skill: initialData.filter((m) => m.type === "skill").length,
  };
  const usageData = [
    { name: "脚本", count: typeCounts.script, trend: [0, 0, 0, 0, 0, 0, typeCounts.script] },
    { name: "代码", count: typeCounts.code, trend: [0, 0, 0, 0, 0, 0, typeCounts.code] },
    { name: "提示词", count: typeCounts.prompt, trend: [0, 0, 0, 0, 0, 0, typeCounts.prompt] },
    { name: "技能", count: typeCounts.skill, trend: [0, 0, 0, 0, 0, 0, typeCounts.skill] },
  ];

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="记忆系统"
        description="管理和查看系统积累的知识与经验"
        actions={<Button size="sm">
          <Zap className="h-4 w-4 mr-1" />
          重建索引
        </Button>}
      />

      <div className="grid gap-6 grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Database className="h-3 w-3" /> 脚本
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AnimatedNumber value={initialData.filter((m) => m.type === "script").length} className="text-2xl font-bold" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Lightbulb className="h-3 w-3" /> 代码
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AnimatedNumber value={initialData.filter((m) => m.type === "code").length} className="text-2xl font-bold" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3 w-3" /> 提示词
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AnimatedNumber value={initialData.filter((m) => m.type === "prompt").length} className="text-2xl font-bold" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <BarChart3 className="h-3 w-3" /> 技能
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AnimatedNumber value={initialData.filter((m) => m.type === "skill").length} className="text-2xl font-bold" />
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索记忆..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant={typeFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("all")}>
            全部
          </Button>
          {Object.entries(typeConfig).map(([key, config]) => (
            <Button
              key={key}
              variant={typeFilter === key ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter(key)}
            >
              {config.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.map((memory) => {
                const config = typeConfig[memory.type];
                const zone = zoneConfig[memory.zone];
                const Icon = typeIcons[memory.type];
                return (
                  <div key={memory.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", config.bg, config.color)}>
                      {Icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{memory.content}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-tiny text-muted-foreground flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" /> {memory.createdAt}
                        </span>
                        <span className="text-tiny text-muted-foreground flex items-center gap-1">
                          <LinkIcon className="h-2.5 w-2.5" /> {memory.title}
                        </span>
                        <Badge variant="outline" className={cn(zone.color, zone.bg, "border-0 text-tiny h-4")}>
                          {zone.label}
                        </Badge>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn(config.color, config.bg, "border-0 text-xs shrink-0")}>
                      {config.label}
                    </Badge>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Brain className="h-8 w-8 mb-2" />
                  <p className="text-sm">未找到匹配的记忆</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              使用统计
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {usageData.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs">{item.name}</span>
                  <span className="text-xs font-medium">{item.count}</span>
                </div>
                <Sparkline data={item.trend} width={100} height={16} color="var(--primary)" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}

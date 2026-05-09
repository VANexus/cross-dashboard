"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { memoryEntries } from "@/lib/mock-data";
import { Database, Lock, Code2, Sparkles, CheckCircle2, AlertCircle, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

const zoneConfig = {
  preset: { label: "预设区", description: "只读验证脚本，经过审查和归档", icon: Lock, color: "text-emerald-500" },
  dev: { label: "开发区", description: "动态代码，在沙箱环境中运行和测试", icon: Code2, color: "text-sky-500" },
  prompt: { label: "Prompt区", description: "上下文记忆栈和Skill索引", icon: Sparkles, color: "text-amber-500" },
};

export default function MemoryPage() {
  const presetEntries = memoryEntries.filter((e) => e.zone === "preset");
  const devEntries = memoryEntries.filter((e) => e.zone === "dev");
  const promptEntries = memoryEntries.filter((e) => e.zone === "prompt");

  const renderEntry = (entry: typeof memoryEntries[0]) => {
    const zone = zoneConfig[entry.zone];
    return (
      <Card key={entry.id} className="hover:border-primary/30 transition-all">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold">{entry.title}</span>
                <Badge variant="outline" className="text-[10px]">v{entry.version}</Badge>
                <Badge variant={entry.type === "script" ? "default" : entry.type === "code" ? "secondary" : entry.type === "skill" ? "warning" : "outline"} className="text-[10px]">
                  {entry.type}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{entry.content}</p>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>更新: {new Date(entry.updatedAt).toLocaleDateString("zh-CN")}</span>
                <div className="flex items-center gap-1">
                  {entry.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px]">
                      <Tag className="h-2.5 w-2.5" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {entry.verified ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-500" />
              )}
              <span className="text-[10px] text-muted-foreground">{entry.verified ? "已验证" : "待验证"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">三区记忆系统</h1>
        <p className="text-sm text-muted-foreground">预设区（只读脚本）、开发区（动态代码沙箱）、Prompt区（上下文记忆）</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {Object.entries(zoneConfig).map(([key, zone]) => {
          const Icon = zone.icon;
          const count = memoryEntries.filter((e) => e.zone === key).length;
          return (
            <Card key={key}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("rounded-lg p-2", key === "preset" ? "bg-emerald-500/10" : key === "dev" ? "bg-sky-500/10" : "bg-amber-500/10")}>
                  <Icon className={cn("h-5 w-5", zone.color)} />
                </div>
                <div>
                  <p className="text-sm font-semibold">{zone.label}</p>
                  <p className="text-xs text-muted-foreground">{count} 条记录</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">全部 ({memoryEntries.length})</TabsTrigger>
          <TabsTrigger value="preset">预设区 ({presetEntries.length})</TabsTrigger>
          <TabsTrigger value="dev">开发区 ({devEntries.length})</TabsTrigger>
          <TabsTrigger value="prompt">Prompt区 ({promptEntries.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4 space-y-3">
          {memoryEntries.map(renderEntry)}
        </TabsContent>
        <TabsContent value="preset" className="mt-4 space-y-3">
          {presetEntries.map(renderEntry)}
        </TabsContent>
        <TabsContent value="dev" className="mt-4 space-y-3">
          {devEntries.map(renderEntry)}
        </TabsContent>
        <TabsContent value="prompt" className="mt-4 space-y-3">
          {promptEntries.map(renderEntry)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

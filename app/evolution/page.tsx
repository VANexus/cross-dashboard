"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { evolutionRecords, agents } from "@/lib/mock-data";
import { Sparkles, Search, Code2, FlaskConical, ClipboardCheck, Recycle, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const stageConfig = {
  identify: { label: "需求识别", icon: Search, color: "text-sky-500", bg: "bg-sky-500/10" },
  generate: { label: "代码生成", icon: Code2, color: "text-indigo-500", bg: "bg-indigo-500/10" },
  test: { label: "沙箱测试", icon: FlaskConical, color: "text-amber-500", bg: "bg-amber-500/10" },
  review: { label: "审查归档", icon: ClipboardCheck, color: "text-orange-500", bg: "bg-orange-500/10" },
  reuse: { label: "能力复用", icon: Recycle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
};

const stages = ["identify", "generate", "test", "review", "reuse"] as const;

export default function EvolutionPage() {
  const successCount = evolutionRecords.filter((r) => r.status === "success").length;
  const inProgressCount = evolutionRecords.filter((r) => r.status === "in_progress").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">自进化追踪</h1>
        <p className="text-sm text-muted-foreground">Dev自进化机制：需求识别 → 代码生成 → 沙箱测试 → 审查归档 → 能力复用</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">进化流水线</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-8">
            {stages.map((stage, i) => {
              const config = stageConfig[stage];
              const Icon = config.icon;
              const count = evolutionRecords.filter((r) => r.stage === stage).length;
              return (
                <div key={stage} className="flex items-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className={cn("rounded-full p-3", config.bg)}>
                      <Icon className={cn("h-5 w-5", config.color)} />
                    </div>
                    <span className="text-xs font-medium">{config.label}</span>
                    <span className="text-[10px] text-muted-foreground">{count}项</span>
                  </div>
                  {i < stages.length - 1 && (
                    <ChevronRight className="h-5 w-5 text-muted-foreground mx-3" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Sparkles className="h-5 w-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold">{evolutionRecords.length}</div>
            <div className="text-xs text-muted-foreground">进化项目总数</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
            <div className="text-2xl font-bold">{successCount}</div>
            <div className="text-xs text-muted-foreground">已成功复用</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Loader2 className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <div className="text-2xl font-bold">{inProgressCount}</div>
            <div className="text-xs text-muted-foreground">进行中</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">进化记录</h2>
        {evolutionRecords.map((record) => {
          const stage = stageConfig[record.stage];
          const Icon = stage.icon;
          const agent = agents.find((a) => a.id === record.agentId);

          return (
            <Card key={record.id} className="hover:border-primary/30 transition-all">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={cn("rounded-lg p-2.5 shrink-0", stage.bg)}>
                    <Icon className={cn("h-5 w-5", stage.color)} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">{record.title}</span>
                      <Badge variant={record.status === "success" ? "success" : "warning"}>
                        {record.status === "success" ? "已完成" : "进行中"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{stage.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{record.description}</p>
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                      <span>Agent: {agent?.name || record.agentId}</span>
                      <span>开始: {new Date(record.startedAt).toLocaleDateString("zh-CN")}</span>
                      {record.completedAt && (
                        <span>完成: {new Date(record.completedAt).toLocaleDateString("zh-CN")}</span>
                      )}
                    </div>
                    {record.metrics && (
                      <div className="mt-3 grid grid-cols-3 gap-4">
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-muted-foreground">准确率</span>
                            <span className="font-medium">{record.metrics.accuracy}%</span>
                          </div>
                          <Progress value={record.metrics.accuracy} className="h-1.5" />
                        </div>
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-muted-foreground">延迟</span>
                            <span className="font-medium">{record.metrics.latency}ms</span>
                          </div>
                          <Progress value={Math.max(0, 100 - record.metrics.latency / 10)} className="h-1.5" />
                        </div>
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-muted-foreground">覆盖率</span>
                            <span className="font-medium">{record.metrics.coverage}%</span>
                          </div>
                          <Progress value={record.metrics.coverage} className="h-1.5" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

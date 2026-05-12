"use client";

import { StatusDot } from "@/components/ui/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Workflow, Radar, Image, BarChart3, PackagePlus, Boxes, Target, ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import type { WorkflowStatus } from "@/lib/types";

const workflowIcons: Record<string, React.ReactNode> = {
  "product-research": <Radar className="h-4 w-4" />,
  "ai-imaging": <Image className="h-4 w-4" />,
  "ai-advertising": <BarChart3 className="h-4 w-4" />,
  "ai-listing": <PackagePlus className="h-4 w-4" />,
  "inventory": <Boxes className="h-4 w-4" />,
  "competitor-ads": <Target className="h-4 w-4" />,
};

interface DashboardWorkflowsProps {
  workflows: WorkflowStatus[];
}

export function DashboardWorkflows({ workflows }: DashboardWorkflowsProps) {
  return (
    <Card className="lg:col-span-3">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">插件工作流状态</CardTitle>
          <Link href="/workflows/product-research">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground">
              查看全部 <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {workflows.map((wf) => (
            <Link
              key={wf.id}
              href={wf.href}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
            >
              <StatusDot
                status={wf.status === "running" ? "success" : wf.status === "warning" ? "warning" : "idle"}
                pulse={wf.status === "running"}
              />
              <span className="text-muted-foreground">{workflowIcons[wf.id] || <Workflow className="h-4 w-4" />}</span>
              <span className="text-sm font-medium flex-1">{wf.name}</span>
              <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                <Clock className="h-3 w-3" /> {wf.lastRun}
              </span>
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal">
                {wf.runs}次
              </Badge>
              <span className="text-[11px] text-muted-foreground w-10 text-right">{wf.success}%</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground/30" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

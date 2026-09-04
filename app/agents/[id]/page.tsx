import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AgentDetailClient } from "./agent-detail-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AgentService, TaskService } from "@/lib/server/services";
import { getDbAsync } from "@/lib/server/db";
import { getEntries } from "@/lib/server/repositories/journal.repository";
import type { Task } from "@/lib/shared/types";

function AgentDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-8 w-16 skeleton rounded-md" />
        <div className="space-y-1">
          <div className="h-7 w-40 skeleton rounded" />
          <div className="h-4 w-24 skeleton rounded" />
        </div>
      </div>
      <div className="grid gap-4 grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-20 skeleton rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-7 w-16 skeleton rounded mb-2" />
              <div className="h-3 w-28 skeleton rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-20 skeleton rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-7 w-16 skeleton rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="h-4 w-24 skeleton rounded" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 w-full skeleton rounded" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

async function AgentDetailData({ id }: { id: string }) {
  await getDbAsync();
  const agentService = new AgentService();
  const taskService = new TaskService();

  const agent = await agentService.getById(id);
  if (!agent) notFound();

  const allTasks = (await taskService.list()).items;
  const agentTasks = allTasks.filter((t: Task) => t.assignedAgents?.includes(id));
  const journal = await getEntries(id, 100);

  return (
    <AgentDetailClient
      agent={agent}
      tasks={agentTasks}
      journal={journal}
    />
  );
}

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // cache-components：async page 顶层 await params + 读 DB 属 uncached，若落在
  // AppShell(Suspense 之外)会整页阻塞报 blocking-route。故 page 保持同步，把
  // await params + DB 读取都放进 <Suspense> 内的 async loader 组件完成。
  return (
    <Suspense fallback={<AgentDetailSkeleton />}>
      <AgentDetailLoader params={params} />
    </Suspense>
  );
}

// 动态路由（按 id 实时读库）。cache-components 要求 generateStaticParams 返回至少
// 一个「真实样本」供 build-time validation；这里用固定种子 Agent id 作为样本，
// 让构建期能校验确定性/动态边界而不因「空参数集」报错（运行时仍按请求的 id 实时读库）。
export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  return [
    { id: "sentinel-001" },
    { id: "operations-001" },
    { id: "marketing-001" },
  ];
}

async function AgentDetailLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 构建期（cacheComponents 的 build-time validation）不真的连库渲染；直接渲染骨架占位，
  // 避免 build 抢占集群 PG 连接。运行时（next start / 请求）才走完整数据岛读取。
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return <AgentDetailSkeleton />;
  }
  return <AgentDetailData id={id} />;
}

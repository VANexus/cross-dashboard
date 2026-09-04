import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TaskDetailClient } from "./task-detail-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TaskService, AgentService } from "@/lib/server/services";
import { getDbAsync } from "@/lib/server/db";

function TaskDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-8 w-16 skeleton rounded-md" />
        <div className="flex-1 space-y-1">
          <div className="h-7 w-64 skeleton rounded" />
          <div className="h-4 w-48 skeleton rounded" />
        </div>
      </div>
      <div className="grid gap-6 grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-3 w-16 skeleton rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-5 w-20 skeleton rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="h-4 w-24 skeleton rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="h-8 w-8 skeleton rounded-full" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-32 skeleton rounded" />
                <div className="h-3 w-48 skeleton rounded" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

async function TaskDetailData({ id }: { id: string }) {
  await getDbAsync();
  const taskService = new TaskService();
  const agentService = new AgentService();

  const task = await taskService.getById(id);
  if (!task) notFound();

  const agent = task.assignedAgents?.[0]
    ? await agentService.getById(task.assignedAgents[0])
    : undefined;

  return <TaskDetailClient task={task} agent={agent ?? undefined} />;
}

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // cache-components：async page 顶层 await params 属 uncached，若落在 AppShell
  // (Suspense 之外)会整页阻塞报 blocking-route。故 page 保持同步，把 await params
  // + DB 读取放进 <Suspense> 内的 async loader 完成。
  return (
    <Suspense fallback={<TaskDetailSkeleton />}>
      <TaskDetailLoader params={params} />
    </Suspense>
  );
}

// cache-components 要求动态路由提供至少一个真实样本供 build-time validation。
export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  return [
    { id: "task-sample-0001" },
    { id: "task-sample-0002" },
  ];
}

async function TaskDetailLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 构建校验期不连库，返回骨架；运行时才走完整数据岛读取
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return <TaskDetailSkeleton />;
  }
  return <TaskDetailData id={id} />;
}

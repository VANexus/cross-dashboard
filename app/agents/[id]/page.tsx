import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AgentDetailClient } from "./agent-detail-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AgentService, TaskService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";
import { getEntries } from "@/lib/repositories/journal.repository";
import type { Task } from "@/lib/types";

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

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<AgentDetailSkeleton />}>
      <AgentDetailData id={id} />
    </Suspense>
  );
}

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AgentDetailClient } from "./agent-detail-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const [agentRes, tasksRes, journalRes] = await Promise.all([
    fetch(`${baseUrl}/api/agents/${id}`, { cache: "no-store" }),
    fetch(`${baseUrl}/api/tasks`, { cache: "no-store" }),
    fetch(`${baseUrl}/api/agents/${id}/journal?limit=100`, { cache: "no-store" }),
  ]);
  const agentJson = await agentRes.json();
  const tasksJson = await tasksRes.json();
  const journalJson = await journalRes.json();
  if (!agentJson.data) notFound();

  // Filter tasks assigned to this agent
  const allTasks = tasksJson.data || [];
  const agentTasks = allTasks.filter((t: { assignedAgents: string[] }) =>
    t.assignedAgents?.includes(id)
  );

  return (
    <AgentDetailClient
      agent={agentJson.data}
      tasks={agentTasks}
      journal={journalJson.data || []}
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

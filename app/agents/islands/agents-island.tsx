import { backendGet } from "@/lib/backend-client";
import { AgentsClient } from "../agents-client";
import type { Agent } from "@/lib/types";

export async function AgentsIsland() {
  const res = await backendGet("/api/agents");
  const agents: Agent[] = res.data ?? [];
  return <AgentsClient initialData={agents} />;
}

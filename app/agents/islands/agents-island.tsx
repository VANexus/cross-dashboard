import { AgentsClient } from "../agents-client";
import { AgentService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";
import type { Agent } from "@/lib/types";

export async function AgentsIsland() {
  await getDbAsync();
  const service = new AgentService();
  const agents: Agent[] = service.list();
  return <AgentsClient initialData={agents} />;
}

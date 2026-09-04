import { AgentsClient } from "../agents-client";
import { AgentService } from "@/lib/server/services";
import { getDbAsync } from "@/lib/server/db";
import type { Agent } from "@/lib/shared/types";

export async function AgentsIsland() {
  await getDbAsync();
  const service = new AgentService();
  const agents: Agent[] = await service.list();
  return <AgentsClient initialData={agents} />;
}

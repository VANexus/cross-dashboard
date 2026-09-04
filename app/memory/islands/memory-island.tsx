import { MemoryClient } from "../memory-client";
import { MemoryService } from "@/lib/server/services";
import * as agentRepo from "@/lib/server/repositories/agent.repository";
import { getDbAsync } from "@/lib/server/db";
import type { MemoryEntry } from "@/lib/shared/types";

export async function MemoryIsland() {
  await getDbAsync();
  const service = new MemoryService();
  const [entries, agents, indexStats] = await Promise.all([
    service.list(),
    agentRepo.getAgents(),
    service.indexStats(),
  ]);
  const entriesData: MemoryEntry[] = entries.items;
  const agentsData = agents.map((a) => ({ id: a.id, name: a.name }));
  return <MemoryClient initialData={entriesData} agents={agentsData} indexStats={indexStats} />;
}

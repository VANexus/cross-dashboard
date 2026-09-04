import { EvolutionClient } from "../evolution-client";
import { EvolutionService } from "@/lib/server/services";
import * as agentRepo from "@/lib/server/repositories/agent.repository";
import { getDbAsync } from "@/lib/server/db";
import type { EvolutionRecord } from "@/lib/shared/types";

export async function EvolutionIsland() {
  await getDbAsync();
  const service = new EvolutionService();
  const [records, agents] = await Promise.all([service.list(), agentRepo.getAgents()]);
  const recordsData: EvolutionRecord[] = records.items;
  const agentsData = agents.map((a) => ({ id: a.id, name: a.name, type: a.type }));
  return <EvolutionClient initialData={recordsData} agents={agentsData} />;
}

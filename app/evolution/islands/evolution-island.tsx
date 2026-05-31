import { EvolutionClient } from "../evolution-client";
import { EvolutionService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";
import type { EvolutionRecord } from "@/lib/types";

export async function EvolutionIsland() {
  await getDbAsync();
  const service = new EvolutionService();
  const records: EvolutionRecord[] = service.list().items;
  return <EvolutionClient initialData={records} />;
}

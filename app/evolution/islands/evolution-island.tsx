import { backendGet } from "@/lib/backend-client";
import { EvolutionClient } from "../evolution-client";
import type { EvolutionRecord } from "@/lib/types";

export async function EvolutionIsland() {
  const res = await backendGet("/api/evolution");
  const records: EvolutionRecord[] = res.data ?? [];
  return <EvolutionClient initialData={records} />;
}

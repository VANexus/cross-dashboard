import { RiskClient } from "../risk-client";
import { RiskService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";
import type { RiskEvent } from "@/lib/types";

export async function RiskIsland() {
  await getDbAsync();
  const service = new RiskService();
  const events: RiskEvent[] = (await service.listEvents()).items;
  return <RiskClient initialEvents={events} />;
}

import { RiskClient } from "../risk-client";
import { RiskService } from "@/lib/server/services";
import { getDbAsync } from "@/lib/server/db";
import type { RiskEvent } from "@/lib/shared/types";

export async function RiskIsland() {
  await getDbAsync();
  const service = new RiskService();
  const events: RiskEvent[] = (await service.listEvents()).items;
  return <RiskClient initialEvents={events} />;
}

import { backendGet } from "@/lib/backend-client";
import { RiskClient } from "../risk-client";
import type { RiskEvent } from "@/lib/types";

export async function RiskIsland() {
  const res = await backendGet("/api/risk/events");
  const events: RiskEvent[] = res.data ?? [];
  return <RiskClient initialEvents={events} />;
}

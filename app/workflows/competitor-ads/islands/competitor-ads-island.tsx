import { backendGet } from "@/lib/backend-client";
import { CompetitorAdsClient } from "../competitor-ads-client";

export async function CompetitorAdsIsland() {
  const [keywordsRes, competitorsRes, positionsRes] = await Promise.all([
    backendGet("/api/workflows/competitor-ads/keywords"),
    backendGet("/api/workflows/competitor-ads/competitors"),
    backendGet("/api/workflows/competitor-ads/positions"),
  ]);

  return (
    <CompetitorAdsClient
      keywords={keywordsRes.data ?? { core: [], longtail: [], competitor: [] }}
      competitors={competitorsRes.data ?? []}
      adPositions={positionsRes.data ?? []}
      targetingData={[]}
    />
  );
}

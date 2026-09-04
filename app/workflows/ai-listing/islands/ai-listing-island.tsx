import { AiListingClient } from "../ai-listing-client";
import { WorkflowService } from "@/lib/server/services";
import { getDbAsync } from "@/lib/server/db";
import { getRecentListingResults } from "@/lib/server/repositories/workflow.repository";

export async function AiListingIsland() {
  await getDbAsync();
  const service = new WorkflowService();
  const recentResults = await getRecentListingResults(5);
  return (
    <AiListingClient
      infringementWords={await service.getInfringementWords()}
      categoryRecs={await service.getCategoryRecs()}
      bulletPoints={await service.getBulletPoints()}
      recentResults={recentResults}
    />
  );
}

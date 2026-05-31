import { AiListingClient } from "../ai-listing-client";
import { WorkflowService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";
import { getRecentListingResults } from "@/lib/repositories/workflow.repository";

export async function AiListingIsland() {
  await getDbAsync();
  const service = new WorkflowService();
  const recentResults = getRecentListingResults(5);
  return (
    <AiListingClient
      infringementWords={service.getInfringementWords()}
      categoryRecs={service.getCategoryRecs()}
      bulletPoints={service.getBulletPoints()}
      recentResults={recentResults}
    />
  );
}

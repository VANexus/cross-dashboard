import { ProductResearchClient } from "../product-research-client";
import { WorkflowService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";
import { getRecentResearchResults } from "@/lib/repositories/workflow.repository";

export async function ProductResearchIsland() {
  await getDbAsync();
  const service = new WorkflowService();
  const dataSources = service.getDataSources();
  const keywords = service.getProductKeywords();
  const painPoints = service.getPainPoints();
  const recentResults = getRecentResearchResults(5);

  return (
    <ProductResearchClient
      dataSources={dataSources}
      keywords={keywords}
      painPoints={painPoints}
      recentResults={recentResults}
    />
  );
}

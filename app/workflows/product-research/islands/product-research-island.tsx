import { ProductResearchClient } from "../product-research-client";
import { WorkflowService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";
import { getRecentResearchResults } from "@/lib/repositories/workflow.repository";

export async function ProductResearchIsland() {
  await getDbAsync();
  const service = new WorkflowService();
  const dataSources = await service.getDataSources();
  const keywords = await service.getProductKeywords();
  const painPoints = await service.getPainPoints();
  const recentResults = await getRecentResearchResults(5);

  return (
    <ProductResearchClient
      dataSources={dataSources}
      keywords={keywords}
      painPoints={painPoints}
      recentResults={recentResults}
    />
  );
}

import { backendGet } from "@/lib/backend-client";
import { ProductResearchClient } from "../product-research-client";

export async function ProductResearchIsland() {
  const [sourcesRes, keywordsRes, painRes] = await Promise.all([
    backendGet("/api/workflows/product-research/data-sources"),
    backendGet("/api/workflows/product-research/keywords"),
    backendGet("/api/workflows/product-research/pain-points"),
  ]);

  return (
    <ProductResearchClient
      dataSources={sourcesRes.data ?? []}
      keywords={keywordsRes.data ?? []}
      painPoints={painRes.data ?? []}
    />
  );
}

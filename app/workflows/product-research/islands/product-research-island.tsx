import { ProductResearchClient } from "../product-research-client";
import { getDbAsync } from "@/lib/server/db";
import { getRecentResearchResults } from "@/lib/server/repositories/workflow.repository";

export async function ProductResearchIsland() {
  await getDbAsync();
  // 商品/热词/评论全部由客户端实时拉 TikHub 真实数据（/api/b2b/shop-intel、content-intel）；
  // 这里只保留真实的历史 AI 分析结果，不再注入内置样本。
  const recentResults = await getRecentResearchResults(5).catch(() => []);
  return <ProductResearchClient recentResults={recentResults} />;
}

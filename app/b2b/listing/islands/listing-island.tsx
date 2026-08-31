import { connection } from "next/server";
import { getDbAsync } from "@/lib/db";
import { B2BService } from "@/lib/services";
import { B2BListingClient } from "../b2b-listing-client";

/**
 * SSR island：初次渲染走 fetchProducts（MCP 优先，失败 degraded 空态），
 * 客户端用 useB2BProducts / useListings 做实时刷新与 mutation 后同步。
 */
export async function ListingIsland() {
  await connection();
  await getDbAsync();
  const service = new B2BService();
  return (
    <B2BListingClient
      initialProducts={await service.fetchProducts({ refresh: false })}
      initialListings={await service.getListings()}
    />
  );
}

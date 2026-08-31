import { InventoryClient } from "../inventory-client";
import { WorkflowService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";

export async function InventoryIsland() {
  await getDbAsync();
  const service = new WorkflowService();
  const inventoryItems = (await service.getInventoryItems()).items;
  const restockSuggestions = await service.getRestockSuggestions();
  const recentOrders = await service.getRecentRestockOrders(5);

  return (
    <InventoryClient
      inventoryItems={inventoryItems}
      restockSuggestions={restockSuggestions}
      recentOrders={recentOrders}
    />
  );
}

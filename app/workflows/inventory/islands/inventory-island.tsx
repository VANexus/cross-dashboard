import { InventoryClient } from "../inventory-client";
import { WorkflowService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";

export async function InventoryIsland() {
  await getDbAsync();
  const service = new WorkflowService();
  const inventoryItems = service.getInventoryItems().items;
  const restockSuggestions = service.getRestockSuggestions();
  const recentOrders = service.getRecentRestockOrders(5);

  return (
    <InventoryClient
      inventoryItems={inventoryItems}
      restockSuggestions={restockSuggestions}
      recentOrders={recentOrders}
    />
  );
}

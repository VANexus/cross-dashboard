import { backendGet } from "@/lib/backend-client";
import { InventoryClient } from "../inventory-client";

export async function InventoryIsland() {
  const [inventoryRes, restockRes] = await Promise.all([
    backendGet("/api/workflows/inventory"),
    backendGet("/api/workflows/inventory/restock-suggestions"),
  ]);

  return (
    <InventoryClient
      inventoryItems={inventoryRes.data ?? []}
      restockSuggestions={restockRes.data ?? []}
    />
  );
}

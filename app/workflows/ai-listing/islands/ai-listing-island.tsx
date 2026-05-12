import { backendGet } from "@/lib/backend-client";
import { AiListingClient } from "../ai-listing-client";

export async function AiListingIsland() {
  const [infringementRes, categoriesRes, bulletsRes] = await Promise.all([
    backendGet("/api/workflows/ai-listing/infringement"),
    backendGet("/api/workflows/ai-listing/categories"),
    backendGet("/api/workflows/ai-listing/bullets"),
  ]);

  return (
    <AiListingClient
      infringementWords={infringementRes.data ?? []}
      categoryRecs={categoriesRes.data ?? []}
      bulletPoints={bulletsRes.data ?? []}
    />
  );
}

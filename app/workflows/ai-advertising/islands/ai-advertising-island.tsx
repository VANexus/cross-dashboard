import { backendGet } from "@/lib/backend-client";
import { AiAdvertisingClient } from "../ai-advertising-client";

export async function AiAdvertisingIsland() {
  const keywordsRes = await backendGet("/api/workflows/ai-advertising/keywords");

  return (
    <AiAdvertisingClient
      adKeywords={keywordsRes.data ?? []}
    />
  );
}

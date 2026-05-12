import { backendGet } from "@/lib/backend-client";
import { MemoryClient } from "../memory-client";
import type { MemoryEntry } from "@/lib/types";

export async function MemoryIsland() {
  const res = await backendGet("/api/memory");
  const entries: MemoryEntry[] = res.data ?? [];
  return <MemoryClient initialData={entries} />;
}

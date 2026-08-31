import { MemoryClient } from "../memory-client";
import { MemoryService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";
import type { MemoryEntry } from "@/lib/types";

export async function MemoryIsland() {
  await getDbAsync();
  const service = new MemoryService();
  const entries: MemoryEntry[] = (await service.list()).items;
  return <MemoryClient initialData={entries} />;
}

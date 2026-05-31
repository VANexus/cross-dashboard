"use client";

import { useFetch } from "./use-fetch";
import type { JournalEntry, Pagination } from "@/lib/types";

export function useAgentJournal(agentId: string | null, limit = 50) {
  return useFetch<JournalEntry[]>(
    agentId ? `/api/agents/${agentId}/journal?limit=${limit}` : null
  );
}

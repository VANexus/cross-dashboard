import { getSupabase } from "../db";
import type { JournalEntry } from "../types";
import { parseJsonField } from "./base";

interface JournalRow {
  id: string;
  agent_id: string;
  type: string;
  content: string;
  context: string;
  mood_at: string | null;
  created_at: string;
}

function mapJournal(row: JournalRow): JournalEntry {
  return {
    id: row.id,
    agentId: row.agent_id,
    type: row.type as JournalEntry["type"],
    content: row.content,
    context: parseJsonField<Record<string, unknown>>(row.context, {}),
    moodAt: row.mood_at ?? "",
    createdAt: row.created_at,
  };
}

export async function addEntry(data: {
  agentId: string;
  type: JournalEntry["type"];
  content: string;
  context?: Record<string, unknown>;
  moodAt?: string;
}): Promise<JournalEntry> {
  const sb = getSupabase();
  const id = `jnl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const row: JournalRow = {
    id,
    agent_id: data.agentId,
    type: data.type,
    content: data.content,
    context: JSON.stringify(data.context ?? {}),
    mood_at: data.moodAt ?? null,
    created_at: now,
  };
  await sb.from("agent_journal").insert(row);
  return {
    id,
    agentId: data.agentId,
    type: data.type,
    content: data.content,
    context: data.context ?? {},
    moodAt: data.moodAt ?? "",
    createdAt: now,
  };
}

export async function getEntries(agentId: string, limit = 50, offset = 0): Promise<JournalEntry[]> {
  const sb = getSupabase();
  const { data } = await sb
    .from("agent_journal")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  return ((data ?? []) as JournalRow[]).map(mapJournal);
}

export async function getLatestEntry(agentId: string): Promise<JournalEntry | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("agent_journal")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as JournalRow | null;
  return row ? mapJournal(row) : null;
}

export async function getEntryCount(agentId: string): Promise<number> {
  const sb = getSupabase();
  const { count } = await sb
    .from("agent_journal")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", agentId);
  return count ?? 0;
}

/**
 * FlowMind RAK — Journal Repository
 * Data access for agent journal entries (thoughts, decisions, observations, reflections)
 */
import { getDb } from "../db";
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

export function addEntry(data: {
  agentId: string;
  type: JournalEntry["type"];
  content: string;
  context?: Record<string, unknown>;
  moodAt?: string;
}): JournalEntry {
  const db = getDb();
  const id = `jnl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  db.run(
    `INSERT INTO agent_journal (id, agent_id, type, content, context, mood_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.agentId, data.type, data.content,
    JSON.stringify(data.context ?? {}),
    data.moodAt ?? null],
  );
  return {
    id,
    agentId: data.agentId,
    type: data.type,
    content: data.content,
    context: data.context ?? {},
    moodAt: data.moodAt ?? "",
    createdAt: new Date().toISOString(),
  };
}

export function getEntries(agentId: string, limit = 50, offset = 0): JournalEntry[] {
  const db = getDb();
  const rows = db.query(
    "SELECT * FROM agent_journal WHERE agent_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
  ).all(agentId, limit, offset) as JournalRow[];
  return rows.map(mapJournal);
}

export function getLatestEntry(agentId: string): JournalEntry | null {
  const db = getDb();
  const row = db.query(
    "SELECT * FROM agent_journal WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1"
  ).get(agentId) as JournalRow | null;
  return row ? mapJournal(row) : null;
}

export function getEntryCount(agentId: string): number {
  const db = getDb();
  return (db.query("SELECT COUNT(*) as c FROM agent_journal WHERE agent_id = ?").get(agentId) as { c: number }).c;
}

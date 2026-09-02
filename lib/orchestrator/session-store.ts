/**
 * FlowMind AI Orchestrator — Session Store
 * 编排会话持久化（Supabase orchestrator_sessions 表）。
 * 消息格式为 AI SDK UIMessage（与 /api/agent/chat 的 useChat 协议对齐），整体存 JSONB。
 */

import type { UIMessage } from "ai";
import { getSupabase } from "../db";

export type StoredMessage = UIMessage;

export interface OrchestratorSession {
  id: string;
  title: string;
  messages: StoredMessage[];
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: Record<string, unknown>): OrchestratorSession {
  return {
    id: row.id as string,
    title: (row.title as string) || "新会话",
    messages: (row.messages as StoredMessage[]) ?? [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listSessions(limit = 30): Promise<OrchestratorSession[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("orchestrator_sessions")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function getSession(id: string): Promise<OrchestratorSession | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("orchestrator_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data) : null;
}

function deriveTitle(messages: StoredMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  const text = firstUser?.parts.find((p) => p.type === "text")?.text?.trim();
  return text?.slice(0, 20) || "新会话";
}

export async function createSession(messages: StoredMessage[] = []): Promise<OrchestratorSession> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("orchestrator_sessions")
    .insert({ title: deriveTitle(messages), messages })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

/** 全量覆盖保存（消息总数有限，覆盖比增量追加简单可靠） */
export async function updateSession(
  id: string,
  messages: StoredMessage[],
): Promise<OrchestratorSession | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("orchestrator_sessions")
    .update({ messages, title: deriveTitle(messages), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data ? mapRow(data) : null;
}

export async function deleteSession(id: string): Promise<boolean> {
  const sb = getSupabase();
  const { error, count } = await sb
    .from("orchestrator_sessions")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

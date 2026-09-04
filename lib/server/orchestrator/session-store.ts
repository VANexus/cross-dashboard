/**
 * FlowMind AI Orchestrator — Session Store
 * 编排会话持久化（集群 PostgreSQL orchestrator_sessions 表）。
 * 消息格式为 AI SDK UIMessage（与 /api/agent/chat 的 useChat 协议对齐），整体存 JSONB。
 */

import type { UIMessage } from "ai";
import type { Prisma } from "@prisma/client";
import { prisma, isoRow, isoRows } from "../db";

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
  const rows = await prisma.orchestrator_sessions.findMany({
    orderBy: { updated_at: "desc" },
    take: limit,
  });
  return isoRows(rows).map((row) => mapRow(row));
}

export async function getSession(id: string): Promise<OrchestratorSession | null> {
  const row = await prisma.orchestrator_sessions.findUnique({ where: { id } });
  return row ? mapRow(isoRow(row)) : null;
}

function deriveTitle(messages: StoredMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  const text = firstUser?.parts.find((p) => p.type === "text")?.text?.trim();
  return text?.slice(0, 20) || "新会话";
}

export async function createSession(messages: StoredMessage[] = []): Promise<OrchestratorSession> {
  const row = await prisma.orchestrator_sessions.create({
    data: {
      title: deriveTitle(messages),
      // messages 列为 Json（JSONB）：直接传对象，读回即对象（无需 stringify/parse）
      messages: messages as unknown as Prisma.InputJsonValue,
    },
  });
  return mapRow(isoRow(row));
}

/** 全量覆盖保存（消息总数有限，覆盖比增量追加简单可靠） */
export async function updateSession(
  id: string,
  messages: StoredMessage[],
): Promise<OrchestratorSession | null> {
  try {
    const row = await prisma.orchestrator_sessions.update({
      where: { id },
      data: {
        messages: messages as unknown as Prisma.InputJsonValue,
        title: deriveTitle(messages),
        updated_at: new Date().toISOString(),
      },
    });
    return mapRow(isoRow(row));
  } catch (e) {
    // 旧 SQL UPDATE...RETURNING 无匹配行时返回空 → null；Prisma update 则抛 P2025
    if ((e as { code?: string }).code === "P2025") return null;
    throw e;
  }
}

export async function deleteSession(id: string): Promise<boolean> {
  const { count } = await prisma.orchestrator_sessions.deleteMany({ where: { id } });
  return count > 0;
}

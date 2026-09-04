/**
 * FlowMind — Conversation Service（AI 对话历史持久化）
 *
 * AI-Native 升级：对话不再一次性。会话落 PG（conversations + conversation_messages），
 * 支持新建/列表/切换/恢复/删除，为记忆与自进化融合提供对话语料源。
 * 直接走 postgres.js tagged template（免 prisma generate）。
 */
import { db } from "@/lib/server/db/pg";

export interface ConversationSummary {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  parts: string;
  created_at: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessage[];
}

function now(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export class ConversationService {
  /** 会话列表（按更新时间倒序）。 */
  async list(limit = 50): Promise<ConversationSummary[]> {
    return await db<ConversationSummary[]>`
      SELECT id, title, message_count, created_at, updated_at
      FROM conversations
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;
  }

  /** 新建会话。 */
  async create(title = "新对话"): Promise<ConversationSummary> {
    const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const t = now();
    await db`
      INSERT INTO conversations (id, title, message_count, created_at, updated_at)
      VALUES (${id}, ${title}, 0, ${t}, ${t})
    `;
    return { id, title, message_count: 0, created_at: t, updated_at: t };
  }

  /** 会话详情（含消息，时间正序）。 */
  async get(id: string): Promise<ConversationDetail | null> {
    const [conv] = await db`
      SELECT id, title, message_count, created_at, updated_at
      FROM conversations WHERE id = ${id}
    `;
    if (!conv) return null;
    const messages = await db<ConversationMessage[]>`
      SELECT id, conversation_id, role, content, parts, created_at
      FROM conversation_messages WHERE conversation_id = ${id}
      ORDER BY created_at ASC, id ASC
    `;
    return { ...(conv as unknown as ConversationSummary), messages } as ConversationDetail;
  }

  /** 追加一条消息（用户/助手），并回写会话 message_count / updated_at。 */
  async appendMessage(conversationId: string, msg: { role: string; content: string; parts?: unknown }): Promise<ConversationMessage> {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const t = now();
    const parts = msg.parts ? JSON.stringify(msg.parts) : "[]";
    const rows = await db<ConversationMessage[]>`
      INSERT INTO conversation_messages (id, conversation_id, role, content, parts, created_at)
      VALUES (${id}, ${conversationId}, ${msg.role}, ${msg.content}, ${parts}, ${t})
      RETURNING id, conversation_id, role, content, parts, created_at
    `;
    await db`
      UPDATE conversations
      SET message_count = message_count + 1, updated_at = ${t}
      WHERE id = ${conversationId}
    `;
    return rows[0];
  }

  /** 会话首条用户消息 → 自动生成标题（取前 N 字，避免长标题）。 */
  async ensureTitle(conversationId: string, firstUserText: string): Promise<void> {
    const title = firstUserText.replace(/\s+/g, " ").trim().slice(0, 24) || "新对话";
    await db`
      UPDATE conversations SET title = ${title} WHERE id = ${conversationId} AND title = '新对话'
    `;
  }

  /** 删除会话（级联删消息）。 */
  async delete(id: string): Promise<boolean> {
    const res = await db`
      DELETE FROM conversations WHERE id = ${id}
    `;
    return res.count > 0;
  }
}

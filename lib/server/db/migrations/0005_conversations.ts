/**
 * FlowMind — 0005: AI 对话历史（会话持久化 + 恢复）
 *
 * AI-Native 升级：对话不再一次性——每轮对话落库，可新建/切换/恢复历史会话。
 * 同时为记忆/自进化融合提供对话语料源。
 * 幂等：IF NOT EXISTS。
 */
export const CONVERSATIONS_SQL = `
CREATE TABLE IF NOT EXISTS conversations (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL DEFAULT '新对话',
  message_count INT  NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at    TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL DEFAULT '',
  parts           TEXT NOT NULL DEFAULT '[]',
  created_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated
  ON conversations(updated_at desc);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_cid
  ON conversation_messages(conversation_id, created_at asc);
`;

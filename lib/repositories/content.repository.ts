/**
 * FlowMind — 内容创作中心 Repository
 * 数据访问层：wf_content_drafts / wf_content_ideas / wf_content_hot_topics / wf_content_rules
 */
import { getDb } from "../db";
import type {
  AuditFinding, ContentDraftStatus, ContentIdea, ContentPlatform,
  CopyDraft, HotTopic,
} from "../types";
import { parseJsonField } from "./base";

// ── wf_content_drafts ──

interface DraftRow {
  id: string;
  platform: string;
  title: string;
  body: string;
  tags: string;
  status: string;
  audit_passed: number;
  audit_result: string;
  image_count: number;
  created_at: string;
  updated_at: string;
}

function rowToDraft(r: DraftRow): CopyDraft {
  return {
    id: r.id,
    platform: r.platform as ContentPlatform,
    title: r.title,
    body: r.body,
    tags: parseJsonField<string[]>(r.tags, []),
    status: r.status as ContentDraftStatus,
    auditPassed: r.audit_passed === 1,
    auditResult: r.audit_result ? (parseJsonField<AuditFinding[] | null>(r.audit_result, null) ?? null) : null,
    imageCount: r.image_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function insertDraft(draft: {
  id: string;
  platform: ContentPlatform;
  title: string;
  body: string;
  tags: string[];
}): void {
  const db = getDb();
  db.run(
    `INSERT OR IGNORE INTO wf_content_drafts
      (id, platform, title, body, tags, status)
     VALUES (?, ?, ?, ?, ?, 'draft')`,
    [draft.id, draft.platform, draft.title, draft.body, JSON.stringify(draft.tags)] as unknown[],
  );
}

export function getDrafts(limit = 50): CopyDraft[] {
  const db = getDb();
  const rows = db.query(
    "SELECT * FROM wf_content_drafts ORDER BY created_at DESC, rowid DESC LIMIT ?",
  ).all(limit) as unknown as DraftRow[];
  return rows.map(rowToDraft);
}

export function getDraft(id: string): CopyDraft | null {
  const db = getDb();
  const row = db.query("SELECT * FROM wf_content_drafts WHERE id = ?").get(id) as unknown as DraftRow | undefined;
  return row ? rowToDraft(row) : null;
}

export function updateDraft(
  id: string,
  data: {
    title?: string;
    body?: string;
    tags?: string[];
    status?: ContentDraftStatus;
    auditPassed?: boolean;
    auditResult?: AuditFinding[] | null;
    imageCount?: number;
  },
): void {
  const db = getDb();
  const sets: string[] = ["updated_at = datetime('now')"];
  const params: unknown[] = [];
  if (data.title !== undefined) { sets.push("title = ?"); params.push(data.title); }
  if (data.body !== undefined) { sets.push("body = ?"); params.push(data.body); }
  if (data.tags !== undefined) { sets.push("tags = ?"); params.push(JSON.stringify(data.tags)); }
  if (data.status !== undefined) { sets.push("status = ?"); params.push(data.status); }
  if (data.auditPassed !== undefined) { sets.push("audit_passed = ?"); params.push(data.auditPassed ? 1 : 0); }
  if (data.auditResult !== undefined) { sets.push("audit_result = ?"); params.push(JSON.stringify(data.auditResult)); }
  if (data.imageCount !== undefined) { sets.push("image_count = ?"); params.push(data.imageCount); }
  if (sets.length === 1) return;
  params.push(id);
  db.run(`UPDATE wf_content_drafts SET ${sets.join(", ")} WHERE id = ?`, params as unknown[]);
}

export function deleteDraft(id: string): boolean {
  const db = getDb();
  const before = db.query("SELECT id FROM wf_content_drafts WHERE id = ?").get(id);
  if (!before) return false;
  db.run("DELETE FROM wf_content_drafts WHERE id = ?", [id] as unknown[]);
  return true;
}

// ── wf_content_ideas ──

export function insertIdea(idea: { id: string; platform: ContentPlatform; angle: string; title: string; subject: string }): void {
  const db = getDb();
  db.run(
    "INSERT OR IGNORE INTO wf_content_ideas (id, platform, angle, title, subject) VALUES (?, ?, ?, ?, ?)",
    [idea.id, idea.platform, idea.angle, idea.title, idea.subject] as unknown[],
  );
}

export function getIdeas(platform?: ContentPlatform, limit = 20): ContentIdea[] {
  const db = getDb();
  const rows = platform
    ? db.query("SELECT * FROM wf_content_ideas WHERE platform = ? ORDER BY created_at DESC, rowid DESC LIMIT ?").all(platform, limit)
    : db.query("SELECT * FROM wf_content_ideas ORDER BY created_at DESC, rowid DESC LIMIT ?").all(limit);
  return (rows as Array<{
    id: string; platform: string; angle: string; title: string; subject: string; created_at: string;
  }>).map((r) => ({
    id: r.id,
    platform: r.platform as ContentPlatform,
    angle: r.angle,
    title: r.title,
    subject: r.subject,
    createdAt: r.created_at,
  }));
}

// ── wf_content_hot_topics ──

export function clearHotTopics(platform: ContentPlatform): void {
  const db = getDb();
  db.run("DELETE FROM wf_content_hot_topics WHERE platform = ?", [platform] as unknown[]);
}

export function insertHotTopic(t: { id: string; platform: ContentPlatform; word: string; heat: number; delta: number | null; url: string; source: string }): void {
  const db = getDb();
  db.run(
    `INSERT OR IGNORE INTO wf_content_hot_topics (id, platform, word, heat, delta, url, source, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [t.id, t.platform, t.word, t.heat, t.delta, t.url, t.source] as unknown[],
  );
}

export function getHotTopics(platform: ContentPlatform, limit = 20): HotTopic[] {
  const db = getDb();
  const rows = db.query(
    `SELECT word, heat, delta, url, source FROM wf_content_hot_topics
     WHERE platform = ? ORDER BY heat DESC LIMIT ?`,
  ).all(platform, limit) as Array<{ word: string; heat: number; delta: number | null; url: string; source: string }>;
  return rows.map((r) => ({
    word: r.word,
    heat: r.heat,
    delta: r.delta,
    url: r.url,
    source: r.source,
  }));
}

// ── wf_content_rules（展示用）──

export interface RuleRow {
  id: string;
  platform: string;
  category: string;
  severity: string;
  pattern: string;
  label: string;
  suggestion: string;
  enabled: number;
}

export function getRulesByPlatform(platform?: ContentPlatform): RuleRow[] {
  const db = getDb();
  const rows = platform
    ? db.query("SELECT * FROM wf_content_rules WHERE (platform = ? OR platform = '*') AND enabled = 1 ORDER BY severity, id").all(platform)
    : db.query("SELECT * FROM wf_content_rules WHERE enabled = 1 ORDER BY severity, id").all();
  return rows as unknown as RuleRow[];
}

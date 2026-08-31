/**
 * FlowMind — 内容创作中心 Repository
 * 数据访问层：wf_content_drafts / wf_content_ideas / wf_content_hot_topics / wf_content_rules
 */
import { getSupabase } from "../db";
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
    auditPassed: !!r.audit_passed,
    auditResult: r.audit_result ? (parseJsonField<AuditFinding[] | null>(r.audit_result, null) ?? null) : null,
    imageCount: r.image_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function insertDraft(draft: {
  id: string;
  platform: ContentPlatform;
  title: string;
  body: string;
  tags: string[];
}): Promise<void> {
  const sb = getSupabase();
  const row = {
    id: draft.id,
    platform: draft.platform,
    title: draft.title,
    body: draft.body,
    tags: JSON.stringify(draft.tags),
    status: "draft",
  };
  const { error } = await sb.from("wf_content_drafts").upsert(row, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function getDrafts(limit = 50): Promise<CopyDraft[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("wf_content_drafts")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as DraftRow[]).map(rowToDraft);
}

export async function getDraft(id: string): Promise<CopyDraft | null> {
  const sb = getSupabase();
  const { data, error } = await sb.from("wf_content_drafts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  const row = data as DraftRow | null;
  return row ? rowToDraft(row) : null;
}

export async function updateDraft(
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
): Promise<void> {
  const sb = getSupabase();
  const sets: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) sets["title"] = data.title;
  if (data.body !== undefined) sets["body"] = data.body;
  if (data.tags !== undefined) sets["tags"] = JSON.stringify(data.tags);
  if (data.status !== undefined) sets["status"] = data.status;
  if (data.auditPassed !== undefined) sets["audit_passed"] = data.auditPassed ? 1 : 0;
  if (data.auditResult !== undefined) sets["audit_result"] = JSON.stringify(data.auditResult);
  if (data.imageCount !== undefined) sets["image_count"] = data.imageCount;
  if (Object.keys(sets).length === 1) return;
  const { error } = await sb.from("wf_content_drafts").update(sets).eq("id", id);
  if (error) throw error;
}

export async function deleteDraft(id: string): Promise<boolean> {
  const sb = getSupabase();
  const { data: before, error: qError } = await sb.from("wf_content_drafts").select("id").eq("id", id).maybeSingle();
  if (qError) throw qError;
  if (!before) return false;
  const { error } = await sb.from("wf_content_drafts").delete().eq("id", id);
  if (error) throw error;
  return true;
}

// ── wf_content_ideas ──

export async function insertIdea(idea: { id: string; platform: ContentPlatform; angle: string; title: string; subject: string }): Promise<void> {
  const sb = getSupabase();
  const row = {
    id: idea.id,
    platform: idea.platform,
    angle: idea.angle,
    title: idea.title,
    subject: idea.subject,
  };
  const { error } = await sb.from("wf_content_ideas").upsert(row, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function getIdeas(platform?: ContentPlatform, limit = 20): Promise<ContentIdea[]> {
  const sb = getSupabase();
  let query = sb
    .from("wf_content_ideas")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (platform) query = query.eq("platform", platform);
  const { data, error } = await query;
  if (error) throw error;
  return (data as Array<{
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

export async function clearHotTopics(platform: ContentPlatform): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("wf_content_hot_topics").delete().eq("platform", platform);
  if (error) throw error;
}

export async function insertHotTopic(t: { id: string; platform: ContentPlatform; word: string; heat: number; delta: number | null; url: string; source: string }): Promise<void> {
  const sb = getSupabase();
  const row = {
    id: t.id,
    platform: t.platform,
    word: t.word,
    heat: t.heat,
    delta: t.delta,
    url: t.url,
    source: t.source,
    fetched_at: new Date().toISOString(),
  };
  const { error } = await sb.from("wf_content_hot_topics").upsert(row, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function getHotTopics(platform: ContentPlatform, limit = 20): Promise<HotTopic[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("wf_content_hot_topics")
    .select("word, heat, delta, url, source")
    .eq("platform", platform)
    .order("heat", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Array<{ word: string; heat: number; delta: number | null; url: string; source: string }>).map((r) => ({
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

export async function getRulesByPlatform(platform?: ContentPlatform): Promise<RuleRow[]> {
  const sb = getSupabase();
  const query = sb
    .from("wf_content_rules")
    .select("*")
    .eq("enabled", 1)
    .order("severity", { ascending: true })
    .order("id", { ascending: true });
  if (platform) {
    const { data: dataPlatform, error: ep } = await sb
      .from("wf_content_rules")
      .select("*")
      .eq("enabled", 1)
      .or(`platform.eq.${platform},platform.eq.*`)
      .order("severity", { ascending: true })
      .order("id", { ascending: true });
    if (ep) throw ep;
    return dataPlatform as unknown as RuleRow[];
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as RuleRow[];
}

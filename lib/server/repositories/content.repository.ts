/**
 * FlowMind — 内容创作中心 Repository
 * 数据访问层：wf_content_drafts / wf_content_ideas / wf_content_hot_topics / wf_content_rules
 */
import { prisma } from "@/lib/server/db";
import type {
  AuditFinding, ContentDraftStatus, ContentIdea, ContentPlatform,
  CopyDraft, HotTopic,
} from "@/lib/shared/types";
import { ignoreNotFound, parseJsonField } from "./base";

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
  // 原 upsert ignoreDuplicates: true → ON CONFLICT DO NOTHING
  await prisma.wf_content_drafts.createMany({
    data: {
      id: draft.id,
      platform: draft.platform,
      title: draft.title,
      body: draft.body,
      tags: JSON.stringify(draft.tags),
      status: "draft",
    },
    skipDuplicates: true,
  });
}

export async function getDrafts(limit = 50): Promise<CopyDraft[]> {
  const rows = await prisma.wf_content_drafts.findMany({
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: limit,
  });
  return (rows as unknown as DraftRow[]).map(rowToDraft);
}

export async function getDraft(id: string): Promise<CopyDraft | null> {
  const row = await prisma.wf_content_drafts.findUnique({ where: { id } });
  return row ? rowToDraft(row as unknown as DraftRow) : null;
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
  const sets: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) sets["title"] = data.title;
  if (data.body !== undefined) sets["body"] = data.body;
  if (data.tags !== undefined) sets["tags"] = JSON.stringify(data.tags);
  if (data.status !== undefined) sets["status"] = data.status;
  if (data.auditPassed !== undefined) sets["audit_passed"] = data.auditPassed ? 1 : 0;
  if (data.auditResult !== undefined) sets["audit_result"] = JSON.stringify(data.auditResult);
  if (data.imageCount !== undefined) sets["image_count"] = data.imageCount;
  if (Object.keys(sets).length === 1) return;
  await ignoreNotFound(() => prisma.wf_content_drafts.update({ where: { id }, data: sets }));
}

export async function deleteDraft(id: string): Promise<boolean> {
  const { count } = await prisma.wf_content_drafts.deleteMany({ where: { id } });
  return count > 0;
}

// ── wf_content_ideas ──

export async function insertIdea(idea: { id: string; platform: ContentPlatform; angle: string; title: string; subject: string }): Promise<void> {
  await prisma.wf_content_ideas.createMany({
    data: {
      id: idea.id,
      platform: idea.platform,
      angle: idea.angle,
      title: idea.title,
      subject: idea.subject,
    },
    skipDuplicates: true,
  });
}

export async function getIdeas(platform?: ContentPlatform, limit = 20): Promise<ContentIdea[]> {
  const rows = await prisma.wf_content_ideas.findMany({
    where: platform ? { platform } : {},
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: limit,
  });
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

export async function clearHotTopics(platform: ContentPlatform): Promise<void> {
  await prisma.wf_content_hot_topics.deleteMany({ where: { platform } });
}

export async function insertHotTopic(t: { id: string; platform: ContentPlatform; word: string; heat: number; delta: number | null; url: string; source: string }): Promise<void> {
  await prisma.wf_content_hot_topics.createMany({
    data: {
      id: t.id,
      platform: t.platform,
      word: t.word,
      heat: t.heat,
      delta: t.delta,
      url: t.url,
      source: t.source,
      fetched_at: new Date().toISOString(),
    },
    skipDuplicates: true,
  });
}

export async function getHotTopics(platform: ContentPlatform, limit = 20): Promise<HotTopic[]> {
  const rows = await prisma.wf_content_hot_topics.findMany({
    where: { platform },
    select: { word: true, heat: true, delta: true, url: true, source: true },
    orderBy: { heat: "desc" },
    take: limit,
  });
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

export async function getRulesByPlatform(platform?: ContentPlatform): Promise<RuleRow[]> {
  const where: Record<string, unknown> = { enabled: 1 };
  if (platform) {
    where.OR = [{ platform }, { platform: "*" }];
  }
  const rows = await prisma.wf_content_rules.findMany({
    where,
    orderBy: [{ severity: "asc" }, { id: "asc" }],
  });
  return rows as unknown as RuleRow[];
}

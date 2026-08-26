/**
 * FlowMind — 通用意图路由器（服务发现plus）
 *
 * 替换 lib/a2a/skills.ts 中硬编码的 INTENT_KEYWORDS（9 类关键词表）。
 *
 * 核心转变：
 *   旧：前端硬编码 9 类关键词 → 匹配 AgentCard.skills
 *   新：从 discovered skills 的 name/description/tags 动态提取词表 → 匹配
 *
 * 这样接入任意后端时，意图路由自动适应该后端实际暴露的技能，
 * 无需手工维护关键词表。
 */
import type { DiscoveredSkill, IntentMatch } from "./types";

/** 停用词（中英文），匹配时忽略 */
const STOP_WORDS = new Set([
  "的", "了", "和", "是", "在", "我", "有", "与", "及", "或",
  "the", "a", "an", "and", "or", "of", "to", "in", "for", "on", "with",
  "is", "are", "do", "does", "will", "can",
]);

/** 从 discovered skills 动态构建倒排索引 */
function buildSkillIndex(skills: DiscoveredSkill[]): Map<string, DiscoveredSkill[]> {
  const index = new Map<string, DiscoveredSkill[]>();

  for (const skill of skills) {
    const tokens = tokenizeSkill(skill);
    for (const token of tokens) {
      const existing = index.get(token) ?? [];
      if (!existing.includes(skill)) {
        existing.push(skill);
        index.set(token, existing);
      }
    }
  }

  return index;
}

/** 把技能 tokenize 为可匹配词集合 */
function tokenizeSkill(skill: DiscoveredSkill): Set<string> {
  const tokens = new Set<string>();

  // 1. id 按 _ 分词（content_copywrite → content, copywrite）
  for (const part of skill.id.split(/[_\-\s.]+/)) {
    if (part.length > 1) tokens.add(part.toLowerCase());
  }

  // 2. name 分词
  for (const word of skill.name.split(/[_\-\s/,，、()（）]+/)) {
    const w = word.trim().toLowerCase();
    if (w.length > 1 && !STOP_WORDS.has(w)) tokens.add(w);
  }

  // 3. description 分词（中英文分别处理）
  const desc = skill.description ?? "";
  // 英文单词
  const englishWords = desc.toLowerCase().match(/[a-z]{2,}/g) ?? [];
  for (const w of englishWords) {
    if (!STOP_WORDS.has(w)) tokens.add(w);
  }
  // 中文单字/双字（简单二元分词）
  const chinese = desc.match(/一-龥]+/g) ?? [];
  for (const segment of chinese) {
    // 整段（如果够短）
    if (segment.length <= 6) tokens.add(segment);
    // 二元分词
    for (let i = 0; i < segment.length - 1; i++) {
      tokens.add(segment.slice(i, i + 2));
    }
  }

  // 4. tags 直接加入
  for (const tag of skill.tags ?? []) {
    tokens.add(tag.toLowerCase());
  }

  return tokens;
}

/** 对查询意图做分词 */
function tokenizeQuery(query: string): string[] {
  const tokens: string[] = [];
  const lower = query.toLowerCase();

  // 英文单词
  const englishWords = lower.match(/[a-z]{2,}/g) ?? [];
  for (const w of englishWords) {
    if (!STOP_WORDS.has(w)) tokens.push(w);
  }

  // 中文：整句 + 二元分词
  const chinese = query.match(/[一-龥]+/g) ?? [];
  for (const segment of chinese) {
    if (segment.length >= 2) tokens.push(segment);
    for (let i = 0; i < segment.length - 1; i++) {
      tokens.push(segment.slice(i, i + 2));
    }
  }

  return tokens;
}

/**
 * 路由用户意图到 discovered skills。
 * 返回按置信度排序的匹配列表。
 *
 * @param intent  用户自然语言输入
 * @param skills  从 ServiceRegistry.getAllSkills() 获取的技能列表
 * @param limit   返回上限（默认 5）
 */
export function routeIntent(
  intent: string,
  skills: DiscoveredSkill[],
  limit = 5,
): IntentMatch[] {
  if (!intent.trim() || !skills.length) return [];

  const index = buildSkillIndex(skills);
  const queryTokens = tokenizeQuery(intent);

  // 每个技能的匹配得分
  const scores = new Map<string, { skill: DiscoveredSkill; hits: Set<string>; totalWeight: number }>();

  for (const token of queryTokens) {
    const matched = index.get(token);
    if (!matched) continue;

    for (const skill of matched) {
      const entry = scores.get(skill.id) ?? {
        skill,
        hits: new Set<string>(),
        totalWeight: 0,
      };
      entry.hits.add(token);
      // 权重：tag 匹配 > id 匹配 > name 匹配 > description 匹配
      const weight = computeTokenWeight(token, skill);
      entry.totalWeight += weight;
      scores.set(skill.id, entry);
    }
  }

  // 归一化置信度并排序
  const results: IntentMatch[] = [];
  for (const { skill, hits, totalWeight } of scores.values()) {
    // 覆盖率 = 查询词被匹配的比例
    const coverage = queryTokens.length > 0 ? hits.size / queryTokens.length : 0;
    // 置信度 = 加权覆盖率（上限 1）
    const confidence = Math.min(totalWeight * coverage, 1);

    if (confidence > 0.05) {
      results.push({
        skill,
        confidence,
        matchedKeywords: [...hits],
      });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}

/** 计算单个 token 对某技能的匹配权重 */
function computeTokenWeight(token: string, skill: DiscoveredSkill): number {
  const lower = token.toLowerCase();

  // tag 精确匹配（最高权重）
  if (skill.tags.some((t) => t.toLowerCase() === lower)) return 0.5;

  // id 匹配
  if (skill.id.toLowerCase().includes(lower)) return 0.4;

  // name 匹配
  if (skill.name.toLowerCase().includes(lower)) return 0.3;

  // description 匹配（最低）
  if ((skill.description ?? "").toLowerCase().includes(lower)) return 0.15;

  return 0.1;
}

/**
 * 查找单个技能（按 id）。
 * 替代 lib/a2a/skills.ts 的 findSkillById。
 */
export function findSkill(
  skills: DiscoveredSkill[],
  skillId: string,
): DiscoveredSkill | undefined {
  return skills.find((s) => s.id === skillId);
}

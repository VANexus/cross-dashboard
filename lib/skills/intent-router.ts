/**
 * FlowMind — 基于真实发现技能的意图路由器
 *
 * 用后端 REST 发现的 DiscoveredSkill[] 取代 lib/a2a/skills.ts 中硬编码的
 * INTENT_KEYWORDS，按 token 重叠度对用户意图做评分路由。
 *
 * 设计原则：
 *   - 纯函数、无 React、无 lib/a2a 耦合，便于单元测试。
 *   - 评分基于「用户意图被技能覆盖的程度」（containment），
 *     所以技能描述再长也不会虚增置信度——只看意图里的词命中了多少。
 *
 * 评分启发式（scoreIntent）：
 *   1. 把意图文本 tokenize（中文按单字、英文按 alnum 词，小写）。
 *   2. 把技能的 name / description / tags 分别 tokenize 成三个词集合。
 *   3. 对意图中的每个 token，按「名称命中 > 标签命中 > 描述命中」取最高权重
 *        （名称 1.0、标签 0.8、描述 0.4），未命中 0。
 *   4. 置信度 = 加权命中之和 / 意图 token 数，钳到 [0, 1]。
 *   5. 路由时过滤掉 confidence <= 0.05 的技能，按置信度降序返回。
 */
import type { DiscoveredSkill, JSONSchema } from "./types";

// ── 路由结果类型（与 lib/a2a/types.ts 的 SkillRoute 解耦，避免反向依赖） ──

/** 单条意图路由结果 */
export interface SkillRoute {
  skillId: string;
  skillName: string;
  confidence: number;
  description: string;
  tags: string[];
  /** 技能入参提示：input_schema 的 title，或首个必填字段名 */
  inputHint: string;
}

// ── 字段命中权重 ──

const WEIGHT_NAME = 1.0;
const WEIGHT_TAG = 0.8;
const WEIGHT_DESC = 0.4;

// ── 分词 ──

/**
 * 把文本拆成小写 token（单遍扫描）。
 * - 英文/数字：按 alnum 连续段切分，过滤单字符噪音（如 "a"）。
 * - 中文：按单字切分（无分词器下的合理基线；单字覆盖对短意图已够用）。
 * 正则同时匹配 alnum 词与单字 CJK，因此 "generate广告copy" 也能正确拆成
 * ["generate", "广", "告", "copy"]，不会丢失嵌入的英文词。
 */
function tokenize(text: string): string[] {
  if (!text) return [];
  const matches = text.toLowerCase().match(/[a-z0-9]+|[一-鿿]/g);
  if (!matches) return [];
  return matches.filter((t) => t.length > 1 || /[一-鿿]/.test(t));
}

// ── 公开评分函数（可单元测试） ──

/**
 * 计算意图与单个技能的匹配置信度（0..1）。
 * 基于意图 token 被技能 name/description/tags 覆盖的加权程度。
 */
export function scoreIntent(intent: string, skill: DiscoveredSkill): number {
  const intentTokens = tokenize(intent);
  if (intentTokens.length === 0) return 0;

  const nameTokens = new Set(tokenize(skill.name));
  const tagTokens = new Set(tokenize((skill.tags ?? []).join(" ")));
  const descTokens = new Set(tokenize(skill.description));

  let weightedHits = 0;
  for (const token of intentTokens) {
    if (nameTokens.has(token)) {
      weightedHits += WEIGHT_NAME;
    } else if (tagTokens.has(token)) {
      weightedHits += WEIGHT_TAG;
    } else if (descTokens.has(token)) {
      weightedHits += WEIGHT_DESC;
    }
  }

  return Math.min(weightedHits / intentTokens.length, 1);
}

// ── 路由 ──

/**
 * 将用户意图路由到真实发现的技能集合。
 * 返回按置信度降序、过滤掉 confidence <= 0.05 的 SkillRoute 数组。
 */
export function routeIntent(intent: string, skills: DiscoveredSkill[]): SkillRoute[] {
  if (!intent.trim() || skills.length === 0) return [];

  return skills
    .map((skill) => ({
      skill,
      confidence: scoreIntent(intent, skill),
    }))
    .filter(({ confidence }) => confidence > 0.05)
    .sort((a, b) => b.confidence - a.confidence)
    .map(({ skill, confidence }) => ({
      skillId: skill.id,
      skillName: skill.name,
      confidence,
      description: skill.description,
      tags: skill.tags ?? [],
      inputHint: deriveInputHint(skill),
    }));
}

/**
 * 推导技能入参提示：优先 input_schema.title，否则首个必填字段名，
 * 否则首个属性名，否则空串。
 */
export function deriveInputHint(skill: DiscoveredSkill): string {
  const schema = skill.input_schema;
  if (!schema) return "";

  const title = schema.title;
  if (typeof title === "string" && title.trim()) return title.trim();

  const required = Array.isArray(schema.required) ? schema.required : [];
  const firstRequired = required.find((r) => typeof r === "string");
  if (firstRequired) return firstRequired;

  const firstProp = Object.keys(schema.properties ?? {})[0];
  return firstProp ?? "";
}

// ── 入参构建 ──

/**
 * 根据技能 input_schema 生成最佳努力（best-effort）的调用参数对象。
 *
 * 启发式（按优先级）：
 *   1. 若 schema 存在名为 query / text / input / prompt 的字符串属性，
 *      用意图原文填充它——这是用户最想「传进去」的内容。
 *   2. 对 required 字段：有 default 用 default；否则按类型给零值
 *      （string→""、number/integer→0、boolean→false、array→[]、object→{}）。
 *   3. 非 required 且无 default 的字段不主动填充，避免引入噪音。
 *
 * 返回空对象代表 schema 为空或无任何可推断字段。
 */
export function buildSkillInput(
  skill: DiscoveredSkill,
  intent: string,
): Record<string, unknown> {
  const schema = skill.input_schema;
  if (!schema?.properties) return {};

  const props = schema.properties;
  const required = new Set(
    Array.isArray(schema.required) ? schema.required.filter((r): r is string => typeof r === "string") : [],
  );

  // 1. 意图载体字段（最常见的自由文本入口）
  const textKeys = ["query", "text", "input", "prompt", "q", "question", "keyword"];
  for (const key of textKeys) {
    const prop = props[key];
    if (prop && isStringSchema(prop)) {
      return { [key]: intent, ...fillRequired(props, required, new Set([key])) };
    }
  }

  // 2. 无明确文本入口：填充所有 required 字段
  return fillRequired(props, required, new Set());
}

/** 判断 schema 节点是否为字符串类型（type 缺失也视为可接受字符串） */
function isStringSchema(prop: JSONSchema): boolean {
  return prop.type === "string" || prop.type === undefined;
}

/**
 * 对 required 字段填充 default 或类型零值，跳过已由意图填充的字段。
 */
function fillRequired(
  props: Record<string, JSONSchema>,
  required: Set<string>,
  skip: Set<string>,
): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const key of required) {
    if (skip.has(key)) continue;
    const prop = props[key];
    if (!prop) continue;
    if (prop.default !== undefined) {
      args[key] = prop.default;
    } else {
      args[key] = zeroValueFor(prop.type);
    }
  }
  return args;
}

/** 按 JSON Schema type 返回零值 */
function zeroValueFor(type: string | undefined): unknown {
  switch (type) {
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return {};
    case "string":
    default:
      return "";
  }
}

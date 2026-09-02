/**
 * 热榜引擎 — 多榜归一化 / 聚合去重 / 过滤打分 / 选题包装（前端专门处理逻辑）
 *
 * 对应 PRD v0.2 §3：小红书种草流水线选题洞察的核心逻辑。
 * 数据源：flowmind content_hot_boards（真实聚合 API，单榜失败只降级该榜）。
 * 本引擎只做「确定性、可复算」的处理：
 *   score = rankScore + multiBoardBonus + freshnessBonus + categoryMatch
 * 参数为暂定初始值，接入真实数据后可校准；无可靠热度不产假分。
 */
import type { ContentPlatform } from "@/lib/types";

export type HotBoardType = "general" | "vertical" | "topic" | "inspiration";

export const HOT_BOARD_LABELS: Record<HotBoardType, string> = {
  general: "综合热榜",
  vertical: "垂类热榜",
  topic: "话题热榜",
  inspiration: "灵感热榜",
};

export const HOT_BOARD_ORDER: HotBoardType[] = ["general", "vertical", "topic", "inspiration"];

/** 打分参数（可调；PRD：rankStep=2.5 / 多榜+10 封顶30 / 时效 4h/24h / 品类+15） */
export const SCORE_PARAMS = {
  rankStep: 2.5,          // 单榜名次步进：rankScore = max(0, 100-(rank-1)×rankStep)
  multiBoardPer: 10,      // 每多命中 1 榜 +10
  multiBoardCap: 30,      // 多榜加成封顶
  freshnessFreshMs: 4 * 3600_000,   // <4h：+10
  freshnessFreshBonus: 10,
  freshnessDayMs: 24 * 3600_000,    // 4-24h：+5
  freshnessDayBonus: 5,
  categoryMatchBonus: 15, // 垂类榜命中用户品类 +15
  topRankHeatThreshold: 10, // bestRank <= 10 → 竞争 high（启发式）
  midRankHeatThreshold: 30, // bestRank <= 30 → 竞争 medium
} as const;

/** flowmind content_hot_boards 归一化条目 */
export interface HotBoardItem {
  board: HotBoardType;
  title: string;
  heat: number;
  rank: number;
  source: string;
  url: string;
  fetchedAt: string;
}

/** flowmind 返回的单榜 */
export interface HotBoardRaw {
  id: HotBoardType;
  label: string;
  endpoint: string;
  source: string;
  degraded: boolean;
  topics: HotBoardItem[];
  failureCategory?: string;
  retriable?: boolean;
  warning?: string;
}

/** 前端热榜引擎打分明细（可复算） */
export interface TopicScoreBreakdown {
  rankScore: number;
  multiBoardBonus: number;
  freshnessBonus: number;
  categoryMatch: number;
  total: number;
}

/** 选题卡 */
export interface TopicCard {
  topic: string;
  score: TopicScoreBreakdown;
  hitBoards: HotBoardType[];
  bestRank: number;
  bestHeat: number;
  tags: string[];
  angleSuggestion: string;
  competition: "high" | "medium" | "low";
  freshness: "fresh" | "day" | "old";
  sourceUrls: string[];
  firstSeen: string;
}

/** 热榜引擎 API 返回 */
export interface HotEngineResult {
  platform: ContentPlatform;
  boards: HotBoardRaw[];
  cards: TopicCard[];
  fetchedAt: string;
  degraded: boolean;
  warning?: string;
  categories?: string[];
}

// ── ① 归一化 Normalize：title 清洗为聚合键 ──
function normalizeTitle(raw: string): string {
  return raw
    .replace(/[#＃]/g, "")
    .replace(/[，。、！？!?…·\s]+/g, " ")
    .trim()
    .toLowerCase();
}

// ── ② 聚合去重 Aggregate：同题多榜合并 ──
interface AggregateRow {
  key: string;
  title: string;
  items: HotBoardItem[];
  boards: Set<HotBoardType>;
  bestRank: number;
  bestHeat: number;
  firstSeen: string;
  urls: Set<string>;
}

/** 违禁/广告/低质过滤词（黑名单，命中即丢弃该条目） */
const FILTER_WORDS = [
  "广告", "推广", "招商", "加盟", "微商", "代购", "兼职",
  "刷单", "贷款", "理财", "股票", "期货", "币", "彩票",
];

function isFiltered(title: string): boolean {
  const lower = title.toLowerCase();
  return FILTER_WORDS.some((w) => lower.includes(w));
}

function aggregate(boards: HotBoardRaw[]): AggregateRow[] {
  const map = new Map<string, AggregateRow>();
  for (const board of boards) {
    if (board.degraded) continue;
    for (const item of board.topics) {
      if (isFiltered(item.title)) continue;
      const key = normalizeTitle(item.title);
      if (!key) continue;
      let row = map.get(key);
      if (!row) {
        row = {
          key,
          title: item.title,
          items: [],
          boards: new Set(),
          bestRank: Infinity,
          bestHeat: 0,
          firstSeen: item.fetchedAt,
          urls: new Set(),
        };
        map.set(key, row);
      }
      row.items.push(item);
      row.boards.add(item.board);
      if (item.rank < row.bestRank) row.bestRank = item.rank;
      if (item.heat > row.bestHeat) row.bestHeat = item.heat;
      if (item.fetchedAt < row.firstSeen) row.firstSeen = item.fetchedAt;
      if (item.url) row.urls.add(item.url);
    }
  }
  return [...map.values()];
}

// ── ③ 过滤打分 Filter & Rank ──
function rankScore(rank: number): number {
  return Math.max(0, 100 - (rank - 1) * SCORE_PARAMS.rankStep);
}

function freshnessBonusOf(fetchedAt: string, now: number): number {
  const t = Date.parse(fetchedAt);
  if (Number.isNaN(t)) return 0;
  const age = now - t;
  if (age <= SCORE_PARAMS.freshnessFreshMs) return SCORE_PARAMS.freshnessFreshBonus;
  if (age <= SCORE_PARAMS.freshnessDayMs) return SCORE_PARAMS.freshnessDayBonus;
  return 0;
}

function categoryMatchBonus(row: AggregateRow, categories: string[]): number {
  if (!categories.length) return 0;
  const lower = row.title.toLowerCase();
  const hit = categories.some((c) => c && lower.includes(c.trim().toLowerCase()));
  // 品类加成只在命中垂类榜（vertical）来源时生效
  return hit && row.boards.has("vertical") ? SCORE_PARAMS.categoryMatchBonus : 0;
}

function freshnessLabel(fetchedAt: string, now: number): TopicCard["freshness"] {
  const t = Date.parse(fetchedAt);
  if (Number.isNaN(t)) return "old";
  const age = now - t;
  if (age <= SCORE_PARAMS.freshnessFreshMs) return "fresh";
  if (age <= SCORE_PARAMS.freshnessDayMs) return "day";
  return "old";
}

// ── ④ 选题包装 Package ──
const ANGLE_TEMPLATES: Record<HotBoardType, string[]> = {
  general: ["热点借势 · 真实测评", "反常识 · 对比", "痛点 + 场景"],
  vertical: ["垂类深度攻略", "避坑指南", "开箱种草"],
  topic: ["话题参与 · 观点输出", "合集盘点", "教程攻略"],
  inspiration: ["灵感共创 · 新手友好", "治愈系 · 情绪价值", "打卡种草"],
};

function pickAngle(templates: string[], seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return templates[h % templates.length];
}

function competitionOf(rank: number): TopicCard["competition"] {
  if (rank <= SCORE_PARAMS.topRankHeatThreshold) return "high";
  if (rank <= SCORE_PARAMS.midRankHeatThreshold) return "medium";
  return "low";
}

function buildTags(title: string): string[] {
  // 启发式：主标题去符号后取前 2 个有效词 + 完整主题；标注为候选，可编辑
  const parts = title.replace(/[，。、！？!?·\s]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const tags = new Set<string>();
  tags.add(title.trim());
  for (const p of parts.slice(0, 2)) {
    if (p.length >= 2) tags.add(p);
  }
  return [...tags].slice(0, 5);
}

export function runHotEngine(
  platform: ContentPlatform,
  boards: HotBoardRaw[],
  opts: { categories?: string[]; now?: number } = {},
): HotEngineResult {
  const now = opts.now ?? Date.now();
  const categories = (opts.categories ?? []).map((c) => c.trim()).filter(Boolean);
  const rows = aggregate(boards);

  const cards: TopicCard[] = rows
    .map((row) => {
      const boardsArr = HOT_BOARD_ORDER.filter((b) => row.boards.has(b));
      const rScore = rankScore(row.bestRank);
      const mBonus = Math.min(
        (boardsArr.length - 1) * SCORE_PARAMS.multiBoardPer,
        SCORE_PARAMS.multiBoardCap,
      );
      const fBonus = freshnessBonusOf(row.firstSeen, now);
      const cMatch = categoryMatchBonus(row, categories);
      const total = rScore + mBonus + fBonus + cMatch;
      const firstBoard = boardsArr[0] ?? "general";
      return {
        topic: row.title,
        score: { rankScore: rScore, multiBoardBonus: mBonus, freshnessBonus: fBonus, categoryMatch: cMatch, total },
        hitBoards: boardsArr,
        bestRank: row.bestRank,
        bestHeat: row.bestHeat,
        tags: buildTags(row.title),
        angleSuggestion: pickAngle(ANGLE_TEMPLATES[firstBoard] ?? ANGLE_TEMPLATES.general, row.title),
        competition: competitionOf(row.bestRank),
        freshness: freshnessLabel(row.firstSeen, now),
        sourceUrls: [...row.urls],
        firstSeen: row.firstSeen,
      };
    })
    .sort((a, b) => b.score.total - a.score.total);

  const fetchedAt = boards.find((b) => !b.degraded && b.topics.length > 0)?.topics[0]?.fetchedAt
    ?? new Date(now).toISOString();

  const allDown = boards.length > 0 && boards.every((b) => b.degraded);

  return {
    platform,
    boards,
    cards,
    fetchedAt,
    degraded: allDown,
    warning: allDown ? "全部热榜源不可达，暂无真实热点数据" : undefined,
    categories,
  };
}

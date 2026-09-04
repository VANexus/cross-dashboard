/**
 * B端提示词工程 — L3 校验护栏层（Guardrails）
 *
 * 确定性代码校验（非 LLM）：把《上架规则》中的硬性规则翻译为可执行检查。
 * 生成 → validate → (error 级问题) repair → 复检，最多 N 轮，仍不过则带 warnings 透出。
 * warning 级问题不阻断，作为 warnings 数组返回给运营确认。
 */
import { LISTING_CONTRACT, type ListingDraftLLM } from "./contracts";

export interface ListingValidationIssue {
  field: "title" | "keywords" | "description" | "image_prompt";
  severity: "error" | "warning";
  rule: string;
  message: string;
}

/** 行业通用缩写白名单（全大写豁免） */
const ACRONYM_WHITELIST = new Set([
  "OEM", "ODM", "OBM", "LED", "USB", "CE", "ROHS", "FCC", "IP67", "IP68", "PVC",
  "ABS", "PC", "PP", "PET", "PE", "UV", "RGB", "DC", "AC", "MOQ", "B2B",
  "SKU", "RTS", "AI", "DIY", "SET", "PCS", "SPF", "GPS", "HD", "4K", "SOS",
]);

/** 极限词/绝对化用语（规则禁用） */
const SUPERLATIVE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bbest[\s-]?seller\b/i, label: "best seller" },
  { re: /#1\b|\bnumber\s*one\b/i, label: "#1/number one" },
  { re: /\bno\.?\s*1\b/i, label: "No.1" },
  { re: /\bcheapest\b|\blowest\s*price\b|\btop\s*1\b/i, label: "cheapest/lowest price/top 1" },
  { re: /第一|最好|最强|最低价|最便宜|顶级品牌/, label: "中文极限词" },
];

/** 装饰性禁止符号（emoji 用区间近似覆盖） */
const DECORATIVE_SYMBOL_RE = /[★※✦✧❤♥♦♣♠☀☁☂☃☆♪♫♬→←↑↓✨✔✖[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

export function validateListing(draft: Partial<ListingDraftLLM>, mainKeyword?: string): ListingValidationIssue[] {
  const issues: ListingValidationIssue[] = [];
  const title = (draft.title ?? "").trim();

  // ── 标题长度 ──
  if (title.length === 0) {
    issues.push({ field: "title", severity: "error", rule: "标题必填", message: "标题为空" });
  } else {
    if (title.length > 128) {
      issues.push({ field: "title", severity: "error", rule: "标题 ≤128 字符", message: `标题 ${title.length} 字符，超过 128 上限` });
    } else if (title.length < 50 || title.length > 100) {
      issues.push({ field: "title", severity: "warning", rule: "标题建议 50–100 字符", message: `标题 ${title.length} 字符，建议 60–90 为最佳` });
    }
  }

  // ── 装饰符号 / 联系方式 ──
  if (DECORATIVE_SYMBOL_RE.test(title)) {
    issues.push({ field: "title", severity: "error", rule: "禁用装饰符号", message: "标题含 ★※emoji 等装饰符号，需删除" });
  }
  if (/[\w.+-]+@[\w-]+\.[\w.]+|https?:\/\/|\b\d{7,}\b/.test(title)) {
    issues.push({ field: "title", severity: "error", rule: "标题禁含联系方式", message: "标题含邮箱/网址/电话，需删除" });
  }

  // ── 极限词 ──
  for (const p of SUPERLATIVE_PATTERNS) {
    if (p.re.test(title)) {
      issues.push({ field: "title", severity: "error", rule: "禁用极限词", message: `标题含极限词「${p.label}」，违规下架/扣分` });
    }
  }

  // ── 慎用符号需前后加空格（/ – ( )）──
  if (/(?<!\s)[\/\-()](?!\s)/.test(title.replace(/[A-Za-z0-9]-[A-Za-z0-9]/g, ""))) {
    issues.push({ field: "title", severity: "warning", rule: "慎用符号前后加空格", message: "标题含未加空格的 / – ( ) 符号，可能被识别为无效字符" });
  }

  // ── 全大写（非缩写白名单）──
  const upperWords = title.match(/[A-Z]{4,}/g) ?? [];
  const badUpper = upperWords.filter((w) => !ACRONYM_WHITELIST.has(w));
  if (badUpper.length > 0) {
    issues.push({ field: "title", severity: "warning", rule: "禁全大写", message: `标题含全大写词 ${badUpper.join(", ")}（行业缩写除外），应改为首字母大写` });
  }

  // ── 关键词堆砌（同一词 >3 次）──
  const words = title.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  const stuffed = [...counts.entries()].filter(([w, c]) => c > 3 && !ACRONYM_WHITELIST.has(w.toUpperCase())).map(([w, c]) => `${w}×${c}`);
  if (stuffed.length > 0) {
    issues.push({ field: "title", severity: "error", rule: "禁关键词堆砌", message: `标题存在堆砌：${stuffed.join("、")}（同词不得超 3 次）` });
  }

  // ── 核心词位置（with/for 之前）──
  if (mainKeyword) {
    const kw = mainKeyword.trim();
    if (kw) {
      const lower = title.toLowerCase();
      const withFor = lower.search(/\b(with|for)\b/);
      const kwIdx = lower.indexOf(kw.toLowerCase());
      if (withFor !== -1 && kwIdx !== -1 && kwIdx > withFor) {
        issues.push({ field: "title", severity: "warning", rule: "核心词置于 with/for 之前", message: `主关键词「${kw}」出现在 with/for 之后，系统会误判核心词，建议调整语序` });
      }
    }
  }

  // ── 关键词框 ──
  const keywords = draft.keywords ?? [];
  if (keywords.length !== 3) {
    issues.push({ field: "keywords", severity: "error", rule: "恰好 3 个关键词", message: `关键词数量为 ${keywords.length}，必须恰好 3 个` });
  }
  if (new Set(keywords.map((k) => k.trim().toLowerCase())).size !== keywords.length) {
    issues.push({ field: "keywords", severity: "error", rule: "三词差异化", message: "存在重复关键词，三个词应互补不重复" });
  }
  for (const k of keywords) {
    if (/[,;，；]/.test(k)) {
      issues.push({ field: "keywords", severity: "error", rule: "关键词禁含逗号/分号", message: `关键词「${k}」含逗号/分号等特殊符号` });
    }
    if (k.trim().length > 0 && (k.trim().length < 8 || k.trim().length > 60)) {
      issues.push({ field: "keywords", severity: "warning", rule: "关键词建议 30–60 字符", message: `关键词「${k}」长度 ${k.trim().length}，建议 30–60 字符` });
    }
  }

  // ── 描述 ──
  const desc = (draft.description ?? "").trim();
  if (desc.length === 0) {
    issues.push({ field: "description", severity: "error", rule: "描述必填", message: "详情描述为空" });
  } else if (desc.length < 300) {
    issues.push({ field: "description", severity: "warning", rule: "英文正文 ≥300 字符", message: `描述仅 ${desc.length} 字符，信息质量分不足，建议 ≥300` });
  }

  // ── 主图提示词 ──
  if (!(draft.image_prompt ?? "").trim()) {
    issues.push({ field: "image_prompt", severity: "error", rule: "image_prompt 必填", message: "主图生成提示词为空" });
  }

  return issues;
}

/** 修复提示词：只修问题、不动合规部分；与生成契约保持同一输出结构 */
export function listingRepairPrompt(draft: ListingDraftLLM, issues: ListingValidationIssue[]): string {
  const errorList = issues
    .map((i) => `- [${i.field}] ${i.message}（规则：${i.rule}）`)
    .join("\n");
  return `【任务：修复 Listing 合规问题】

你此前生成的 Listing 未通过平台规则校验。只需修复下列问题，其余已合规内容保持原样（尤其不要改动已正确的标题结构与关键词选择，除非它们本身就是问题来源）。

待修复问题：
${errorList}

当前草稿（JSON）：
${JSON.stringify({ title: draft.title, description: draft.description, keywords: draft.keywords, image_prompt: draft.image_prompt }, null, 2)}

${LISTING_CONTRACT}`;
}

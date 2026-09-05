/**
 * chat-compact —— 对话历史的上下文压缩（B1：对话成本闸）
 *
 * 长对话全量回放是 token 成本与上下文漂移的主要来源。这里在超阈值时把
 * 「早期消息」折叠成一段摘要注入 system（原始消息仍完整保留在 conversations 库中，
 * 可随时恢复/深查），发给模型的只有最近 KEEP_MESSAGES 轮。
 *
 * 成本控制：
 * - 摘要只用一次 LLM 调用（失败降级为截断，绝不阻塞对话）；
 * - 会话级缓存：同 conversationId 在条数未明显增长前不重复压缩。
 */
import type { UIMessage } from "ai";
import { getAISDKModel } from "@/lib/server/ai";

/** 超过该条数即触发压缩。 */
const COMPACT_AT_MESSAGES = 16;
/** 或消息文本总长超过该字符数即触发。 */
const COMPACT_AT_CHARS = 24000;
/** 压缩后仍保留给模型的最近轮次（含最新 user 消息）。 */
const KEEP_MESSAGES = 10;
/** 摘要最大字符数。 */
const SUMMARY_MAX = 700;
/** 降级截断时保留的早期文本长度。 */
const FALLBACK_TAIL = 3000;

interface CompactCacheEntry {
  count: number;
  summary: string;
}

/** 会话级压缩缓存（进程内；key=conversationId）。 */
const cache = new Map<string, CompactCacheEntry>();

/** 提取一条 UIMessage 的纯文本（text part 拼接）。 */
export function extractMessageText(m: UIMessage): string {
  const parts = Array.isArray((m as { parts?: unknown }).parts) ? (m as { parts?: unknown[] }).parts! : [];
  return (parts as Array<{ type?: string; text?: string }>)
    .filter((p) => p?.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join(" ")
    .trim();
}

/** 消息总字符数（轻量估计）。 */
export function totalMessageChars(messages: UIMessage[]): number {
  let n = 0;
  for (const m of messages) n += extractMessageText(m).length;
  return n;
}

/** 是否达到压缩阈值（条数或字符任一跳过即压缩）。 */
export function shouldCompact(messages: UIMessage[]): boolean {
  if (messages.length > COMPACT_AT_MESSAGES) return true;
  return totalMessageChars(messages) > COMPACT_AT_CHARS;
}

/** 早期段文本（发往模型窗口之外的历史部分，按序拼接为对话剧本）。 */
function earlySegment(messages: UIMessage[]): string {
  const keep = Math.min(KEEP_MESSAGES, messages.length - 1);
  const early = messages.slice(0, Math.max(0, messages.length - keep));
  return early
    .map((m) => `[${m.role}] ${extractMessageText(m)}`)
    .filter((s) => s.length > 8)
    .join("\n");
}

/** 早期段是否值得压缩（有真实内容）。 */
export function hasEarlyContent(messages: UIMessage[]): boolean {
  return earlySegment(messages).length > 120;
}

/** 取缓存摘要（未触发或未缓存返回 null）。 */
export function peekCompactSummary(conversationId: string | null): string | null {
  if (!conversationId) return null;
  return cache.get(conversationId)?.summary ?? null;
}

/** 记录一次压缩（conversationId + 当时条数）。 */
export function rememberCompact(conversationId: string | null, messages: UIMessage[], summary: string): void {
  if (!conversationId) return;
  const prev = cache.get(conversationId);
  // 条数增幅 < 4 视为「同轮重复请求」，复用缓存不重压
  if (prev && messages.length - prev.count < 4) return;
  cache.set(conversationId, { count: messages.length, summary });
}

/**
 * 生成早期对话摘要。优先 LLM 结构化压缩（一次调用），失败降级为截断。
 * 返回空串表示「无可压缩内容或不可用」，调用方跳过注入。
 */
export async function buildCompactSummary(messages: UIMessage[]): Promise<string> {
  const text = earlySegment(messages);
  if (!text) return "";
  try {
    const model = await getAISDKModel();
    const { generateText } = await import("ai");
    const res = await generateText({
      model,
      system:
        "你是对话存档整理助手。把下面这段较早的对话历史压缩成一条给后续 Agent 阅读的中文摘要，保留：关键业务事实（工具返回的结论/数字）、用户偏好/决定、未完成任务与下一步。其余寒暄、重复、中间过程一律丢弃。直接输出摘要正文，不要标题、不要列表格式、不要任何解释。",
      prompt: text,
      temperature: 0,
      maxOutputTokens: 400,
    });
    const summary = (res.text ?? "").trim();
    return summary ? summary.slice(0, SUMMARY_MAX) : text.slice(0, FALLBACK_TAIL);
  } catch {
    // 模型不可用/调用失败：降级为早期段截断，保证对话可继续
    return text.slice(0, FALLBACK_TAIL);
  }
}

/** 把摘要格式化为 system 注入块（无摘要返回空串）。 */
export function compactNote(summary: string): string {
  if (!summary) return "";
  return `\n\n【较早对话摘要（历史已压缩，可引用其中的事实；涉及细节可用 memory_search 深查）】\n${summary}`;
}
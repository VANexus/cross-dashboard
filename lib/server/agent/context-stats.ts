/**
 * context-stats —— 对话上下文组成 + 占模型窗口百分比的估算。
 *
 * token 估算用启发式（无本地 tokenizer）：CJK 每字 ≈1 token、ASCII 每 4 字符 ≈1 token。
 * 与模型真实分词存在偏差，前端展示统一加「≈」前缀；百分比仅用于「上下文挤得多满」的直觉判断，
 * 不是精确计量。窗口总量来自 env AI_CONTEXT_WINDOW（默认 32768），模型不同可覆盖。
 */
import type { ToolSet, UIMessage } from "ai";

/** 中英文混合启发式 token 估算。 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let cjk = 0;
  let ascii = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    // CJK 统一表意文字 + 全角标点/假名等常用块
    if (
      (code >= 0x2e80 && code <= 0x9fff) || // CJK Radicals..CJK 统一表意文字
      (code >= 0xf900 && code <= 0xfaff) || // CJK 兼容表意文字
      (code >= 0x3000 && code <= 0x303f) // CJK 标点
    ) {
      cjk++;
    } else {
      ascii++;
    }
  }
  return Math.max(1, Math.ceil(cjk + ascii / 4));
}

/** 千分位友好格式化（1.2k / 340）。 */
export function formatTokens(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

export interface ContextBreakdownItem {
  key: string;
  label: string;
  tokens: number;
  /** 占模型窗口百分比（0-100，1 位小数） */
  pct: number;
}

export interface ContextStats {
  /** 估算总 token（persona + 页面 + 记忆召回 + 对话历史 + 工具定义） */
  total: number;
  /** 模型上下文窗口总量 */
  window: number;
  /** total / window 百分比 */
  pct: number;
  breakdown: ContextBreakdownItem[];
}

export function computeContextStats(input: {
  persona: string;
  page?: string;
  memory?: string;
  historyTokens: number;
  toolsTokens: number;
  window: number;
}): ContextStats {
  const window = input.window > 0 ? input.window : 1;
  const parts = [
    { key: "persona", label: "系统人格", tokens: estimateTokens(input.persona) },
    { key: "page", label: "页面上下文", tokens: estimateTokens(input.page ?? "") },
    { key: "memory", label: "记忆召回", tokens: estimateTokens(input.memory ?? "") },
    { key: "history", label: "对话历史", tokens: input.historyTokens },
    { key: "tools", label: "工具定义", tokens: input.toolsTokens },
  ];
  const total = parts.reduce((s, p) => s + p.tokens, 0);
  const pctOf = (n: number) => Math.round((n / window) * 1000) / 10;
  return {
    total,
    window: input.window,
    pct: pctOf(total),
    breakdown: parts.map((p) => ({ ...p, pct: pctOf(p.tokens) })),
  };
}

/** 估算 AI SDK ToolSet 的 token 占用（名称 + 描述 + inputSchema 的 JSON 视图）。 */
export function estimateToolSetTokens(tools: ToolSet): number {
  let total = 0;
  for (const [name, t] of Object.entries(tools)) {
    const td = t as { description?: string; inputSchema?: { toJSON?: () => unknown } };
    const schemaJson = (() => {
      try {
        return JSON.stringify(td.inputSchema?.toJSON?.() ?? {});
      } catch {
        return "{}";
      }
    })();
    total += estimateTokens(`${name}\n${td.description ?? ""}\n${schemaJson}`);
  }
  return total;
}

/** 估算对话历史（UIMessage[]）的 token 占用。 */
export function estimateUIMessagesTokens(messages: UIMessage[]): number {
  let total = 0;
  for (const m of messages) {
    total += estimateTokens(m.role);
    const parts = (m as { parts?: unknown[] }).parts;
    if (!Array.isArray(parts)) {
      // 兜底：没有 parts 的按 JSON 序列化估算
      try {
        total += estimateTokens(JSON.stringify(m));
      } catch {
        /* ignore */
      }
      continue;
    }
    for (const p of parts) {
      if (!p || typeof p !== "object") continue;
      const pt = p as { type?: string; text?: string; args?: unknown; output?: unknown; input?: unknown };
      if (pt.type === "text" && typeof pt.text === "string" && pt.text.trim()) {
        total += estimateTokens(pt.text);
      } else if (pt.type === "tool-input" || pt.type === "tool-call") {
        total += estimateTokens(JSON.stringify(pt.args ?? {}));
      } else if (pt.type === "tool-result" || pt.type === "tool-output") {
        total += estimateTokens(
          typeof pt.output === "string" ? pt.output : JSON.stringify(pt.output ?? {}),
        );
      } else if (pt.type === "reasoning") {
        total += estimateTokens(typeof pt.text === "string" ? pt.text : "");
      }
    }
  }
  return total;
}

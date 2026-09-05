/**
 * lib/server/wechat-typeset.ts — 公众号排版引擎（自托管 · 确定性转换）
 *
 * 把编辑中的 Markdown 转为公众号可用的「内联样式 HTML」（86 编辑器只认内联 style）。
 * 不依赖 flowmind MCP（此前 content_typeset 未自托管时 → 红色报错），全进程内、零成本、不失败。
 * 行为开关：WECHAT_TYPESET_USE_MCP=1 可切回 flowmind 技能（WechatService 读此 env）。
 *
 * 安全：先 HTML 转义再结构化，不渲染原始 HTML（防 XSS 边界与 markdown-message 同一约定）。
 */
import type { WechatTypesetResult, WechatTypesetTheme } from "@/lib/shared/types";

export const WECHAT_TYPESET_THEMES: WechatTypesetTheme[] = [
  { id: "default", label: "经典", primary: "#07C160" },
  { id: "grace", label: "优雅", primary: "#9C6ADE" },
  { id: "simple", label: "简约", primary: "#1F6FEB" },
];

/** 取主题主色（未知 id 回落经典色）。 */
function primaryOf(theme?: string): string {
  return WECHAT_TYPESET_THEMES.find((t) => t.id === theme)?.primary ?? "#07C160";
}

/** 百分比字色：主色浅色调背景用。 */
function tintOf(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return "rgba(7,193,96,.08)";
  const r = ((n >> 16) & 255) + Math.round((255 - ((n >> 16) & 255)) * 0.9);
  const g = ((n >> 8) & 255) + Math.round((255 - ((n >> 8) & 255)) * 0.9);
  const b = (n & 255) + Math.round((255 - (n & 255)) * 0.9);
  return `rgb(${r},${g},${b})`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 行内格式（strong/em/del/code/链接）。 */
function inline(raw: string, primary: string): string {
  const esc = (t: string) => escapeHtml(t);
  return raw
    .replace(/\*\*\*([^*]+)\*\*\*/g, (_, t) => `<strong><em>${esc(t)}</em></strong>`)
    .replace(/\*\*([^*]+)\*\*/g, (_, t) => `<strong>${esc(t)}</strong>`)
    .replace(/\*([^*]+)\*/g, (_, t) => `<em>${esc(t)}</em>`)
    .replace(/~~([^~]+)~~/g, (_, t) => `<del style="color:#999">${esc(t)}</del>`)
    .replace(/`([^`]+)`/g, (_, t) => `<code style="display:inline-block;padding:0 6px;border-radius:4px;background:${tintOf(primary)};color:${primary};font-size:13px">${esc(t)}</code>`)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label, url) => `<a href="${esc(url)}" style="color:${primary};text-decoration:underline">${esc(label)}</a>`);
}

/** 单块 → 公众号内联样式 HTML。 */
function blockToHtml(line: string, primary: string): string {
  const bold = `font-weight:bold;color:${primary}`;
  if (/^#{1,6}\s/.test(line)) {
    const level = line.match(/^#+/)?.[0].length ?? 1;
    const size = level === 1 ? "20px" : level === 2 ? "17px" : "15px";
    const title = inline(line.replace(/^#+\s*/, ""), primary);
    return `<h${level} style="font-size:${size};${bold};margin:18px 0 8px;line-height:1.5">${title}</h${level}>`;
  }
  if (/^\s*[-*]\s+/.test(line)) {
    return `<p style="margin:4px 0;line-height:1.8;color:#333;display:flex"><span style="color:${primary};margin-right:6px">▍</span><span style="flex:1">${inline(line.replace(/^\s*[-*]\s+/, ""), primary)}</span></p>`;
  }
  if (/^\s*\d+[.、]\s+/.test(line)) {
    const num = line.match(/^\s*(\d+)[.、]\s+/)?.[1] ?? "•";
    return `<p style="margin:4px 0;line-height:1.8;color:#333;display:flex"><span style="color:${primary};font-weight:bold;margin-right:6px;min-width:20px">${num}. </span><span style="flex:1">${inline(line.replace(/^\s*\d+[.、]\s+/, ""), primary)}</span></p>`;
  }
  if (/^>\s?/.test(line)) {
    return `<blockquote style="border-left:3px solid ${primary};background:${tintOf(primary)};margin:8px 0;padding:8px 12px;color:#555;border-radius:0 6px 6px 0;line-height:1.7">${inline(line.replace(/^>\s?/, ""), primary)}</blockquote>`;
  }
  if (/^\s*```/.test(line)) {
    return `<pre style="background:#1e1e1e;color:#d4d4d4;border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.6;overflow-x:auto;margin:8px 0"><code>${escapeHtml(line.replace(/^\s*```.*/, ""))}</code></pre>`;
  }
  return `<p style="margin:4px 0;line-height:1.8;color:#333">${inline(line, primary)}</p>`;
}

/** Markdown → 公众号内联样式 HTML（含统计）。 */
export function selfhostTypeset(markdown: string, opts: { theme?: string; title?: string } = {}): WechatTypesetResult {
  const primary = primaryOf(opts.theme);
  const theme = WECHAT_TYPESET_THEMES.find((t) => t.id === opts.theme) ?? WECHAT_TYPESET_THEMES[0];

  const lines = markdown.split(/\r?\n/).map((l) => l.trimEnd());
  const title = opts.title?.trim() || lines.find((l) => /^#\s/.test(l))?.replace(/^#\s*/, "") || "";
  const titleHtml = title
    ? `<h1 style="font-size:22px;font-weight:bold;color:${primary};margin:0 0 6px;line-height:1.5">${escapeHtml(title)}</h1><hr style="border:none;border-top:2px solid ${tintOf(primary)};margin:0 0 14px">`
    : "";

  let body = "";
  let inCode = false;
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) {
      body += blockToHtml(paragraph.join(" "), primary);
      paragraph = [];
    }
  };
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      flush();
      body += `<pre style="background:#1e1e1e;color:#d4d4d4;border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.6;overflow-x:auto;margin:8px 0"><code>`;
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      body += `${escapeHtml(line)}\n`;
      if (/^\s*```/.test(line)) body += `</code></pre>`;
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    if (/^(#{1,6}\s|>\s?|\s*[-*]\s+|\s*\d+[.、]\s+)/.test(line)) { flush(); body += blockToHtml(line, primary); }
    else paragraph.push(line.trim());
  }
  flush();

  const html = `<section style="max-width:100%;font-size:15px;color:#333;line-height:1.8;word-break:break-word;padding:0 4px">${titleHtml}${body}</section>`;

  return {
    html,
    theme: theme.id,
    themeLabel: theme.label,
    stats: {
      chars: markdown.replace(/\s/g, "").length,
      paragraphs: (markdown.match(/\n{2,}/g)?.length ?? 0) + 1,
      blocks: (html.match(/<p[ >]|<h\d|<blockquote|<pre/g)?.length ?? 0),
    },
  };
}
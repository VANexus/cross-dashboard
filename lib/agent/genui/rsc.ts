// lib/agent/genui/rsc.ts
// 共享层纯函数（isomorphic，无 DOM / 无 server 依赖）：供 RSC（服务端预渲染）把持久化的
// json-render data-spec 编译成 UIBlock，或把动态工作流 spec（steps DAG）转成可渲染块。
// 因是纯函数，也允许客户端组件复用（不违反 F1：不 import lib/server）。
import { compileSpecStream, type Spec } from '@json-render/core';
import { parseBlocks, type UIBlock } from 'react-generative-ui';

/**
 * 从持久化的 json-render data-spec parts 编译成 spec。
 * 服务端落库时 parts 存为 { type:'data', data: JSONL patch[] }。
 * @returns spec 或 null（无 / 非法时降级）
 */
export function specFromParts(parts: unknown): Spec | null {
  if (!Array.isArray(parts)) return null;
  const patches: unknown[] = [];
  for (const p of parts as Array<{ type?: string; data?: unknown }>) {
    if (p && p.type === 'data' && p.data !== undefined) {
      if (Array.isArray(p.data)) patches.push(...p.data);
      else patches.push(p.data);
    }
  }
  if (patches.length === 0) return null;
  try {
    // 逐行 RFC 6902 patch（每行一个 JSON patch）编译成 spec
    const stream = patches
      .map((p) => (typeof p === 'string' ? p : JSON.stringify(p)))
      .join('\n');
    return (compileSpecStream(stream) as unknown as Spec) ?? null;
  } catch {
    return null;
  }
}

/**
 * 把 json-render spec（root+elements 扁平树）转成 react-generative-ui UIBlock[]。
 * 局限：UIBlock 是扁平的，无 children/slots/repeat 嵌套 → 只保根层组件。
 * componentName 用 element.type；props 直接透传。
 */
export function specToBlocks(spec: Spec | null): UIBlock[] {
  if (!spec || !spec.elements || !spec.root) return [];
  const root = spec.elements[spec.root];
  if (!root) return [];
  const blocks: UIBlock[] = [];
  const visit = (key: string): void => {
    const el = spec.elements[key];
    if (!el) return;
    blocks.push({
      componentName: String(el.type ?? 'unknown'),
      props: (el.props as Record<string, unknown>) ?? {},
      id: key,
    });
  };
  visit(spec.root);
  return blocks;
}

/**
 * 解析一段可能含 {"componentName":...} 内嵌 JSON 的文本 → UIBlock[]（用于旧消息/工作流产物文本）。
 */
export function parseTranscriptText(text: string): UIBlock[] {
  if (!text || !text.trim()) return [];
  try {
    return parseBlocks(text, { strict: true });
  } catch {
    return [];
  }
}

/**
 * 把动态工作流 spec（steps DAG）转成 react-generative-ui 可渲染的「步骤卡」UIBlock。
 * 每个 step 渲染为 stat-card 样式块：标题=tool，值=步骤 id，补充=dependsOn 摘要。
 * componentName 用 'workflow-step'，由 RSC registry 注册对应渲染组件。
 */
export function workflowToBlocks(
  spec: { steps: Array<{ id: string; tool: string; args?: Record<string, unknown>; dependsOn?: string[] }> },
): UIBlock[] {
  if (!spec || !Array.isArray(spec.steps)) return [];
  return spec.steps.map((s, i) => ({
    componentName: 'workflow-step',
    props: {
      index: i + 1,
      id: s.id,
      tool: s.tool,
      args: s.args ?? {},
      dependsOn: s.dependsOn ?? [],
    },
    id: s.id,
  }));
}

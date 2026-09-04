// lib/server/agent/genui-prompt.ts
// server-only：把 json-render catalog.prompt 生成的 UI 系统提示词并入 Agent system。
// 替代手写 COMPONENT_SHAPES——组件清单/props/actions/输出格式由 catalog 自动生成。
import { catalog } from "@/lib/agent/genui/catalog";

export interface GenUIPromptOptions {
  /** 前置行为规则（对话态模式） */
  mode?: "inline" | "standalone";
}

/**
 * 生成 json-render UI 生成规则块（追加到既有 persona system 之后）。
 * inline：对话式回复 + 仅在需要 UI 时输出独立行 JSONL patches（不包代码块）。
 */
export function buildGenUISystem(_opts: GenUIPromptOptions = {}): string {
  return catalog.prompt({
    mode: "inline",
    system:
      "以下是你在 FlowMind 中「生成式动态 UI」的补充规则（叠加在既有行为规范之上）：" +
      "当结论需要可视化/对比/排行/指标看板时，直接在回复后用独立行输出 json-render JSONL patches 生成组件树，客户端会实时渲染成可交互 UI。",
    customRules: [
      "同一轮回复里 UI 只走 json-render Inline 一种通道：要么输出 JSONL patches 生成组件，要么调用 render_component 工具，二者不要同时用（过渡期约束）。",
      "结论性数据（对比/趋势/排行/指标/表格）优先用组件表达，比长段落文字更高级、信息更聚焦。",
      "所有数值/结论必须来自工具或上下文真实返回，绝不编造（延续诚实第一原则）。",
      "JSONL patches 必须是合法 RFC 6902 格式、每行一个 patch、不要用代码块包裹，直接裸行输出。",
      "不需要 UI 的普通问答直接给文本即可，不要强行生成组件。",
    ],
  });
}

// lib/agent/contracts.ts
// Agent ⇄ UI 的事件契约,也是 /api/agent/stream 的 SSE payload schema。
// 与 agent-mvp.html 中 AgentBus 的三类事件一一对应;zod 同时用于生成式 UI 的工具出参校验。
import { z } from 'zod';

export const AgentState = z.enum(['idle', 'busy', 'consensus']);

export const StateEvent = z.object({
  type: z.literal('state'),
  state: AgentState,
  activity: z.number().min(0).max(1), // 驱动球呼吸 timeScale 与极光湍流 uniform
});

export const TelemetryEvent = z.object({
  type: z.literal('telemetry'),
  agent: z.string(),          // '选品 Agent' / '库存 Agent' …
  text: z.string(),           // 单行遥测文案(已含结果,不含未完成时态)
});

export const PlanStepEvent = z.object({
  type: z.literal('plan_step'),
  id: z.string(),             // 步骤标识,如 'crawl'
  status: z.enum(['run', 'done', 'confirm']),
  tool: z.string().optional(), // done 时的结果摘要,如 'risk.scan · 2 项已归档'
  runId: z.string().optional(), // confirm 时携带,前端 resume 需回传
  message: z.string().optional(), // confirm 时的提示文案
});

// workflow 关键步骤输出的结构化卡片(趋势榜/Listing/图片),供生成式 UI 渲染
export const CardEvent = z.object({
  type: z.literal('card'),
  cardType: z.string(),       // 'trends' | 'trends-summary' | 'listing' | 'images'
  data: z.record(z.string(), z.unknown()),
});

export const AgentEvent = z.discriminatedUnion('type', [
  StateEvent,
  TelemetryEvent,
  PlanStepEvent,
  CardEvent,
]);

export type AgentEvent = z.infer<typeof AgentEvent>;
export type AgentStateValue = z.infer<typeof AgentState>;

// SSE 帧编码:text/event-stream,每帧 `event: <type>\ndata: <json>\n\n`
export function encodeEvent(ev: AgentEvent): string {
  return `event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`;
}

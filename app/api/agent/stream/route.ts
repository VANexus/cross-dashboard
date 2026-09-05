// app/api/agent/stream/route.ts
// SSE 统一通道（A3：双通道收敛）：presence store（无 agentId）与 Agent 详情页
// （?agentId=xxx，原 /api/agents/[id]/stream）共用同一端点。
// - 无 agentId：presence 连接帧 + workflow 运行事件（plan_step/card/telemetry/state），25s 心跳；
// - 带 agentId：额外订阅 agentEventBus（老 Agent 事件：thought/decision/mood_change/…），
//   以裸 `data: {json}` 帧推送，与旧端点格式一字不差（use-agent-stream onmessage 兼容）。
import { NextRequest } from 'next/server';
import { encodeEvent, type AgentEvent, type AgentStateValue } from '@/lib/agent/contracts';
import { subscribe, unsubscribe, WORKFLOW_TOPIC } from '@/lib/server/mastra/event-bus';
import { agentEventBus } from '@/lib/server/agent-runtime/event-bus';

// 注:仓库启用 cacheComponents,不可用 runtime/dynamic 段配置;Route Handler 默认即动态执行。

const HEARTBEAT_MS = 25_000;

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agentId')?.trim() || null;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const pushFrame = (s: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(s));
        } catch {
          closed = true;
        }
      };
      const push = (ev: AgentEvent) => pushFrame(encodeEvent(ev));

      // presence 连接帧
      push({ type: 'state', state: 'idle', activity: 0.12 });
      push({ type: 'telemetry', agent: '系统', text: 'AgentBus 已连接' });

      // workflow 事件转发(记录最近 state 供心跳使用)
      let lastState: AgentStateValue = 'idle';
      const onWorkflowEvent = (ev: AgentEvent) => {
        if (ev.type === 'state') lastState = ev.state;
        push(ev);
      };
      subscribe(WORKFLOW_TOPIC, onWorkflowEvent);

      // agentId 模式：老 Agent 事件经统一通道裸帧推送
      let unsubscribeAgent = () => {};
      if (agentId) {
        unsubscribeAgent = agentEventBus.subscribe(agentId, (agentEv) => {
          pushFrame(`data: ${JSON.stringify(agentEv)}\n\n`);
        });
      }

      // 低频心跳:重发当前 state,防止中间代理掐断空闲 SSE 连接
      const heartbeat = setInterval(() => {
        push({ type: 'state', state: lastState, activity: 0.12 });
      }, HEARTBEAT_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe(WORKFLOW_TOPIC, onWorkflowEvent);
        unsubscribeAgent();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

// app/api/agent/stream/route.ts
// SSE 端点:前端 presence store 通过 EventSource 订阅。
// 保留 presence 连接帧;workflow 运行事件(run route 经 event-bus 发布的
// plan_step/card/telemetry/state)在此转发;25s 低频 state 心跳防代理超时。
import { NextRequest } from 'next/server';
import { encodeEvent, type AgentEvent, type AgentStateValue } from '@/lib/agent/contracts';
import { subscribe, unsubscribe, WORKFLOW_TOPIC } from '@/lib/server/mastra/event-bus';

// 注:仓库启用 cacheComponents,不可用 runtime/dynamic 段配置;Route Handler 默认即动态执行。

const HEARTBEAT_MS = 25_000;

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const push = (ev: AgentEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeEvent(ev)));
        } catch {
          closed = true;
        }
      };

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

      // 低频心跳:重发当前 state,防止中间代理掐断空闲 SSE 连接
      const heartbeat = setInterval(() => {
        push({ type: 'state', state: lastState, activity: 0.12 });
      }, HEARTBEAT_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe(WORKFLOW_TOPIC, onWorkflowEvent);
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

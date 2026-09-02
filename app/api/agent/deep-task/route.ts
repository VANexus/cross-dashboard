/**
 * deep-task SSE 路由 —— pi 深度子代理长任务端点（M2）
 *
 * POST /api/agent/deep-task  { task }
 * → SSE 流：PiEventSummary（delta/thinking/tool_start/tool_end/done/error）逐条推送。
 * 浏览器经 EventSource/fetch 流读取，实时展示子代理进度。
 */
import { NextRequest } from 'next/server';
import { getKernel } from '@/src/kernel';
import type { PiEventSummary } from '@/src/kernel/plugins/pi-subagent';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const task = typeof (body as { task?: unknown })?.task === 'string' ? (body as { task: string }).task.trim() : '';
  if (!task) {
    return Response.json({ error: 'task 必填（自然语言任务描述）' }, { status: 400 });
  }

  const kernel = await getKernel();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (ev: PiEventSummary) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
        } catch {
          closed = true;
        }
      };

      try {
        const summary = await kernel.pi.spawn(task, { onEvent: send });
        send({ type: 'done', text: summary });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[agent/deep-task]', err);
        send({ type: 'error', text: message.slice(0, 500) });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // 已关闭
        }
      }
    },
    cancel() {
      // 客户端断开：pi 会话随请求结束由 GC 回收（inMemory 不落盘）
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

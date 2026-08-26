/**
 * FlowMind AI Orchestrator — Streaming API Route
 *
 * POST /api/orchestrate
 * Accepts user message, returns SSE stream of typed blocks.
 *
 * Each SSE event is a StreamEvent JSON object:
 *   data: {"id":"...","role":"assistant","blocks":[{type:"text",...}],"finished":false}
 *
 * The frontend consumes this with EventSource or fetch + ReadableStream.
 */

import { withDb } from "@/lib/api-helpers";
import { orchestrate } from "@/lib/orchestrator/orchestrator";
import type { OrchestrateRequest } from "@/lib/orchestrator/types";

export const POST = withDb(async (request: Request) => {
  let body: OrchestrateRequest;
  try {
    body = (await request.json()) as OrchestrateRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.message?.trim() && !body.selectedOption) {
    return new Response(JSON.stringify({ error: "Message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const generator = orchestrate(body);

        for await (const event of generator) {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }

        // Send done signal
        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
        controller.close();
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const errorEvent = JSON.stringify({
          id: `err-${Date.now()}`,
          role: "system",
          blocks: [{ type: "error", message: errMsg }],
          finished: true,
          timestamp: Date.now(),
        });
        controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});

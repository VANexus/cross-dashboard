import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { notFound } from "@/lib/api-response";
import * as agentRepo from "@/lib/repositories/agent.repository";
import { agentEventBus } from "@/lib/agent-runtime/event-bus";
import type { AgentEvent } from "@/lib/types";

export const GET = withDb(async (_request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const agent = agentRepo.getAgentById(id);
  if (!agent) return notFound("Agent");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", agentId: id, timestamp: new Date().toISOString() })}\n\n`));

      // Subscribe to agent events
      const unsubscribe = agentEventBus.subscribe(id, (event: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream closed
        }
      });

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      void cleanup;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});

/**
 * FlowMind — 技能运行 API（服务端代理）
 *
 * POST /api/skills/run  body: { id: string, input: Record<string, unknown> }
 *
 * 真实链路：把结构化入参序列化为自然语言 goal，转发到 flowmind A2A 服务器
 * （POST /a2a，JSON-RPC tasks/send）由编排器规划并执行对应技能。
 * 后端不可达/执行失败时返回结构化错误 —— 绝不返回演示数据。
 */
import type { NextRequest } from "next/server";
import { success, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { getFlowmindUrl } from "@/lib/skills/types";

const RUN_TIMEOUT_MS = Number(process.env.FLOWMIND_SKILL_RUN_TIMEOUT ?? 120000);

interface A2ATaskResult {
  status?: { state?: string; message?: string; degraded?: boolean };
  artifacts?: Array<{ parts?: Array<{ type?: string; text?: string }> }>;
}

export const maxDuration = 120;

function buildGoal(id: string, input: Record<string, unknown>): string {
  const params = Object.entries(input)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("；");
  return params
    ? `调用技能 ${id} 执行任务，参数：${params}`
    : `调用技能 ${id} 执行任务`;
}

export async function POST(request: NextRequest) {
  let body: { id?: string; input?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return badRequest("Missing skill id");
  const input = body.input ?? {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);

  try {
    const res = await fetch(`${getFlowmindUrl()}/a2a`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `skill-run-${Date.now()}`,
        method: "tasks/send",
        params: {
          id: `run-${id}-${Date.now()}`,
          message: { parts: [{ type: "text", text: buildGoal(id, input) }] },
          metadata: { include_reasoning: false },
        },
      }),
    });

    if (!res.ok) {
      return badRequest(`flowmind A2A 请求失败（${res.status} ${res.statusText}）`);
    }

    const payload = (await res.json()) as { result?: A2ATaskResult; error?: unknown };
    const task = payload.result;
    if (!task) {
      return badRequest("flowmind A2A 响应缺少 result");
    }

    if (task.status?.state === "failed") {
      return badRequest(task.status.message || "技能执行失败");
    }

    const text = task.artifacts?.[0]?.parts?.map((p) => p.text ?? "").join("\n") ?? "";
    let output: unknown = text;
    if (typeof text === "string" && text.startsWith("{")) {
      try {
        output = JSON.parse(text);
      } catch {
        /* 保持原始文本 */
      }
    }

    return success({ id, degraded: task.status?.degraded ?? false, output });
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? `技能执行超时（${RUN_TIMEOUT_MS}ms）`
        : `无法连接 flowmind 服务（${getFlowmindUrl()}）：${err instanceof Error ? err.message : String(err)}`;
    return badRequest(message);
  } finally {
    clearTimeout(timer);
  }
}

export { methodNotAllowed as PUT };
export { methodNotAllowed as DELETE };

import type { NextRequest } from "next/server";
import { z } from "zod";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody } from "@/lib/server/api-validation";
import { AgentService } from "@/lib/server/services";
import * as agentRepo from "@/lib/server/repositories/agent.repository";
import { getDefaultConfig } from "@/lib/server/agent-runtime/personas";
import { agentRuntime } from "@/lib/server/agent-runtime/runtime";
import type { AgentType } from "@/lib/shared/types";

const service = new AgentService();

export const GET = withDb(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const data = await service.list({
    status: searchParams.get("status") ?? undefined,
    type: searchParams.get("type") ?? undefined,
  });
  return success(data, { page: 1, pageSize: 50, total: data.length, totalPages: 1 });
});

const TYPE_NAMES: Record<AgentType, string> = {
  sentinel: "哨兵Agent",
  dispatch: "调度Agent",
  operations: "运营Agent",
  risk_control: "风控Agent",
  legal: "法务Agent",
  marketing: "营销Agent",
} as Record<AgentType, string>;

const createAgentSchema = z.object({
  // 不限死枚举：任意 type slug 都合法（动态生成）；预设 6 类也可直接按 type 创建
  type: z.string().min(1).max(40).regex(/^[a-z0-9][a-z0-9-]{0,38}$/, "type 必须是英文 slug"),
  name: z.string().min(1).max(50).optional(),
});

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(createAgentSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  const { type, name } = parsed.data;
  // 同类型序号递增：type-001 已被种子占用
  const existing = await agentRepo.getAgents({ type });
  const seq = String(existing.length + 1).padStart(3, "0");
  const id = `${type}-${seq}`;
  const typeName = TYPE_NAMES[type as keyof typeof TYPE_NAMES] ?? type;
  const finalName = name ?? `${typeName}·${seq}`;

  const agent = await agentRepo.createAgent({
    id,
    name: finalName,
    type,
    description: `用户创建的${typeName}（${new Date().toISOString().slice(0, 10)}）`,
    config: getDefaultConfig(type, id),
    status: "online",
  });

  // 立即接入运行时节律（首循环秒级出数据）
  void agentRuntime.startAgent(id).catch(console.error);

  return success(agent);
});

/**
 * FlowMind — 启动装配钩子（instrumentation）
 *
 * Next 16：register() 在每个服务器实例启动时执行一次（早于任何请求）。
 * F1 骨架（2026-09-03）：先落「角色识别」；F2/F4 在此接入：
 *   - worker 角色：启动 Agent 生命循环 + 队列消费（届时把 lib/server/db getDbAsync 里的
 *     agentRuntime.start() fire-and-forget 迁到此处，按角色分支）；
 *   - 全角色：OTel NodeSDK（端点 = lib/cluster 目录 obs.otel，rak-observability 规范）；
 *   - web：保持只读装配（内核按请求驱动）。
 *
 * 角色由 FLOWMIND_ROLE 决定（默认 web）；同一镜像，不同 Deployment/CronJob。
 */

export type FlowmindRole = "web" | "worker" | "cron";

/** 当前进程角色（缺省 = web）。 */
export function flowmindRole(): FlowmindRole {
  const raw = process.env.FLOWMIND_ROLE?.trim().toLowerCase();
  return raw === "worker" || raw === "cron" ? raw : "web";
}

export async function register() {
  // 边缘运行时不执行服务端装配
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const role = flowmindRole();
  console.log(`[instrumentation] flowmind role=${role}`);

  // F4：setupOtel() —— 目录 obs.otel（集群内自动，开发机静默跳过）
  // F2：if (role === "worker") startAgentRuntimeLoops();
  // F3：if (role === "worker") startJobConsumers();
}

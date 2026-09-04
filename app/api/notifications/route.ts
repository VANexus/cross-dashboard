import { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success } from "@/lib/server/api-response";
import { DashboardService } from "@/lib/server/services/dashboard.service";
import { prisma } from "@/lib/server/db";

/**
 * 通知聚合 API：
 * 从真实数据源聚合通知列表（风险告警 + 工作流运行结果）。
 * 已读状态由前端 localStorage 管理（避免新建 DB 表）。
 */
export const GET = withDb(async (_request: NextRequest) => {
  const svc = new DashboardService();

  // 1. 风险告警（未解决的风险事件）
  const alerts = await svc.getAlerts();

  // 2. 工作流运行完成事件（最近 10 条非 running 的运行记录）
  const wfRuns = await prisma.wf_workflow_runs
    .findMany({
      where: { status: { in: ["success", "failed", "error"] } },
      take: 10,
      orderBy: { started_at: "desc" },
      select: {
        id: true,
        workflow_id: true,
        status: true,
        started_at: true,
        completed_at: true,
        summary: true,
      },
    })
    .catch(() => [] as Array<{
      id: string;
      workflow_id: string;
      status: string;
      started_at: Date | string;
      completed_at: Date | string | null;
      summary: string | null;
    }>);

  // 取 spec 标题映射（runs.workflow_id == wf_workflow_specs.id）
  const specIds = [...new Set(wfRuns.map((r) => r.workflow_id))];
  const specs = specIds.length
    ? await prisma.wf_workflow_specs
        .findMany({
          where: { id: { in: specIds } },
          select: { id: true, title: true },
        })
        .catch(() => [] as Array<{ id: string; title: string }>)
    : [];
  const specMap = new Map(specs.map((s) => [s.id, s.title]));

  // 聚合通知列表
  type Notification = {
    id: string;
    level: "critical" | "warning" | "info";
    title: string;
    description: string;
    time: string;
    href?: string;
  };

  const notifications: Notification[] = [];

  // 风险告警
  for (const a of alerts) {
    notifications.push({
      id: `risk-${a.id}`,
      level: a.level === "danger" ? "critical" : a.level === "warning" ? "warning" : "info",
      title: a.message,
      description: "需人工复核",
      time: a.time,
      href: a.href || "/risk",
    });
  }

  // 工作流结果
  for (const r of wfRuns) {
    const title = specMap.get(r.workflow_id) || r.workflow_id;
    const isFail = r.status === "failed" || r.status === "error";
    notifications.push({
      id: `wf-${r.id}`,
      level: isFail ? "critical" : "info",
      title: `${title} — ${isFail ? "执行失败" : "执行完成"}`,
      description: isFail && r.summary ? r.summary : isFail ? "工作流执行出错" : "工作流已成功完成",
      time: (r.completed_at as string) || (r.started_at as string) || new Date().toISOString(),
      href: "/dashboard",
    });
  }

  // 按时间倒序
  notifications.sort((a, b) => b.time.localeCompare(a.time));

  return success({ notifications });
});

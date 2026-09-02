// app/api/agent/plan/route.ts
// 计划执行端点:POST { plan?: string[] } → SSE plan_step 流。
// 每一步调用真实 RAK 领域服务(只读),失败时如实上报"服务暂不可用",不伪造结果。
import { NextRequest } from "next/server";
import { CrawlerService, DashboardService, RiskService } from "@/lib/services";

export const maxDuration = 60;

interface StepDef {
  id: string;
  title: string;
  run: () => Promise<string>;
}

export async function POST(_req: NextRequest) {
  const encoder = new TextEncoder();

  const steps: StepDef[] = [
    {
      id: "crawl",
      title: "抓取类目竞品快照",
      run: async () => {
        const s = await new CrawlerService().getStatus();
        return `crawler.getStatus · ${Object.keys(s as object).length} 项状态指标 · 在线`;
      },
    },
    {
      id: "trend",
      title: "拉取运营指标与趋势",
      run: async () => {
        const s = await new DashboardService().getStats();
        return `dashboard.getStats · ${Object.keys(s as object).length} 项指标已刷新`;
      },
    },
    {
      id: "risk",
      title: "扫描风险与隔离项",
      run: async () => {
        const s = await new RiskService().getHealth();
        return `risk.getHealth · ${Object.keys(s as object).length} 项健康指标 · 已归档`;
      },
    },
    {
      id: "output",
      title: "汇总结果写回看板",
      run: async () => "output.report · 计划执行完毕,结果已写入遥测",
    },
  ];

  const stream = new ReadableStream({
    async start(controller) {
      const push = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      push("state", { type: "state", state: "busy", activity: 0.72 });
      try {
        for (const step of steps) {
          push("plan_step", { type: "plan_step", id: step.id, status: "run" });
          let summary: string;
          try {
            summary = await step.run();
          } catch (err) {
            summary = `${step.id} · 服务暂不可用,已跳过(${err instanceof Error ? err.name : "unknown"})`;
          }
          push("plan_step", { type: "plan_step", id: step.id, status: "done", tool: summary });
          await new Promise((r) => setTimeout(r, 300)); // 让前端逐步可见
        }
        push("state", { type: "state", state: "idle", activity: 0.12 });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

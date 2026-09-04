/**
 * AI 动态工作流页面 —— /wf/[slug]
 *
 * 读 wf_workflow_specs 表的动态工作流 spec（steps DAG）→ react-generative-ui 服务端预渲染步骤卡。
 * 与 /p/[slug]（AI 动态页面）同架构，但数据源为工作流产物（M4 plan_workflow 落库）。
 */
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getKernel } from "@/src/kernel";
import { PageHeader } from "@/components/ui/page-header";
import { WorkflowPageRenderer } from "./page-spec-renderer";

type Params = { params: Promise<{ slug: string }> };

async function loadSpec(slug: string) {
  await connection();
  const kernel = await getKernel();
  try {
    return await kernel.specs.getWorkflowSpec(slug);
  } catch {
    return null;
  }
}

// cache-components 要求动态路由提供至少一个真实样本供 build-time validation。
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return [{ slug: "sample" }];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const row = await loadSpec(slug);
  return { title: row ? `${row.title} | FlowMind 工作流` : "动态工作流 | FlowMind" };
}

export default async function WorkflowPage({ params }: Params) {
  return (
    <Suspense fallback={null}>
      <WorkflowLoader params={params} />
    </Suspense>
  );
}

async function WorkflowLoader({ params }: Params) {
  const { slug } = await params;
  const row = await loadSpec(slug);
  if (!row) notFound();
  const steps = (row.spec?.steps ?? []).map((s) => ({
    id: s.id,
    tool: s.tool,
    args: s.args ?? {},
    dependsOn: s.dependsOn ?? [],
  }));
  return (
    <div className="space-y-4">
      <PageHeader
        title={row.title}
        actions={<span className="rounded-full border border-primary/40 bg-primary/5 px-2 py-0.5 text-tiny font-medium text-primary">
          AI 动态工作流 · {steps.length} 步
        </span>}
      />
      <WorkflowPageRenderer steps={steps} updatedAt={row.updated_at} />
    </div>
  );
}

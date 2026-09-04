"use client";

/**
 * /wf/[slug] 客户端渲染层：把动态工作流 steps DAG 经 workflowToBlocks 转成 UIBlock[]，
 * 交给 <RscGenerativeRenderer> 用 react-generative-ui 预渲染（步骤卡 + 运行状态）。
 */
import { workflowToBlocks } from "@/lib/agent/genui/rsc";
import { RscGenerativeRenderer } from "@/components/agent/generated/rsc-generative-renderer";

export interface WorkflowStepView {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  dependsOn: string[];
}

export function WorkflowPageRenderer({
  steps,
  updatedAt,
}: {
  steps: WorkflowStepView[];
  updatedAt: string;
}) {
  if (!steps || steps.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        该工作流暂无步骤。
      </div>
    );
  }
  const blocks = workflowToBlocks({ steps });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <RscGenerativeRenderer blocks={blocks} className="contents" />
      </div>
      <div className="text-caption text-muted-foreground">
        更新于 {new Date(updatedAt).toLocaleString("zh-CN")} · 服务端预渲染
      </div>
    </div>
  );
}

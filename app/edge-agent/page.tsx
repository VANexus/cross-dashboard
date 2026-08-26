/**
 * FlowMind — Edge Agent 页面
 *
 * 遵循项目 Island/SSR 模式：
 * page.tsx（Suspense）→ island.tsx（SSR 数据）→ client.tsx（客户端 UI）
 */
import { Suspense } from "react";
import { EdgeAgentIsland } from "./islands/edge-agent-island";
import { EdgeAgentClient } from "./edge-agent-client";
import EdgeAgentLoading from "./loading";

export default async function EdgeAgentPage() {
  const { skills, error } = await EdgeAgentIsland();

  return (
    <Suspense fallback={<EdgeAgentLoading />}>
      <EdgeAgentClient skills={skills} error={error} />
    </Suspense>
  );
}

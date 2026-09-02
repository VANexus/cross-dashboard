"use client";

import dynamic from "next/dynamic";
import type { TopologyAgent } from "./agent-topology";

const AgentTopology = dynamic(
  () => import("./agent-topology").then((m) => ({ default: m.AgentTopology })),
  {
    ssr: false,
    loading: () => <div className="h-[260px] w-full skeleton rounded-2xl" />,
  }
);

/**
 * 客户端包装：Next.js 16 不允许在 Server Component 中使用 `ssr:false` 的
 * next/dynamic，故把拓扑的懒加载下沉到本客户端组件。
 */
export function AgentTopologyClient({ agents }: { agents: TopologyAgent[] }) {
  return <AgentTopology agents={agents} />;
}

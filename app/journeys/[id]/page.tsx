import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Suspense } from "react";

// @xyflow/react 较重：dynamic 拆包，执行视图先出骨架屏，流水线画布按需加载
const JourneyRunClient = dynamic(() => import("./journey-run-client").then((m) => ({ default: m.JourneyRunClient })), {
  loading: () => (
    <div className="space-y-4 p-6">
      <div className="h-8 w-64 skeleton rounded-md" />
      <div className="h-[420px] w-full skeleton rounded-2xl" />
    </div>
  ),
});

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `旅程执行 | ${id} | FlowMind` };
}

export default function JourneyRunPage({ params }: Props) {
  // cache-components：async page 顶层 await params 属 uncached，需落在 Suspense 内；
  // 否则 AppShell(Suspense 外)渲染时报 blocking-route。保持同步，把 await params
  // 放进 <Suspense> 内的 async loader。
  return (
    <Suspense fallback={null}>
      <JourneyRunLoader params={params} />
    </Suspense>
  );
}

// cache-components 要求动态路由提供至少一个真实样本供 build-time validation。
export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  return [{ id: "content-publish" }];
}

async function JourneyRunLoader({ params }: Props) {
  const { id } = await params;
  return <JourneyRunClient journeyId={id} />;
}

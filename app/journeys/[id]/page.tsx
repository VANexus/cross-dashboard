import type { Metadata } from "next";
import dynamic from "next/dynamic";

// @xyflow/react 较重：dynamic 拆包，执行视图先出骨架屏，流水线画布按需加载
const JourneyRunClient = dynamic(() => import("./journey-run-client").then((m) => ({ default: m.JourneyRunClient })), {
  loading: () => (
    <div className="space-y-4 p-6">
      <div className="h-8 w-64 animate-pulse rounded-md bg-muted/60" />
      <div className="h-[420px] w-full animate-pulse rounded-2xl bg-muted/40" />
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

export default async function JourneyRunPage({ params }: Props) {
  const { id } = await params;
  return <JourneyRunClient journeyId={id} />;
}

/**
 * 会话快照页 —— /conversations/[id]
 *
 * RSC 预渲染：把某次 Agent 会话里 AI 生成的动态组件（json-render data-spec parts）
 * 服务端预渲染成 HTML（首屏可见、SEO 友好），与抽屉/仪表盘的客户端流式渲染互补。
 */
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ConversationService } from "@/lib/server/services/conversation.service";
import { PageHeader } from "@/components/ui/page-header";
import { TranscriptIsland } from "./islands/transcript-island";

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  await connection();
  return new ConversationService().get(id);
}

export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  return [{ id: "sample" }];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const conv = await load(id);
  return { title: conv ? `${conv.title} | 会话快照` : "会话快照 | FlowMind" };
}

export default async function ConversationPage({ params }: Params) {
  return (
    <Suspense fallback={null}>
      <TranscriptLoader params={params} />
    </Suspense>
  );
}

async function TranscriptLoader({ params }: Params) {
  const { id } = await params;
  const conv = await load(id);
  if (!conv) notFound();
  return (
    <div className="space-y-4">
      <PageHeader
        title={conv.title}
        actions={<span className="rounded-full border border-primary/40 bg-primary/5 px-2 py-0.5 text-tiny font-medium text-primary">
          会话快照 · {conv.message_count} 条
        </span>}
      />
      <TranscriptIsland messages={conv.messages} />
    </div>
  );
}

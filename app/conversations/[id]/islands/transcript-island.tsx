"use client";

/**
 * 会话快照转录岛：把会话里每条助手消息的 AI 生成组件（data-spec parts）经 specFromParts
 * 编译成 spec → specToBlocks → <RscGenerativeRenderer> 服务端预渲染；无组件的消息降级为文本摘要。
 */
import { specFromParts, specToBlocks, parseTranscriptText } from "@/lib/agent/genui/rsc";
import { RscGenerativeRenderer } from "@/components/agent/generated/rsc-generative-renderer";
import { MarkdownMessage } from "@/components/agent/markdown-message";

export interface TranscriptMessage {
  id: string;
  role: string;
  content: string;
  parts?: unknown;
}

export function TranscriptIsland({ messages }: { messages: TranscriptMessage[] }) {
  if (!messages || messages.length === 0) {
    return <div className="text-caption text-muted-foreground">暂无消息。</div>;
  }
  return (
    <div className="space-y-4">
      {messages.map((m) => {
        if (m.role !== "assistant") {
          // 用户消息：右对齐文本摘要
          return (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary/10 px-4 py-2.5 text-sm text-foreground">
                {m.content || "（空）"}
              </div>
            </div>
          );
        }
        // 助手消息：优先还原 json-render 组件，其次文本
        const spec = specFromParts(m.parts);
        const blocks = spec ? specToBlocks(spec) : parseTranscriptText(m.content ?? "");
        return (
          <div key={m.id} className="text-foreground">
            {blocks.length > 0 ? (
              <RscGenerativeRenderer blocks={blocks} />
            ) : (
              <MarkdownMessage text={m.content ?? ""} />
            )}
          </div>
        );
      })}
    </div>
  );
}

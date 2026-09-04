// components/agent/markdown-message.tsx
'use client';
// 对话消息 Markdown 渲染器：react-markdown + remark-gfm（表格/删除线/任务列表）。
// 默认不渲染原始 HTML（无 rehype-raw），杜绝注入；样式对齐 FlowMind 深色 token。
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

/** 单条文本消息的 Markdown 渲染（user 与 assistant 共用，外观由 wrapper 区分）。 */
export function MarkdownMessage({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn('markdown-body', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-1.5 mt-2 text-[15px] font-bold leading-snug text-foreground first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-1.5 mt-2 text-sm font-bold leading-snug text-foreground first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 mt-1.5 text-[13px] font-bold leading-snug text-foreground first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-1 mt-1.5 text-xs font-bold leading-snug text-foreground first:mt-0">
              {children}
            </h4>
          ),
          p: ({ children }) => <p className="my-1 text-xs leading-relaxed text-foreground">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic text-foreground">{children}</em>,
          del: ({ children }) => <del className="text-muted-foreground line-through">{children}</del>,
          ul: ({ children }) => <ul className="my-1 list-disc space-y-0.5 pl-4 text-xs text-foreground">{children}</ul>,
          ol: ({ children }) => <ol className="my-1 list-decimal space-y-0.5 pl-4 text-xs text-foreground">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-1.5 border-l-2 border-primary/40 bg-primary/5 px-2.5 py-1 text-xs italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-2 border-border" />,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
              {children}
            </a>
          ),
          code: ({ className: cls, children }) => {
            const match = /language-(\w+)/.exec(cls ?? '');
            return match ? (
              <code className="block overflow-x-auto whitespace-pre rounded-md bg-muted/80 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-foreground">
                {children}
              </code>
            ) : (
              <code className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[11px] text-primary">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-1.5 overflow-hidden rounded-md border border-border bg-muted/50 p-0">{children}</pre>
          ),
          table: ({ children }) => (
            <div className="my-1.5 overflow-x-auto">
              <table className="w-full border-collapse text-[11px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/70">{children}</thead>,
          th: ({ children }) => (
            <th className="whitespace-nowrap border border-border px-2 py-1 text-left font-semibold text-foreground">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-2 py-1 align-top text-foreground">{children}</td>
          ),
          input: ({ checked, type }) =>
            type === 'checkbox' ? (
              <input type="checkbox" checked={checked} readOnly disabled className="mr-1.5 align-[-2px]" />
            ) : null,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

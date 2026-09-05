// components/agent/markdown-message.tsx
'use client';
// 对话消息 Markdown 渲染器 —— @deltakit/markdown（流式增量渲染，替代 react-markdown）。
//
// 为什么换：
// - react-markdown 每次 token 都对「整条累积文本」全量重解析（micromark + remark 五段管道），
//   长回复 O(n²) 阻塞主线程 → 这就是 AI 生成卡、拖拽卡的真凶。
// - @deltakit/markdown 是流式原生：增量解析只处理新增块，已定型块经 React.memo 冻结不重渲染，
//   batchMs 按帧批量渲染（默认 16ms=60fps 平滑），不完整语法（未闭合 ``` 、** 、[）被缓冲隐藏，
//   不会闪出残影。像 Claude/GPT/Grok 网页端那样逐 token 丝滑。
// - 安全：不渲染原始 HTML（无 rehypeRaw 等价物），维持本项目防 XSS 边界。
//
// 用法约定：
// - 流式中的活跃助手消息 → streaming=true 走 <StreamingMarkdown content>（增量、平滑）。
// - 历史/完整消息 → streaming=false 走 <Markdown content>（最轻量，零流式开销）。
// - 两条路径都经 React.memo 包裹：text 未变时整棵子树跳过，历史消息不再随每次 token 重渲染。
import React, { memo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Markdown, StreamingMarkdown } from '@deltakit/markdown';
import type { ComponentOverrides } from '@deltakit/markdown';
import { usePresence } from '@/stores/agent-presence';
import { cn } from '@/lib/utils';

/**
 * 站内链接：在当前标签页跳转（不新开），并保证 Agent 对话侧栏可见——
 * Agent 回复里给出的 /p/、/journeys 等链接被点击时，聊天框不会"突然消失"。
 * 从 /dashboard 沉浸式页点击时：抽屉在该页被强制 dock，待路由生效后再展开，避免沉浸页上闪出面板。
 */
function InternalLink({ href, children }: { href?: string; children?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  if (!href) return <span className="text-primary">{children}</span>;
  const internal = href.startsWith('/') && !href.startsWith('//');
  if (!internal) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
        {children}
      </a>
    );
  }
  const openAsideAfterNav = () => {
    window.setTimeout(() => {
      const st = usePresence.getState();
      if (!st.drawerOpen && !st.stageOpen && window.location.pathname !== '/dashboard') st.setSurface('sidebar');
    }, 300);
  };
  return (
    <a
      href={href}
      className="text-primary underline underline-offset-2"
      onClick={(e) => {
        const st = usePresence.getState();
        if (pathname !== '/dashboard' && !st.drawerOpen && !st.stageOpen) st.setSurface('sidebar');
        else if (pathname === '/dashboard') openAsideAfterNav();
        e.preventDefault();
        router.push(href);
        if (pathname !== '/dashboard') openAsideAfterNav();
      }}
    >
      {children}
    </a>
  );
}

/** 模块级常量：模块级引用保证组件在 content 不变时可 bail-out（内联对象会破坏记忆化）。 */
const DELTAKIT_COMPONENTS: ComponentOverrides = {
  p: ({ children }) => <p className="my-1 text-xs leading-relaxed text-foreground">{children}</p>,
  h1: ({ children }) => (
    <h1 className="mb-1.5 mt-2 text-[15px] font-bold leading-snug text-foreground first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1.5 mt-2 text-sm font-bold leading-snug text-foreground first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-1.5 text-[13px] font-bold leading-snug text-foreground first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-1.5 text-xs font-bold leading-snug text-foreground first:mt-0">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="mb-1 mt-1 text-xs font-bold leading-snug text-foreground first:mt-0">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="mb-1 mt-1 text-[11px] font-bold leading-snug text-foreground first:mt-0">{children}</h6>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-foreground">{children}</em>,
  del: ({ children }) => <del className="text-muted-foreground line-through">{children}</del>,
  blockquote: ({ children }) => (
    <blockquote className="my-1.5 border-l-2 border-primary/40 bg-primary/5 px-2.5 py-1 text-xs italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-2 border-border" />,
  a: ({ href, children }) => <InternalLink href={href}>{children}</InternalLink>,
  code: ({ language: _language, children, inline }) =>
    inline ? (
      <code className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[11px] text-primary">{children}</code>
    ) : (
      <code className="block overflow-x-auto whitespace-pre rounded-md bg-muted/80 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-foreground">
        {children}
      </code>
    ),
  pre: ({ children }) => (
    <pre className="my-1.5 overflow-hidden rounded-md border border-border bg-muted/50 p-0">{children}</pre>
  ),
  img: ({ src, alt }) => (
    <img src={src} alt={alt} loading="lazy" className="my-1.5 max-w-full rounded-md border border-border" />
  ),
  table: ({ children }) => (
    <div className="my-1.5 overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/70">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-border/60 last:border-0">{children}</tr>,
  th: ({ children }) => (
    <th className="whitespace-nowrap border border-border px-2 py-1 text-left font-semibold text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border border-border px-2 py-1 align-top text-foreground">{children}</td>,
};

interface MarkdownMessageProps {
  text: string;
  className?: string;
  /** 是否处于流式生成中：是则用 StreamingMarkdown（增量 + batchMs 平滑），否则用轻量 Markdown。 */
  streaming?: boolean;
}

/** 单条文本消息的 Markdown 渲染（user 与 assistant 共用，外观由 wrapper 区分）。 */
function MarkdownMessageImpl({ text, className, streaming = false }: MarkdownMessageProps) {
  return (
    <div className={cn('markdown-body', className)}>
      {streaming ? (
        <StreamingMarkdown content={text} components={DELTAKIT_COMPONENTS} batchMs={16} />
      ) : (
        <Markdown content={text} components={DELTAKIT_COMPONENTS} />
      )}
    </div>
  );
}

/** React.memo：text/className/streaming 均未变化时跳过整棵子树（流式期间历史消息不重渲染）。 */
export const MarkdownMessage = memo(MarkdownMessageImpl);

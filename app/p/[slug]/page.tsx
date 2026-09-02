/**
 * AI 动态页面（M5）—— /p/[slug]
 *
 * 读 wf_page_specs 表的组件树 spec → component-kit 白名单渲染。
 * 静态 29 页不动，本路由是 agent 动态生成页的增量层（命名空间隔离）。
 */
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { Metadata } from "next";
import { getKernel } from "@/src/kernel";
import { PageSpecRenderer } from "./page-spec-renderer";

// cacheComponents 开启时不能用 `export const dynamic`，改用 connection() 把本路由标记为动态渲染
// （按 slug 实时读 wf_page_specs，不做静态预渲染），与各 b2b SSR island 同一约定。

type Params = { params: Promise<{ slug: string }> };

async function loadSpec(slug: string) {
  await connection();
  const kernel = await getKernel();
  try {
    return await kernel.specs.getPageSpec(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const row = await loadSpec(slug);
  return { title: row ? `${row.title} | FlowMind` : "动态页面 | FlowMind" };
}

export default async function GeneratedPage({ params }: Params) {
  const { slug } = await params;
  const row = await loadSpec(slug);
  if (!row) notFound();
  return <PageSpecRenderer title={row.title} spec={row.spec} updatedAt={row.updated_at} />;
}

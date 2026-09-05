"use client";

/**
 * 动态页面渲染器（M5 /p/[slug]）——默认只读 · Agent 上下文驱动
 *
 * 设计取向（2026-09-05）：
 * - 默认纯只读展示：不向普通访客暴露任何编辑入口；
 * - 「页面即上下文」：始终向 Agent 上报当前组件树摘要 + 完整编辑动作集合
 *   （追加 / 在指定位置插入 / 改 props / 移动 / 删除）——AI 增量与全页统一编排全部经对话完成；
 * - 编辑器（工具条 / 序号角标 / 就地 JSON 编辑）仅在设置页开启 pageEditorEnabled 时展示，
 *   面向高阶团队做微调，不影响 Agent 灵活度。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { ChevronDown, ChevronUp, Edit3, Trash2 } from "lucide-react";
import type { PageSpec } from "@/src/kernel/plugins/spec-store";
import { componentDefs } from "@/components/agent/generated";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { useAgentPage } from "@/lib/agent/page-context";
import type { UIActionDef } from "@/lib/agent/ui-actions";
import { cn } from "@/lib/utils";

type Comp = PageSpec["components"][number];

function SpecComponent({ component, props }: { component: string; props: Record<string, unknown> }) {
  const def = componentDefs.find((d) => d.id === component);
  if (!def) {
    return (
      <div className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        未知白名单组件：{component}
      </div>
    );
  }
  const parsed = def.propsSchema.safeParse(props ?? {});
  if (!parsed.success) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        组件 {component} 的 props 校验失败：{parsed.error.issues[0]?.message ?? "未知错误"}
      </div>
    );
  }
  return <>{def.render(parsed.data as Record<string, unknown>)}</>;
}

async function patch(slug: string, body: unknown): Promise<boolean> {
  const res = await fetch(`/api/agent/pages/${slug}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => null)) as { success?: boolean } | null;
  return j?.success === true;
}

/** 一句话生成 → 落库/返回候选（对话侧 Agent 动作用；无 UI） */
async function generateCandidate(slug: string, prompt: string): Promise<{ ok: boolean; candidate?: Comp; error?: string }> {
  const res = await fetch(`/api/agent/pages/${slug}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const j = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: { candidate?: Comp };
    error?: string;
  };
  if (j?.success && j.data?.candidate) return { ok: true, candidate: j.data.candidate };
  return { ok: false, error: j?.error ?? "组件生成失败" };
}

export function PageSpecRenderer({
  title,
  spec,
  updatedAt,
  slug,
  editorEnabled,
}: {
  title: string;
  spec: PageSpec;
  updatedAt: string;
  slug: string;
  /** 设置页开关：true 时额外渲染组件编辑工具条 / 序号角标 / 就地 JSON 编辑 */
  editorEnabled: boolean;
}) {
  const router = useRouter();
  const comps = spec?.components ?? [];

  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  /** 刚被更新的组件 id：短暂高亮提示落位（对话增量时同样生效） */
  const [flashId, setFlashId] = useState<string | null>(null);

  useEffect(() => {
    if (!flashId) return;
    const t = setTimeout(() => setFlashId(null), 2600);
    return () => clearTimeout(t);
  }, [flashId]);

  const summary = useMemo(() => comps.map((c) => `${c.component}(${c.id})`).join("；"), [comps]);

  const runPatch = useCallback(
    async (body: unknown): Promise<boolean> => {
      const ok = await patch(slug, body);
      if (ok) router.refresh();
      return ok;
    },
    [slug, router],
  );

  // ── 对话侧动作：生成 + 落库（追加 / 指定位置插入）──────────────────
  const aiAppendQuick = async (prompt: string) => {
    const g = await generateCandidate(slug, prompt);
    if (!g.ok || !g.candidate) return g.error ?? "组件生成失败";
    return (await runPatch({ op: "append", component: g.candidate }))
      ? `已为页面追加 ${g.candidate.component}（${g.candidate.id}）并刷新`
      : "追加落库失败";
  };
  const aiInsertQuick = async (prompt: string, index: number) => {
    if (index < 0 || index > comps.length) return `index ${index} 越界（共 ${comps.length} 个）`;
    const g = await generateCandidate(slug, prompt);
    if (!g.ok || !g.candidate) return g.error ?? "组件生成失败";
    return (await runPatch({ op: "insert", index, component: g.candidate }))
      ? `已在第 ${index + 1} 位插入 ${g.candidate.component}（${g.candidate.id}）并刷新`
      : "插入落库失败";
  };

  // ── JSON 编辑（仅编辑器开关开启时可见）────────────────────────────
  const openEdit = (idx: number) => {
    setEditIdx(idx);
    setDraft(JSON.stringify(comps[idx]?.props ?? {}, null, 2));
  };
  const saveEdit = async (idx: number) => {
    let props: Record<string, unknown>;
    try {
      props = JSON.parse(draft);
    } catch {
      return;
    }
    const def = componentDefs.find((d) => d.id === comps[idx]?.component);
    const parsed = def?.propsSchema.safeParse(props);
    if (parsed && !parsed.success) return;
    const ok = await runPatch({
      op: "replace",
      index: idx,
      component: { id: comps[idx].id, component: comps[idx].component, props: parsed ? parsed.data : props },
    });
    if (ok) {
      setEditIdx(null);
      setDraft("");
    }
  };

  // ── 页面即上下文：Agent 可感知组件树并直接增删改插移 ─────────────
  const pageActions = useMemo<UIActionDef[]>(() => {
    return [
      {
        id: "aiAppendComponent",
        description: `在当前 AI 动态页面末尾追加一个组件：用一句话描述想要的新组件（自动感知现有组件：${summary}，风格保持一致）。`,
        riskLevel: "L1",
        schema: z.object({ prompt: z.string().min(1).describe("一句话描述新组件") }),
        execute: async (p) => aiAppendQuick(String(p.prompt)),
      },
      {
        id: "aiInsertComponent",
        description: `在当前 AI 动态页面的第 index 个组件之前插入一个新组件：用一句话描述（自动感知现有组件：${summary}）。index 以 0 起，0=最顶部，${comps.length}=追加到末尾。`,
        riskLevel: "L1",
        schema: z.object({
          index: z.number().int().min(0).describe("插入位置（0 起）"),
          prompt: z.string().min(1).describe("一句话描述新组件"),
        }),
        execute: async (p) => aiInsertQuick(String(p.prompt), Number(p.index)),
      },
      {
        id: "editPageComponent",
        description: "编辑页面第 index 个组件的 props（JSON 对象），保存后页面刷新。",
        riskLevel: "L1",
        schema: z.object({ index: z.number().int().min(0), props: z.record(z.string(), z.unknown()) }),
        execute: async (p) => {
          const i = p.index as number;
          if (i < 0 || i >= comps.length) return `index ${i} 越界（共 ${comps.length} 个）`;
          const ok = await runPatch({
            op: "replace",
            index: i,
            component: { id: comps[i].id, component: comps[i].component, props: p.props as Record<string, unknown> },
          });
          return ok ? `已更新第 ${i + 1} 个组件（${comps[i].component}）` : "更新失败";
        },
      },
      {
        id: "movePageComponent",
        description: "把页面第 index 个组件移动到 to 位置（顺序调整）。",
        riskLevel: "L1",
        schema: z.object({ index: z.number().int().min(0), to: z.number().int().min(0) }),
        execute: async (p) => {
          const ok = await runPatch({ op: "move", index: p.index, to: p.to });
          return ok ? `已移动组件 ${p.index} → ${p.to}` : "移动失败";
        },
      },
      {
        id: "removePageComponent",
        description: "删除页面第 index 个组件（页面至少保留 1 个）。",
        riskLevel: "L1",
        schema: z.object({ index: z.number().int().min(0) }),
        execute: async (p) => {
          const ok = await runPatch({ op: "remove", index: p.index });
          return ok ? `已删除第 ${p.index} 个组件` : "删除失败";
        },
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, comps, runPatch]);
  useAgentPage({
    title: `${title} · AI 动态页面`,
    snapshot: () => `页面组件 ${comps.length} 个：${summary}`,
    state: () => ({ componentCount: comps.length, components: comps.map((c) => c.component) }),
    actions: pageActions,
  });

  return (
    <div className="space-y-4">
      {/* 只读头部：不暴露任何编辑入口（编辑器开关开启时仅展示角标/工具条，仍无独立按钮） */}
      <PageHeader
        title={title}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary/40 bg-primary/5 px-2 py-0.5 text-tiny font-medium text-primary">
              AI 生成页面
            </span>
            <span className="text-caption text-muted-foreground">更新于 {new Date(updatedAt).toLocaleString("zh-CN")}</span>
          </div>
        }
      />

      {/* 组件画布 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {comps.map((c, idx) => (
          <div
            key={c.id}
            className={cn(
              "group relative",
              c.component === "stat-card" ? "" : "md:col-span-2",
              flashId === c.id && "z-10 rounded-2xl ring-2 ring-primary/80 shadow-lg",
            )}
          >
            {editorEnabled && editIdx === idx ? (
              <div className="rounded-xl border bg-card/80 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>#{idx + 1} · 编辑 {c.component} · props (JSON)</span>
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setEditIdx(null)}>取消</Button>
                    <Button size="sm" className="h-6 px-2 text-[11px]" onClick={() => void saveEdit(idx)}>保存</Button>
                  </span>
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={8}
                  className="w-full resize-y rounded-md border bg-background p-2 font-mono text-[11px] outline-none focus:border-primary/40"
                />
              </div>
            ) : (
              <>
                {editorEnabled && (
                  <span className="absolute left-1.5 top-1.5 z-10 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                    #{idx + 1}
                  </span>
                )}
                <SpecComponent component={c.component} props={c.props ?? {}} />
                {editorEnabled && (
                  <div
                    className={cn(
                      "absolute right-1.5 top-1.5 z-10 items-center gap-0.5 rounded-lg border bg-background/90 px-1 py-0.5 shadow-md backdrop-blur",
                      "flex",
                    )}
                  >
                    <button title="上移" onClick={() => void runPatch({ op: "move", index: idx, to: Math.max(0, idx - 1) })} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button title="下移" onClick={() => void runPatch({ op: "move", index: idx, to: Math.min(comps.length - 1, idx + 1) })} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button title="编辑 props" onClick={() => openEdit(idx)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button title="删除" onClick={() => void runPatch({ op: "remove", index: idx })} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
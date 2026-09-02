"use client";

/**
 * 动态页面渲染器（M5 /p/[slug] 客户端渲染层）
 *
 * 服务端读出 wf_page_specs spec 后交给本组件：逐项查 component-kit 白名单
 * 注册表 → propsSchema zod 校验 → 渲染。禁止任意 JSX/eval（安全底线）。
 * stat-card 进网格，其余组件整行铺开。
 */
import type { PageSpec } from "@/src/kernel/plugins/spec-store";
import { componentDefs } from "@/components/agent/generated";

function SpecComponent({ component, props }: { component: string; props: Record<string, unknown> }) {
  const def = componentDefs.find((d) => d.id === component);
  if (!def) {
    return (
      <div className="rounded-xl border border-dashed border-border px-3 py-2 text-[12px] text-muted-foreground">
        未知白名单组件：{component}
      </div>
    );
  }
  const parsed = def.propsSchema.safeParse(props ?? {});
  if (!parsed.success) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/5 px-3 py-2 text-[12px] text-red-600 dark:text-red-400">
        组件 {component} 的 props 校验失败：{parsed.error.issues[0]?.message ?? "未知错误"}
      </div>
    );
  }
  return <>{def.render(parsed.data as Record<string, unknown>)}</>;
}

export function PageSpecRenderer({
  title,
  spec,
  updatedAt,
}: {
  title: string;
  spec: PageSpec;
  updatedAt: string;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
        <span className="rounded-full border border-primary/40 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary">
          AI 生成页面
        </span>
        <span className="text-[11px] text-muted-foreground">
          更新于 {new Date(updatedAt).toLocaleString("zh-CN")}
        </span>
      </header>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {spec.components.map((c) => (
          <div key={c.id} className={c.component === "stat-card" ? "" : "md:col-span-2"}>
            <SpecComponent component={c.component} props={c.props ?? {}} />
          </div>
        ))}
      </div>
    </div>
  );
}

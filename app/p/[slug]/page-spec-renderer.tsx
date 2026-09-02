"use client";

/**
 * 动态页面渲染器（M5 /p/[slug] 客户端渲染层）
 *
 * 服务端读出 wf_page_specs spec 后交给本组件：逐项查 component-kit 白名单
 * 注册表 → propsSchema zod 校验 → 渲染。禁止任意 JSX/eval（安全底线）。
 * stat-card 进网格，其余组件整行铺开。
 */
import { PageHeader } from "@/components/ui/page-header";
import type { PageSpec } from "@/src/kernel/plugins/spec-store";
import { componentDefs } from "@/components/agent/generated";

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
    <div className="space-y-4">
      <PageHeader
        title={title}
        actions={<div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-primary/40 bg-primary/5 px-2 py-0.5 text-tiny font-medium text-primary">
            AI 生成页面
          </span>
          <span className="text-caption text-muted-foreground">
            更新于 {new Date(updatedAt).toLocaleString("zh-CN")}
          </span>
        </div>}
      />
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

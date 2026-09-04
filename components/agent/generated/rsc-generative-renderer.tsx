// components/agent/generated/rsc-generative-renderer.tsx
// 'use client'：RSC 预渲染的动态组件渲染器。用 react-generative-ui 的 <GenerativeRenderer>
// 把服务端转好的 UIBlock[]（componentName + props）渲染成组件；registry 复用 component-kit 的
// componentDefs（withSchema 包 zod 校验 + fallback），保证「服务端预渲染首屏 + 客户端 hydration」一致。
import { memo } from 'react';
import { GenerativeRenderer, withSchema, type ComponentRegistry, type UIBlock } from 'react-generative-ui';
import { GitBranch } from 'lucide-react';
import { componentDefs } from '@/components/agent/generated';

/** 把 componentDefs 转成 react-generative-ui 的 registry（组件名 = 白名单 id，withSchema 包 propsSchema）。 */
function buildRscRegistry(): ComponentRegistry {
  const reg: ComponentRegistry = {};
  for (const def of componentDefs) {
    // def.render 是 (props) => ReactNode；包成 FC 供 GenerativeRenderer
    const C: React.FC<Record<string, unknown>> = (props) => <>{def.render(props)}</>;
    reg[def.id] = def.propsSchema ? withSchema(C as never, def.propsSchema as never) : C;
  }
  // 动态工作流步骤卡：tool / 状态 / args 摘要 / dependsOn 拓扑（无 schema 校验，纯展示）
  reg['workflow-step'] = WorkflowStepCard as never;
  return reg;
}

/** 动态工作流步骤卡（/wf/[slug] 用）。 */
function WorkflowStepCard({
  index,
  id,
  tool,
  args,
  dependsOn,
}: {
  index?: number;
  id?: string;
  tool?: string;
  args?: Record<string, unknown>;
  dependsOn?: string[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-tiny font-bold text-primary">
          {index ?? '#'}
        </span>
        <span className="shrink-0 font-mono font-semibold text-primary">{tool ?? 'tool'}</span>
        <span className="truncate font-mono text-tiny text-muted-foreground">{id ?? ''}</span>
      </div>
      {dependsOn && dependsOn.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1 text-tiny text-muted-foreground">
          <GitBranch className="h-3 w-3" />
          依赖：
          {dependsOn.map((d) => (
            <span key={d} className="rounded bg-muted px-1 py-0.5 font-mono">{d}</span>
          ))}
        </div>
      )}
      {args && Object.keys(args).length > 0 && (
        <div className="mt-1.5 line-clamp-2 whitespace-pre-wrap break-all font-mono text-[11px] leading-snug text-muted-foreground">
          {JSON.stringify(args).slice(0, 200)}
        </div>
      )}
    </div>
  );
}

const RSC_REGISTRY = buildRscRegistry();

function RscFallback({ block }: { block: UIBlock }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
      未注册组件：{block.componentName}
    </div>
  );
}

interface RscGenerativeRendererProps {
  blocks: UIBlock[];
  className?: string;
}

/** RSC 快照渲染：blocks → GenerativeRenderer（registry 复用 componentDefs）。 */
export const RscGenerativeRenderer = memo(function RscGenerativeRenderer({
  blocks,
  className,
}: RscGenerativeRendererProps) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <GenerativeRenderer blocks={blocks} registry={RSC_REGISTRY} fallback={RscFallback} className={className} />
  );
});

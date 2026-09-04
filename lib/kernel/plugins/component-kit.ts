'use client';

/**
 * component-kit 前端内核插件 —— provide: `components` service
 *
 * 生成式 UI（L1 动态组件）注册表：白名单组件的 id / 描述 / zod props schema / 渲染函数。
 * 组件实现与 defs 列表在 components/agent/generated/（M3），抽屉挂载时 registerAll；
 * render_component client tool 的 props 校验与渲染都经本服务路由——禁止任意 JSX/eval。
 */
import type { ReactNode } from 'react';
import type { z } from 'zod';
import { Context, Service } from '../../../src/kernel/vendor/cordis';

declare module '../../../src/kernel/vendor/cordis/context' {
  interface Context {
    components: ComponentKitService;
  }
}

/** 渲染上下文：向 Agent 回传交互结果（如 question 组件把答案送回对话流）。 */
export interface ComponentRenderCtx {
  onInteract?: (answer: unknown) => void;
}

/** 白名单动态组件注册信息。render 假定 props 已通过 propsSchema 校验。 */
export interface ComponentDef {
  id: string;
  description: string;
  propsSchema: z.ZodType;
  render: (props: Record<string, unknown>, ctx?: ComponentRenderCtx) => ReactNode;
}

export class ComponentKitService extends Service {
  static provide = 'components';

  private registry = new Map<string, ComponentDef>();

  constructor(ctx: Context) {
    super(ctx, 'components');
  }

  /** 批量注册白名单组件（同 id 覆盖，HMR 热更新安全）。 */
  registerAll(defs: ComponentDef[]): void {
    for (const d of defs) this.registry.set(d.id, d);
  }

  /** 按 id 查找组件注册信息。 */
  getComponent(id: string): ComponentDef | undefined {
    return this.registry.get(id);
  }

  /** 全部已注册组件（调试/LLM 能力清单展示用）。 */
  listComponents(): ComponentDef[] {
    return [...this.registry.values()];
  }
}

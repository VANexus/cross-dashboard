'use client';

/**
 * ui-actions 前端内核插件 —— provide: `actions` service
 *
 * 「UI 即工具」动作注册表（自 lib/agent/ui-actions.ts 迁入，M1 插件化，行为不变）：
 * navigate/refresh/openDrawer/highlight 等通用动作 + 各页面经 registerPageActions
 * 注册的页面动作。Agent 抽屉收到 ui_action tool call 后按 id 路由到本地 execute
 * （本地 zod 校验），结果经 addToolResult 回传续推。
 */
import { z } from 'zod';
import { Context, Service } from '../../../src/kernel/vendor/cordis';
import { usePresence } from '@/stores/agent-presence';
import { getJourneyById } from '@/lib/journeys/registry';
import { useJourneyRun } from '@/stores/journey-run';
// 循环导入仅函数体内使用（live binding），模块初始化期不触碰，安全
import { getClientKernel } from '../index';

declare module '../../../src/kernel/vendor/cordis/context' {
  interface Context {
    actions: ActionsService;
  }
}

/** 单个可被 Agent 调用的 UI 动作。execute 返回执行结果摘要文本（如"已筛选出 3 个失败任务"）。 */
export interface UIActionDef {
  id: string;
  description: string;                 // LLM 可读
  schema?: z.ZodType;                  // params 校验（zod v4 / Standard Schema）
  execute: (params: Record<string, unknown>) => string | Promise<string>;
}

// ── 动作注册表 Service（注册表归内核所有，HMR 安全）──────────────
export class ActionsService extends Service {
  static provide = 'actions';

  private globalRegistry = new Map<string, UIActionDef>();
  private pageRegistry = new Map<string, UIActionDef>();

  constructor(ctx: Context) {
    super(ctx, 'actions');
  }

  /** 注册全局通用动作（所有页面可用；应用启动时由 Agent 抽屉挂载一次）。 */
  registerGlobalActions(actions: UIActionDef[]): void {
    for (const a of actions) this.globalRegistry.set(a.id, a);
  }

  /** 注册当前页面动作（进入页面时调用，离开时 unregisterPageActions 清理）。 */
  registerPageActions(actions: UIActionDef[]): void {
    this.unregisterPageActions();
    for (const a of actions) this.pageRegistry.set(a.id, a);
  }

  /** 清理当前页面动作（卸载/路由变化）。 */
  unregisterPageActions(): void {
    this.pageRegistry.clear();
  }

  /** 当前生效动作 = 通用 + 当前页（同名时页面动作优先）。 */
  getPageActions(): UIActionDef[] {
    return [...this.globalRegistry.values(), ...this.pageRegistry.values()];
  }

  /** 按 id 查找动作（通用 + 当前页）。 */
  getActionById(id: string): UIActionDef | undefined {
    return this.pageRegistry.get(id) ?? this.globalRegistry.get(id);
  }

  /** 校验并执行动作，返回结果摘要或错误说明。 */
  async runAction(id: string, params: Record<string, unknown> = {}): Promise<string> {
    const action = this.getActionById(id);
    if (!action) {
      return `未注册的 UI 动作：${id}（当前可用：${this.getPageActions().map((a) => a.id).join(', ') || '无'}）`;
    }
    let p = params;
    if (action.schema) {
      const pr = action.schema.safeParse(params);
      if (!pr.success) return `动作 ${action.id} 参数不合法：${pr.error.message}`;
      p = (pr.data ?? {}) as Record<string, unknown>;
    }
    return action.execute(p);
  }
}

// ── 高亮工具（openDrawer/highlight 与页面 focusCard 共用）────────────
const HIGHLIGHT_CLASS = 'agent-ui-highlight';
const HIGHLIGHT_STYLE_ID = 'agent-ui-highlight-style';

function ensureHighlightStyle(): void {
  if (typeof document === 'undefined' || document.getElementById(HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = [
    `.${HIGHLIGHT_CLASS}{outline:2px solid oklch(0.8 0.12 200) !important;outline-offset:2px;border-radius:6px;`,
    'animation:agent-ui-highlight-fade 2s ease forwards;}',
    '@keyframes agent-ui-highlight-fade{0%,70%{outline-color:oklch(0.8 0.12 200 / 1)}100%{outline-color:oklch(0.8 0.12 200 / 0)}}',
  ].join('');
  document.head.appendChild(style);
}

/** 给选择器命中的元素加临时高亮 class，2s 移除；返回结果摘要。 */
export function runHighlight(selector: string): string {
  const el = typeof document !== 'undefined' ? document.querySelector(selector) : null;
  if (!el) return `未找到元素：${selector}`;
  ensureHighlightStyle();
  el.classList.add(HIGHLIGHT_CLASS);
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  setTimeout(() => el.classList.remove(HIGHLIGHT_CLASS), 2000);
  return `已高亮 ${selector}`;
}

// ── 通用动作工厂（navigate/refresh 需要 router，由挂载方注入）────────
/** 站内主要路由速查：注入 navigate 描述，避免 LLM 凭空猜路由跳错页。 */
const ROUTE_HINTS = [
  '/journeys 流程编排中心（旅程列表/发起）',
  '/dashboard 仪表盘',
  '/tasks 任务中心',
  '/agents Agent 管理',
  '/skills 能力中心',
  '/risk 账号风险',
  '/content-studio 内容创作中心',
  '/b2b/intel 情报中心',
  '/b2b/keyword-trends 关键词趋势',
  '/b2b/listing 一键上架',
  '/b2b/image-skills 生图 Skill 库',
  '/b2b/channels 渠道账号',
  '/memory 记忆系统',
  '/evolution 自进化',
  '/settings 设置',
].join('；');

export interface GlobalActionOptions {
  onNavigate?: (route: string) => void; // next/navigation router.push
  onRefresh?: () => void;               // next/navigation router.refresh
}

export function createGlobalActions(opts: GlobalActionOptions = {}): UIActionDef[] {
  return [
    {
      id: 'navigate',
      description: `跳转到指定路由（站内页面导航）。常用路由：${ROUTE_HINTS}`,
      schema: z.object({ route: z.string().min(1).describe('目标路由') }),
      execute: (params) => {
        const route = String(params.route ?? '/');
        if (opts.onNavigate) opts.onNavigate(route);
        else if (typeof window !== 'undefined') window.location.assign(route);
        return `已跳转到 ${route}`;
      },
    },
    {
      id: 'refresh',
      description: '刷新当前页面数据（server components 重新渲染）',
      execute: () => {
        if (opts.onRefresh) opts.onRefresh();
        else if (typeof window !== 'undefined') window.location.reload();
        return '已刷新页面数据';
      },
    },
    {
      id: 'openDrawer',
      description: '打开 Agent 抽屉对话面板',
      schema: z.object({ question: z.string().optional().describe('用户想问的问题（仅作提示）') }),
      execute: (params) => {
        usePresence.getState().setDrawerOpen(true);
        const q = typeof params.question === 'string' ? params.question.trim() : '';
        return q ? `已打开 Agent 抽屉（用户想问：${q.slice(0, 40)}）` : '已打开 Agent 抽屉';
      },
    },
    {
      id: 'highlight',
      description: '临时高亮页面上指定 CSS 选择器的元素 2 秒（指给用户看）',
      schema: z.object({ selector: z.string().min(1).describe('CSS 选择器，如 [data-agent-card="risk"]') }),
      execute: (params) => runHighlight(String(params.selector ?? '')),
    },
    {
      id: 'startJourney',
      description:
        '发起一条端到端业务旅程并进入执行视图（content-publish 内容发布 / listing-launch 选品上架等，见 /journeys）',
      schema: z.object({ id: z.string().min(1).describe('旅程 id，如 content-publish') }),
      execute: (params) => {
        const id = String(params.id ?? '');
        const journey = getJourneyById(id);
        if (!journey) return `旅程「${id}」未登记（可用：/journeys 页查看全部旅程）`;
        if (!journey.enabled) return `旅程「${journey.label}」为骨架旅程，尚未开放执行`;
        useJourneyRun.getState().start(id);
        const href = `/journeys/${id}`;
        if (opts.onNavigate) opts.onNavigate(href);
        else if (typeof window !== 'undefined') window.location.assign(href);
        return `已发起旅程「${journey.label}」，共 ${journey.steps.length} 步，当前第 1 步：${journey.steps[0].label}`;
      },
    },
    {
      id: 'advanceJourney',
      description: '把当前进行中的旅程推进到下一步（标记当前步完成；最后一步则结束旅程）',
      execute: () => {
        const run = useJourneyRun.getState();
        if (!run.journeyId) return '当前没有进行中的旅程（可先用 startJourney 发起）';
        const journey = getJourneyById(run.journeyId);
        if (!journey) return `旅程「${run.journeyId}」未登记，建议 reset 后重新发起`;
        const idx = Math.max(0, run.currentStep - 1);
        const current = journey.steps[idx];
        const next = journey.steps[idx + 1];
        if (current) run.markStepDone(current.id);
        run.advance(journey.steps.length, next ? next.href : undefined);
        return next
          ? `第 ${idx + 1} 步「${current?.label}」已完成，前往下一步「${next.label}」（${next.href}）`
          : `第 ${idx + 1} 步「${current?.label}」已完成，旅程「${journey.label}」全部执行完毕`;
      },
    },
    {
      id: 'click',
      description:
        '点击页面上指定 CSS 选择器的元素（按钮/链接/开关等任意可见控件）。带 data-agent-action 属性的按钮可用稳定选择器，如 [data-agent-action="orchestrate"]',
      schema: z.object({ selector: z.string().min(1).describe('CSS 选择器') }),
      execute: (params) => {
        const selector = String(params.selector ?? '');
        const el = typeof document !== 'undefined' ? document.querySelector(selector) : null;
        if (!el) return `未找到元素：${selector}`;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        const clickable = el as HTMLElement;
        if (typeof clickable.click !== 'function') return `元素不可点击：${selector}`;
        clickable.click();
        return `已点击 ${selector}`;
      },
    },
    {
      id: 'fill',
      description: '向页面上指定 CSS 选择器的输入框填充文本（兼容 React 受控组件）',
      schema: z.object({
        selector: z.string().min(1).describe('输入框 CSS 选择器'),
        value: z.string().describe('要填入的文本'),
      }),
      execute: (params) => {
        const selector = String(params.selector ?? '');
        const value = String(params.value ?? '');
        const el = typeof document !== 'undefined' ? document.querySelector(selector) : null;
        if (!el) return `未找到元素：${selector}`;
        const input = el as HTMLInputElement;
        if (!('value' in input)) return `元素不是可输入控件：${selector}`;
        // React 受控输入：走原型 setter 绕过 value 拦截，再派发 input 事件触发 onChange
        const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        setter?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return `已填充 ${selector} = "${value.slice(0, 40)}"`;
      },
    },
  ];
}

// ── 测试/调试钩子：e2e 与控制台可经 window.__agentUI 快速驱动全部动作 ──
// 仅非生产环境挂载；校验逻辑与抽屉 onToolCall 一致（zod → execute）。
/** 挂载 window.__agentUI = { list, execute }（生产环境跳过；内核未就绪时静默跳过）。 */
export function installAgentTestHook(): void {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') return;
  const actions = getClientKernel().actions;
  if (!actions) return;
  (window as unknown as Record<string, unknown>).__agentUI = {
    list: () => actions.getPageActions().map(({ id, description }) => ({ id, description })),
    execute: (id: string, params?: Record<string, unknown>) => actions.runAction(id, params),
  };
}

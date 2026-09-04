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
import { sendAgentCommand } from '@/lib/agent/agent-bus';
// 循环导入仅函数体内使用（live binding），模块初始化期不触碰，安全
import { getClientKernel } from '../index';

declare module '../../../src/kernel/vendor/cordis/context' {
  interface Context {
    actions: ActionsService;
  }
}

/**
 * 动作风险分级（人在环中权限模型，对齐 Amazon Seller Assistant「经同意才行动」范式）：
 * - L0 只读/导航/建议：不改任何业务数据，前端可直接执行（查询、跳转、高亮、打开面板）；
 * - L1 草稿/本地可逆：只改本地页面状态或生成草稿，可直接执行，用户可一键撤销/不采纳（填表、筛选、生成草稿）；
 * - L2 对外/不可逆/资金：会对外发布、上传、删除、花费或写入凭证，前端必须弹确认卡，用户当次明确批准后才执行。
 * 模型无权自行判定「已获授权」；授权只来自用户在确认卡上的点击。
 */
export type ActionRiskLevel = 'L0' | 'L1' | 'L2';

export const RISK_META: Record<ActionRiskLevel, { label: string; hint: string }> = {
  L0: { label: '只读', hint: '只读取/导航，不改数据' },
  L1: { label: '本地可逆', hint: '仅改本页或生成草稿，可撤销' },
  L2: { label: '需批准', hint: '对外/不可逆动作，需你确认后执行' },
};

/** 单个可被 Agent 调用的 UI 动作。execute 返回执行结果摘要文本（如"已筛选出 3 个失败任务"）。 */
export interface UIActionDef {
  id: string;
  description: string;                 // LLM 可读
  schema?: z.ZodType;                  // params 校验（zod v4 / Standard Schema）
  execute: (params: Record<string, unknown>) => string | Promise<string>;
  /** 风险等级，默认 L1（本地可逆）。对外不可逆动作必须显式声明为 L2。 */
  riskLevel?: ActionRiskLevel;
  /** L2 确认卡上向用户说明「执行后会发生什么」；可为基于参数的动态文案。 */
  confirmText?: string | ((params: Record<string, unknown>) => string);
}

/** 取动作风险等级（缺省按 L1 本地可逆处理，安全侧默认值）。 */
export function riskLevelOf(action: UIActionDef | undefined): ActionRiskLevel {
  return action?.riskLevel ?? 'L1';
}

// ── 动作注册表 Service（注册表归内核所有，HMR 安全）──────────────
export class ActionsService extends Service {
  static provide = 'actions';

  private globalRegistry = new Map<string, UIActionDef>();
  private pageRegistry = new Map<string, UIActionDef>();
  // 仅非生产环境、经测试钩子注册的动作（e2e 用），生产恒为空
  private testRegistry = new Map<string, UIActionDef>();

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

  /** @test 仅 e2e/调试：注册临时动作（生产环境忽略）。 */
  registerTestAction(action: UIActionDef): void {
    if (process.env.NODE_ENV === 'production') return;
    this.testRegistry.set(action.id, action);
  }

  /** 当前生效动作 = 通用 + 当前页（同名时页面动作优先；测试动作最后兜底）。 */
  getPageActions(): UIActionDef[] {
    return [
      ...this.globalRegistry.values(),
      ...this.pageRegistry.values(),
      ...this.testRegistry.values(),
    ];
  }

  /** 按 id 查找动作（页面 → 通用 → 测试）。 */
  getActionById(id: string): UIActionDef | undefined {
    return this.pageRegistry.get(id) ?? this.globalRegistry.get(id) ?? this.testRegistry.get(id);
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
      riskLevel: 'L0',
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
      riskLevel: 'L0',
      execute: () => {
        if (opts.onRefresh) opts.onRefresh();
        else if (typeof window !== 'undefined') window.location.reload();
        return '已刷新页面数据';
      },
    },
    {
      id: 'openDrawer',
      description: '打开 Agent 抽屉对话面板',
      riskLevel: 'L0',
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
      riskLevel: 'L0',
      schema: z.object({ selector: z.string().min(1).describe('CSS 选择器，如 [data-agent-card="risk"]') }),
      execute: (params) => runHighlight(String(params.selector ?? '')),
    },
    {
      id: 'startJourney',
      description:
        '发起一条端到端业务旅程并进入执行视图（content-publish 内容发布 / listing-launch 选品上架等，见 /journeys）',
      riskLevel: 'L1',
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
      riskLevel: 'L1',
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
      riskLevel: 'L1',
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
      riskLevel: 'L1',
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
    {
      id: 'panel.morph',
      description:
        '变换 Agent 面板形态（三面一体）：stage 进入近全宽「舞台」（左栏仪表盘动态画布+右栏对话，生成组件/图表最适合）、expanded/compact/drawer 打开右侧对话侧栏，dock/float 收起回底部灵动岛。可选 width 精确设像素宽，question 存在则同时把问题送进对话。',
      riskLevel: 'L0',
      schema: z.object({
        shape: z.enum(['dock', 'float', 'drawer', 'compact', 'expanded', 'stage']).describe('目标形态'),
        width: z.number().min(320).max(1200).optional(),
        question: z.string().optional(),
      }),
      execute: (params) => {
        const shape = String(params.shape ?? 'drawer');
        const width = typeof params.width === 'number' ? params.width : undefined;
        const s = usePresence.getState();
        if (shape === 'dock' || shape === 'float') {
          s.setSurface('dock');
          return `已收起为灵动岛（右侧对话收起，页面焦点由岛持续追踪）`;
        }
        s.setSurface(shape === 'stage' ? 'stage' : 'sidebar');
        if (shape !== 'stage') {
          s.setDrawerWidth(width ?? (shape === 'expanded' ? 748 : shape === 'compact' ? 440 : 540));
        }
        const q = typeof params.question === 'string' ? params.question.trim() : '';
        if (q) {
          sendAgentCommand(q);
          return `已${shape === 'stage' ? '进入全画布舞台' : `展开右侧对话面板（${shape}）`}并推送问题：${q.slice(0, 24)}`;
        }
        return shape === 'stage' ? '已进入全画布舞台（左栏仪表盘动态画布，组件经 panel.pin 实时上墙）' : `已展开右侧对话面板（${shape}）`;
      },
    },
    {
      id: 'panel.expand',
      description: '进入全画布舞台：对话展开到近全宽（左栏仪表盘动态画布 + 右栏对话），适合展示图表/表格等生成组件与长编排',
      riskLevel: 'L0',
      execute: () => {
        usePresence.getState().setSurface('stage');
        return '已进入全画布舞台';
      },
    },
    {
      id: 'dock.suggest',
      description: '在底部灵动岛放一条 AI 主动建议（label + prompt），用户点击即作为命令送进对话执行',
      riskLevel: 'L0',
      schema: z.object({ label: z.string().min(1), prompt: z.string().min(1) }),
      execute: (params) => {
        usePresence
          .getState()
          .setDockSuggestion({
            label: String(params.label),
            prompt: String(params.prompt),
            source: 'agent',
          });
        return `已在灵动岛放下建议「${String(params.label).slice(0, 20)}」`;
      },
    },
    {
      id: 'panel.pin',
      description:
        '把白名单组件固定到仪表盘主画布，长期保留（刷新不丢，用户可手动移除）。' +
        'component 与 render_component 的组件 id 一致，props 形状相同。' +
        '适合用户要「把这张图/表放到仪表盘」时：先 render_component 确认，再 pin 到主区。',
      riskLevel: 'L0',
      schema: z.object({
        component: z.string().min(1).describe('白名单组件 id，如 stat-card / line-chart / data-table'),
        props: z.record(z.string(), z.unknown()).optional().describe('组件参数（与 render_component 的 props 相同）'),
        title: z.string().optional().describe('画布面板标题，缺省取组件名'),
      }),
      execute: (params) => {
        const components = getClientKernel().components;
        const def = components?.getComponent(String(params.component));
        if (!def) {
          return `未注册的白名单组件：${params.component}（可用：${components?.listComponents().map((d) => d.id).join('、') ?? '无'}）`;
        }
        const pr = def.propsSchema.safeParse(params.props ?? {});
        if (!pr.success) return `组件 ${def.id} 参数不合法：${pr.error.message}`;
        const id = `pin-${def.id}-${Date.now().toString(36)}`;
        usePresence.getState().pinCanvasItem({
          id,
          component: def.id,
          props: pr.data as Record<string, unknown>,
          title: typeof params.title === 'string' ? params.title : undefined,
          pinnedAt: Date.now(),
        });
        const t = typeof params.title === 'string' && params.title.trim() ? params.title : def.id;
        return `已固定到主画布：${def.id}（${t}），id=${id}`;
      },
    },
    {
      id: 'panel.unpin',
      description:
        '从仪表盘主画布移除已固定的组件。优先用 id（panel.pin 返回的 id）；不记得 id 时可用 component + title 匹配首个。',
      riskLevel: 'L0',
      schema: z.object({
        id: z.string().optional(),
        component: z.string().optional(),
        title: z.string().optional(),
      }),
      execute: (params) => {
        const s = usePresence.getState();
        const item = s.canvas.find((c) =>
          (typeof params.id === 'string' && c.id === params.id) ||
          (typeof params.component === 'string' && c.component === params.component &&
            (!params.title || c.title === params.title)));
        if (!item) return `画布中没有可移除的组件（当前 ${s.canvas.length} 个）`;
        s.unpinCanvasItem(item.id);
        return `已从主画布移除：${item.component}（${item.title ?? item.id}）`;
      },
    },
  ];
}

// ── 测试/调试钩子：e2e 与控制台可经 window.__agentUI 快速驱动全部动作 ──
// 仅非生产环境挂载；校验逻辑与抽屉 onToolCall 一致（zod → execute）。
/** 挂载 window.__agentUI = { list, execute, riskOf, registerTestAction }（生产环境跳过；内核未就绪时静默跳过）。 */
export function installAgentTestHook(): void {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') return;
  const actions = getClientKernel().actions;
  if (!actions) return;
  (window as unknown as Record<string, unknown>).__agentUI = {
    list: () =>
      actions.getPageActions().map(({ id, description, riskLevel }) => ({
        id,
        description,
        riskLevel: riskLevel ?? 'L1',
      })),
    execute: (id: string, params?: Record<string, unknown>) => actions.runAction(id, params),
    riskOf: (id: string) => riskLevelOf(actions.getActionById(id)),
    registerTestAction: (def: UIActionDef) => actions.registerTestAction(def),
  };
}

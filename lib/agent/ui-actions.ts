// lib/agent/ui-actions.ts
// 「UI 即工具」门面（M1 插件化改造）：实现已迁入前端内核插件
// lib/kernel/plugins/ui-actions.ts（actions service，注册表归内核所有）。
// 本文件保持历史 import 路径与 API 签名不变，全部委托给内核服务。
import { getClientKernel } from '@/lib/kernel';
import type { UIActionDef } from '@/lib/kernel/plugins/ui-actions';

export type { UIActionDef, GlobalActionOptions, ActionRiskLevel } from '@/lib/kernel/plugins/ui-actions';
export {
  createGlobalActions,
  runHighlight,
  installAgentTestHook,
  riskLevelOf,
  RISK_META,
} from '@/lib/kernel/plugins/ui-actions';

/** 注册全局通用动作（所有页面可用；应用启动时由 Agent 抽屉挂载一次）。 */
export function registerGlobalActions(actions: UIActionDef[]): void {
  getClientKernel().actions.registerGlobalActions(actions);
}

/** 注册当前页面动作（进入页面时调用，离开时 unregisterPageActions 清理）。 */
export function registerPageActions(actions: UIActionDef[]): void {
  getClientKernel().actions.registerPageActions(actions);
}

/** 清理当前页面动作（卸载/路由变化）。 */
export function unregisterPageActions(): void {
  getClientKernel().actions.unregisterPageActions();
}

/** 当前生效动作 = 通用 + 当前页（同名时页面动作优先）。 */
export function getPageActions(): UIActionDef[] {
  return getClientKernel().actions.getPageActions();
}

/** 按 id 查找动作（通用 + 当前页）。 */
export function getActionById(id: string): UIActionDef | undefined {
  return getClientKernel().actions.getActionById(id);
}

/** 校验并执行动作，返回结果摘要或错误说明。 */
export function runAction(id: string, params: Record<string, unknown> = {}): Promise<string> {
  return getClientKernel().actions.runAction(id, params);
}

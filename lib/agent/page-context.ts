// lib/agent/page-context.ts
// 「页面即上下文」门面（M1 插件化改造）：实现已迁入前端内核插件
// lib/kernel/plugins/page-context.ts（pageContext service）。
// 本文件保持历史 import 路径与 API 签名不变。
import { getClientKernel } from '@/lib/kernel';

export type {
  PageAgentContext,
  ChatPageContext,
  UseAgentPageOptions,
} from '@/lib/kernel/plugins/page-context';
export { useAgentPage } from '@/lib/kernel/plugins/page-context';

/** 求值当前页面上下文（快照/状态截断 + 全部可用动作）；无页面上下文时返回 null。 */
export function serializePageContext() {
  return getClientKernel().pageContext.serializePageContext();
}

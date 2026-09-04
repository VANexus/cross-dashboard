import { DashboardShell } from "./dashboard-shell";
import { DashboardChat } from "./dashboard-chat";

/**
 * 仪表盘（沉浸式对话画布）：整个 main 就是一张 Agent 对话画布。
 * - 动态 UI 组件包内联渲染在对话流中（不设独立 pin 栏）。
 * dashboard 不启用三面一体面板（drawer 禁用）；入口仅灵动岛 dock。
 * 其他页面维持三面一体设计。
 */
export default function DashboardPage() {
  return (
    <DashboardShell>
      {/* 沉浸式对话画布：消息正常文档流 + 输入框 sticky 吸底（随页面滚动始终可见） */}
      <DashboardChat />
    </DashboardShell>
  );
}

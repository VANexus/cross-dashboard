import { DashboardShell } from "./dashboard-shell";
import { DashboardChat } from "./dashboard-chat";
import { ChatSessionBar } from "./dashboard-session-bar";

/**
 * 仪表盘（主落地页）= 纯 GPT 式对话画布：整个 main 就是一张 Agent 对话。
 * - 顶部「会话条」：+ 新建对话 / 聊天记录切换（服务端 conversations 持久化）；
 * - 空态居中欢迎，开始对话后消息区自适应滚动、输入框恒贴底部。
 * dashboard 不启用三面一体面板（drawer 禁用）；入口仅灵动岛 dock。
 * 其他页面维持三面一体设计。Supabase 式用量看板在个人工作台 /profile。
 */
export default function DashboardPage() {
  return (
    <DashboardShell>
      <ChatSessionBar />
      <DashboardChat />
    </DashboardShell>
  );
}

/**
 * chat-context —— 对话上下文的确定性构建（chat 路由 与 context-stats 路由共用）。
 *
 * 拆成 persona / 页面上下文块两个可单独计 token 的片段：
 * - context-stats 用它们算「上下文组成 + 占模型窗口百分比」；
 * - chat 路由只关心合并后的 system 字符串。
 * 任何一侧改了 BASE_PERSONA / 页面块，两侧自动同步，不会出现「统计口径 ≠ 实际发送」。
 */
import type { UIMessage } from "ai";

export interface PageAction {
  id: string;
  description: string;
  riskLevel?: 'L0' | 'L1' | 'L2';
}

export interface PageContext {
  route?: string;
  title?: string;
  snapshot?: string;
  state?: Record<string, unknown>;
  actions?: PageAction[];
}

export const BASE_PERSONA = `你是 FlowMind —— 跨境电商 AI 原生编排系统的「内核 Agent」，也是唯一直接和用户对话的 Agent。
你的职责不是"聊天"，而是：听懂用户一句话背后的业务意图 → 用现有原子能力 / 动态 UI / 记忆 / 子 Agent 把它编排成一次完整、真实、可交付的执行。

# 身份与定位
- 你是唯一对用户负责的 Agent；其他 Agent 都是你按需一句话创建、临时组队、事后归档的成员。
- 你不预设工作流：所有流程都由你根据任务现场组装（选品 / 作图 / 广告 / 上架 / 竞品 / 库存 / 情报都只是能力，不是流程）。
- 用简体中文交流，结论先行，能用 ①②③ 绝不用长段落；需要展开时再展开。

# 诚实第一（禁止编造）
- 所有数字、结论必须来自真实工具返回；工具返回"降级 / 缓存 / 缺 Key"时如实说明数据状态，绝不把降级数据包装成实时结果。
- 不确定就说不确定；"已确认"与"推测"必须明确区分。
- 工具失败：先读报错，按提示修正参数重试；同一动作失败两次就换实现路径，并把失败原因和你的调整告诉用户。

# 工具使用规范（精确优先）
- 只调用工具列表里真实存在的工具；参数按 schema 逐字段填写，id 等标识符逐字精确匹配，禁止编造。
- 能用现成工具 / 组件完成，就不手动拼字符串。
- 任务形态与执行方式：单个业务问题 → 直接调对应业务工具（product_research / competitor_analyze / ad_analyze / listing_generate / imaging_generate / inventory_restock / 情报三技能等）；多步可复用任务 → 先 plan_workflow 规划步骤并落库（步骤 id 只能用真实存在的）再 run_workflow 执行；长链条研究 → 用 deep_task 派发给深度子代理，等摘要返回再汇报；要做页面 / 看板 → 用 generate_page 发布动态页面，把 /p/ 链接给用户。
- 要在「已发布的动态页面」上继续加组件 / 改组件 / 删组件 / 调顺序 → 用 update_page（append 末尾追加 / insert 在 index 前插入 / replace 替换 / remove 删除 / move 移动，index 按页面从上到下 0 起编号），改完告知刷新后的 /p/ 地址。
- 需要回忆历史经验 → 先 memory_search 检索再作答；产生重要结论 / 经验 → 用 memory_store 沉淀。
- 动态渲染白名单 UI 组件（stat-card / line-chart / bar-chart / area-chart / pie-chart / radar-chart / data-table / progress / timeline / tag-list / form / action-list / callout / video-scroll / question / ranking / compare / metric-grid 等）：回答涉及对比 / 趋势 / 排行 / 占比 / 流程 / 多维度时，优先用组件呈现（props 严格按工具 schema 传），渲染成功后再用一两句话点评。

# 人在环中（你编排，人决策）
- 页面动作带风险等级：[L0] 只读 / 导航可直调；[L1] 本地可逆（筛选 / 填表 / 生成草稿等只落本页或草稿库）可直接做，用户可自行不采纳；[L2] 对外 / 不可逆（发布 / 上传 / 删除 / 导入凭证 / 花钱）只能发起调用，前端会挂起并弹确认卡，用户批准后才真正执行——你不得声称它已执行成功，只有收到执行结果回传后才能下结论；用户取消时不得重试，应询问下一步。
- 发起 L2 动作前先用一句话向用户说明它对外会产生什么影响。
- 重大方向选择交给用户：用 question 组件给出可执行选项，而不是替他拍板。

# 工作方式（Agent 驱动，不预设）
- 收到任务先判断形态（单次问答 / 多步工作流 / 深度研究 / 建页面 / 建 Agent / 组团队），再选执行方式。
- "创建一个 xx 的 Agent" → 用 create_agent 一句话生成（可指定参考模板）；"组建一个团队做 xx" → 用 create_team 一句话组建；创建后告知成员分工。
- 执行后：用结构化方式（表格 / 列表 / 图表）把结果呈现给用户，并给出明确的下一步建议，而不是只做文字总结。
- 复杂任务分步推进，每步结束给用户可见进展；卡住时说明卡点和你打算怎么办。

# 输出规范
- 简洁克制，不堆砌术语；一条消息一个重点。
- 呈现结果优先可视化（图表 / 组件），文字只做点评与下一步。`;

/** 页面上下文块：当前页面 + 数据摘要 + UI 状态 + 可调用动作（独立计 token 的片段）。 */
export function buildPageContextBlock(pageContext?: PageContext): string {
  if (!pageContext) return "";

  // B3 降 token：完整快照/状态只在客户端可见；注入 system 的仅保留「摘要化」版本，
  // 超长截断 + 提示可用 ui_action/readKpi 深查，避免整页数据进 prompt。
  const SNAPSHOT_MAX = 1600;
  const STATE_MAX = 1200;

  const lines: string[] = [
    "## 用户当前页面",
    `用户当前在「${pageContext.title ?? "未知页面"}」(${pageContext.route ?? "未知路由"})。`,
  ];

  if (pageContext.snapshot) {
    const snap = pageContext.snapshot.length > SNAPSHOT_MAX
      ? pageContext.snapshot.slice(0, SNAPSHOT_MAX) + "…（已截断，如需细节请用 ui_action 查看页面或询问）"
      : pageContext.snapshot;
    lines.push("页面数据摘要：", snap);
  }
  if (pageContext.state && Object.keys(pageContext.state).length > 0) {
    let stateJson = JSON.stringify(pageContext.state);
    if (stateJson.length > STATE_MAX) {
      stateJson = stateJson.slice(0, STATE_MAX) + "…";
    }
    lines.push("页面 UI 状态：", stateJson);
  }
  if (pageContext.actions && pageContext.actions.length > 0) {
    lines.push(
      "可调用以下页面动作（通过 ui_action 工具触发，由前端在页面上执行，不要编造列表之外的 id；方括号为风险等级，[L2] 需用户确认）：",
      ...pageContext.actions.map((a) => `- [${a.riskLevel ?? 'L1'}] ${a.id} — ${a.description}`),
    );
  }

  return lines.join("\n");
}

/** 上下文组成片段（persona / 页面块分离），供统计口径与 chat 实际发送共用。 */
export function buildContextParts(pageContext?: PageContext): { persona: string; page: string } {
  return { persona: BASE_PERSONA, page: buildPageContextBlock(pageContext) };
}

/** 合并后的 system 提示（chat 路由实际发送）。 */
export function buildSystemPrompt(pageContext?: PageContext): string {
  const { persona, page } = buildContextParts(pageContext);
  return (persona + (page ? "\n\n" + page : "")).trim();
}

/** 从 UIMessage 里提取「最近一条用户文本」，供记忆语义召回等用途。 */
export function extractLastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const parts = (m as { parts?: unknown[] }).parts;
    if (!Array.isArray(parts)) continue;
    const t = parts
      .filter((p): p is { type: string; text?: string } => typeof p === "object" && p !== null && "type" in p)
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join(" ")
      .trim();
    if (t) return t;
  }
  return "";
}

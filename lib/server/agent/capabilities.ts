/**
 * FlowMind RAK — Agent 能力目录（真实来源）
 * 与内核 tool-registry 白名单一一对应的能力清单：业务能力 9 个 + 编排能力 + 记忆能力。
 * 前端「Agent 能力中心」据此展示真实能力（不写死前端假列表），
 * 每项能力都可由主 Agent 一句话编排，并在执行中把决策点交回人类（UI 对话）。
 */

export interface Capability {
  /** 工具 id（与 kernel.tools.mastra / chat 工具一一对应） */
  id: string;
  name: string;
  category: "business" | "orchestrate" | "memory" | "agent" | "selfhost";
  description: string;
  /** 让 Agent 编排该能力的自然语言例句 */
  prompt: string;
  /** 关联的能力工作台页面（UI 不能废弃：Agent 编排时可把人引导到该页面决策） */
  consoleHref?: string;
  /** 需要人类决策的关键点（human-in-the-loop 提示） */
  humanDecision?: string;
}

const CONSOLES: Record<string, string> = {
  product_research: "/workflows/product-research",
  imaging_generate: "/workflows/ai-imaging",
  ad_analyze: "/workflows/ai-advertising",
  ad_optimize: "/workflows/ai-advertising",
  listing_generate: "/workflows/ai-listing",
  inventory_restock: "/workflows/inventory",
  competitor_analyze: "/workflows/competitor-ads",
};

export const CAPABILITIES: Capability[] = [
  // ── 业务能力（与 kernel.tools.mastra 一致） ──
  {
    id: "product_research",
    name: "选品调研",
    category: "business",
    description: "基于关键词进行选品调研，发现高潜力产品和市场机会（需指定数据源与关键词）。",
    prompt: "帮我调研保温杯在美国市场的选品机会",
    consoleHref: CONSOLES.product_research,
    humanDecision: "确认数据源与目标市场后，Agent 执行并回传结论，由你在对话中决定是否采纳",
  },
  {
    id: "imaging_generate",
    name: "AI 产品图",
    category: "business",
    description: "基于产品关键词生成 AI 产品图片（主图/场景图/A+图），含评分。",
    prompt: "为我的保温杯产品生成一组主图和场景图",
    consoleHref: CONSOLES.imaging_generate,
    humanDecision: "图片生成后由你在结果中挑选/打回，Agent 再迭代",
  },
  {
    id: "ad_analyze",
    name: "广告关键词分析",
    category: "business",
    description: "查看广告关键词表现数据：展示量、点击、花费、销售额、ACoS、转化率。",
    prompt: "分析我当前广告关键词的 ACoS 和转化表现",
    consoleHref: CONSOLES.ad_analyze,
    humanDecision: "分析结论出来后，由你决定哪些词保留/暂停",
  },
  {
    id: "ad_optimize",
    name: "广告策略优化",
    category: "business",
    description: "基于 AI 分析优化广告策略：出价调整、匹配类型、预算分配建议。",
    prompt: "根据最近数据帮我优化广告出价和预算分配",
    consoleHref: CONSOLES.ad_optimize,
    humanDecision: "优化建议需你确认后才可执行变更",
  },
  {
    id: "listing_generate",
    name: "Listing 生成",
    category: "business",
    description: "基于产品信息生成优化 Amazon Listing（标题、五点描述、后台搜索词）。",
    prompt: "为我的保温杯生成一版优化的 Amazon Listing",
    consoleHref: CONSOLES.listing_generate,
    humanDecision: "生成后由你审阅/修改再决定是否上架",
  },
  {
    id: "listing_category",
    name: "类目推荐",
    category: "business",
    description: "基于产品关键词推荐最佳 Amazon 类目（BSR、竞争度、佣金费率）。",
    prompt: "给我的保温杯推荐最合适的 Amazon 类目",
    humanDecision: "推荐类目由你确认后 Agent 再执行后续步骤",
  },
  {
    id: "listing_infringement",
    name: "侵权检测",
    category: "business",
    description: "检测标题/描述中的侵权风险词（品牌词、专利词等）。",
    prompt: "检测这份 Listing 标题有没有侵权风险词",
    humanDecision: "命中的风险词由你决定如何处理",
  },
  {
    id: "inventory_restock",
    name: "库销比补货",
    category: "business",
    description: "基于库存数据和销售趋势生成补货建议（紧急程度、最优补货量、预估成本）。",
    prompt: "帮我生成一份补货建议",
    consoleHref: CONSOLES.inventory_restock,
    humanDecision: "补货量与成本由你确认后再下单",
  },
  {
    id: "competitor_analyze",
    name: "竞品广告分析",
    category: "business",
    description: "分析竞品广告投放（关键词、出价、展示位置）。",
    prompt: "分析竞品在我这个类目的广告投放策略",
    consoleHref: CONSOLES.competitor_analyze,
    humanDecision: "竞品情报结论供你决策，Agent 负责持续监测",
  },

  // ── 本地自举能力（Next.js 全栈原生，不依赖 flowmind-mcp 后端） ──
  {
    id: "content_copywrite",
    name: "平台文案",
    category: "selfhost",
    description: "生成小红书/公众号/抖音/产品/广告多平台营销文案（标题+正文+CTA+话题）。纯 LLM，Next.js 自举。",
    prompt: "为我的保温杯写一篇小红书种草文案",
    humanDecision: "生成的文案由你选择/修改后再发布",
  },
  {
    id: "content_idea_design",
    name: "创意策划",
    category: "selfhost",
    description: "基于产品生成内容创意（角度、钩子、脚本大纲、互动设计）。纯 LLM，Next.js 自举。",
    prompt: "给我的秋季选品策划 3 个内容创意",
    humanDecision: "创意方向由你拍板后再执行",
  },
  {
    id: "content_audit",
    name: "内容审核",
    category: "selfhost",
    description: "发布前审核：本地规则命中违禁词/极限词/广告法禁用词 + LLM 复核，给处置建议。Next.js 自举。",
    prompt: "帮我审核这段营销文案有没有违规风险",
    humanDecision: "命中词与处置建议由你确认",
  },
  {
    id: "image_prompt_reverse",
    name: "图片反向提示词",
    category: "selfhost",
    description: "根据图片/描述反推高质量 AI 绘图提示词（主体/风格/构图/负面词）。纯 LLM 视觉理解，Next.js 自举。",
    prompt: "反推这张图的 AI 绘图提示词",
    humanDecision: "生成的提示词由你用于下一步生图",
  },
  {
    id: "inventory_risk",
    name: "库存风险扫描",
    category: "selfhost",
    description: "读本地库存数据按确定性规则判定断货/积压/库销比异常。纯本地数据 + 规则，零外部依赖。",
    prompt: "扫描当前库存有哪些断货风险",
    consoleHref: CONSOLES.inventory_restock,
    humanDecision: "处置建议由你确认后再补货",
  },
  {
    id: "b2b_daily_digest",
    name: "每日业务摘要",
    category: "selfhost",
    description: "聚合本地业务数据（库存/广告/任务/风控）生成经营日报要点。Next.js 自举。",
    prompt: "生成今天的一份经营日报摘要",
    humanDecision: "日报要点供你核对，可要求展开某部分",
  },

  // ── 编排能力（Agent 如何驱动整套工作流） ──
  {
    id: "plan_workflow",
    name: "工作流编排",
    category: "orchestrate",
    description: "把多步可复用任务规划为动态工作流 spec 并落库（步骤只能用真实工具 id）。",
    prompt: "规划一个「每天自动监测竞品广告并沉淀结论」的工作流",
    humanDecision: "编排的步骤清单由你确认后再固化执行",
  },
  {
    id: "run_workflow",
    name: "工作流执行",
    category: "orchestrate",
    description: "按 slug 执行已保存的动态工作流，步骤按依赖拓扑序执行，逐步回传结果。",
    prompt: "执行我刚才规划的竞品广告监测工作流",
    humanDecision: "每步结果在对话中呈现，由你决定是否继续/修正",
  },
  {
    id: "ui_action",
    name: "页面编排（人机交互）",
    category: "orchestrate",
    description: "Agent 直接操作当前页面：导航、筛选、跳转、打开面板，把相关 UI 带到你面前。",
    prompt: "帮我在选品工作台打开数据源面板并选中 US 市场",
    humanDecision: "高风险动作（L2）会弹出确认门，由你批准后执行",
  },
  {
    id: "render_component",
    name: "动态组件渲染",
    category: "orchestrate",
    description: "在对话中动态渲染白名单 UI 组件（卡片/图表/表格/表单），把结果变成可交互 UI。",
    prompt: "把刚才的选品结论渲染成一个数据表格和一个趋势图",
    humanDecision: "渲染出的组件可直接在对话中交互查看",
  },
  {
    id: "deep_task",
    name: "深度子任务",
    category: "orchestrate",
    description: "长链条研究（调研→分析→交叉验证→长报告）派发给深度子代理执行。",
    prompt: "深度调研北美保温杯市场并出一份长报告",
    humanDecision: "子代理产出摘要后由你决定是否深入",
  },
  {
    id: "generate_page",
    name: "动态页面发布",
    category: "orchestrate",
    description: "生成全新 AI 动态页面并发布，导航自动出现入口（/p/[slug]）。",
    prompt: "做一个「秋季选品灵感看板」页面",
    humanDecision: "页面发布后由你在侧边栏打开查看",
  },

  // ── 记忆能力 ──
  {
    id: "memory_search",
    name: "记忆检索",
    category: "memory",
    description: "语义检索历史经验与结论（Milvus 混合检索带 score），让 Agent 基于真实记忆回答。",
    prompt: "回忆一下我们之前做保温杯选品时沉淀的结论",
    humanDecision: "召回的记忆供你核对是否采纳",
  },
  {
    id: "memory_store",
    name: "记忆沉淀",
    category: "memory",
    description: "把重要结论/经验三库写回（PG + Mongo + Milvus 向量），供后续检索。",
    prompt: "把这次选品结论沉淀到记忆里",
    humanDecision: "沉淀内容由你确认是否长期保留",
  },

  // ── Agent 组建能力 ──
  {
    id: "create_agent",
    name: "动态创建 Agent",
    category: "agent",
    description: "一句话生成完整独立人格的 Agent（参考预设模板），立即接入运行时节律。",
    prompt: "创建一个负责物流时效监控的 Agent",
    humanDecision: "生成的人格提示词由你审阅，不满意可让 Agent 重做",
  },
  {
    id: "create_team",
    name: "动态组建团队",
    category: "agent",
    description: "一句话生成职责互补的多个 Agent 并组队，形成协同拓扑。",
    prompt: "组建一个负责新品上市的选品、作图、广告投放团队",
    humanDecision: "团队成员分工由你确认后再启动",
  },
];

export function listCapabilities(): Capability[] {
  return CAPABILITIES;
}

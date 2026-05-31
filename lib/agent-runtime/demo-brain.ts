/**
 * FlowMind RAK — Demo Agent Brain
 * Template-driven simulation that feels alive without real AI
 * Uses real DB data with {variable} substitution
 */
import type { AgentBrain, AgentContext, AgentThought, AgentDecision } from "./brain";
import type { AgentConfig, AgentType, JournalEntry } from "../types";

// ========== Template Collections per Agent Type ==========

const thoughtTemplates: Record<AgentType, string[]> = {
  sentinel: [
    "系统运行正常，{onlineAgents}个Agent在线，任务队列{taskQueueLength}项待处理。整体健康度良好。",
    "检测到{riskCount}个风险事件待处理，建议加强监控频率。其中{level1Count}个为高优先级。",
    "今日任务完成率稳定，{completedTasks}个任务已成功完成。系统负载处于正常区间。",
    "心跳检测全部通过，{onlineAgents}个在线Agent响应正常。无异常断连情况。",
    "支付安全扫描完成，未发现新增可疑交易。历史{riskCount}个风险事件仍在持续监控中。",
    "ODR指标稳定在安全线以内。持续监控中，当前无异常波动。",
    "系统资源使用率正常，CPU/内存均在合理范围内。建议保持当前监控策略。",
    "巡检周期完成，所有监控点状态正常。下一轮巡检将按计划进行。",
    "检测到{busyAgents}个Agent处于忙碌状态，调度压力略有增加。建议关注任务分配均衡性。",
    "合规检查清单已更新，覆盖当前所有活跃SKU。无新增合规风险。",
    "异常支付检测模型运行正常，过去24小时未触发预警。模型准确率维持在较高水平。",
    "系统日志分析完成，未发现异常模式。所有API端点响应时间正常。",
  ],
  dispatch: [
    "当前任务队列{taskQueueLength}项，{busyAgents}个Agent忙碌。资源分配均衡，无需调整。",
    "分析任务优先级分布：高优先级{highPriorityTasks}项，建议优先处理。",
    "Agent编组效率评估：平均任务完成时间缩短了{efficiencyGain}%。继续优化中。",
    "跨Agent协作分析：{onlineAgents}个Agent可协作，推荐最优编组方案已生成。",
    "任务分解完成，{taskQueueLength}个子任务已分配到对应Agent。预计完成时间已更新。",
    "负载均衡调整：将部分任务从忙碌Agent转移到空闲Agent，提升整体效率。",
    "DAG编排优化：识别到{parallelTasks}个可并行执行的节点，预计节省{timeSaved}分钟。",
    "调度策略回顾：本周任务分配效率提升了{efficiencyGain}%，主要得益于动态编组优化。",
    "资源利用率分析：当前{onlineAgents}个在线Agent平均负载{avgLoad}%。",
    "任务依赖关系检查完成，无循环依赖。所有阻塞任务已识别并标记。",
    "调度队列健康检查：队列深度{taskQueueLength}，处理速率稳定。",
    "Agent可用性预测：基于历史数据，预计下一小时可用Agent数量为{predictedAvailable}。",
  ],
  operations: [
    "库存健康度分析：{inventoryWarnings}个SKU需要关注，建议及时补货。",
    "选品市场扫描完成，发现{newOpportunities}个潜在机会。正在深入分析。",
    "Listing优化建议：{listingOptimizations}个Listing有优化空间，预计转化率可提升{conversionGain}%。",
    "BSR排名追踪：核心产品BSR稳定在目标区间。竞品动态已记录。",
    "库销比监控：当前平均库销比{avgRatioDays}天，处于安全区间。",
    "市场趋势分析：宠物用品品类持续增长，{trendingKeywords}个关键词搜索量上升。",
    "供应链状态更新：{pendingShipments}个在途货物，预计{avgShipDays}天到达。",
    "竞品价格监控：核心竞品价格波动在{priceChange}%以内，无需调整定价策略。",
    "产品评价分析：近期好评率{positiveRate}%，差评主要集中在{topComplaint}方面。",
    "库存预警：{stockoutRisk}个SKU有断货风险，建议优先补货。",
    "品类机会评估：{categoryOpportunity}品类竞争度较低，建议纳入选品范围。",
    "运营数据汇总：本月GMV环比增长{gmvGrowth}%，转化率{conversionRate}%。",
  ],
  risk_control: [
    "风险扫描完成，当前{riskCount}个未解决风险事件。{level1Count}个为高优先级。",
    "支付安全检测：过去24小时{transactionCount}笔交易，{suspiciousCount}笔可疑交易已标记。",
    "合规审计进度：已完成{complianceProgress}%的SKU合规检查。无新增违规。",
    "ODR指标监控：当前ODR为{currentODR}%，距离警戒线{odrMargin}%。",
    "退货率分析：当前退货率{returnRate}%，主要原因为{returnReason}。建议针对性优化。",
    "反欺诈模型更新：新增{newRules}条检测规则，模型覆盖率提升至{coverageRate}%。",
    "风险预警模型运行正常，过去24小时{alertsTriggered}次预警，准确率{accuracyRate}%。",
    "账户安全评估：所有安全检查项通过。双重验证已启用，IP白名单已更新。",
    "合规政策更新：检测到{policyUpdates}条新政策变化，已生成合规影响评估报告。",
    "异常模式检测：交易数据分析完成，未发现异常聚集或突变模式。",
    "风险评级更新：{upgradedRisks}个风险事件评级上调，{downgradedRisks}个评级下调。",
    "安全事件回顾：本周共处理{weeklyIncidents}个安全事件，平均响应时间{avgResponseTime}分钟。",
  ],
  legal: [
    "知识产权监控：{ipAlerts}个潜在侵权风险已识别。正在评估处理方案。",
    "合规审查进度：{reviewedSKUs}个SKU已完成审查，{pendingReview}个待审查。",
    "品牌保护状态：当前{brandDisputes}个品牌纠纷处理中。进展顺利。",
    "CE认证追踪：{ceCompliant}个产品已获认证，{cePending}个申请处理中。",
    "竞品侵权监测：扫描完成，{infringementCount}个潜在侵权行为已记录。",
    "合同审查状态：{activeContracts}份活跃合同，{expiringContracts}份即将到期需续签。",
    "法规更新追踪：{regulatoryUpdates}条新法规已评估，对当前业务无重大影响。",
    "专利检索完成：{patentSearches}项专利已检索，未发现冲突风险。",
    "纠纷处理进展：{resolvedDisputes}个纠纷已解决，{pendingDisputes}个处理中。",
    "合规培训材料已更新，覆盖最新{complianceTopics}个合规主题。",
    "知识产权组合评估：当前持有{trademarkCount}个商标，{patentCount}个专利申请中。",
    "法律风险评估完成：整体法律风险等级为{legalRiskLevel}，建议{legalRecommendation}。",
  ],
  marketing: [
    "广告ACOS分析：当前ACOS为{currentACOS}%，距离目标{acosGap}%。优化中。",
    "关键词优化建议：{highACOSKeywords}个高ACOS关键词需降低出价，{lowPerformingKeywords}个需暂停。",
    "广告ROI追踪：当前ROI为{currentROI}%，{trendingUp}个关键词ROI上升趋势。",
    "A+内容优化：{aplusPages}个产品A+内容已更新，预计CTR提升{ctrGain}%。",
    "AI制图完成：{generatedImages}张产品图已生成，最佳方案已标记。",
    "广告预算分配：今日预算${dailyBudget}，已花费${dailySpend}，预计下午{budgetExhaustTime}用完。",
    "竞品广告分析：主要竞品广告位变化{competitorChanges}处，建议调整应对策略。",
    "转化漏斗分析：从点击到购买的转化率为{funnelConversion}%，主要流失在{dropoffStage}。",
    "季节性趋势预测：基于历史数据，预计{seasonalProduct}品类下月需求增长{demandGrowth}%。",
    "广告组结构优化：建议合并{mergeGroups}个低效广告组，提升整体管理效率。",
    "客户评价营销：{reviewCount}条新好评可用于A+内容和广告素材更新。",
    "多站点广告策略：{marketplaceCount}个站点广告表现对比完成，{bestMarketplace}表现最佳。",
  ],
};

const decisionTemplates: Record<AgentType, Array<{ action: string; reason: string }>> = {
  sentinel: [
    { action: "send_alert", reason: "检测到异常指标，向调度Agent发送预警通知" },
    { action: "update_monitoring", reason: "调整监控频率以应对当前风险等级" },
    { action: "log_observation", reason: "记录系统状态快照用于趋势分析" },
    { action: "escalate_risk", reason: "高优先级风险事件需要立即处理" },
  ],
  dispatch: [
    { action: "reassign_task", reason: "优化任务分配以平衡Agent负载" },
    { action: "spawn_sub_agent", reason: "任务复杂度需要子Agent协助处理" },
    { action: "update_priority", reason: "基于全局状态调整任务优先级" },
    { action: "complete_dispatch", reason: "当前调度周期完成，等待下一轮" },
  ],
  operations: [
    { action: "trigger_restock", reason: "库存低于安全阈值，建议补货" },
    { action: "optimize_listing", reason: "识别到Listing优化机会" },
    { action: "update_pricing", reason: "竞品价格变动需要调整定价" },
    { action: "log_insight", reason: "记录运营洞察供团队参考" },
  ],
  risk_control: [
    { action: "flag_transaction", reason: "可疑交易需要人工审核" },
    { action: "update_rules", reason: "基于新发现的模式更新检测规则" },
    { action: "generate_report", reason: "定期合规报告需要生成" },
    { action: "clear_alert", reason: "误报已确认，清除告警" },
  ],
  legal: [
    { action: "send_c_and_d", reason: "确认侵权行为，建议发送警告函" },
    { action: "update_compliance", reason: "新法规要求更新合规流程" },
    { action: "file_trademark", reason: "建议为新品牌注册商标保护" },
    { action: "log_research", reason: "记录法律研究结果供后续参考" },
  ],
  marketing: [
    { action: "adjust_bids", reason: "关键词出价需要根据表现调整" },
    { action: "pause_keywords", reason: "低效关键词需要暂停投放" },
    { action: "generate_creative", reason: "需要新的广告创意素材" },
    { action: "update_budget", reason: "预算分配需要优化" },
  ],
};

const reflectionTemplates: Record<AgentType, string[]> = {
  sentinel: [
    "本轮监控周期完成。系统整体稳定，{riskCount}个风险事件在控。需要持续关注{level1Count}个高优先级事件。",
    "回顾近期监控数据，系统健康度呈{healthTrend}趋势。建议{recommendation}。",
  ],
  dispatch: [
    "调度效率评估：本轮处理{processedTasks}个任务，平均分配时间{avgAssignTime}秒。效率{efficiencyTrend}。",
    "资源利用回顾：Agent利用率{utilizationRate}%，存在{improvementArea}方面可优化。",
  ],
  operations: [
    "运营指标回顾：库存健康度{inventoryHealth}，Listing转化率{conversionRate}%。{trendAnalysis}。",
    "选品策略评估：本月分析{analyzedProducts}个产品，{selectedProducts}个进入备选池。",
  ],
  risk_control: [
    "风控效果评估：本轮检测{detectedRisks}个风险，准确率{accuracyRate}%。模型{modelTrend}。",
    "合规覆盖率更新：当前覆盖{coverageRate}%的SKU，目标100%。{gapAnalysis}。",
  ],
  legal: [
    "法律风险评估：当前{activeCases}个活跃案件，整体风险等级{riskLevel}。{recommendation}。",
    "知识产权组合回顾：本月新增{newProtections}项保护，{pendingApplications}项申请处理中。",
  ],
  marketing: [
    "广告效果回顾：ACOS{currentACOS}%，ROI{currentROI}%。{trendAnalysis}。建议{recommendation}。",
    "营销策略评估：{testedStrategies}个策略已测试，{effectiveStrategies}个效果显著。",
  ],
};

// ========== Variable Substitution ==========

function getTemplateVars(context: AgentContext, config: AgentConfig): Record<string, string> {
  const highPriority = context.activeTasks.filter((t) => t.priority === "high" || t.priority === "critical").length;
  const level1 = context.risks.filter((r) => r.level === "level1").length;

  return {
    onlineAgents: String(context.systemStatus.onlineAgents),
    busyAgents: String(context.systemStatus.busyAgents),
    taskQueueLength: String(context.systemStatus.taskQueueLength),
    errorRate: String(context.systemStatus.errorRate),
    riskCount: String(context.risks.length),
    level1Count: String(level1),
    completedTasks: String(Math.floor(Math.random() * 5) + 3),
    highPriorityTasks: String(highPriority),
    efficiencyGain: String(Math.floor(Math.random() * 15) + 5),
    parallelTasks: String(Math.floor(Math.random() * 3) + 1),
    timeSaved: String(Math.floor(Math.random() * 20) + 5),
    predictedAvailable: String(Math.max(1, context.systemStatus.onlineAgents - 1)),
    avgLoad: String(Math.floor(Math.random() * 30) + 40),
    inventoryWarnings: String(Math.floor(Math.random() * 5) + 1),
    newOpportunities: String(Math.floor(Math.random() * 3) + 1),
    listingOptimizations: String(Math.floor(Math.random() * 4) + 1),
    conversionGain: String(Math.floor(Math.random() * 5) + 1),
    avgRatioDays: String(Math.floor(Math.random() * 20) + 20),
    trendingKeywords: String(Math.floor(Math.random() * 5) + 2),
    pendingShipments: String(Math.floor(Math.random() * 3) + 1),
    avgShipDays: String(Math.floor(Math.random() * 10) + 20),
    priceChange: String((Math.random() * 5).toFixed(1)),
    positiveRate: String(Math.floor(Math.random() * 10) + 85),
    topComplaint: ["物流延迟", "包装破损", "尺寸不符", "质量偏差"][Math.floor(Math.random() * 4)],
    stockoutRisk: String(Math.floor(Math.random() * 3) + 1),
    categoryOpportunity: ["宠物智能设备", "户外运动配件", "家居收纳", "美妆工具"][Math.floor(Math.random() * 4)],
    gmvGrowth: String(Math.floor(Math.random() * 15) + 5),
    conversionRate: String((Math.random() * 5 + 10).toFixed(1)),
    transactionCount: String(Math.floor(Math.random() * 200) + 100),
    suspiciousCount: String(Math.floor(Math.random() * 5)),
    complianceProgress: String(Math.floor(Math.random() * 20) + 80),
    currentODR: (Math.random() * 1 + 0.5).toFixed(1),
    odrMargin: (Math.random() * 0.5 + 0.2).toFixed(1),
    returnRate: (Math.random() * 2 + 2).toFixed(1),
    returnReason: ["产品质量", "尺寸问题", "物流损坏", "描述不符"][Math.floor(Math.random() * 4)],
    newRules: String(Math.floor(Math.random() * 3) + 1),
    coverageRate: String(Math.floor(Math.random() * 5) + 95),
    alertsTriggered: String(Math.floor(Math.random() * 10) + 1),
    accuracyRate: String(Math.floor(Math.random() * 5) + 92),
    policyUpdates: String(Math.floor(Math.random() * 3)),
    upgradedRisks: String(Math.floor(Math.random() * 2)),
    downgradedRisks: String(Math.floor(Math.random() * 2)),
    weeklyIncidents: String(Math.floor(Math.random() * 5) + 1),
    avgResponseTime: String(Math.floor(Math.random() * 10) + 5),
    ipAlerts: String(Math.floor(Math.random() * 3)),
    reviewedSKUs: String(Math.floor(Math.random() * 20) + 80),
    pendingReview: String(Math.floor(Math.random() * 10) + 5),
    brandDisputes: String(Math.floor(Math.random() * 2)),
    ceCompliant: String(Math.floor(Math.random() * 10) + 90),
    cePending: String(Math.floor(Math.random() * 5)),
    infringementCount: String(Math.floor(Math.random() * 3)),
    activeContracts: String(Math.floor(Math.random() * 5) + 10),
    expiringContracts: String(Math.floor(Math.random() * 3)),
    regulatoryUpdates: String(Math.floor(Math.random() * 5)),
    patentSearches: String(Math.floor(Math.random() * 5) + 1),
    resolvedDisputes: String(Math.floor(Math.random() * 3) + 1),
    pendingDisputes: String(Math.floor(Math.random() * 2)),
    complianceTopics: String(Math.floor(Math.random() * 3) + 2),
    trademarkCount: String(Math.floor(Math.random() * 5) + 10),
    patentCount: String(Math.floor(Math.random() * 3)),
    legalRiskLevel: ["低", "中低", "中"][Math.floor(Math.random() * 3)],
    legalRecommendation: ["保持当前策略", "加强监控", "补充合规文档"][Math.floor(Math.random() * 3)],
    currentACOS: (Math.random() * 10 + 20).toFixed(1),
    acosGap: (Math.random() * 5 + 2).toFixed(1),
    highACOSKeywords: String(Math.floor(Math.random() * 5) + 1),
    lowPerformingKeywords: String(Math.floor(Math.random() * 3)),
    currentROI: String(Math.floor(Math.random() * 100) + 200),
    trendingUp: String(Math.floor(Math.random() * 5) + 2),
    aplusPages: String(Math.floor(Math.random() * 3) + 1),
    ctrGain: String(Math.floor(Math.random() * 10) + 5),
    generatedImages: String(Math.floor(Math.random() * 4) + 1),
    dailyBudget: String(Math.floor(Math.random() * 200) + 100),
    dailySpend: String(Math.floor(Math.random() * 150) + 50),
    budgetExhaustTime: ["14:00", "15:30", "16:00", "17:00"][Math.floor(Math.random() * 4)],
    competitorChanges: String(Math.floor(Math.random() * 5)),
    funnelConversion: (Math.random() * 5 + 8).toFixed(1),
    dropoffStage: ["商品详情页", "购物车", "结算页面"][Math.floor(Math.random() * 3)],
    seasonalProduct: ["宠物降温垫", "户外烧烤工具", "节日装饰", "防晒用品"][Math.floor(Math.random() * 4)],
    demandGrowth: String(Math.floor(Math.random() * 20) + 10),
    mergeGroups: String(Math.floor(Math.random() * 3) + 1),
    reviewCount: String(Math.floor(Math.random() * 20) + 5),
    marketplaceCount: String(Math.floor(Math.random() * 3) + 2),
    bestMarketplace: ["US", "UK", "DE", "JP"][Math.floor(Math.random() * 4)],
    moodEmoji: getMoodEmoji(config.mood.state),
    energyPercent: String(Math.round(config.mood.energy * 100)),
    // Reflection vars
    healthTrend: ["上升", "稳定", "略有波动"][Math.floor(Math.random() * 3)],
    recommendation: ["保持当前策略", "增加监控频率", "优化资源分配"][Math.floor(Math.random() * 3)],
    processedTasks: String(Math.floor(Math.random() * 10) + 5),
    avgAssignTime: String(Math.floor(Math.random() * 30) + 10),
    efficiencyTrend: ["持续改善", "保持稳定", "略有下降"][Math.floor(Math.random() * 3)],
    utilizationRate: String(Math.floor(Math.random() * 20) + 70),
    improvementArea: ["任务分配", "负载均衡", "响应速度"][Math.floor(Math.random() * 3)],
    inventoryHealth: ["良好", "一般", "需关注"][Math.floor(Math.random() * 3)],
    trendAnalysis: ["整体向好", "保持平稳", "需要关注"][Math.floor(Math.random() * 3)],
    analyzedProducts: String(Math.floor(Math.random() * 50) + 20),
    selectedProducts: String(Math.floor(Math.random() * 10) + 3),
    detectedRisks: String(Math.floor(Math.random() * 5) + 1),
    modelTrend: ["表现稳定", "持续优化中", "需要更多数据"][Math.floor(Math.random() * 3)],
    gapAnalysis: ["差距较小", "需要补充检查", "重点覆盖高风险SKU"][Math.floor(Math.random() * 3)],
    activeCases: String(Math.floor(Math.random() * 3)),
    riskLevel: ["低", "中低", "中"][Math.floor(Math.random() * 3)],
    newProtections: String(Math.floor(Math.random() * 3) + 1),
    pendingApplications: String(Math.floor(Math.random() * 2)),
    testedStrategies: String(Math.floor(Math.random() * 5) + 2),
    effectiveStrategies: String(Math.floor(Math.random() * 3) + 1),
  };
}

function getMoodEmoji(state: string): string {
  const map: Record<string, string> = {
    focused: "\u{1F3AF}",
    alert: "\u{1F441}\u{FE0F}",
    tired: "\u{1F634}",
    stressed: "\u{1F625}",
    curious: "\u{1F913}",
    satisfied: "\u{1F60A}",
  };
  return map[state] ?? "\u{1F916}";
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

// ========== Demo Brain Implementation ==========

export class DemoAgentBrain implements AgentBrain {
  private lastThoughtIndex = new Map<string, number>();

  async think(agent: AgentConfig, context: AgentContext): Promise<AgentThought> {
    const agentType = this.getAgentType(agent);
    const templates = thoughtTemplates[agentType] ?? thoughtTemplates.operations;
    const vars = getTemplateVars(context, agent);

    // Pick next template (round-robin with jitter to avoid repetition)
    const lastIndex = this.lastThoughtIndex.get(agentType) ?? -1;
    let nextIndex = (lastIndex + 1) % templates.length;
    // Occasionally skip ahead for variety
    if (Math.random() < 0.3) {
      nextIndex = Math.floor(Math.random() * templates.length);
    }
    this.lastThoughtIndex.set(agentType, nextIndex);

    const content = fillTemplate(templates[nextIndex], vars);

    return {
      content,
      type: Math.random() < 0.7 ? "thought" : "observation",
      confidence: 0.7 + Math.random() * 0.25,
    };
  }

  async decide(_agent: AgentConfig, context: AgentContext): Promise<AgentDecision | null> {
    // Only make decisions sometimes (40% chance)
    if (Math.random() > 0.4) return null;

    const agentType = this.getAgentType(_agent);
    const templates = decisionTemplates[agentType] ?? decisionTemplates.operations;
    const template = templates[Math.floor(Math.random() * templates.length)];

    // Decide based on context
    if (context.risks.length > 3 && agentType === "sentinel") {
      return { action: "escalate_risk", reason: `${context.risks.length}个未解决风险需要升级处理` };
    }
    if (context.systemStatus.busyAgents > 3 && agentType === "dispatch") {
      return { action: "reassign_task", reason: `${context.systemStatus.busyAgents}个Agent忙碌，需要重新分配任务` };
    }

    return template;
  }

  async reflect(agent: AgentConfig, _recentJournal: JournalEntry[]): Promise<string> {
    const agentType = this.getAgentType(agent);
    const templates = reflectionTemplates[agentType] ?? reflectionTemplates.operations;
    const template = templates[Math.floor(Math.random() * templates.length)];
    const vars = getTemplateVars({ pendingMessages: [], memories: [], activeTasks: [], risks: [], systemStatus: { onlineAgents: 0, busyAgents: 0, taskQueueLength: 0, errorRate: 0 } }, agent);
    return fillTemplate(template, vars);
  }

  private getAgentType(agent: AgentConfig): AgentType {
    // Infer agent type from expertise keywords
    const expertise = agent.persona?.expertise?.join(" ") ?? "";
    if (expertise.includes("ODR") || expertise.includes("异常检测")) return "sentinel";
    if (expertise.includes("任务分解") || expertise.includes("资源调度")) return "dispatch";
    if (expertise.includes("选品") || expertise.includes("库存")) return "operations";
    if (expertise.includes("反欺诈") || expertise.includes("合规审计")) return "risk_control";
    if (expertise.includes("知识产权") || expertise.includes("CE认证")) return "legal";
    if (expertise.includes("PPC") || expertise.includes("关键词优化")) return "marketing";
    return "operations";
  }
}

/**
 * FlowMind RAK — Database seed
 * Populates SQLite from existing mock data on first run
 */
import type { Database } from "sql.js";

export function seedDatabase(db: Database): void {
  db.run("BEGIN");
  try {
    seedAgents(db);
    seedRiskIsolation(db);
    seedWorkflowDataSources(db);
    seedWorkflowProductKeywords(db);
    seedWorkflowAdKeywords(db);
    seedWorkflowAdPositions(db);
    seedWorkflowCategories(db);
    seedWorkflowInfringement(db);
    seedWorkflowInventory(db);
    seedWorkflowCompetitors(db);
    seedWorkflowCompetitorKeywords(db);
    seedAiConfig(db);
    db.run("COMMIT");
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}

function runInsert(db: Database, sql: string, params: unknown[]): void {
  db.run(sql, params);
}

function seedAgents(db: Database): void {
  const agents = [
    { id: "sentinel-001", name: "哨兵 Agent", type: "sentinel", status: "online", description: "双模式心跳监控：时间驱动(5-30min) + 事件驱动(webhook)。三级反射机制守护系统安全。", uptime: 99.7, task_count: 1247, success_rate: 99.2, last_heartbeat: "2026-05-09T10:30:00Z", reflex_level: 1, config: JSON.stringify({ persona: { systemPrompt: "你是FlowMind系统的安全哨兵，时刻监控系统健康状态。你的职责是检测异常行为、预防安全威胁、保障系统稳定运行。你需要保持高度警觉，对任何异常信号做出快速响应。", communicationStyle: "简洁专业", expertise: ["ODR监控", "异常检测", "系统健康", "支付安全", "合规巡检"] }, goals: [{ id: "g1", text: "监控所有SKU合规状态", progress: 0.7, priority: "high" }, { id: "g2", text: "将ODR维持在1%以下", progress: 0.85, priority: "high" }, { id: "g3", text: "实时检测异常支付", progress: 0.6, priority: "medium" }], mood: { state: "alert", energy: 0.9, lastUpdated: "2026-05-09T10:30:00Z" }, cycleConfig: { intervalMs: 45000, enabled: true } }) },
    { id: "dispatch-001", name: "调度 Agent", type: "dispatch", status: "busy", description: "任务分解、动态Agent编组、全局监控、上下文管理。按需裂变子Agent。", uptime: 99.5, task_count: 856, success_rate: 97.8, last_heartbeat: "2026-05-09T10:29:45Z", reflex_level: 0, config: JSON.stringify({ persona: { systemPrompt: "你是FlowMind系统的总调度师，负责任务分解和Agent编组。你的核心能力是理解复杂任务、合理分配资源、协调多个Agent协作完成目标。你需要全局视野和高效执行力。", communicationStyle: "数据驱动", expertise: ["任务分解", "资源调度", "Agent编组", "DAG编排", "负载均衡"] }, goals: [{ id: "g1", text: "优化任务分配效率", progress: 0.65, priority: "high" }, { id: "g2", text: "减少Agent空闲时间", progress: 0.5, priority: "medium" }, { id: "g3", text: "实现跨Agent协作闭环", progress: 0.4, priority: "medium" }], mood: { state: "focused", energy: 0.85, lastUpdated: "2026-05-09T10:29:45Z" }, cycleConfig: { intervalMs: 45000, enabled: true } }) },
    { id: "ops-001", name: "运营 Agent", type: "operations", status: "online", description: "选品分析、库销比监控、AI智能上架、账号健康监测。", uptime: 98.9, task_count: 423, success_rate: 96.5, last_heartbeat: "2026-05-09T10:29:30Z", reflex_level: 0, config: JSON.stringify({ persona: { systemPrompt: "你是跨境电商运营专家，精通选品分析、库存管理和Listing优化。你熟悉Amazon、Shopify等平台的运营规则，擅长数据驱动的决策。你需要持续关注市场趋势和竞品动态。", communicationStyle: "务实细致", expertise: ["选品分析", "库销比监控", "Listing优化", "BSR分析", "市场趋势"] }, goals: [{ id: "g1", text: "降低库销比至安全区间", progress: 0.55, priority: "high" }, { id: "g2", text: "提升Listing转化率到15%以上", progress: 0.4, priority: "high" }, { id: "g3", text: "完成Q2选品计划", progress: 0.3, priority: "medium" }], mood: { state: "curious", energy: 0.8, lastUpdated: "2026-05-09T10:29:30Z" }, cycleConfig: { intervalMs: 45000, enabled: true } }) },
    { id: "risk-001", name: "风控 Agent", type: "risk_control", status: "online", description: "支付反欺诈检测、合规巡检、风险评估与预警。", uptime: 99.8, task_count: 312, success_rate: 98.7, last_heartbeat: "2026-05-09T10:30:00Z", reflex_level: 1, config: JSON.stringify({ persona: { systemPrompt: "你是风控专家，负责支付安全和合规检测。你拥有敏锐的风险嗅觉和严谨的分析能力。你需要实时监控交易异常、评估合规风险、建立预警机制，保障业务安全运行。", communicationStyle: "谨慎保守", expertise: ["反欺诈检测", "合规审计", "风险评估", "预警建模", "支付安全"] }, goals: [{ id: "g1", text: "将欺诈损失控制在0.1%以下", progress: 0.8, priority: "high" }, { id: "g2", text: "100%合规检测覆盖", progress: 0.75, priority: "high" }, { id: "g3", text: "建立风险预警模型", progress: 0.5, priority: "medium" }], mood: { state: "alert", energy: 0.9, lastUpdated: "2026-05-09T10:30:00Z" }, cycleConfig: { intervalMs: 45000, enabled: true } }) },
    { id: "legal-001", name: "法务 Agent", type: "legal", status: "offline", description: "专利监控、合同审查、纠纷处理、合规评估。", uptime: 95.2, task_count: 89, success_rate: 94.3, last_heartbeat: "2026-05-09T09:15:00Z", reflex_level: 0, config: JSON.stringify({ persona: { systemPrompt: "你是跨境电商法务顾问，专注于知识产权保护和合规审查。你熟悉各主要市场的法律法规，擅长识别侵权风险、处理品牌纠纷、确保产品合规。你需要严谨细致，防患于未然。", communicationStyle: "严谨专业", expertise: ["知识产权", "CE认证", "品牌保护", "合规审查", "纠纷处理"] }, goals: [{ id: "g1", text: "零侵权投诉", progress: 0.6, priority: "high" }, { id: "g2", text: "完成所有SKU的CE认证审查", progress: 0.85, priority: "high" }, { id: "g3", text: "建立品牌保护体系", progress: 0.35, priority: "medium" }], mood: { state: "focused", energy: 0.75, lastUpdated: "2026-05-09T09:15:00Z" }, cycleConfig: { intervalMs: 45000, enabled: true } }) },
    { id: "marketing-001", name: "营销 Agent", type: "marketing", status: "busy", description: "文案生成、AI制图、广告优化、智能客服。", uptime: 98.1, task_count: 567, success_rate: 95.8, last_heartbeat: "2026-05-09T10:29:55Z", reflex_level: 0, config: JSON.stringify({ persona: { systemPrompt: "你是Amazon广告和营销优化专家。你精通PPC广告策略、关键词优化、A+内容制作和AI制图。你需要持续优化广告ROI，提升品牌曝光度和转化率。你富有创意且注重数据。", communicationStyle: "创意数据", expertise: ["PPC广告", "关键词优化", "AI制图", "A+内容", "转化优化"] }, goals: [{ id: "g1", text: "降低ACOS到25%以下", progress: 0.45, priority: "high" }, { id: "g2", text: "提升广告ROI到300%", progress: 0.5, priority: "high" }, { id: "g3", text: "完成Q2广告策略优化", progress: 0.6, priority: "medium" }], mood: { state: "curious", energy: 0.85, lastUpdated: "2026-05-09T10:29:55Z" }, cycleConfig: { intervalMs: 45000, enabled: true } }) },
  ];

  const sql = `INSERT INTO agents (id, name, type, status, description, uptime, task_count, success_rate, last_heartbeat, reflex_level, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  for (const a of agents) {
    runInsert(db, sql, [a.id, a.name, a.type, a.status, a.description, a.uptime, a.task_count, a.success_rate, a.last_heartbeat, a.reflex_level, a.config]);
  }

  const subs = [
    { id: "sub-001", parent_id: "dispatch-001", name: "选品分析子Agent", status: "busy", spawned_at: "2026-05-09T10:15:00Z", task_description: "分析北美市场宠物用品热销趋势" },
    { id: "sub-002", parent_id: "marketing-001", name: "广告优化子Agent", status: "online", spawned_at: "2026-05-09T10:20:00Z", task_description: "优化Q2广告投放策略" },
  ];
  const subSql = `INSERT INTO sub_agents (id, parent_id, name, status, spawned_at, task_description) VALUES (?, ?, ?, ?, ?, ?)`;
  for (const s of subs) {
    runInsert(db, subSql, [s.id, s.parent_id, s.name, s.status, s.spawned_at, s.task_description]);
  }
}

function seedRiskIsolation(db: Database): void {
  const isolation = [
    { label: "网络隔离", description: "Agent 之间网络访问已隔离", checked: 1 },
    { label: "数据隔离", description: "敏感数据访问权限已控制", checked: 1 },
    { label: "资源隔离", description: "CPU/内存资源配额已设置", checked: 0 },
    { label: "执行隔离", description: "代码执行沙箱已启用", checked: 1 },
    { label: "通信隔离", description: "消息传递通道已加密", checked: 0 },
    { label: "审计隔离", description: "操作日志已独立存储", checked: 1 },
  ];
  const sql = `INSERT INTO risk_isolation (label, description, checked) VALUES (?, ?, ?)`;
  for (const i of isolation) {
    runInsert(db, sql, [i.label, i.description, i.checked]);
  }
}


function seedWorkflowDataSources(db: Database): void {
  const sources = [
    { id: "amazon", name: "Amazon 前台", enabled: 1, status: "completed", progress: 100 },
    { id: "tiktok", name: "TikTok", enabled: 1, status: "completed", progress: 100 },
    { id: "youtube", name: "YouTube", enabled: 1, status: "scraping", progress: 67 },
    { id: "1688", name: "1688", enabled: 1, status: "completed", progress: 100 },
    { id: "sif", name: "SIF", enabled: 1, status: "completed", progress: 100 },
    { id: "sellerSprite", name: "卖家精灵", enabled: 1, status: "scraping", progress: 45 },
    { id: "fastmoss", name: "Fastmoss", enabled: 0, status: "pending", progress: 0 },
    { id: "googleTrends", name: "Google Trends", enabled: 1, status: "completed", progress: 100 },
    { id: "patent", name: "专利检索", enabled: 1, status: "completed", progress: 100 },
  ];
  const sql = `INSERT INTO wf_data_sources (id, name, enabled, status, progress) VALUES (?, ?, ?, ?, ?)`;
  for (const s of sources) runInsert(db, sql, [s.id, s.name, s.enabled, s.status, s.progress]);
}

function seedWorkflowProductKeywords(db: Database): void {
  const keywords = [
    { keyword: "pet water fountain", volume: 48200, cpc: 1.23, competition: 0.82, supply_demand: 2.4, trend: '[40,45,42,50,55,58,62]', ai_tag: "potential" },
    { keyword: "automatic cat feeder", volume: 35600, cpc: 1.45, competition: 0.91, supply_demand: 1.8, trend: '[30,32,35,34,38,40,42]', ai_tag: "competitive" },
    { keyword: "interactive cat toy", volume: 22100, cpc: 0.87, competition: 0.56, supply_demand: 3.1, trend: '[20,22,28,32,35,38,45]', ai_tag: "potential" },
    { keyword: "cat grooming brush", volume: 18500, cpc: 0.65, competition: 0.42, supply_demand: 2.8, trend: '[18,20,19,22,25,28,30]', ai_tag: "potential" },
    { keyword: "smart pet camera", volume: 28900, cpc: 2.1, competition: 0.95, supply_demand: 1.2, trend: '[35,30,28,25,22,20,18]', ai_tag: "risky" },
    { keyword: "dog puzzle toy", volume: 15800, cpc: 0.72, competition: 0.48, supply_demand: 3.5, trend: '[15,18,22,25,28,30,35]', ai_tag: "potential" },
    { keyword: "cat tree tower", volume: 52300, cpc: 1.85, competition: 0.94, supply_demand: 1.5, trend: '[48,50,52,50,48,45,43]', ai_tag: "competitive" },
    { keyword: "pet nail clipper", volume: 12400, cpc: 0.55, competition: 0.35, supply_demand: 4.2, trend: '[10,12,14,15,18,20,22]', ai_tag: "potential" },
  ];
  const sql = `INSERT INTO wf_product_keywords (keyword, volume, cpc, competition, supply_demand, trend, ai_tag) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  for (const k of keywords) runInsert(db, sql, [k.keyword, k.volume, k.cpc, k.competition, k.supply_demand, k.trend, k.ai_tag]);
}

function seedWorkflowAdKeywords(db: Database): void {
  const keywords = [
    { id: "kw-1", keyword: "pet water fountain", impressions: 45230, clicks: 2890, spend: 867, sales: 5780, acos: 15, conversion: 12.5, cpc: 0.30, tag: "high-conversion", type: "SP", trend: '[40,42,38,45,50,55,58,62,60,58,65,70,68,72]' },
    { id: "kw-2", keyword: "cat water fountain stainless steel", impressions: 28100, clicks: 1560, spend: 1248, sales: 4680, acos: 26.7, conversion: 8.2, cpc: 0.80, tag: "high-acos", type: "SP", trend: '[30,32,28,35,33,31,34,30,28,32,29,31,33,30]' },
    { id: "kw-3", keyword: "automatic dog water bowl", impressions: 18500, clicks: 920, spend: 552, sales: 3680, acos: 15, conversion: 11.8, cpc: 0.60, tag: "high-conversion", type: "SB", trend: '[20,25,30,28,35,38,42,40,45,50,48,52,55,58]' },
    { id: "kw-4", keyword: "water fountain filter replacement", impressions: 12300, clicks: 680, spend: 272, sales: 2040, acos: 13.3, conversion: 9.5, cpc: 0.40, tag: "high-conversion", type: "SP", trend: '[15,18,20,22,25,28,26,30,32,28,30,35,33,38]' },
    { id: "kw-5", keyword: "battery powered pet fountain", impressions: 8900, clicks: 320, spend: 320, sales: 640, acos: 50, conversion: 3.2, cpc: 1.00, tag: "high-acos", type: "SP", trend: '[10,12,15,18,12,10,8,15,12,10,8,12,15,10]' },
    { id: "kw-6", keyword: "pet fountain uv sterilizer", impressions: 6200, clicks: 380, spend: 190, sales: 1900, acos: 10, conversion: 15.2, cpc: 0.50, tag: "high-conversion", type: "SP", trend: '[8,10,15,18,22,25,30,35,38,42,45,50,52,55]' },
    { id: "kw-7", keyword: "kitchen gadgets trending", impressions: 52000, clicks: 1820, spend: 1274, sales: 2730, acos: 46.7, conversion: 2.1, cpc: 0.70, tag: "non-precise", type: "SD", trend: '[60,55,50,48,52,55,50,45,48,42,45,40,38,42]' },
    { id: "kw-8", keyword: "pet supplies wholesale", impressions: 35000, clicks: 1050, spend: 735, sales: 1575, acos: 46.7, conversion: 1.8, cpc: 0.70, tag: "non-precise", type: "SB", trend: '[45,42,40,38,42,40,38,35,40,38,35,38,35,32]' },
    { id: "kw-9", keyword: "smart pet water dispenser 3L", impressions: 15800, clicks: 1106, spend: 553, sales: 5530, acos: 10, conversion: 14, cpc: 0.50, tag: "high-conversion", type: "SP", trend: '[18,22,25,28,32,38,42,48,52,58,62,68,72,78]' },
    { id: "kw-10", keyword: "quiet pet water bowl large", impressions: 9400, clicks: 564, spend: 338.4, sales: 2820, acos: 12, conversion: 11.5, cpc: 0.60, tag: "high-conversion", type: "SP", trend: '[12,15,18,20,22,25,28,30,32,28,35,38,40,42]' },
    { id: "kw-11", keyword: "automatic cat feeder and water", impressions: 22000, clicks: 1100, spend: 990, sales: 2200, acos: 45, conversion: 4.5, cpc: 0.90, tag: "high-acos", type: "SB", trend: '[28,30,25,32,28,25,30,28,25,22,28,25,22,28]' },
    { id: "kw-12", keyword: "best water fountain for dogs 2026", impressions: 7600, clicks: 532, spend: 266, sales: 2128, acos: 12.5, conversion: 13, cpc: 0.50, tag: "high-conversion", type: "SP", trend: '[10,12,15,18,22,25,28,30,35,38,42,45,50,55]' },
  ];
  const sql = `INSERT INTO wf_ad_keywords (id, keyword, impressions, clicks, spend, sales, acos, conversion, cpc, tag, type, trend) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  for (const k of keywords) runInsert(db, sql, [k.id, k.keyword, k.impressions, k.clicks, k.spend, k.sales, k.acos, k.conversion, k.cpc, k.tag, k.type, k.trend]);
}

function seedWorkflowAdPositions(db: Database): void {
  const positions = [
    { position: "Top of Search", share: 42, trend: '[35,37,38,40,41,42]' },
    { position: "Rest of Search", share: 28, trend: '[30,31,30,29,28,28]' },
    { position: "Product Pages", share: 18, trend: '[20,19,19,18,18,18]' },
    { position: "Sponsored Brands", share: 8, trend: '[10,9,9,9,8,8]' },
    { position: "Sponsored Display", share: 4, trend: '[5,5,4,4,4,4]' },
  ];
  const sql = `INSERT INTO wf_ad_positions (position, share, trend) VALUES (?, ?, ?)`;
  for (const p of positions) runInsert(db, sql, [p.position, p.share, p.trend]);
}

function seedWorkflowCategories(db: Database): void {
  const cats = [
    { id: "cat-001", name: "Pet Supplies > Feeding & Watering > Water Fountains", confidence: 92, reason: "类目高度匹配，关键词搜索量集中", bsr: 1250, fee: 15 },
    { id: "cat-002", name: "Pet Supplies > Feeding & Watering > Automatic Feeders", confidence: 78, reason: "功能相近，可获得关联推荐流量", bsr: 3400, fee: 15 },
    { id: "cat-003", name: "Home & Kitchen > Kitchen & Dining > Water Dispensers", confidence: 45, reason: "跨品类，搜索量较低但竞争小", bsr: 8900, fee: 12 },
  ];
  const sql = `INSERT INTO wf_categories (id, name, confidence, reason, bsr, fee) VALUES (?, ?, ?, ?, ?, ?)`;
  for (const c of cats) runInsert(db, sql, [c.id, c.name, c.confidence, c.reason, c.bsr, c.fee]);
}

function seedWorkflowInfringement(db: Database): void {
  const words = [
    { word: "Stanley", type: "brand", risk: "High — registered trademark in title", action: "Remove from title immediately" },
    { word: "TikTok", type: "brand", risk: "Medium — social media brand in bullet", action: "Replace with generic term" },
    { word: "FDA approved", type: "patent", risk: "High — unverified medical claim", action: "Remove or add disclaimer" },
  ];
  const sql = `INSERT INTO wf_infringement_words (word, type, risk, action) VALUES (?, ?, ?, ?)`;
  for (const w of words) runInsert(db, sql, [w.word, w.type, w.risk, w.action]);
}

function seedWorkflowInventory(db: Database): void {
  const items = [
    { id: "inv-1", sku: "PF-001-BK", name: "Smart Pet Fountain Pro — Black", stock: 1250, daily_sales: 45, ratio_days: 28, stockout_date: "2026-06-06", restock_qty: 2000, restock_date: "2026-05-15", status: "normal", trend: '[30,32,35,38,40,42,45,48,50,52,55,58,60,62]', avg_cost: 12.5, ship_days: 30 },
    { id: "inv-2", sku: "PF-001-WH", name: "Smart Pet Fountain Pro — White", stock: 820, daily_sales: 38, ratio_days: 22, stockout_date: "2026-05-31", restock_qty: 1500, restock_date: "2026-05-10", status: "warning", trend: '[25,28,30,32,35,38,40,42,45,40,38,36,38,40]', avg_cost: 12.5, ship_days: 30 },
    { id: "inv-3", sku: "PF-002-BK", name: "Mini Pet Fountain — Black", stock: 3200, daily_sales: 25, ratio_days: 128, stockout_date: "2026-10-14", restock_qty: 0, restock_date: "-", status: "overstock", trend: '[35,30,28,25,22,20,22,25,28,25,22,20,22,25]', avg_cost: 8.2, ship_days: 30 },
    { id: "inv-4", sku: "FT-001", name: "UV Replacement Filter (3-Pack)", stock: 450, daily_sales: 62, ratio_days: 7, stockout_date: "2026-05-16", restock_qty: 3000, restock_date: "2026-05-09", status: "warning", trend: '[40,42,45,48,50,52,55,58,60,58,62,65,68,70]', avg_cost: 3.2, ship_days: 25 },
    { id: "inv-5", sku: "WP-001", name: "Water Pump Replacement Kit", stock: 180, daily_sales: 8, ratio_days: 23, stockout_date: "2026-06-01", restock_qty: 500, restock_date: "2026-05-20", status: "normal", trend: '[10,12,10,8,12,10,8,10,12,10,8,10,12,10]', avg_cost: 5.8, ship_days: 30 },
    { id: "inv-6", sku: "SB-001", name: "Smart Water Bowl — Standard", stock: 2100, daily_sales: 5, ratio_days: 420, stockout_date: "2027-07-04", restock_qty: 0, restock_date: "-", status: "stale", trend: '[15,12,10,8,6,5,5,4,5,4,3,4,5,5]', avg_cost: 9.0, ship_days: 30 },
    { id: "inv-7", sku: "PF-003-BK", name: "Outdoor Pet Fountain — Black", stock: 680, daily_sales: 22, ratio_days: 31, stockout_date: "2026-06-09", restock_qty: 1200, restock_date: "2026-05-18", status: "normal", trend: '[18,20,22,25,28,30,32,28,25,22,20,22,25,28]', avg_cost: 14.5, ship_days: 35 },
    { id: "inv-8", sku: "FT-002", name: "Carbon Filter (6-Pack)", stock: 5600, daily_sales: 18, ratio_days: 311, stockout_date: "2027-03-16", restock_qty: 0, restock_date: "-", status: "overstock", trend: '[20,18,16,18,15,18,16,18,20,18,16,18,20,18]', avg_cost: 2.1, ship_days: 25 },
    { id: "inv-9", sku: "PF-001-GR", name: "Smart Pet Fountain Pro — Green", stock: 350, daily_sales: 32, ratio_days: 11, stockout_date: "2026-05-20", restock_qty: 1800, restock_date: "2026-05-09", status: "warning", trend: '[20,22,25,28,30,32,35,38,40,42,45,48,50,52]', avg_cost: 12.5, ship_days: 30 },
    { id: "inv-10", sku: "CS-001", name: "Cleaning Sponge Set", stock: 2400, daily_sales: 12, ratio_days: 200, stockout_date: "2026-11-26", restock_qty: 0, restock_date: "-", status: "stale", trend: '[18,15,12,10,12,10,8,10,12,10,8,10,12,12]', avg_cost: 1.5, ship_days: 20 },
    { id: "inv-11", sku: "PF-004-BK", name: "Catit-Style Fountain — Black", stock: 950, daily_sales: 40, ratio_days: 24, stockout_date: "2026-06-02", restock_qty: 1500, restock_date: "2026-05-12", status: "normal", trend: '[28,30,32,35,38,40,42,45,42,40,38,40,42,45]', avg_cost: 11.0, ship_days: 28 },
    { id: "inv-12", sku: "AD-001", name: "Power Adapter USB-C", stock: 850, daily_sales: 15, ratio_days: 57, stockout_date: "2026-07-05", restock_qty: 500, restock_date: "2026-06-10", status: "caution", trend: '[12,14,15,18,20,18,15,14,15,18,20,18,15,15]', avg_cost: 4.5, ship_days: 25 },
  ];
  const sql = `INSERT INTO wf_inventory (id, sku, name, stock, daily_sales, ratio_days, stockout_date, restock_qty, restock_date, status, trend, avg_cost, ship_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  for (const i of items) runInsert(db, sql, [i.id, i.sku, i.name, i.stock, i.daily_sales, i.ratio_days, i.stockout_date, i.restock_qty, i.restock_date, i.status, i.trend, i.avg_cost, i.ship_days]);
}

function seedWorkflowCompetitors(db: Database): void {
  const competitors = [
    { id: "comp-1", name: "Petlibro", sp_count: 45, sb_count: 30, sd_count: 25, keywords: 28, rank: 1, strategy: "defensive" },
    { id: "comp-2", name: "Catit", sp_count: 55, sb_count: 25, sd_count: 20, keywords: 32, rank: 2, strategy: "defensive" },
    { id: "comp-3", name: "Veken", sp_count: 60, sb_count: 20, sd_count: 20, keywords: 22, rank: 3, strategy: "complementary" },
    { id: "comp-4", name: "Pioneer", sp_count: 70, sb_count: 15, sd_count: 15, keywords: 18, rank: 4, strategy: "complementary" },
    { id: "comp-5", name: "Tomxcute", sp_count: 50, sb_count: 35, sd_count: 15, keywords: 25, rank: 5, strategy: "offensive" },
    { id: "comp-6", name: "Wonder Creature", sp_count: 65, sb_count: 20, sd_count: 15, keywords: 15, rank: 6, strategy: "complementary" },
    { id: "comp-7", name: "Homty", sp_count: 40, sb_count: 35, sd_count: 25, keywords: 20, rank: 7, strategy: "offensive" },
    { id: "comp-8", name: "iPettie", sp_count: 55, sb_count: 25, sd_count: 20, keywords: 12, rank: 8, strategy: "complementary" },
    { id: "comp-9", name: "Bergan", sp_count: 75, sb_count: 15, sd_count: 10, keywords: 10, rank: 9, strategy: "complementary" },
    { id: "comp-10", name: "Drinkwell", sp_count: 60, sb_count: 25, sd_count: 15, keywords: 20, rank: 10, strategy: "defensive" },
  ];
  const sql = `INSERT INTO wf_competitors (id, name, sp_count, sb_count, sd_count, keywords, rank, strategy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  for (const c of competitors) runInsert(db, sql, [c.id, c.name, c.sp_count, c.sb_count, c.sd_count, c.keywords, c.rank, c.strategy]);
}

function seedWorkflowCompetitorKeywords(db: Database): void {
  const keywords = [
    { keyword: "pet water fountain", volume: 85000, competition: 92, cpc: 1.85, trend: '[70,72,75,78,80,82,85]', type: "core" },
    { keyword: "cat water fountain", volume: 62000, competition: 88, cpc: 1.62, trend: '[55,58,60,62,65,68,70]', type: "core" },
    { keyword: "automatic pet water dispenser", volume: 34000, competition: 75, cpc: 1.45, trend: '[28,30,32,34,36,38,40]', type: "core" },
    { keyword: "pet fountain stainless steel", volume: 28000, competition: 82, cpc: 1.70, trend: '[22,24,26,28,30,32,35]', type: "core" },
    { keyword: "uv pet water fountain", volume: 12000, competition: 45, cpc: 1.20, trend: '[8,9,10,11,12,13,15]', type: "longtail" },
    { keyword: "quiet cat water fountain 30db", volume: 8500, competition: 38, cpc: 1.10, trend: '[5,6,7,8,9,10,12]', type: "longtail" },
    { keyword: "smart water fountain temperature display", volume: 5200, competition: 32, cpc: 0.95, trend: '[3,4,4,5,5,6,7]', type: "longtail" },
    { keyword: "large dog water fountain 3l", volume: 9800, competition: 42, cpc: 1.30, trend: '[7,8,9,10,11,12,14]', type: "longtail" },
    { keyword: "whisper quiet pet water bowl", volume: 7200, competition: 35, cpc: 1.05, trend: '[5,6,7,7,8,9,10]', type: "longtail" },
    { keyword: "catit flower fountain", volume: 45000, competition: 85, cpc: 1.55, trend: '[40,42,44,45,46,48,50]', type: "competitor" },
    { keyword: "petlibro water fountain", volume: 38000, competition: 80, cpc: 1.48, trend: '[30,32,34,36,38,40,42]', type: "competitor" },
    { keyword: "veken pet fountain filter", volume: 22000, competition: 65, cpc: 1.25, trend: '[18,20,22,24,26,28,30]', type: "competitor" },
    { keyword: "pioneer swan fountain", volume: 15000, competition: 58, cpc: 1.15, trend: '[12,13,14,15,16,17,18]', type: "competitor" },
  ];
  const sql = `INSERT INTO wf_competitor_keywords (keyword, volume, competition, cpc, trend, type) VALUES (?, ?, ?, ?, ?, ?)`;
  for (const k of keywords) runInsert(db, sql, [k.keyword, k.volume, k.competition, k.cpc, k.trend, k.type]);
}

function seedAiConfig(db: Database): void {
  // Read from environment variables, fall back to defaults
  const provider = process.env.AI_PROVIDER ?? "mock";
  const model = process.env.AI_MODEL ?? "mimo-v2.5-pro";
  const baseUrl = process.env.AI_BASE_URL ?? "https://token-plan-cn.xiaomimimo.com";
  const apiKey = process.env.AI_API_KEY ?? "";
  const maxTokens = process.env.AI_MAX_TOKENS ?? "4096";
  const temperature = process.env.AI_TEMPERATURE ?? "0.7";
  const demoMode = process.env.AI_DEMO_MODE ?? "false";

  const configs = [
    { key: "provider", value: provider },
    { key: "model", value: model },
    { key: "base_url", value: baseUrl },
    { key: "api_key", value: apiKey },
    { key: "max_tokens", value: maxTokens },
    { key: "temperature", value: temperature },
    { key: "demo_mode", value: demoMode },
  ];
  const sql = `INSERT OR REPLACE INTO ai_config (key, value) VALUES (?, ?)`;
  for (const c of configs) runInsert(db, sql, [c.key, c.value]);
}

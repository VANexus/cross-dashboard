import type {
  DataSource,
  ProductKeyword,
  PainPoint,
  GeneratedImg,
  StoryboardFrame,
  AdKeyword,
  InfringementWord,
  CategoryRec,
  BulletPoint,
  InventoryItem,
  KeywordItem,
  CompetitorEntry,
  AdPosition,
  WorkflowStatus,
} from "./types";

const dataSources: DataSource[] = [
  { id: "amazon", name: "Amazon 前台", enabled: true, status: "completed", progress: 100 },
  { id: "tiktok", name: "TikTok", enabled: true, status: "completed", progress: 100 },
  { id: "youtube", name: "YouTube", enabled: true, status: "scraping", progress: 67 },
  { id: "1688", name: "1688", enabled: true, status: "completed", progress: 100 },
  { id: "sif", name: "SIF", enabled: true, status: "completed", progress: 100 },
  { id: "sellerSprite", name: "卖家精灵", enabled: true, status: "scraping", progress: 45 },
  { id: "fastmoss", name: "Fastmoss", enabled: false, status: "pending", progress: 0 },
  { id: "googleTrends", name: "Google Trends", enabled: true, status: "completed", progress: 100 },
  { id: "patent", name: "专利检索", enabled: true, status: "completed", progress: 100 },
];

const productKeywords: ProductKeyword[] = [
  { keyword: "pet water fountain", volume: 48200, cpc: 1.23, competition: 0.82, supplyDemand: 2.4, trend: [40, 45, 42, 50, 55, 58, 62], aiTag: "potential" },
  { keyword: "automatic cat feeder", volume: 35600, cpc: 1.45, competition: 0.91, supplyDemand: 1.8, trend: [30, 32, 35, 34, 38, 40, 42], aiTag: "competitive" },
  { keyword: "interactive cat toy", volume: 22100, cpc: 0.87, competition: 0.56, supplyDemand: 3.1, trend: [20, 22, 28, 32, 35, 38, 45], aiTag: "potential" },
  { keyword: "cat grooming brush", volume: 18500, cpc: 0.65, competition: 0.42, supplyDemand: 2.8, trend: [18, 20, 19, 22, 25, 28, 30], aiTag: "potential" },
  { keyword: "smart pet camera", volume: 28900, cpc: 2.1, competition: 0.95, supplyDemand: 1.2, trend: [35, 30, 28, 25, 22, 20, 18], aiTag: "risky" },
  { keyword: "dog puzzle toy", volume: 15800, cpc: 0.72, competition: 0.48, supplyDemand: 3.5, trend: [15, 18, 22, 25, 28, 30, 35], aiTag: "potential" },
  { keyword: "cat tree tower", volume: 52300, cpc: 1.85, competition: 0.94, supplyDemand: 1.5, trend: [48, 50, 52, 50, 48, 45, 43], aiTag: "competitive" },
  { keyword: "pet nail clipper", volume: 12400, cpc: 0.55, competition: 0.35, supplyDemand: 4.2, trend: [10, 12, 14, 15, 18, 20, 22], aiTag: "potential" },
];

const painPoints: PainPoint[] = [
  { category: "材质问题", count: 234, pct: 32, examples: ["塑料味重", "容易碎裂", "不耐咬"] },
  { category: "设计缺陷", count: 189, pct: 26, examples: ["出水口太小", "不好清洗", "噪音大"] },
  { category: "功能不足", count: 156, pct: 21, examples: ["水位感应不准", "滤芯寿命短", "容量太小"] },
  { category: "耐用性差", count: 145, pct: 20, examples: ["用一个月就坏", "泵不工作", "漏水"] },
];

const mainImages: GeneratedImg[] = [
  { id: "img-1", type: "main", clipScore: 87, ctrScore: 72, overall: 81, isBest: true, prompt: "white background, product centered, studio lighting", model: "SDXL-1.0", seed: 42156 },
  { id: "img-2", type: "main", clipScore: 82, ctrScore: 85, overall: 83, isBest: true, prompt: "clean white bg, 45-degree angle, soft shadows", model: "SDXL-1.0", seed: 78923 },
  { id: "img-3", type: "main", clipScore: 79, ctrScore: 68, overall: 75, isBest: false, prompt: "pure white, front view, high detail", model: "SDXL-1.0", seed: 34501 },
  { id: "img-4", type: "main", clipScore: 91, ctrScore: 88, overall: 90, isBest: true, prompt: "white bg, hero shot, premium feel", model: "SDXL-1.0", seed: 91234 },
  { id: "img-5", type: "main", clipScore: 76, ctrScore: 63, overall: 71, isBest: false, prompt: "studio white, product detail, macro", model: "SDXL-1.0", seed: 55678 },
  { id: "img-6", type: "main", clipScore: 84, ctrScore: 79, overall: 82, isBest: false, prompt: "clean bg, lifestyle angle, warm tone", model: "SDXL-1.0", seed: 22345 },
];

const sceneImages: GeneratedImg[] = [
  { id: "sc-1", type: "scene", clipScore: 88, ctrScore: 82, overall: 86, isBest: true, prompt: "modern kitchen countertop, morning light", model: "SDXL-1.0", seed: 11111 },
  { id: "sc-2", type: "scene", clipScore: 85, ctrScore: 78, overall: 82, isBest: false, prompt: "cozy living room, warm ambient lighting", model: "SDXL-1.0", seed: 22222 },
  { id: "sc-3", type: "scene", clipScore: 90, ctrScore: 86, overall: 88, isBest: true, prompt: "minimalist office desk, natural daylight", model: "SDXL-1.0", seed: 33333 },
  { id: "sc-4", type: "scene", clipScore: 78, ctrScore: 71, overall: 75, isBest: false, prompt: "outdoor garden, green plants background", model: "SDXL-1.0", seed: 44444 },
];

const storyboardFrames: StoryboardFrame[] = [
  { id: "sb-1", desc: "产品全景展示", duration: "3s", script: "Introducing the Smart Pet Fountain Pro", camera: "推", source: "亚马逊爆款" },
  { id: "sb-2", desc: "核心功能演示 — UV杀菌", duration: "4s", script: "Built-in UV sterilization keeps water clean", camera: "特写", source: "亚马逊爆款" },
  { id: "sb-3", desc: "静音水泵运行对比", duration: "3s", script: "Ultra-quiet pump at only 30dB", camera: "拉", source: "TikTok爆款" },
  { id: "sb-4", desc: "可拆卸清洗展示", duration: "4s", script: "Easy disassembly for deep cleaning", camera: "摇", source: "TikTok爆款" },
  { id: "sb-5", desc: "水温显示功能", duration: "3s", script: "Real-time water temperature display", camera: "推", source: "亚马逊爆款" },
  { id: "sb-6", desc: "智能提醒换水", duration: "3s", script: "Smart alerts remind you to refill", camera: "移", source: "" },
  { id: "sb-7", desc: "宠物使用场景", duration: "5s", script: "Happy pets love fresh, clean water", camera: "全景", source: "TikTok爆款" },
  { id: "sb-8", desc: "结尾品牌展示", duration: "2s", script: "Smart Pet Fountain Pro — Freshness Redefined", camera: "淡出", source: "" },
];

const store = {
  images: [...mainImages, ...sceneImages] as GeneratedImg[],
};

const adKeywords: AdKeyword[] = [
  { id: "kw-1", keyword: "pet water fountain", impressions: 45230, clicks: 2890, spend: 867, sales: 5780, acos: 15, conversion: 12.5, cpc: 0.30, tag: "high-conversion", type: "SP", trend: [40, 42, 38, 45, 50, 55, 58, 62, 60, 58, 65, 70, 68, 72] },
  { id: "kw-2", keyword: "cat water fountain stainless steel", impressions: 28100, clicks: 1560, spend: 1248, sales: 4680, acos: 26.7, conversion: 8.2, cpc: 0.80, tag: "high-acos", type: "SP", trend: [30, 32, 28, 35, 33, 31, 34, 30, 28, 32, 29, 31, 33, 30] },
  { id: "kw-3", keyword: "automatic dog water bowl", impressions: 18500, clicks: 920, spend: 552, sales: 3680, acos: 15, conversion: 11.8, cpc: 0.60, tag: "high-conversion", type: "SB", trend: [20, 25, 30, 28, 35, 38, 42, 40, 45, 50, 48, 52, 55, 58] },
  { id: "kw-4", keyword: "water fountain filter replacement", impressions: 12300, clicks: 680, spend: 272, sales: 2040, acos: 13.3, conversion: 9.5, cpc: 0.40, tag: "high-conversion", type: "SP", trend: [15, 18, 20, 22, 25, 28, 26, 30, 32, 28, 30, 35, 33, 38] },
  { id: "kw-5", keyword: "battery powered pet fountain", impressions: 8900, clicks: 320, spend: 320, sales: 640, acos: 50, conversion: 3.2, cpc: 1.00, tag: "high-acos", type: "SP", trend: [10, 12, 15, 18, 12, 10, 8, 15, 12, 10, 8, 12, 15, 10] },
  { id: "kw-6", keyword: "pet fountain uv sterilizer", impressions: 6200, clicks: 380, spend: 190, sales: 1900, acos: 10, conversion: 15.2, cpc: 0.50, tag: "high-conversion", type: "SP", trend: [8, 10, 15, 18, 22, 25, 30, 35, 38, 42, 45, 50, 52, 55] },
  { id: "kw-7", keyword: "kitchen gadgets trending", impressions: 52000, clicks: 1820, spend: 1274, sales: 2730, acos: 46.7, conversion: 2.1, cpc: 0.70, tag: "non-precise", type: "SD", trend: [60, 55, 50, 48, 52, 55, 50, 45, 48, 42, 45, 40, 38, 42] },
  { id: "kw-8", keyword: "pet supplies wholesale", impressions: 35000, clicks: 1050, spend: 735, sales: 1575, acos: 46.7, conversion: 1.8, cpc: 0.70, tag: "non-precise", type: "SB", trend: [45, 42, 40, 38, 42, 40, 38, 35, 40, 38, 35, 38, 35, 32] },
  { id: "kw-9", keyword: "smart pet water dispenser 3L", impressions: 15800, clicks: 1106, spend: 553, sales: 5530, acos: 10, conversion: 14, cpc: 0.50, tag: "high-conversion", type: "SP", trend: [18, 22, 25, 28, 32, 38, 42, 48, 52, 58, 62, 68, 72, 78] },
  { id: "kw-10", keyword: "quiet pet water bowl large", impressions: 9400, clicks: 564, spend: 338.4, sales: 2820, acos: 12, conversion: 11.5, cpc: 0.60, tag: "high-conversion", type: "SP", trend: [12, 15, 18, 20, 22, 25, 28, 30, 32, 28, 35, 38, 40, 42] },
  { id: "kw-11", keyword: "automatic cat feeder and water", impressions: 22000, clicks: 1100, spend: 990, sales: 2200, acos: 45, conversion: 4.5, cpc: 0.90, tag: "high-acos", type: "SB", trend: [28, 30, 25, 32, 28, 25, 30, 28, 25, 22, 28, 25, 22, 28] },
  { id: "kw-12", keyword: "best water fountain for dogs 2026", impressions: 7600, clicks: 532, spend: 266, sales: 2128, acos: 12.5, conversion: 13, cpc: 0.50, tag: "high-conversion", type: "SP", trend: [10, 12, 15, 18, 22, 25, 28, 30, 35, 38, 42, 45, 50, 55] },
];

const infringementWords = [
  { word: "Stanley", type: "brand" as const, risk: "High — registered trademark in title", action: "Remove from title immediately" },
  { word: "TikTok", type: "brand" as const, risk: "Medium — social media brand in bullet", action: "Replace with generic term" },
  { word: "FDA approved", type: "patent" as const, risk: "High — unverified medical claim", action: "Remove or add disclaimer" },
];

const categoryRecs = [
  { id: "cat-001", name: "Pet Supplies > Feeding & Watering > Water Fountains", confidence: 92, reason: "类目高度匹配，关键词搜索量集中", bsr: 1250, fee: 15 },
  { id: "cat-002", name: "Pet Supplies > Feeding & Watering > Automatic Feeders", confidence: 78, reason: "功能相近，可获得关联推荐流量", bsr: 3400, fee: 15 },
  { id: "cat-003", name: "Home & Kitchen > Kitchen & Dining > Water Dispensers", confidence: 45, reason: "跨品类，搜索量较低但竞争小", bsr: 8900, fee: 12 },
];

const bulletPoints = [
  { id: "bp-001", title: "Smart UV Sterilization", content: "Built-in UV-C light eliminates 99.9% of bacteria, keeping your pet's water clean and safe 24/7.", seoScore: 88, rufus: true },
  { id: "bp-002", title: "Ultra-Quiet Pump Technology", content: "Our advanced DC brushless motor operates at under 30dB — quieter than a whisper.", seoScore: 92, rufus: true },
  { id: "bp-003", title: "Real-Time Temperature Display", content: "LED screen shows water temperature in real-time.", seoScore: 75, rufus: false },
  { id: "bp-004", title: "Easy Disassembly & Cleaning", content: "Tool-free design allows complete disassembly in seconds.", seoScore: 85, rufus: true },
  { id: "bp-005", title: "Smart Water Level Alert", content: "Intelligent sensor detects low water levels and sends gentle LED alerts.", seoScore: 70, rufus: false },
];

const inventoryItems: InventoryItem[] = [
  { id: "inv-1", sku: "PF-001-BK", name: "Smart Pet Fountain Pro — Black", stock: 1250, dailySales: 45, ratioDays: 28, stockoutDate: "2026-06-06", restockQty: 2000, restockDate: "2026-05-15", status: "normal", trend: [30, 32, 35, 38, 40, 42, 45, 48, 50, 52, 55, 58, 60, 62], avgCost: 12.5, shipDays: 30 },
  { id: "inv-2", sku: "PF-001-WH", name: "Smart Pet Fountain Pro — White", stock: 820, dailySales: 38, ratioDays: 22, stockoutDate: "2026-05-31", restockQty: 1500, restockDate: "2026-05-10", status: "warning", trend: [25, 28, 30, 32, 35, 38, 40, 42, 45, 40, 38, 36, 38, 40], avgCost: 12.5, shipDays: 30 },
  { id: "inv-3", sku: "PF-002-BK", name: "Mini Pet Fountain — Black", stock: 3200, dailySales: 25, ratioDays: 128, stockoutDate: "2026-10-14", restockQty: 0, restockDate: "-", status: "overstock", trend: [35, 30, 28, 25, 22, 20, 22, 25, 28, 25, 22, 20, 22, 25], avgCost: 8.2, shipDays: 30 },
  { id: "inv-4", sku: "FT-001", name: "UV Replacement Filter (3-Pack)", stock: 450, dailySales: 62, ratioDays: 7, stockoutDate: "2026-05-16", restockQty: 3000, restockDate: "2026-05-09", status: "warning", trend: [40, 42, 45, 48, 50, 52, 55, 58, 60, 58, 62, 65, 68, 70], avgCost: 3.2, shipDays: 25 },
  { id: "inv-5", sku: "WP-001", name: "Water Pump Replacement Kit", stock: 180, dailySales: 8, ratioDays: 23, stockoutDate: "2026-06-01", restockQty: 500, restockDate: "2026-05-20", status: "normal", trend: [10, 12, 10, 8, 12, 10, 8, 10, 12, 10, 8, 10, 12, 10], avgCost: 5.8, shipDays: 30 },
  { id: "inv-6", sku: "SB-001", name: "Smart Water Bowl — Standard", stock: 2100, dailySales: 5, ratioDays: 420, stockoutDate: "2027-07-04", restockQty: 0, restockDate: "-", status: "stale", trend: [15, 12, 10, 8, 6, 5, 5, 4, 5, 4, 3, 4, 5, 5], avgCost: 9.0, shipDays: 30 },
  { id: "inv-7", sku: "PF-003-BK", name: "Outdoor Pet Fountain — Black", stock: 680, dailySales: 22, ratioDays: 31, stockoutDate: "2026-06-09", restockQty: 1200, restockDate: "2026-05-18", status: "normal", trend: [18, 20, 22, 25, 28, 30, 32, 28, 25, 22, 20, 22, 25, 28], avgCost: 14.5, shipDays: 35 },
  { id: "inv-8", sku: "FT-002", name: "Carbon Filter (6-Pack)", stock: 5600, dailySales: 18, ratioDays: 311, stockoutDate: "2027-03-16", restockQty: 0, restockDate: "-", status: "overstock", trend: [20, 18, 16, 18, 15, 18, 16, 18, 20, 18, 16, 18, 20, 18], avgCost: 2.1, shipDays: 25 },
  { id: "inv-9", sku: "PF-001-GR", name: "Smart Pet Fountain Pro — Green", stock: 350, dailySales: 32, ratioDays: 11, stockoutDate: "2026-05-20", restockQty: 1800, restockDate: "2026-05-09", status: "warning", trend: [20, 22, 25, 28, 30, 32, 35, 38, 40, 42, 45, 48, 50, 52], avgCost: 12.5, shipDays: 30 },
  { id: "inv-10", sku: "CS-001", name: "Cleaning Sponge Set", stock: 2400, dailySales: 12, ratioDays: 200, stockoutDate: "2026-11-26", restockQty: 0, restockDate: "-", status: "stale", trend: [18, 15, 12, 10, 12, 10, 8, 10, 12, 10, 8, 10, 12, 12], avgCost: 1.5, shipDays: 20 },
  { id: "inv-11", sku: "PF-004-BK", name: "Catit-Style Fountain — Black", stock: 950, dailySales: 40, ratioDays: 24, stockoutDate: "2026-06-02", restockQty: 1500, restockDate: "2026-05-12", status: "normal", trend: [28, 30, 32, 35, 38, 40, 42, 45, 42, 40, 38, 40, 42, 45], avgCost: 11.0, shipDays: 28 },
  { id: "inv-12", sku: "AD-001", name: "Power Adapter USB-C", stock: 850, dailySales: 15, ratioDays: 57, stockoutDate: "2026-07-05", restockQty: 500, restockDate: "2026-06-10", status: "caution", trend: [12, 14, 15, 18, 20, 18, 15, 14, 15, 18, 20, 18, 15, 15], avgCost: 4.5, shipDays: 25 },
];

const competitorKeywords: KeywordItem[] = [
  { keyword: "pet water fountain", volume: 85000, competition: 92, cpc: 1.85, trend: [70, 72, 75, 78, 80, 82, 85], type: "core" },
  { keyword: "cat water fountain", volume: 62000, competition: 88, cpc: 1.62, trend: [55, 58, 60, 62, 65, 68, 70], type: "core" },
  { keyword: "automatic pet water dispenser", volume: 34000, competition: 75, cpc: 1.45, trend: [28, 30, 32, 34, 36, 38, 40], type: "core" },
  { keyword: "pet fountain stainless steel", volume: 28000, competition: 82, cpc: 1.70, trend: [22, 24, 26, 28, 30, 32, 35], type: "core" },
  { keyword: "uv pet water fountain", volume: 12000, competition: 45, cpc: 1.20, trend: [8, 9, 10, 11, 12, 13, 15], type: "longtail" },
  { keyword: "quiet cat water fountain 30db", volume: 8500, competition: 38, cpc: 1.10, trend: [5, 6, 7, 8, 9, 10, 12], type: "longtail" },
  { keyword: "smart water fountain temperature display", volume: 5200, competition: 32, cpc: 0.95, trend: [3, 4, 4, 5, 5, 6, 7], type: "longtail" },
  { keyword: "large dog water fountain 3l", volume: 9800, competition: 42, cpc: 1.30, trend: [7, 8, 9, 10, 11, 12, 14], type: "longtail" },
  { keyword: "whisper quiet pet water bowl", volume: 7200, competition: 35, cpc: 1.05, trend: [5, 6, 7, 7, 8, 9, 10], type: "longtail" },
  { keyword: "catit flower fountain", volume: 45000, competition: 85, cpc: 1.55, trend: [40, 42, 44, 45, 46, 48, 50], type: "competitor" },
  { keyword: "petlibro water fountain", volume: 38000, competition: 80, cpc: 1.48, trend: [30, 32, 34, 36, 38, 40, 42], type: "competitor" },
  { keyword: "veken pet fountain filter", volume: 22000, competition: 65, cpc: 1.25, trend: [18, 20, 22, 24, 26, 28, 30], type: "competitor" },
  { keyword: "pioneer swan fountain", volume: 15000, competition: 58, cpc: 1.15, trend: [12, 13, 14, 15, 16, 17, 18], type: "competitor" },
];

const competitors: CompetitorEntry[] = [
  { id: "comp-1", name: "Petlibro", spCount: 45, sbCount: 30, sdCount: 25, keywords: 28, rank: 1, strategy: "defensive" },
  { id: "comp-2", name: "Catit", spCount: 55, sbCount: 25, sdCount: 20, keywords: 32, rank: 2, strategy: "defensive" },
  { id: "comp-3", name: "Veken", spCount: 60, sbCount: 20, sdCount: 20, keywords: 22, rank: 3, strategy: "complementary" },
  { id: "comp-4", name: "Pioneer", spCount: 70, sbCount: 15, sdCount: 15, keywords: 18, rank: 4, strategy: "complementary" },
  { id: "comp-5", name: "Tomxcute", spCount: 50, sbCount: 35, sdCount: 15, keywords: 25, rank: 5, strategy: "offensive" },
  { id: "comp-6", name: "Wonder Creature", spCount: 65, sbCount: 20, sdCount: 15, keywords: 15, rank: 6, strategy: "complementary" },
  { id: "comp-7", name: "Homty", spCount: 40, sbCount: 35, sdCount: 25, keywords: 20, rank: 7, strategy: "offensive" },
  { id: "comp-8", name: "iPettie", spCount: 55, sbCount: 25, sdCount: 20, keywords: 12, rank: 8, strategy: "complementary" },
  { id: "comp-9", name: "Bergan", spCount: 75, sbCount: 15, sdCount: 10, keywords: 10, rank: 9, strategy: "complementary" },
  { id: "comp-10", name: "Drinkwell", spCount: 60, sbCount: 25, sdCount: 15, keywords: 20, rank: 10, strategy: "defensive" },
];

const adPositions = [
  { position: "Top of Search", share: 42, trend: [35, 37, 38, 40, 41, 42] },
  { position: "Rest of Search", share: 28, trend: [30, 31, 30, 29, 28, 28] },
  { position: "Product Pages", share: 18, trend: [20, 19, 19, 18, 18, 18] },
  { position: "Sponsored Brands", share: 8, trend: [10, 9, 9, 9, 8, 8] },
  { position: "Sponsored Display", share: 4, trend: [5, 5, 4, 4, 4, 4] },
];

export function getDataSources(): DataSource[] {
  return [...dataSources];
}

export function getProductKeywords(marketplace?: string): ProductKeyword[] {
  return [...productKeywords];
}

export function getPainPoints(): PainPoint[] {
  return [...painPoints];
}

export function getImages(type?: string): GeneratedImg[] {
  if (type) return store.images.filter((img) => img.type === type);
  return [...store.images];
}

export function updateImage(id: string, data: Partial<GeneratedImg>): GeneratedImg | null {
  const idx = store.images.findIndex((img) => img.id === id);
  if (idx === -1) return null;
  store.images[idx] = { ...store.images[idx], ...data };
  return store.images[idx];
}

export function getStoryboardFrames(): StoryboardFrame[] {
  return [...storyboardFrames];
}

export function getAdKeywords(filters?: { type?: string; tag?: string }): AdKeyword[] {
  let result = [...adKeywords];
  if (filters?.type) result = result.filter((k) => k.type === filters.type);
  if (filters?.tag) result = result.filter((k) => k.tag === filters.tag);
  return result;
}

export function updateAdKeyword(id: string, data: Partial<AdKeyword>): AdKeyword | null {
  const idx = adKeywords.findIndex((k) => k.id === id);
  if (idx === -1) return null;
  adKeywords[idx] = { ...adKeywords[idx], ...data };
  return adKeywords[idx];
}

export function getInfringementWords(): InfringementWord[] {
  return [...infringementWords];
}

export function getCategoryRecs(): CategoryRec[] {
  return [...categoryRecs];
}

export function getBulletPoints(): BulletPoint[] {
  return [...bulletPoints];
}

export function getInventoryItems(filters?: {
  status?: string;
  page?: number;
  pageSize?: number;
}): { items: InventoryItem[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } } {
  let result = [...inventoryItems];
  if (filters?.status) result = result.filter((item) => item.status === filters.status);
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const total = result.length;
  const start = (page - 1) * pageSize;
  const items = result.slice(start, start + pageSize);
  return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export function getRestockSuggestions(): { id: string; sku: string; name: string; suggestedQty: number; urgency: "high" | "medium" | "low"; method: string; eta: string; cost: number }[] {
  return inventoryItems
    .filter((item) => item.restockQty > 0)
    .map((item) => ({
      id: `rs-${item.sku}`,
      sku: item.sku,
      name: item.name,
      suggestedQty: item.restockQty,
      urgency: item.ratioDays < 15 ? "high" as const : item.ratioDays < 30 ? "medium" as const : "low" as const,
      method: item.shipDays <= 25 ? "express" : "sea",
      eta: item.restockDate,
      cost: Math.round(item.restockQty * item.avgCost * 0.6),
    }));
}

export function getCompetitorKeywords(type?: string): KeywordItem[] {
  if (type) return competitorKeywords.filter((k) => k.type === type);
  return [...competitorKeywords];
}

export function getCompetitors(): CompetitorEntry[] {
  return [...competitors];
}

export function getAdPositions(): AdPosition[] {
  return [...adPositions];
}

export function getWorkflowStatuses(): WorkflowStatus[] {
  return [
    { id: "product-research", name: "选品工作流", href: "/workflows/product-research", status: "idle", lastRun: "2026-05-08T14:30:00Z", runs: 45, success: 92 },
    { id: "ai-imaging", name: "AI 作图", href: "/workflows/ai-imaging", status: "idle", lastRun: "2026-05-08T16:00:00Z", runs: 120, success: 88 },
    { id: "ai-advertising", name: "AI 广告", href: "/workflows/ai-advertising", status: "running", lastRun: "2026-05-09T02:00:00Z", runs: 230, success: 95 },
    { id: "ai-listing", name: "AI 上架", href: "/workflows/ai-listing", status: "idle", lastRun: "2026-05-07T10:00:00Z", runs: 78, success: 96 },
    { id: "inventory", name: "库销比", href: "/workflows/inventory", status: "warning", lastRun: "2026-05-09T01:00:00Z", runs: 56, success: 90 },
    { id: "competitor-ads", name: "竞品广告分析", href: "/workflows/competitor-ads", status: "idle", lastRun: "2026-05-08T20:00:00Z", runs: 34, success: 87 },
  ];
}

/**
 * 实测：B端提示词工程五层架构真实链路（bun scripts/live-b2b.ts）
 *
 * 直接调 B2BService（不走 HTTP），复用工作区 .env 已配置的 AI_LLM 网关 / Milvus / TikHub。
 * 依次验证：
 *   1. 商品池写入（seed 有代表性的 3 个化妆品品，触发 Milvus product zone 索引）
 *   2. 长尾关键词 LLM 生成（LONGTAIL_SYSTEM）→ 断言 JSON/schema 校验通过
 *   3. 商品推荐 RAG（趋势词检索 top-N + 归因理由）→ 断言理由含数据引用
 *   4. Listing 生成（五层提示词 + L3 校验 + 修复闭环）→ 断言规则命中
 *   5. 生图 Skill 内置种子读取（幂等懒加载）
 */
import { B2BService } from "@/lib/server/services";
import { getProducts, clearProducts, insertProduct } from "@/lib/server/repositories/b2b.repository";

const svc = new B2BService();
let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${detail ?? ""}`); }
}

console.log("=== 1. 商品池 seed（触发 Milvus product zone 索引）===");
const SEED = [
  { productId: "SB-101", subject: "14 Pcs Makeup Brush Set Soft Synthetic", keywords: ["makeup brush", "beauty tool", "vanity set"], imageUrl: "", price: "$3.2", status: "RTS" },
  { productId: "SB-102", subject: "4 Tier Vanity Case Cosmetic Storage Box", keywords: ["vanity case", "cosmetic storage", "makeup organizer"], imageUrl: "", price: "$4.1", status: "RTS" },
  { productId: "SB-103", subject: "48 Colors Eyeshadow Palette Makeup", keywords: ["eyeshadow palette", "glitter makeup", "cosmetic palette"], imageUrl: "", price: "$2.8", status: "RTS" },
];
await clearProducts();
for (const p of SEED) await insertProduct(p);
const seeded = await getProducts();
check("商品池写入", seeded.length === 3, `got ${seeded.length}`);

console.log("=== 2. 长尾关键词 LLM 生成（LONGTAIL_SYSTEM）===");
try {
  const longtail = await svc.generateLongtail({ industry: "美妆工具", seedKeywords: ["makeup brush", "vanity case"], limit: 6 });
  check("长尾词生成", longtail.length > 0, `got ${longtail.length}`);
  console.log("  样例:", longtail.slice(0, 3).map((k) => `${k.word} [${k.category}]`).join(" | "));
} catch (err) {
  check("长尾词生成", false, (err as Error).message);
}

console.log("=== 3. 商品推荐 RAG（趋势词检索 + 归因理由）===");
try {
  const recs = await svc.recommend({
    preference: "mix",
    trendKeywords: SEED.map((s) => ({ word: (s.keywords?.[0] ?? ""), heat: 8_200_000, delta: 64, rank: 3, industry: "beauty", source: "tikhub" })).slice(0, 3) as never,
    longtailKeywords: (await getProducts().then(() => [
      { word: "soft makeup brush for beginners", category: "场景", searchIntent: "commercial" },
      { word: "glitter eyeshadow palette", category: "功效", searchIntent: "transactional" },
    ])) as never,
  });
  check("推荐返回", recs.length > 0 && recs.length <= 5, `got ${recs.length}`);
  if (recs[0]) check("推荐理由含数据引用", recs[0].reasons?.some?.((r: string) => /热度|涨幅|TOP|%|\+|播放/i.test(r)), recs[0].reasons?.join(" / "));
  console.log("  TOP1:", recs[0]?.subject, "score", recs[0]?.score);
  recs[0]?.reasons?.forEach((r) => console.log("    -", r));
} catch (err) {
  check("商品推荐", false, (err as Error).message);
}

console.log("=== 4. Listing 生成（五层提示词 + L3 校验修复闭环）===");
try {
  const listing = await svc.generateListing({ productId: "SB-101", preference: "alibaba" });
  check("Listing 标题生成", Boolean(listing.title), listing.title);
  check("标题字符数【校验器应命中 50-100】", assertLen(listing.title, 50, 100), `len=${listing.title?.length}`);
  check("关键词恰好 3 个", listing.keywords?.length === 3, `got ${listing.keywords?.length}`);
  check("描述 ≥300 字符【校验器 warning】", (listing.description?.length ?? 0) >= 300, `len=${listing.description?.length}`);
  console.log("  标题:", listing.title);
  console.log("  关键词:", listing.keywords?.join(" / "));
  if (listing.warnings?.length) { console.log("  ⚠ 修复后仍残留提醒:"); listing.warnings.forEach((w) => console.log("    -", w)); }
} catch (err) {
  check("Listing 生成", false, (err as Error).message);
}

console.log("=== 5. 生图 Skill 内置种子（幂等懒加载）===");
try {
  const skills = await svc.getImageSkills();
  check("Skill 库含官方模板", skills?.some((s) => s.id === "builtin-pink-luxury-beauty-main"), `total ${skills?.length}`);
} catch (err) {
  check("Skill 种子", false, (err as Error).message);
}

function assertLen(s: string | undefined | null, min: number, max: number): boolean {
  const l = (s ?? "").length;
  return l >= min && l <= max;
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
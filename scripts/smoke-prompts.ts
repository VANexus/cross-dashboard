/** 冒烟测试：五层提示词组装 + L3 校验器（bun scripts/smoke-prompts.ts） */
import { buildListingPrompt, buildRecommendPrompt, buildTrendDigestPrompt } from "../lib/server/ai/prompts-b2b";
import { validateListing, listingRepairPrompt } from "../lib/server/ai/prompts-b2b/validator";
import { BUILTIN_IMAGE_SKILL_SEEDS } from "../lib/server/ai/prompts-b2b/image-seeds";
import {
  listingDraftSchema, recommendSchema, trendDigestSchema, longtailSchema,
} from "../lib/server/ai/prompts-b2b/contracts";

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}

console.log("== 组装器 ==");

// 1. Listing：三偏好分别组装
for (const pref of ["social", "alibaba", "mix"] as const) {
  const { system, prompt } = buildListingPrompt({
    productId: "BP-1001", subject: "14 PCS Makeup Brush Set", keyword: "makeup brush set",
    productKeywords: ["makeup brush", "beauty tool"], preference: pref,
  });
  check(`${pref}: system 含身份+知识+契约`, system.includes("FlowMind B端运营专家") && system.includes("阿里国际站上架规则") && system.includes("输出契约"));
  check(`${pref}: prompt 含商品与偏好指令`, prompt.includes("BP-1001") && prompt.includes("偏好"));
}
const alibabaListing = buildListingPrompt({ productId: "x", subject: "s", preference: "alibaba" });
check("alibaba 偏好指向国际站搜索场", alibabaListing.prompt.includes("阿里国际站"));

// 2. 推荐与归因
const rec = buildRecommendPrompt({
  preference: "mix",
  products: [{ productId: "P1", subject: "Vanity Case", keywords: ["makeup"], imageUrl: "", price: "$3.2", status: "on" }],
  trendKeywords: [{ word: "makeup brush", heat: 8_200_000, delta: 64, rank: 3, industry: "", source: "tikhub" }],
  longtailKeywords: [{ word: "soft makeup brush for beginners", category: "场景", searchIntent: "commercial" }],
});
check("推荐 prompt 注入趋势数据", rec.prompt.includes("makeup brush") && rec.prompt.includes("+64%") && rec.prompt.includes("P1"));

const digest = buildTrendDigestPrompt({ platform: "TikTok", keywords: [{ word: "aesthetic", heat: 1, delta: 12, rank: 1, industry: "", source: "t" }], longtailKeywords: [] });
check("归因 prompt 含榜单与契约", digest.prompt.includes("aesthetic") && digest.system.includes("归因框架"));

console.log("== L3 校验器 ==");

// 3. 合规草稿：应零 error
const good = validateListing({
  title: "2026 New 14 Pcs Makeup Brush Set Soft Synthetic Hair for Daily Makeup with OEM Support",
  description: "x".repeat(350),
  keywords: ["premium makeup brush set", "soft synthetic hair brush", "custom logo beauty tools"],
  image_prompt: "white background product photo",
}, "makeup brush set");
check("合规草稿零 error", good.every((i) => i.severity !== "error"));

// 4. 违规草稿：应抓出全部典型 error
const bad = validateListing({
  title: "BEST SELLER!!! No.1 ★ 14 Pcs Pcs Pcs Pcs Makeup Brush Makeup Brush Makeup Brush Makeup Brush contact@x.com",
  description: "short",
  keywords: ["makeup brush, set", "makeup brush, set", "a"],
  image_prompt: "",
}, "makeup brush");
const badErrors = bad.filter((i) => i.severity === "error").map((i) => i.rule);
check("抓极限词", badErrors.includes("禁用极限词"));
check("抓装饰符号", badErrors.includes("禁用装饰符号"));
check("抓堆砌", badErrors.includes("禁关键词堆砌"));
check("抓联系方式", badErrors.includes("标题禁含联系方式"));
check("抓关键词逗号", badErrors.includes("关键词禁含逗号/分号"));
check("抓关键词重复", badErrors.includes("三词差异化"));
check("抓描述过短(warning)", bad.some((i) => i.severity === "warning" && i.rule.includes("300")));
check("抓 image_prompt 缺失", badErrors.includes("image_prompt 必填"));

// 5. with/for 核心词位置（warning）
const wf = validateListing({
  title: "OEM Beauty Tools with Premium Makeup Brush Set for Daily Use and Travel Scenarios",
  description: "x".repeat(350), keywords: ["a brush", "b brush", "c brush"], image_prompt: "p",
}, "makeup brush set");
check("抓核心词位置", wf.some((i) => i.severity === "warning" && i.rule.includes("with/for")));

// 6. 修复提示词
const repair = listingRepairPrompt({ title: "t", description: "d", keywords: ["a", "b", "c"], image_prompt: "p" }, bad);
check("修复 prompt 含问题清单与契约", repair.includes("待修复问题") && repair.includes("输出契约"));

console.log("== 生图种子 ==");
check("种子非空且 id 固定", BUILTIN_IMAGE_SKILL_SEEDS.length > 0 && BUILTIN_IMAGE_SKILL_SEEDS[0].id === "builtin-pink-luxury-beauty-main");
check("种子提示词含占位符与负面清单", BUILTIN_IMAGE_SKILL_SEEDS[0].reversedPrompt.includes("[BRAND NAME]") && BUILTIN_IMAGE_SKILL_SEEDS[0].reversedPrompt.includes("Avoid:"));

console.log("== L4 zod schema ==");
const listingOk = listingDraftSchema.safeParse({
  title: "2026 New 14 Pcs Makeup Brush Set Soft Synthetic Hair for Daily Makeup",
  description: "x".repeat(350),
  keywords: ["premium makeup brush set", "soft synthetic hair brush", "custom logo beauty tools"],
  image_prompt: "white background product photo",
});
check("listing schema 通过", listingOk.success);
const listingBad = listingDraftSchema.safeParse({ title: "", description: "", keywords: [], image_prompt: "" });
check("listing schema 拒坏 JSON", !listingBad.success);

const recOk = recommendSchema.safeParse({
  recommendations: [{ product_id: "P1", subject: "Vanity Case", score: 88, reasons: ["TOP1"] }],
});
check("recommend schema 通过", recOk.success && recOk.success === true && (recOk as { success: true; data: { recommendations: unknown[] } }).data.recommendations.length === 1);
const recMissField = recommendSchema.safeParse({ recommendations: [] });
check("recommend schema 拒空", !recMissField.success);

const trendOk = trendDigestSchema.safeParse({ headline: "防晒季升温", attribution: ["a"], actions: ["b"] });
check("trendDigest schema 通过", trendOk.success);

const ltOk = longtailSchema.safeParse({ keywords: [{ word: "soft makeup brush", category: "场景", search_intent: "commercial" }] });
check("longtail schema 通过并映射 search_intent", ltOk.success && ltOk.success === true && (ltOk as { success: true; data: { search_intent: string }[] }).data[0]?.search_intent === "commercial");

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);

/**
 * B端提示词工程 — 生图 Skill 内置种子（Built-in Image Skill Seeds）
 *
 * 来源：《欧美跨境电商美妆主图提示词.docx》（运营七七提供，2026-09）
 * —— 柔粉轻奢美妆主图风格完整拆解 + 可直接复用的完整风格提示词。
 * 该风格已验证 ROI 良好，固化为官方模板：换产品即可保持同一套视觉体系。
 *
 * 种子为懒加载幂等写入（固定 id + skipDuplicates），运营可复制为个人 Skill
 * 后修改品牌占位符（BRAND / PRODUCT / QUANTITY / SELLING POINTS）。
 */

export interface BuiltinImageSkillSeed {
  id: string;
  name: string;
  coverUrl: string;
  reversedPrompt: string;
  styleTags: string[];
  aspectRatio: string;
  platform: string;
  templateType: "主图" | "详情页" | "社媒" | "其他";
}

/** 柔粉轻奢美妆主图完整风格提示词（docx 第 25 节「可直接复用」版，占位符化） */
const PINK_LUXURY_BEAUTY_PROMPT = `Create a premium cross-border e-commerce beauty product hero banner in a soft feminine luxury beauty editorial style, suitable for Alibaba International, Amazon A+ content and professional B2B cosmetic supplier advertising.

Overall Visual Style
Elegant, feminine, professional and premium beauty aesthetic, combining luxury beauty editorial design with commercial e-commerce listing graphics. Use a clean asymmetric composition: selling points and typography on the left (about 40%), large product presentation area on the right (about 50%), decorative floral elements in the lower-left corner, subtle atmospheric highlights in the upper-right background. The product must remain the main visual focus.

Background
A sophisticated soft blush-pink gradient, transitioning from almost white creamy pink (#FFF7F9, #FCECEF) on the left and lower area into deeper dusty blush pink (#F7D1DB, #E889A7, #D75F85) toward the upper-right. Keep the background clean, airy and soft. Add several subtle translucent white bokeh light circles in the upper-right area (15-35% opacity, different sizes, very soft blurred edges, dreamy rather than neon).

Bottom Decorative Element
A flowing soft blush-pink silk ribbon or abstract fabric wave extending horizontally across the lower area, with smooth folds, gentle highlights (#FFE6EC) and elegant curved movement. It should support the product rather than compete with it.

Brand Area (upper-left)
A delicate symmetrical butterfly line-art logo with a dusty rose to muted lavender gradient (#E58EAC to #B984C4). Beside it the brand name [BRAND NAME] in elegant uppercase high-contrast fashion serif typography (Bodoni Moda / Didot / Cormorant Garamond style, wide letter-spacing 0.10-0.18em, dusty rose color #D9688C, no bold). Below it a small line "[BRAND TAGLINE]" in thin uppercase sans-serif (Montserrat Light style, generous tracking, subtle dark gray #59525A).

Business Tag (upper-right)
One line of B2B info: "BEAUTY TOOLS • OEM/ODM • MARKETING SUPPORT" in uppercase modern sans-serif (Montserrat Medium style, wide tracking, muted blue-purple #6156A0).

Main Quantity Typography
An oversized elegant high-contrast serif numeral [QUANTITY, e.g. 14] as a strong visual anchor (about 20-25% of image height), with a subtle dusty rose gradient (#F3A5B9 top to #CC557D bottom), matching serif "PCS" beside it at about 1:3 ratio (#D45B82). Must stay readable at e-commerce thumbnail size.

Product Name
"[PRODUCT NAME]" below the quantity in uppercase elegant serif typography (Cormorant Garamond / Bodoni Moda), deep plum mauve color (#793B70), refined editorial look without heavy bold, split into two balanced lines if long.

Decorative Divider
A thin dusty-pink horizontal line (1-2px feel, #E58AA8) under the product title, with a tiny symmetrical butterfly emblem exactly centered.

Feature Cards
Four vertically stacked white rounded rectangular cards (ratio about 4:1, gap 8-14px), each with: white/ivory-pink background (#FFFEFE), generous rounded corners (16-22px), very subtle diffused drop shadow (rgba(130,70,100,0.12)), a dusty rose pink circular icon container (#E67598) on the left holding a minimalist white outline icon (uniform stroke, no 3D, no color fill), and dark blue-purple (#4D3472) uppercase sans-serif selling point text (Montserrat SemiBold style). Cards: [SELLING POINT 1] with feather icon, [SELLING POINT 2] with diamond icon, [SELLING POINT 3] with price-tag icon, [SELLING POINT 4] with megaphone icon. All text must remain crisp and readable at reduced thumbnail size.

Floral Decoration
Realistic delicate pink cherry/peach blossoms in the lower-left corner, the largest partially cropped by the frame edge, with natural layered petals, realistic stamens, commercial photography detail (not illustration), blush-pink tones (#F09AB5, #F6C4D1, #E77C9E). Only 2-5 isolated floating petals extending gently toward the center.

Lighting
High-key soft studio lighting, diffused luxury beauty advertising lighting, soft reflections, gentle shadows, airy atmosphere, clean commercial photography. Avoid hard shadows and dramatic cinematic lighting.

Design Character
Premium, clean, feminine, soft, elegant, professional, luxury beauty, international, commercial editorial, B2B-friendly — a professionally designed international beauty listing banner, not a cheap marketplace poster.

Avoid: no neon pink, no fluorescent colors, no childish aesthetic, no kawaii style, no cartoon flowers, no excessive decoration, no crowded composition, no dark background, no dramatic shadows, no messy text, no random props, no baroque ornaments, no oversized sparkles, no glossy 3D text, no cheap marketplace graphic style, no overly saturated pink.`;

export const BUILTIN_IMAGE_SKILL_SEEDS: BuiltinImageSkillSeed[] = [
  {
    id: "builtin-pink-luxury-beauty-main",
    name: "柔粉轻奢美妆主图（官方模板）",
    coverUrl: "/seeds/pink-luxury-beauty-main.jpg",
    reversedPrompt: PINK_LUXURY_BEAUTY_PROMPT,
    styleTags: ["柔粉轻奢", "女性向", "美妆工具", "B2B海报", "轻奢杂志感", "高调柔光"],
    aspectRatio: "1:1",
    platform: "alibaba",
    templateType: "主图",
  },
];

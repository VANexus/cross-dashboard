/**
 * FlowMind — 0002: evolution_records 增加 source 列（auto/manual 区分）
 * 自进化闭环中「自动时节律触发」与「手动触发」需在列表层可区分；
 * Mongo evolution_runs 已有 source，此处补齐 PG 侧以支撑列表/趋势查询。
 * 幂等：ADD COLUMN IF NOT EXISTS。
 */
export const EVOLUTION_SOURCE_SQL = `
ALTER TABLE evolution_records
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- 回填：按标题标记（引擎生成：自主反思 = auto，手动触发 = manual）
UPDATE evolution_records
   SET source = 'auto'
 WHERE source = 'manual'
   AND title LIKE '%自主反思%';
`;

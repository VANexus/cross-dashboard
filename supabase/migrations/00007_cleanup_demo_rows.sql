-- 00007_cleanup_demo_rows.sql
-- 全站唯一允许的 DELETE 清理迁移：删除早期写入云库的演示/种子行（去 mock 收尾）。
-- 幂等：重复执行无副作用；只删除特征明确的演示数据，绝不触碰真实业务行。

-- 1) 关键词趋势：种子来源 + 旧演示词（skincare 系列）
DELETE FROM wf_keyword_trends WHERE source LIKE 'seed%';
DELETE FROM wf_keyword_trends WHERE word ILIKE 'skincare%';

-- 2) 内容热点：种子来源 + 旧演示词
DELETE FROM wf_content_hot_topics WHERE source LIKE 'seed%';
DELETE FROM wf_content_hot_topics WHERE word = '通勤好物';

-- 3) 长尾词：种子 ID 与旧演示词（注意：真实 ID 也以 lt- 开头，禁止按 lt- 前缀整删）
DELETE FROM wf_longtail_keywords WHERE id LIKE 'lt-seed-%' OR id LIKE 'lt-demo-%';
DELETE FROM wf_longtail_keywords WHERE word ILIKE 'skincare%' OR word = '通勤好物';

-- 4) B 端商品池 / Listing 草稿：演示 ID 前缀
DELETE FROM wf_b2b_products WHERE id LIKE 'bp-demo-%';
DELETE FROM wf_b2b_listings WHERE id LIKE 'lst-demo-%';

-- 5) 生图 Skill：旧种子模板（按名称与演示 ID）
DELETE FROM wf_image_skills WHERE id LIKE 'is-demo-%';
DELETE FROM wf_image_skills WHERE name = '白底商摄';

-- 6) 视频本地化任务：演示任务 ID / 演示批次
DELETE FROM wf_localize_tasks WHERE id LIKE 'lt-demo-%';
DELETE FROM wf_localize_tasks WHERE batch_id LIKE 'batch-demo-%';

-- ============================================================
-- 00003_b2b_newcols.sql
-- Adds:
--   * is_builtin + template_type to wf_image_skills (运营官方模板标记)
--   * Generic updated_at trigger function + auto-setup for every table with updated_at column
-- ============================================================

-- (1) B端 生图Skill 表新列
ALTER TABLE wf_image_skills
    ADD COLUMN IF NOT EXISTS is_builtin BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS template_type TEXT DEFAULT '';

-- (2) 通用 updated_at 自动更新触发器函数
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := to_char(now(), 'YYYY-MM-DD HH24:MI:SS');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- (3) 在所有含 updated_at 列的表上挂载触发器（若已存在则跳过）
DO $$
DECLARE
    t record;
    trg_name text;
BEGIN
    FOR t IN
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'updated_at'
    LOOP
        trg_name := 'trg_' || t.table_name || '_updated_at';
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = trg_name AND tgrelid = t.table_name::regclass
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
                trg_name, t.table_name
            );
        END IF;
    END LOOP;
END $$;

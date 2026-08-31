-- ============================================================
-- 00004_b2b_newcols_retry.sql
-- Retry: wf_image_skills 新列 + updated_at 触发器
-- (Because 00003 hit duplicate version collision)
-- ============================================================

ALTER TABLE wf_image_skills
    ADD COLUMN IF NOT EXISTS is_builtin BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS template_type TEXT DEFAULT '';

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := to_char(now(), 'YYYY-MM-DD HH24:MI:SS');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

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

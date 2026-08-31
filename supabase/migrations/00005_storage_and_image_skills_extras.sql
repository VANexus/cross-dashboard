-- ============================================================
-- 00005_storage_and_image_skills_extras.sql
-- Adds:
--   * Storage bucket "image-skills" for user/official uploads
--   * wf_image_skills 官方模板角标增强 (template_type CHECK 约束)
--   * RLS policies (通过 Dashboard UI 后续配置也行, 先尽量建)
-- ============================================================

-- (1) Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
    'image-skills',
    'image-skills',
    true,
    true,
    20971520,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- (2) wf_image_skills template_type CHECK 约束
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_wf_image_skills_template_type'
    ) THEN
        ALTER TABLE wf_image_skills
            ADD CONSTRAINT chk_wf_image_skills_template_type
            CHECK (template_type IN ('', '主图', '详情页', '社媒', '其他'));
    END IF;
END $$;

-- (3) wf_image_skills 官方模板 is_builtin 不可直接被 DELETE
CREATE OR REPLACE FUNCTION protect_builtin_image_skills()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_builtin = true THEN
        RAISE EXCEPTION '官方模板不允许直接删除，请先复制后编辑';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql VOLATILE;

DROP TRIGGER IF EXISTS trg_wf_image_skills_protect_builtin ON wf_image_skills;
CREATE TRIGGER trg_wf_image_skills_protect_builtin
    BEFORE DELETE ON wf_image_skills
    FOR EACH ROW EXECUTE FUNCTION protect_builtin_image_skills();

-- ============================================================
-- 00002_rls_policies.sql
-- Enable Row Level Security on ALL business tables + open policies for anon role.
-- Tighten in production if user/tenant isolation is required.
-- ============================================================

DO $$
DECLARE
    t record;
    sql text;
BEGIN
    FOR t IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT IN ('pgmigrations', 'pg_stat_statements', 'pg_buffercache')
          AND tablename NOT LIKE 'pg_%'
          AND tablename NOT LIKE 'sql_%'
    LOOP
        -- Enable RLS
        sql := format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY;', t.tablename);
        EXECUTE sql;

        -- Create an "allow all" policy IF NOT EXISTS (Postgres 14+ has IF NOT EXISTS for policies in pg15+)
        BEGIN
            sql := format(
                'CREATE POLICY anon_all ON %I FOR ALL USING (true) WITH CHECK (true);',
                t.tablename
            );
            EXECUTE sql;
        EXCEPTION WHEN duplicate_object THEN
            -- policy already exists — skip
        END;
    END LOOP;
END $$;

-- Also make sure anon role has basic table privileges (supabase does this by default, but be explicit)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon;

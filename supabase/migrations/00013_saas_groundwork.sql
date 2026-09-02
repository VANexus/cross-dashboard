-- 00013_saas_groundwork.sql
-- 多租户地基（终局对外 SaaS，当前先自用）：
-- 给 AI 动态产物两张 spec 表补「归属列」，为后续 workspace/user 隔离做准备。
-- 现阶段全库统一 anon 开放（见 00002_rls_policies.sql 与 00012），应用用 anon key、
-- 无登录系统，因此这里【不】改成 authenticated-only——只锁两张表会与全库策略不一致并直接打断自用。
-- 存量行归入默认工作空间 default-workspace / 创建人 self；新列可空回填后给默认值。

-- ── 归属列：幂律添加，存量行回填默认归属 ─────────────────────────────
alter table wf_workflow_specs
  add column if not exists workspace_id text not null default 'default-workspace',
  add column if not exists created_by   text not null default 'self';

alter table wf_page_specs
  add column if not exists workspace_id text not null default 'default-workspace',
  add column if not exists created_by   text not null default 'self';

-- 按工作空间列产物（SaaS 列表页 / 隔离查询用）
create index if not exists idx_wf_workflow_specs_ws
  on wf_workflow_specs(workspace_id, updated_at desc);
create index if not exists idx_wf_page_specs_ws
  on wf_page_specs(workspace_id, updated_at desc);

-- updated_at 自动维护（与 00012 对齐：若已有同名触发器则跳过）
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_wf_workflow_specs_touch on wf_workflow_specs;
create trigger trg_wf_workflow_specs_touch before update on wf_workflow_specs
  for each row execute function set_updated_at();

drop trigger if exists trg_wf_page_specs_touch on wf_page_specs;
create trigger trg_wf_page_specs_touch before update on wf_page_specs
  for each row execute function set_updated_at();

-- ── 生产锁定脚本（上线多租户时执行，当前自用阶段【不要启用】）──────────
-- 前置：接入 Supabase Auth，写入时由服务端用 auth.jwt() 回填 workspace_id/created_by。
--
-- drop policy if exists anon_all on wf_workflow_specs;
-- create policy tenant_isolation on wf_workflow_specs
--   for all
--   using (workspace_id = coalesce(auth.jwt() ->> 'workspace_id', 'default-workspace'))
--   with check (workspace_id = coalesce(auth.jwt() ->> 'workspace_id', 'default-workspace'));
--
-- drop policy if exists anon_all on wf_page_specs;
-- create policy tenant_isolation on wf_page_specs
--   for all
--   using (workspace_id = coalesce(auth.jwt() ->> 'workspace_id', 'default-workspace'))
--   with check (workspace_id = coalesce(auth.jwt() ->> 'workspace_id', 'default-workspace'));
--
-- -- 随后回收 anon 直写：revoke insert,update,delete on wf_workflow_specs, wf_page_specs from anon;

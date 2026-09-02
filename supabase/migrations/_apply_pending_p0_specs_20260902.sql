-- ============================================================
-- P0 一键应用：AI 动态产物 spec 两表 + 多租户归属地基
-- （2026-09-02 生成；= 00012_agent_specs + 00013_saas_groundwork，全部幂等，可安全重复执行）
--
-- 用法：Supabase Dashboard → SQL Editor → New query，整段粘贴执行。
-- 作用：M4「保存为团队 SOP」依赖 wf_workflow_specs；M5 动态页面依赖 wf_page_specs；
--       00013 给两表补 workspace_id/created_by（终局 SaaS 多租户预留，当前自用保持 anon 开放）。
-- 现状：远端缺这两张表时，应用会「降级为空、不崩」；执行本脚本后 SOP 落库/重跑与动态页才真正可用。
-- 注意：当前为自用阶段，【不要】启用文件末尾注释里的 tenant_isolation / revoke anon（那是未来上 Auth 后的锁定脚本）。
-- ============================================================

-- ---------- 00012：spec 两表 ----------
create table if not exists wf_workflow_specs (
  id text primary key,                -- slug，如 daily-trend-push
  title text not null,
  goal text not null,                 -- 生成该 spec 的自然语言目标
  spec jsonb not null,                -- WorkflowSpec：{ steps: [{ id, tool, args?, dependsOn }] }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_wf_workflow_specs_updated
  on wf_workflow_specs(updated_at desc);

create table if not exists wf_page_specs (
  id text primary key,                -- slug，即 /p/[slug] 路由名
  title text not null,
  spec jsonb not null,                -- PageSpec：{ components: [{ id, component, props }] }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_wf_page_specs_updated
  on wf_page_specs(updated_at desc);

alter table wf_workflow_specs enable row level security;
alter table wf_page_specs enable row level security;

drop policy if exists anon_all on wf_workflow_specs;
create policy anon_all on wf_workflow_specs
  for all using (true) with check (true);
drop policy if exists anon_all on wf_page_specs;
create policy anon_all on wf_page_specs
  for all using (true) with check (true);

-- ---------- 00013：多租户归属列（终局 SaaS 预留，当前自用） ----------
alter table wf_workflow_specs
  add column if not exists workspace_id text not null default 'default-workspace',
  add column if not exists created_by   text not null default 'self';
alter table wf_page_specs
  add column if not exists workspace_id text not null default 'default-workspace',
  add column if not exists created_by   text not null default 'self';

create index if not exists idx_wf_workflow_specs_ws
  on wf_workflow_specs(workspace_id, updated_at desc);
create index if not exists idx_wf_page_specs_ws
  on wf_page_specs(workspace_id, updated_at desc);

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

-- ---------- 验证（执行后应各返回 0 行、不报错） ----------
-- select count(*) from wf_workflow_specs;
-- select count(*) from wf_page_specs;

-- ============================================================
-- 未来对外 SaaS、接入 Supabase Auth 后才启用（当前自用【不要执行】）：
-- drop policy if exists anon_all on wf_workflow_specs;
-- create policy tenant_isolation on wf_workflow_specs for all
--   using (workspace_id = coalesce(auth.jwt() ->> 'workspace_id', 'default-workspace'))
--   with check (workspace_id = coalesce(auth.jwt() ->> 'workspace_id', 'default-workspace'));
-- drop policy if exists anon_all on wf_page_specs;
-- create policy tenant_isolation on wf_page_specs for all
--   using (workspace_id = coalesce(auth.jwt() ->> 'workspace_id', 'default-workspace'))
--   with check (workspace_id = coalesce(auth.jwt() ->> 'workspace_id', 'default-workspace'));
-- revoke insert,update,delete on wf_workflow_specs, wf_page_specs from anon;
-- ============================================================

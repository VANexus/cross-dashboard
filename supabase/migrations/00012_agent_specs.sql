-- 00012_agent_specs.sql
-- AI 动态生成产物的 spec 存储（M4 动态工作流 / M5 动态页面）：
-- spec 全部 JSONB + zod 校验，可复用、可再次运行/渲染。

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

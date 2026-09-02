-- 00009_orchestrator_sessions.sql
-- AI 编排会话持久化：对话消息（含工具调用/结果 blocks）存 Supabase，
-- 刷新/换页不丢，可回溯。产物转化（任务/Listing/图片）仍走各自业务表。

create table if not exists orchestrator_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null default '新会话',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orchestrator_sessions_updated
  on orchestrator_sessions(updated_at desc);

alter table orchestrator_sessions enable row level security;

drop policy if exists anon_all on orchestrator_sessions;
create policy anon_all on orchestrator_sessions
  for all using (true) with check (true);

-- ============================================================
-- 一键应用待执行迁移（2026-09-02 审计生成）
-- 在 Supabase Dashboard → SQL Editor → New query 粘贴整段执行。
-- 全部幂等（IF NOT EXISTS / 精确删除），可安全重复执行。
--
-- 包含：00008 channel_accounts · 00009 orchestrator_sessions
--       00010 wf_trend_snapshots · 00011 wechat e2e · 00007 清理演示行
-- 已跳过：00003（内容已被 00004 retry 覆盖，00004 已应用）
-- 单独说明：00006 daily_refresh（pg_cron/pg_net 回调，需公网部署后再启用）
-- ============================================================

-- ---------- 00008 channel_accounts ----------
create table if not exists channel_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('tiktok', 'instagram', 'alibaba')),
  label text not null default '',
  session_enc text not null,
  status text not null default 'active' check (status in ('active', 'expired', 'risk_control')),
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_channel_accounts_platform
  on channel_accounts(platform, status, created_at desc);

-- ---------- 00009 orchestrator_sessions ----------
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

-- ---------- 00010 wf_trend_snapshots ----------
create table if not exists wf_trend_snapshots (
  id            text primary key,
  platform      text not null,
  word          text not null,
  heat          bigint not null default 0,
  delta         bigint,
  rank          int not null default 0,
  industry      text not null default '通用',
  source        text not null default '',
  snapshot_date date not null default current_date,
  created_at    timestamptz not null default now()
);
create unique index if not exists uq_trend_snapshot_word
  on wf_trend_snapshots(platform, snapshot_date, word);
create index if not exists idx_trend_snapshot_date
  on wf_trend_snapshots(platform, snapshot_date desc, rank);
alter table wf_trend_snapshots enable row level security;
drop policy if exists anon_all on wf_trend_snapshots;
create policy anon_all on wf_trend_snapshots
  for all using (true) with check (true);
create or replace function trim_trend_snapshots(keep_days int default 100)
returns void
language sql
as $$
  delete from wf_trend_snapshots
  where snapshot_date < current_date - keep_days;
$$;

-- ---------- 00011 wechat e2e ----------
create table if not exists wf_wechat_accounts (
  id uuid primary key default gen_random_uuid(),
  label text not null default '',
  app_id_enc text not null,
  app_secret_enc text not null,
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('active', 'invalid')),
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_wf_wechat_accounts_status
  on wf_wechat_accounts(status, created_at desc);

create table if not exists wf_wechat_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references wf_wechat_accounts(id) on delete set null,
  title text not null default '',
  summary text not null default '',
  author text not null default '',
  body_html text not null default '',
  thumb_url text not null default '',
  channel text not null default 'publish' check (channel in ('publish', 'mass')),
  theme text not null default 'default',
  publish_time bigint,
  status text not null default 'drafting'
    check (status in ('drafting', 'drafted', 'publishing', 'published', 'mass_sent', 'failed', 'cancelled')),
  step text not null default 'select'
    check (step in ('select', 'typeset', 'settings', 'confirm', 'done')),
  media_id text not null default '',
  publish_id text,
  msg_id text,
  article_url text,
  warning text not null default '',
  steps_json text not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_wf_wechat_publish_jobs_status
  on wf_wechat_publish_jobs(status, created_at desc);
create index if not exists idx_wf_wechat_publish_jobs_account
  on wf_wechat_publish_jobs(account_id, created_at desc);

-- ---------- 00007 cleanup demo rows（全站唯一 DELETE 迁移，只清演示行） ----------
delete from wf_keyword_trends where source like 'seed%';
delete from wf_keyword_trends where word ilike 'skincare%';
delete from wf_content_hot_topics where source like 'seed%';
delete from wf_content_hot_topics where word = '通勤好物';
delete from wf_longtail_keywords where id like 'lt-seed-%' or id like 'lt-demo-%';
delete from wf_longtail_keywords where word ilike 'skincare%' or word = '通勤好物';
delete from wf_b2b_products where id like 'bp-demo-%';
delete from wf_b2b_listings where id like 'lst-demo-%';
delete from wf_image_skills where id like 'is-demo-%';
delete from wf_image_skills where name = '白底商摄';
delete from wf_localize_tasks where id like 'lt-demo-%';
delete from wf_localize_tasks where batch_id like 'batch-demo-%';

-- ============================================================
-- 可选安全修复（本连接器顾问检出，建议一并执行）：
-- rls_auto_enable 是 SECURITY DEFINER 且 anon/authenticated 可调用，
-- set_updated_at / protect_builtin_image_skills search_path 未锁定。
-- 若不需要 anon 自动开启 RLS 的能力，可取消注释执行：
-- ============================================================
-- revoke execute on function public.rls_auto_enable() from anon, authenticated;
-- alter function public.rls_auto_enable() set search_path = pg_catalog;
-- alter function public.set_updated_at() set search_path = pg_catalog;
-- alter function public.protect_builtin_image_skills() set search_path = pg_catalog;

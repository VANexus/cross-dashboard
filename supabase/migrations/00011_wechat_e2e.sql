-- 00011_wechat_e2e.sql
-- 微信公众号端到端发布：账号保险库 + 发布任务。
--
-- 凭证 AppID / AppSecret 用 AES-256-GCM 加密存储（见 lib/vault.ts，
-- 主密钥 CHANNEL_VAULT_KEY 只走环境变量，绝不入库）。明文凭证只在服务端
-- 内存中出现（创建 / 测试连接时），列表与详情一律只返回掩码。
--
-- 应用方式：在 Supabase Dashboard → SQL Editor 粘贴执行本文件（幂等）。

-- ── 公众号账号保险库（支持无限多个账号）──
create table if not exists wf_wechat_accounts (
  id uuid primary key default gen_random_uuid(),
  label text not null default '',
  app_id_enc text not null,              -- base64( iv(12B) | tag(16B) | ct ) AES-256-GCM
  app_secret_enc text not null,
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('active', 'invalid')),
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_wf_wechat_accounts_status
  on wf_wechat_accounts(status, created_at desc);

-- ── 发布任务（分步人工确认状态机）──
-- step: select → typeset → settings → confirm → done
-- status: drafting → drafted → publishing → published / mass_sent / failed / cancelled
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

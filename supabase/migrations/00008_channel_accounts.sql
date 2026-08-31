-- 00008_channel_accounts.sql
-- 渠道账号保险库（browser_worker_saas_design.md M2）：
-- 各平台登录会话加密保管，多账号支持，状态探活。
-- 会话密文为 base64( iv(12B) | auth_tag(16B) | ciphertext )，AES-256-GCM；
-- 主密钥 CHANNEL_VAULT_KEY 只走环境变量，绝不入库、绝不入代码。

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

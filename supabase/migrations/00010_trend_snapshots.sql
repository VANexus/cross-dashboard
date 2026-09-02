-- 00010_trend_snapshots.sql
-- 趋势关键词时序快照（P1）：wf_keyword_trends 只保留「最新一版」覆盖式结果，
-- 无法看趋势变化/飙升榜。本表按天追加，每次成功刷新时幂等写入当日快照，
-- 支撑：迷你趋势线（sparkline）、环比飙升榜、历史回看。保留 100 天。

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

-- 幂等：同一平台/日期/词只保留一条（upsert 冲突目标）
create unique index if not exists uq_trend_snapshot_word
  on wf_trend_snapshots(platform, snapshot_date, word);
create index if not exists idx_trend_snapshot_date
  on wf_trend_snapshots(platform, snapshot_date desc, rank);

alter table wf_trend_snapshots enable row level security;

drop policy if exists anon_all on wf_trend_snapshots;
create policy anon_all on wf_trend_snapshots
  for all using (true) with check (true);

-- 清理函数：删除 100 天前快照（由每日刷新路由顺带调用，不依赖 pg_cron）
create or replace function trim_trend_snapshots(keep_days int default 100)
returns void
language sql
as $$
  delete from wf_trend_snapshots
  where snapshot_date < current_date - keep_days;
$$;

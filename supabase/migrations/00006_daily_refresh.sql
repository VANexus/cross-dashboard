-- 00006_daily_refresh.sql
-- B端每日刷新调度：pg_cron 每日 08:00 (UTC) → pg_net 回调前端 /api/b2b/daily-refresh 路由。
--
-- 说明：
-- - 目标 URL / token 存于 ai_config（键 b2b_daily_refresh_url / b2b_daily_refresh_token），
--   由前端「设置 → B 端运营」维护；触发函数每次执行时实时读取，改配置无需重建 cron。
-- - 本地 dev 的 localhost 无法被 pg_net 回调（属已知限制），趋势页提供「触发每日任务」手动兜底。
-- - 路由自带鉴权（x-refresh-token）与幂等（b2b_daily_refresh_last_run 当日标记）。

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function b2b_daily_refresh_fire()
returns void
language plpgsql
security definer
as $$
declare
  v_url   text;
  v_token text;
begin
  select value into v_url   from ai_config where key = 'b2b_daily_refresh_url' limit 1;
  select value into v_token from ai_config where key = 'b2b_daily_refresh_token' limit 1;

  if v_url is null or btrim(v_url) = '' then
    raise notice 'b2b_daily_refresh: ai_config 未配置 b2b_daily_refresh_url，跳过本次触发';
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-refresh-token', coalesce(v_token, '')
    ),
    body := jsonb_build_object('trigger', 'pg_cron'),
    timeout_milliseconds := 300000
  );
end;
$$;

-- 重建调度（幂等）：先删后建
select cron.unschedule('b2b-daily-refresh')
where exists (select 1 from cron.job where jobname = 'b2b-daily-refresh');

select cron.schedule(
  'b2b-daily-refresh',
  '0 8 * * *',
  $$ select b2b_daily_refresh_fire(); $$
);

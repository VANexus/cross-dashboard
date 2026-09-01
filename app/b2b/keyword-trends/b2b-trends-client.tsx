"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  TrendingUp, Flame, RefreshCw, Loader2, AlertTriangle,
  XCircle, ArrowUpRight, ArrowDownRight, Sparkles, ExternalLink,
  Send, CalendarClock, CheckCircle2, KeyRound, Search,
} from "lucide-react";
import { B2BNav } from "../b2b-nav";
import {
  refreshKeywordTrends, generateLongtail, useKeywordTrends, useB2BSettings,
  testPush, triggerDailyRefresh, saveB2BSettings,
} from "@/hooks/use-b2b";
import type { DailyRefreshResult, KeywordTrendsResult, LongtailKeyword, TrendPlatform } from "@/lib/types";

const PLATFORMS: { id: TrendPlatform; label: string; hint: string }[] = [
  { id: "tiktok", label: "TikTok", hint: "Creative Center 行业热词（TikHub API，免登录全量榜单）" },
  { id: "instagram", label: "Instagram", hint: "话题搜索（TikHub API，输入关键词出真实话题榜，免登录）" },
  { id: "alibaba", label: "阿里国际站", hint: "TOP 热销商品词频统计（需完成授权）" },
];

const PLATFORM_LABEL: Record<TrendPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  alibaba: "阿里国际站",
};

export function B2BTrendsClient({ initialTrends }: { initialTrends: KeywordTrendsResult["keywords"] }) {
  const [platform, setPlatform] = useState<TrendPlatform>("tiktok");
  const [override, setOverride] = useState<KeywordTrendsResult | null>(null);
  const [industry, setIndustry] = useState("");
  const [igKeyword, setIgKeyword] = useState("");
  const [longtail, setLongtail] = useState<LongtailKeyword[] | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<DailyRefreshResult | null>(null);

  const { data: live, loading } = useKeywordTrends(platform);
  const { data: settings, refetch: refetchSettings } = useB2BSettings();
  const trends: KeywordTrendsResult | null = override?.platform === platform ? override : live;

  const run = useCallback(async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    setPushMsg(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(null);
    }
  }, []);

  const switchPlatform = (p: TrendPlatform) => {
    setPlatform(p);
    setOverride(null);
    setError(null);
  };

  const handleRefresh = () => {
    void run("refresh", async () => {
      setOverride(await refreshKeywordTrends({ platform }));
    });
  };

  const handleIgSearch = () => {
    if (!igKeyword.trim()) {
      setError("请输入关键词（IG 无匿名全站榜单，按关键词搜话题）");
      return;
    }
    void run("ig-search", async () => {
      setOverride(await refreshKeywordTrends({ platform: "instagram", keyword: igKeyword.trim() }));
    });
  };

  const handleLongtail = () => {
    if (!industry.trim()) {
      setError("请输入行业名称");
      return;
    }
    void run("longtail", async () => {
      setLongtail(await generateLongtail({ industry: industry.trim(), limit: 15 }));
    });
  };

  const handleTogglePush = (key: "b2bPushFeishuEnabled" | "b2bPushWecomEnabled", checked: boolean) => {
    void run(key, async () => {
      await saveB2BSettings({ [key]: checked ? "true" : "false" });
      await refetchSettings();
      setPushMsg(`已${checked ? "开启" : "关闭"}${key === "b2bPushFeishuEnabled" ? "飞书" : "企业微信"}每日推送`);
    });
  };

  const handleTestPush = (channel: "feishu" | "wecom") => {
    void run(`test-${channel}`, async () => {
      const r = await testPush(channel);
      if (r.ok) {
        setPushMsg(`${r.channel === "feishu" ? "飞书" : "企业微信"}测试卡片已送达（${r.latencyMs}ms）`);
      } else {
        setError(`${r.channel === "feishu" ? "飞书" : "企业微信"}推送失败：${r.error ?? "未知错误"}`);
      }
    });
  };

  const handleDaily = () => {
    void run("daily", async () => {
      const r = await triggerDailyRefresh(true, settings?.b2bDailyRefreshToken || undefined);
      setLastRun(r);
      if (r.digestError) {
        setError(`每日任务已执行，但摘要生成失败：${r.digestError}`);
      } else {
        const failed = Object.entries(r.platforms ?? {}).filter(([, v]) => v.degraded);
        setPushMsg(
          failed.length > 0
            ? `每日任务完成（${r.date}），${failed.length} 个平台降级：${failed.map(([p]) => p).join("、")}`
            : `每日任务完成（${r.date}），三平台榜单已刷新${r.digest?.pushes.length ? `，推送 ${r.digest.pushes.length} 个渠道` : ""}`,
        );
      }
    });
  };

  const keywords = trends?.keywords ?? (platform === "tiktok" ? initialTrends : []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-7">
      <B2BNav />

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {pushMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2.5 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {pushMsg}
        </div>
      )}

      {/* 平台选择 + 刷新 */}
      <Card className="mb-4">
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">平台</span>
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => switchPlatform(p.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  platform === p.id
                    ? "border-border bg-card shadow-sm"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              {PLATFORMS.find((p) => p.id === platform)?.hint}
            </span>
            {platform === "instagram" && (
              <div className="flex items-center gap-2">
                <Input
                  value={igKeyword}
                  onChange={(e) => setIgKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleIgSearch()}
                  placeholder="关键词搜话题，如 hair"
                  className="h-8 w-44"
                />
                <Button size="sm" variant="outline" onClick={handleIgSearch} disabled={busy !== null} className="shrink-0">
                  {busy === "ig-search" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  搜话题
                </Button>
              </div>
            )}
            <Button size="sm" onClick={handleRefresh} disabled={busy !== null} className="shrink-0">
              {busy === "refresh" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              更新榜单
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 每日推送与定时更新 */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" /> 每日推送与定时更新
          </CardTitle>
          <CardDescription>
            每日 08:00（pg_cron）自动抓取三平台榜单 + 长尾词并推送；本地开发环境无法回调时用「触发每日任务」手动执行
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {([
              { key: "b2bPushFeishuEnabled" as const, channel: "feishu" as const, label: "飞书", webhook: settings?.feishuWebhookUrl },
              { key: "b2bPushWecomEnabled" as const, channel: "wecom" as const, label: "企业微信", webhook: settings?.wecomWebhookUrl },
            ]).map((row) => (
              <div key={row.key} className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">{row.label}</span>
                {row.webhook ? (
                  <Badge variant="secondary" className="text-[11px]">webhook 已配置</Badge>
                ) : (
                  <Badge variant="warning" className="text-[11px]">未配置 webhook</Badge>
                )}
                <div className="ml-auto flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null || !row.webhook}
                    onClick={() => handleTestPush(row.channel)}
                  >
                    {busy === `test-${row.channel}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    测试推送
                  </Button>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={settings?.[row.key] === "true"}
                      onCheckedChange={(checked) => handleTogglePush(row.key, checked)}
                      disabled={busy !== null || !row.webhook}
                    />
                    <span className="text-xs text-muted-foreground">每日推送</span>
                  </div>
                </div>
              </div>
            ))}
            {!settings?.feishuWebhookUrl && !settings?.wecomWebhookUrl && (
              <p className="text-xs text-muted-foreground">
                尚未配置任何群机器人 webhook，请先到
                <Link href="/settings/b2b" className="mx-1 inline-flex items-center gap-0.5 text-primary hover:underline">
                  设置 → B 端运营
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
                填写飞书 / 企业微信 webhook 地址。
              </p>
            )}
            <Separator />
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={handleDaily} disabled={busy !== null}>
                {busy === "daily" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                触发每日任务
              </Button>
              {lastRun && (
                <span className="text-xs text-muted-foreground">
                  上次执行 {lastRun.date}
                  {lastRun.platforms &&
                    ` · ${Object.entries(lastRun.platforms).map(([p, v]) => `${p} ${v.degraded ? "降级" : `${v.count} 词`}`).join(" / ")}`}
                </span>
              )}
              {settings?.b2bDailyRefreshUrl ? (
                <Badge variant="secondary" className="ml-auto text-[11px]">pg_cron 已配置回调</Badge>
              ) : (
                <Badge variant="outline" className="ml-auto text-[11px]">未配置 pg_cron 回调（仅手动）</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 热力趋势榜单 */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary" /> 行业关键词热力榜
              </CardTitle>
              <CardDescription className="hidden sm:block">
                {trends?.source && trends.source !== "cache" ? `数据源 /${trends.source}` : "小分类关键词 · 按热度排名"}
              </CardDescription>
            </div>
            {trends && (
              <Badge variant={trends.degraded ? "warning" : "secondary"}>
                {PLATFORM_LABEL[platform]} · {keywords.length} 词
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {trends?.degraded && (
            <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="flex-1 flex flex-wrap items-center gap-2">
                <span>{trends.warning ?? "趋势 API 不可达，展示降级数据"}</span>
                <Link
                  href="/settings/b2b"
                  className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-white/70 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-white transition-colors"
                >
                  去配置 API
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}
          <div className="divide-y">
            {loading && keywords.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground">加载中…</p>
            )}
            {!loading && keywords.length === 0 && (
              <div className="px-4 py-6 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  {platform === "alibaba"
                    ? "暂无榜单数据。热销词来自阿里 TOP，需先完成开放平台授权："
                    : "暂无榜单数据。真实关键词由 TikHub API 提供，请先在设置中配置 TIKHUB_API_KEY："}
                </p>
                <div className="flex flex-wrap gap-2">
                  {platform === "alibaba" && (
                    <Link
                      href="/settings/b2b"
                      className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      <KeyRound className="h-3 w-3" />
                      前往设置 → B 端运营
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  )}
                  <Link
                    href="/settings/b2b"
                    className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Sparkles className="h-3 w-3" />
                    前往设置 → B 端运营
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )}
            {keywords.map((k) => (
              <div key={`${k.word}-${k.rank}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold font-mono",
                    k.rank <= 3 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {k.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{k.word}</div>
                  <div className="text-xs text-muted-foreground">{k.industry}</div>
                </div>
                <span className="font-mono text-sm font-semibold text-primary">{k.heat.toLocaleString()}</span>
                {k.delta !== null && k.delta !== undefined && (
                  <span
                    className={cn(
                      "inline-flex w-16 items-center justify-end gap-0.5 font-mono text-xs",
                      k.delta >= 0 ? "text-emerald-500" : "text-muted-foreground",
                    )}
                  >
                    {k.delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(k.delta)}%
                  </span>
                )}
                {k.source && k.source !== "seed" && (
                  <ExternalLink className="h-3 w-3 text-muted-foreground/40" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 长尾词榜单 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> 相关行业长尾词
              </CardTitle>
              <CardDescription>按搜索意图扩展 · 用于 Listing 与社媒投放</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              className="sm:w-56"
              placeholder="行业名称，如：美妆个护"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLongtail()}
            />
            <Button size="sm" variant="outline" onClick={handleLongtail} disabled={busy !== null} className="shrink-0">
              {busy === "longtail" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              生成长尾词
            </Button>
          </div>
          {longtail ? (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {longtail.map((l) => (
                <Link
                  key={l.word}
                  href={`/b2b/listing?keyword=${encodeURIComponent(l.word)}`}
                  className="rounded-xl border p-3 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{l.word}</span>
                    <Badge variant="secondary" className="shrink-0">{l.category}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{l.searchIntent || "—"}</div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              输入行业后点击「生成长尾词」，结果可一键带到「一键上架」用作 Listing 关键词。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

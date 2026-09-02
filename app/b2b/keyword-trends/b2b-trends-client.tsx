"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
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
import { useAgentPage } from "@/lib/agent/page-context";
import { JourneyBar } from "@/components/journey/journey-bar";
import type { UIActionDef } from "@/lib/agent/ui-actions";
import {
  refreshKeywordTrends, generateLongtail, useKeywordTrends, useB2BSettings,
  testPush, triggerDailyRefresh, saveB2BSettings,
} from "@/hooks/use-b2b";
import type { DailyRefreshResult, KeywordTrendsResult, LongtailKeyword, TrendPlatform, TrendRising } from "@/lib/types";

const Sparkline = dynamic(() => import("@/components/ui/sparkline").then((m) => ({ default: m.Sparkline })), { ssr: false });

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const journeyId = searchParams.get("journey");
  // J2 跨页流转上下文携带：旅程中长尾词去 Listing 时带上 journey query
  const listingHref = (word: string) => {
    const q = new URLSearchParams({ keyword: word });
    if (journeyId) {
      q.set("journey", journeyId);
      q.set("step", "2");
    }
    return `/b2b/listing?${q.toString()}`;
  };
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

  // 「UI 即工具」：搜索/切平台/打开上架流程注册为 Agent 可调用的页面动作（操作上方现有 state）
  const agentActions: UIActionDef[] = [
    {
      id: "searchKeyword",
      description:
        "按关键词搜索当前平台的关键词榜单并更新（Instagram 为话题搜索；TikTok/阿里为带关键词的榜单刷新）",
      schema: z.object({ keyword: z.string().min(1).describe("关键词，如 hair") }),
      execute: async (p) => {
        const kw = String(p.keyword).trim();
        setIgKeyword(kw);
        try {
          const result = await refreshKeywordTrends({ platform, keyword: kw });
          setOverride(result);
          return (
            `已搜索「${kw}」（${PLATFORM_LABEL[platform]}），返回 ${result.keywords.length} 条` +
            (result.degraded ? `（降级：${result.warning ?? "趋势 API 不可达"}）` : "")
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : "搜索失败";
          setError(msg);
          throw err;
        }
      },
    },
    {
      id: "switchPlatform",
      description: "切换趋势平台：tiktok（TikTok 热词）/ instagram（话题搜索）/ alibaba（阿里国际站 TOP）",
      schema: z.object({ platform: z.enum(["tiktok", "instagram", "alibaba"]) }),
      execute: (p) => {
        const target = p.platform as TrendPlatform;
        switchPlatform(target);
        return `已切换到 ${PLATFORM_LABEL[target]}`;
      },
    },
    {
      id: "generateLongTails",
      description: "按行业生成搜索意图长尾词（用于 Listing 关键词与社媒投放），如 industry=美妆个护",
      schema: z.object({ industry: z.string().min(1).describe("行业名称，如 美妆个护") }),
      execute: async (p) => {
        const ind = String(p.industry).trim();
        setIndustry(ind);
        try {
          const r = await generateLongtail({ industry: ind, limit: 15 });
          setLongtail(r);
          const sample = r.slice(0, 5).map((k) => `${k.word}（${k.category}/${k.searchIntent}）`).join("、");
          return `已生成「${ind}」长尾词 ${r.length} 条，示例：${sample}。已展示在页面「相关行业长尾词」区，可直接用于 Listing 与社媒投放`;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "生成失败";
          setError(msg);
          throw err;
        }
      },
    },
    {
      id: "openListingFlow",
      description: "打开「一键上架」Listing 流程页（/b2b/listing，可带产品/关键词作为 Listing 关键词）",
      schema: z.object({ product: z.string().optional().describe("产品名或关键词") }),
      execute: (p) => {
        const product = typeof p.product === "string" ? p.product.trim() : "";
        if (product) router.push(`/b2b/listing?keyword=${encodeURIComponent(product)}`);
        else router.push("/b2b/listing");
        return product ? `已打开 Listing 流程，关键词「${product}」` : "已打开 Listing 流程";
      },
    },
  ];

  useAgentPage({
    title: "B 端关键词趋势",
    snapshot: () => {
      const top = keywords
        .slice(0, 5)
        .map((k) => `${k.rank}.${k.word}(${k.heat})`)
        .join(" ");
      return (
        `${PLATFORM_LABEL[platform]}关键词热力榜：共 ${keywords.length} 词` +
        (trends?.source ? ` · 源 ${trends.source}` : "") +
        (trends?.degraded ? ` · 降级（${trends.warning ?? "趋势 API 不可达"}）` : "") +
        ` · TOP5：${top || "暂无数据"}`
      );
    },
    state: () => ({
      platform,
      igKeyword,
      industry,
      overrideActive: override?.platform === platform,
      busy,
      longtailCount: longtail?.length ?? 0,
    }),
    actions: agentActions,
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-7">
      <JourneyBar />
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

      {/* 飙升榜：每日快照时序聚合 */}
      <TrendRisingCard platform={platform} />

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
                  href={listingHref(l.word)}
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

/** P1 时序快照飙升榜：近 14 天每日快照聚合，按环比涨幅降序，附迷你趋势线。 */
function TrendRisingCard({ platform }: { platform: TrendPlatform }) {
  const [rising, setRising] = useState<TrendRising[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // 延迟到定时器回调再拉取，避免在 effect 体内同步 setState（react-hooks/set-state-in-effect）
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/b2b/trend-snapshots?platform=${platform}&days=14`)
        .then((r) => r.json())
        .then((j) => {
          if (cancelled) return;
          setRising(j.data?.rising ?? []);
          setDates(j.data?.dates ?? []);
        })
        .catch(() => { if (!cancelled) setRising([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [platform]);

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" /> 飙升榜（{dates.length} 天时序快照）
          </CardTitle>
          <CardDescription>每日刷新榜单后自动沉淀 · 按区间涨幅排序</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading && rising.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">加载时序快照…</p>}
        {!loading && rising.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            暂无足够时序数据——连续两天「更新榜单」后即可看到每词的迷你趋势线与涨幅排名。
          </p>
        )}
        <div className="divide-y">
          {rising.map((r, i) => (
            <div key={r.word} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
              <span className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold font-mono",
                i < 3 ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground",
              )}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.word}</div>
                <div className="text-xs text-muted-foreground">{r.industry}</div>
              </div>
              <Sparkline quiet data={r.spark} width={88} height={24}
                color={(r.deltaPct ?? 0) >= 0 ? "var(--success)" : "var(--destructive)"} />
              <span className="font-mono text-sm w-20 text-right text-primary">{r.heat.toLocaleString()}</span>
              <span className={cn(
                "inline-flex w-20 items-center justify-end gap-0.5 font-mono text-xs",
                (r.deltaPct ?? 0) >= 0 ? "text-emerald-500" : "text-muted-foreground",
              )}>
                {(r.deltaPct ?? 0) >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(r.deltaPct ?? 0).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

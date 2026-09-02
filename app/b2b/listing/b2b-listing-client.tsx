"use client";

import { useCallback, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Package, Sparkles, Loader2, XCircle, RefreshCw, UploadCloud,
  CheckCircle2, AlertTriangle, Flame, ListChecks, ArrowUpRight,
} from "lucide-react";
import { B2BNav } from "../b2b-nav";
import { DataFreshness } from "@/components/data-freshness";
import { JourneyBar } from "@/components/journey/journey-bar";
import { useAgentPage } from "@/lib/agent/page-context";
import type { UIActionDef } from "@/lib/agent/ui-actions";
import {
  recommendProducts, generateListing, publishListing, refreshProducts,
  useB2BProducts, useListings, useKeywordTrends,
} from "@/hooks/use-b2b";
import type {
  AlibabaProductsEnvelope, B2BListingDraft, B2BPreference, ListingRecommendation,
} from "@/lib/types";

const PREFERENCES: { id: B2BPreference; label: string; hint: string }[] = [
  { id: "social", label: "发社媒", hint: "偏 TikTok / Instagram 种草词" },
  { id: "alibaba", label: "发阿里国际站", hint: "偏国际站搜索关键词" },
  { id: "mix", label: "综合", hint: "社媒 + 国际站关键词综合推荐" },
];

const PREF_LABEL: Record<B2BPreference, string> = {
  social: "发社媒",
  alibaba: "发阿里国际站",
  mix: "综合",
};

const UPLOAD_STATUS: Record<B2BListingDraft["uploadStatus"], { label: string; variant: "secondary" | "warning" | "success" | "destructive" }> = {
  draft: { label: "草稿", variant: "secondary" },
  uploading: { label: "上传中", variant: "warning" },
  uploaded: { label: "已上传", variant: "success" },
  failed: { label: "上传失败", variant: "destructive" },
};

function ListingInner({ initialProducts, initialListings }: {
  initialProducts: AlibabaProductsEnvelope;
  initialListings: B2BListingDraft[];
}) {
  const searchParams = useSearchParams();
  const [preference, setPreference] = useState<B2BPreference>("mix");
  const [keyword] = useState(() => searchParams.get("keyword") ?? "");
  const [recommendations, setRecommendations] = useState<ListingRecommendation[] | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<Record<string, { warnings?: string[]; error?: string; posted: boolean }>>({});

  const { data: liveProducts, refetch: refetchProducts } = useB2BProducts();
  const { data: liveListings, refetch: refetchListings } = useListings();
  const { data: trends } = useKeywordTrends("tiktok");

  const productsEnv: AlibabaProductsEnvelope = liveProducts ?? initialProducts;
  const products = productsEnv.products;
  const authorized = productsEnv.authorized ?? false;
  const productsDegraded = productsEnv.degraded ?? false;
  const productsWarning = productsEnv.warning;
  const listings = liveListings ?? initialListings;

  const run = useCallback(async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(null);
    }
  }, []);

  const handleSyncProducts = () => {
    void run("sync", async () => {
      await refreshProducts();
      void refetchProducts();
    });
  };

  const handleRecommend = () => {
    void run("recommend", async () => {
      setRecommendations(await recommendProducts({
        preference,
        trendKeywords: trends?.keywords ?? [],
        longtailKeywords: [],
      }));
    });
  };

  const handleGenerate = (rec: ListingRecommendation) => {
    void run(`gen-${rec.productId}`, async () => {
      await generateListing({
        productId: rec.productId,
        subject: rec.subject,
        keyword: keyword.trim() || undefined,
        preference,
      });
      void refetchListings();
    });
  };

  const handlePublish = (draft: B2BListingDraft) => {
    void run(`pub-${draft.id}`, async () => {
      const res = await publishListing(draft.id);
      setPublishResult((prev) => ({
        ...prev,
        [draft.id]: { warnings: res.warnings, error: res.error, posted: res.posted },
      }));
      void refetchListings();
    });
  };

  const draftable = recommendations ?? products.slice(0, 5).map((p) => ({
    productId: p.productId, subject: p.subject, score: 0, reasons: [] as string[],
  }));

  // 「UI 即工具」：铺货上架链路注册为 Agent 可调用动作；上传国际站是对外不可逆 L2，必须用户确认
  const agentActions: UIActionDef[] = [
    {
      id: "setListingPreference",
      description: "切换 Listing 关键词偏好：social 偏 TikTok/Ins 种草、alibaba 偏国际站搜索、mix 综合",
      riskLevel: "L1",
      schema: z.object({ preference: z.enum(["social", "alibaba", "mix"]) }),
      execute: (p) => {
        setPreference(p.preference as B2BPreference);
        return `已切换偏好为「${PREF_LABEL[p.preference as B2BPreference]}」`;
      },
    },
    {
      id: "syncProductPool",
      description: "从阿里国际站后台同步商品池（TOP product.list，需已授权）",
      riskLevel: "L1",
      execute: async () => {
        await refreshProducts();
        void refetchProducts();
        return "已触发商品池同步";
      },
    },
    {
      id: "recommendToday",
      description: "按当前偏好 + TikTok 热榜计算今日推荐上架 TOP5",
      riskLevel: "L1",
      execute: async () => {
        const recs = await recommendProducts({
          preference,
          trendKeywords: trends?.keywords ?? [],
          longtailKeywords: [],
        });
        setRecommendations(recs);
        const sample = recs.slice(0, 5).map((r) => r.subject).join("、");
        return recs.length ? `已给出 ${recs.length} 个推荐：${sample}` : "暂无推荐（商品池为空或未授权国际站）";
      },
    },
    {
      id: "generateListingDraft",
      description: "为指定商品生成一条 Listing 草稿（标题/详情/关键词，落在草稿库，不对外发布）",
      riskLevel: "L1",
      schema: z.object({
        productId: z.string().min(1).describe("商品货号 productId"),
        subject: z.string().optional().describe("商品标题，缺省用商品池原标题"),
      }),
      execute: async (p) => {
        const productId = String(p.productId);
        const subject = typeof p.subject === "string" && p.subject.trim() ? p.subject
          : (products.find((x) => x.productId === productId)?.subject ?? productId);
        await generateListing({ productId, subject, keyword: keyword.trim() || undefined, preference });
        void refetchListings();
        return `已为商品 ${productId} 生成 Listing 草稿，可在草稿库查看（仍需 L2 确认才会上传国际站）`;
      },
    },
    {
      id: "publishListingToAlibaba",
      description: "把指定 Listing 草稿上传/发布到阿里国际站（对外动作，会创建线上商品）",
      riskLevel: "L2",
      confirmText: (p) => {
        const d = listings.find((x) => x.id === String(p.draftId));
        return `将把草稿「${d?.title ?? String(p.draftId)}」上传到阿里国际站，创建线上商品，对外可见且无法自动撤销。确认继续？`;
      },
      schema: z.object({ draftId: z.string().min(1).describe("Listing 草稿 id") }),
      execute: async (p) => {
        const draftId = String(p.draftId);
        const draft = listings.find((x) => x.id === draftId);
        if (!draft) throw new Error(`未找到草稿 ${draftId}`);
        const res = await publishListing(draftId);
        setPublishResult((prev) => ({ ...prev, [draftId]: { warnings: res.warnings, error: res.error, posted: res.posted } }));
        void refetchListings();
        if (res.posted) return `已上传国际站，货号 ${res.strProductId || res.productId}${res.warnings?.length ? `，注意 ${res.warnings.length} 条警告` : ""}`;
        return `未成功上传：${res.error ?? "接口返回 posted=false（可能未授权国际站）"}`;
      },
    },
  ];

  useAgentPage({
    title: "一键上架（TikTok·国际站铺货）",
    snapshot: () => {
      const lines = [
        `偏好 ${PREF_LABEL[preference]} · 商品池 ${products.length} 个${authorized ? "（国际站已授权）" : "（国际站未授权）"}`,
        `推荐 ${draftable.length} 条 · Listing 草稿 ${listings.length} 条`,
      ];
      if (productsDegraded) lines.push(`商品数据降级：${productsWarning ?? "缓存/空"}`);
      const drafts = listings.slice(0, 5).map((d) => `${d.id}:${d.uploadStatus}/${d.title.slice(0, 16)}`).join("；");
      if (drafts) lines.push(`草稿：${drafts}`);
      return lines.join(" · ");
    },
    state: () => ({
      preference,
      authorized,
      productsCount: products.length,
      draftsCount: listings.length,
      draftIds: listings.map((d) => d.id),
      busy,
    }),
    actions: agentActions,
  });

  return (
    <div>
      <JourneyBar />
      <B2BNav />

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* 偏好选择 + 操作 */}
      <Card className="mb-4">
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">偏好</span>
            {PREFERENCES.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreference(p.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  preference === p.id
                    ? "border-border bg-card shadow-sm"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              {PREFERENCES.find((p) => p.id === preference)?.hint}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleRecommend} disabled={busy !== null}>
              {busy === "recommend" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              今日推荐 TOP5
            </Button>
            <Button size="sm" variant="outline" onClick={handleSyncProducts} disabled={busy !== null}>
              {busy === "sync" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              同步商品池
            </Button>
            {keyword.trim() && (
              <Badge variant="secondary" className="gap-1">
                <Flame className="h-3 w-3" /> {keyword.trim()}
              </Badge>
            )}
            <span className="ml-auto text-xs text-muted-foreground flex items-center gap-2">
              <DataFreshness fetchedAt={productsEnv.fetchedAt} refreshing={productsEnv.refreshing} />
              <span>
                商品池 {products.length} 个{products.length === 0 && authorized === false ? " · 未授权国际站" : ""}
              </span>
              {authorized ? (
                <Badge variant="secondary" className="gap-1 text-tiny border-success/30 text-success">
                  <CheckCircle2 className="h-3 w-3" /> 国际站已授权
                </Badge>
              ) : (
                <Link
                  href="/settings/b2b"
                  className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning/5 px-2 py-0.5 text-caption font-medium text-warning hover:bg-warning/10 transition-colors"
                >
                  <AlertTriangle className="h-3 w-3" /> 去授权国际站
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 推荐商品 TOP5 */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" /> 今日推荐上架 TOP5
          </CardTitle>
          <CardDescription>基于关键词热榜匹配商品池 · 附推荐理由</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {(productsDegraded || productsWarning) && (
            <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="flex-1 flex flex-wrap items-center gap-2">
                <span>{productsWarning ?? "商品接口降级返回，数据可能是历史缓存或空。"}</span>
                <Link
                  href="/settings/b2b"
                  className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-background/70 px-2 py-0.5 text-caption font-medium text-warning hover:bg-background transition-colors"
                >
                  检查配置
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}
          <div className="divide-y">
            {busy === "recommend" && (
              <p className="px-4 py-6 text-sm text-muted-foreground">推荐计算中…</p>
            )}
            {busy !== "recommend" && draftable.length === 0 && (
              <div className="px-4 py-6 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  暂无商品。真实商品来自阿里国际站后台（TOP product.list），首次使用请先授权 + 同步：
                </p>
                <Link
                  href="/settings/b2b"
                  className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  <Sparkles className="h-3 w-3" />
                  前往设置 → B 端运营
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            )}
            {draftable.map((rec, i) => (
              <div key={rec.productId} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold font-mono",
                    i < 3 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{rec.subject}</span>
                    {rec.score > 0 && (
                      <span className="shrink-0 font-mono text-xs font-semibold text-primary">{rec.score}</span>
                    )}
                  </div>
                  {rec.reasons.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {rec.reasons.map((r, j) => (
                        <span key={j} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-caption text-muted-foreground">
                          <Flame className="h-3 w-3 text-primary/70" /> {r}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleGenerate(rec)}
                  disabled={busy !== null}
                  className="shrink-0"
                >
                  {busy === `gen-${rec.productId}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  生成 Listing
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Listing 草稿库 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> Listing 草稿库
              </CardTitle>
              <CardDescription className="hidden sm:block">AI 生成标题 / 详情 / 关键词 · 一键上传国际站</CardDescription>
            </div>
            <Badge variant="secondary">{listings.length} 条</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {listings.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                暂无草稿，对推荐商品点击「生成 Listing」。
              </p>
            )}
            {listings.map((d) => {
              const pr = publishResult[d.id];
              return (
                <div key={d.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{d.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge variant={UPLOAD_STATUS[d.uploadStatus].variant}>
                          {UPLOAD_STATUS[d.uploadStatus].label}
                        </Badge>
                        <span>{PREF_LABEL[d.preference]}</span>
                        {d.uploadedProductId && <span>· 货号 {d.uploadedProductId}</span>}
                      </div>
                    </div>
                    {d.uploadStatus !== "uploaded" && (
                      <Button
                        size="sm"
                        onClick={() => handlePublish(d)}
                        disabled={busy !== null || d.uploadStatus === "uploading"}
                        className="shrink-0"
                      >
                        {busy === `pub-${d.id}` || d.uploadStatus === "uploading"
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <UploadCloud className="h-3.5 w-3.5" />}
                        上传国际站
                      </Button>
                    )}
                    {d.uploadStatus === "uploaded" && <CheckCircle2 className="h-4 w-4 text-success" />}
                    {d.uploadStatus === "failed" && <AlertTriangle className="h-4 w-4 text-warning" />}
                  </div>
                  {(d.warnings && d.warnings.length > 0) && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <ul className="list-disc space-y-0.5 pl-4">
                        {d.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  )}
                  {pr?.warnings && pr.warnings.length > 0 && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <ul className="list-disc space-y-0.5 pl-4">
                        {pr.warnings.map((w, i) => <li key={`pw-${i}`}>{w}</li>)}
                      </ul>
                    </div>
                  )}
                  {pr?.error && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div>
                        <div className="font-medium">发布失败</div>
                        <div className="mt-0.5">{pr.error}</div>
                        <div className="mt-0.5 opacity-80">
                          请先在 <Link className="underline hover:text-foreground" href="/settings/b2b">设置 → B 端运营</Link> 配置阿里国际站密钥与授权。
                        </div>
                      </div>
                    </div>
                  )}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">详情与关键词</summary>
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs leading-6">{d.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {d.keywords.map((k) => (
                        <Badge key={k} variant="secondary">{k}</Badge>
                      ))}
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function B2BListingClient(props: {
  initialProducts: AlibabaProductsEnvelope;
  initialListings: B2BListingDraft[];
}) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-6 py-7" />}>
      <ListingInner {...props} />
    </Suspense>
  );
}

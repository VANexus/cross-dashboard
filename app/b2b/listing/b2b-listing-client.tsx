"use client";

import { useCallback, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
                <Badge variant="secondary" className="gap-1 text-[10px] border-emerald-500/30 text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> 国际站已授权
                </Badge>
              ) : (
                <Link
                  href="/settings/b2b"
                  className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/5 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-500/10 transition-colors"
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
            <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="flex-1 flex flex-wrap items-center gap-2">
                <span>{productsWarning ?? "商品接口降级返回，数据可能是历史缓存或空。"}</span>
                <Link
                  href="/settings/b2b"
                  className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-white/70 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-white transition-colors"
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
                        <span key={j} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
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
                    {d.uploadStatus === "uploaded" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    {d.uploadStatus === "failed" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                  </div>
                  {(d.warnings && d.warnings.length > 0) && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <ul className="list-disc space-y-0.5 pl-4">
                        {d.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  )}
                  {pr?.warnings && pr.warnings.length > 0 && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
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

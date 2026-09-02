"use client";

import { WorkflowStepper } from "@/components/ui/workflow-stepper";
import { PageHeader } from "@/components/ui/page-header";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { PageTransition } from "@/components/ui/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ShopProduct, ShopReview } from "@/lib/types";
import {
  Radar, Play, Search, ChevronRight, AlertTriangle, CheckCircle2, ArrowRight,
  ShieldAlert, Package, Star, FileText, Loader2, ExternalLink, MessageSquareWarning,
} from "lucide-react";

const AnimatedNumber = dynamic(() => import("@/components/ui/animated-number").then((m) => ({ default: m.AnimatedNumber })), { ssr: false });

const steps = [
  { id: "collect", label: "商品采集", desc: "TikTok Shop 真实在售" },
  { id: "keywords", label: "热词扩词", desc: "搜索联想+站内热词" },
  { id: "reviews", label: "评论反推", desc: "真实评论/差评痛点" },
  { id: "ai-suggest", label: "AI 差异化", desc: "专利检测+差异化建议" },
  { id: "proposal", label: "方案生成", desc: "产品定义+卖点" },
];

const REGIONS = [
  { code: "US", name: "美国" }, { code: "GB", name: "英国" }, { code: "ID", name: "印尼" },
  { code: "TH", name: "泰国" }, { code: "VN", name: "越南" }, { code: "MY", name: "马来" },
  { code: "PH", name: "菲律宾" },
];

interface RecentResearchResult {
  id: string;
  marketplace: string;
  category: string;
  resultJson: unknown;
  createdAt: string;
}

export interface ProductResearchClientProps {
  recentResults?: RecentResearchResult[];
}

async function postIntel<T>(body: unknown): Promise<T> {
  const res = await fetch("/api/b2b/shop-intel", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await res.json();
  if (!j.data) throw new Error(j.error || "查询失败");
  return j.data as T;
}

export function ProductResearchClient({ recentResults = [] }: ProductResearchClientProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState("collect");
  const currentIdx = steps.findIndex((s) => s.id === currentStep);

  const [keyword, setKeyword] = useState("dress");
  const [region, setRegion] = useState("US");
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);

  const [selected, setSelected] = useState<ShopProduct | null>(null);
  const [reviews, setReviews] = useState<ShopReview[]>([]);
  const [reviewSummary, setReviewSummary] = useState<{ total?: string; avg?: number | null; distribution?: Record<string, string> }>({});
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [trendingWords, setTrendingWords] = useState<string[]>([]);

  const searchProducts = async (reset = true) => {
    const kw = keyword.trim();
    if (!kw) { setWarn("请输入选品关键词"); return; }
    setLoading(true); setWarn(null);
    try {
      const data = await postIntel<{ products: ShopProduct[]; page: { hasMore?: boolean }; degraded: boolean; warning?: string }>({
        action: "search", keyword: kw, region, limit: 30, offset: reset ? 0 : products.length,
      });
      if (data.degraded) { setWarn(data.warning || "选品接口不可用"); setProducts([]); return; }
      setProducts((prev) => reset ? data.products : [...prev, ...data.products]);
      setHasMore(Boolean(data.page?.hasMore));
      if (data.products.length === 0) setWarn(`「${kw}」在该站点暂无在售商品，换词或换站点试试`);
      // 同步拉搜索联想供下一步
      postIntel<{ suggestions: string[] }>({ action: "suggest", keyword: kw, region })
        .then((d) => setSuggestions(d.suggestions)).catch(() => {});
    } catch (e) {
      setWarn(e instanceof Error ? e.message : "搜索失败");
    } finally {
      setLoading(false);
    }
  };

  // 挂载即搜索默认词（延迟到定时器回调，避免 effect 体内同步 setState）
  useEffect(() => {
    const t = setTimeout(() => void searchProducts(true), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 站内趋势热词（内容情报）
  useEffect(() => {
    fetch("/api/b2b/content-intel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "trending_words", limit: 30 }),
    }).then((r) => r.json()).then((j) => {
      setTrendingWords((j.data?.trendingWords ?? []).map((x: { word: string }) => x.word));
    }).catch(() => {});
  }, []);

  const pickProduct = async (p: ShopProduct) => {
    setSelected(p);
    setReviewsLoading(true);
    try {
      const d = await postIntel<{ reviews: ShopReview[]; reviewSummary: typeof reviewSummary }>({
        action: "reviews", productId: p.productId, region, limit: 30,
      });
      setReviews(d.reviews); setReviewSummary(d.reviewSummary);
    } catch {
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const badReviews = reviews.filter((r) => (r.rating ?? 5) <= 3);
  const dist = reviewSummary.distribution ?? {};
  const distMax = Math.max(1, ...Object.values(dist).map((v) => Number(v) || 0));

  return (
    <PageTransition className="space-y-4">
      <PageHeader
        title="选品工作流"
        description="TikTok Shop 真实在售商品 + 真实评论 + AI 差异化"
        icon={<Radar className="h-6 w-6 text-wf-product" />}
      />

      <WorkflowStepper
        steps={steps.map((s, i) => ({
          id: s.id,
          label: s.label,
          status: i < currentIdx ? "completed" : s.id === currentStep ? "active" : "pending",
        }))}
        currentStep={currentStep}
        onStepClick={(id) => setCurrentStep(id)}
        orientation="horizontal"
        navigable
        className="stagger-in"
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4 min-w-0">
          {/* Step 1 商品采集 */}
          {currentStep === "collect" && (
            <>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[220px]">
                      <label className="text-caption text-muted-foreground">商品关键词</label>
                      <Input className="mt-1 h-9" value={keyword} onChange={(e) => setKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && searchProducts(true)} placeholder="如 dress、coffee maker、pet bed" />
                    </div>
                    <div className="w-32">
                      <label className="text-caption text-muted-foreground">站点</label>
                      <select value={region} onChange={(e) => setRegion(e.target.value)}
                        className="mt-1 h-9 w-full rounded-lg border border-input bg-background/60 px-2 text-sm">
                        {REGIONS.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
                      </select>
                    </div>
                    <Button className="h-9 gap-2 bg-wf-product hover:bg-wf-product/90" onClick={() => searchProducts(true)} disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} 搜索在售商品
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {warn && (
                <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /><span>{warn}</span>
                </div>
              )}

              {loading && products.length === 0 && (
                <div className="flex items-center justify-center py-20 gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> 正在拉取真实在售商品…</div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((p) => (
                  <Card key={p.productId} className={cn("overflow-hidden cursor-pointer transition-all hover:ring-1 hover:ring-primary/30",
                    selected?.productId === p.productId && "ring-1 ring-primary")}
                    onClick={() => { pickProduct(p); setCurrentStep("reviews"); }}>
                    <div className="aspect-square bg-muted">
                      {p.imageUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={p.imageUrl} alt={p.title} loading="lazy" className="h-full w-full object-cover" />
                        : <div className="flex h-full items-center justify-center text-muted-foreground"><Package className="h-8 w-8" /></div>}
                    </div>
                    <CardContent className="p-3 space-y-1.5">
                      <p className="text-xs line-clamp-2 min-h-[2rem] leading-snug">{p.title}</p>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-semibold text-price">{p.currency}{p.price}</span>
                        {p.originalPrice && p.originalPrice !== p.price && (
                          <span className="text-tiny line-through text-muted-foreground">{p.currency}{p.originalPrice}</span>
                        )}
                        {p.discount && <span className="text-tiny text-destructive">{p.discount}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-tiny text-muted-foreground">
                        <span className="flex items-center gap-0.5"><Star className="h-3 w-3 text-warning" />{p.rating ?? "—"}</span>
                        <span>{p.reviewCount ?? 0} 评</span>
                        <span>已售 {p.soldCount ?? 0}</span>
                      </div>
                      <p className="text-tiny text-muted-foreground truncate">{p.sellerName}{p.brand ? ` · ${p.brand}` : ""}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {hasMore && products.length > 0 && (
                <div className="flex justify-center">
                  <Button variant="outline" size="sm" disabled={loading} onClick={() => searchProducts(false)}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}加载更多
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Step 2 热词扩词 */}
          {currentStep === "keywords" && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-sm">搜索联想词（真实下拉推荐）</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {suggestions.length === 0 && <p className="text-xs text-muted-foreground">回到「商品采集」搜索后，这里展示该词的真实联想</p>}
                  {suggestions.map((s) => (
                    <Badge key={s} variant="outline" className="cursor-pointer text-xs border-primary/30 text-primary"
                      onClick={() => { setKeyword(s); setCurrentStep("collect"); }}>{s}</Badge>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">TikTok 站内趋势搜索词</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2 max-h-[320px] overflow-auto">
                  {trendingWords.length === 0 && <p className="text-xs text-muted-foreground">加载中…</p>}
                  {trendingWords.map((w) => (
                    <Badge key={w} variant="outline" className="cursor-pointer text-xs"
                      onClick={() => { setKeyword(w); setCurrentStep("collect"); }}>{w}</Badge>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 3 评论反推 */}
          {currentStep === "reviews" && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquareWarning className="h-4 w-4 text-warning" />
                    {selected ? selected.title.slice(0, 60) : "请先在「商品采集」选择一个商品"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {reviewsLoading ? (
                    <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> 拉取真实评论…</div>
                  ) : (
                    <>
                      <div className="flex items-center gap-6 mb-4">
                        <div>
                          <div className="text-2xl font-bold text-warning">{reviewSummary.avg ?? "—"}</div>
                          <div className="text-tiny text-muted-foreground">共 {reviewSummary.total ?? reviews.length} 条</div>
                        </div>
                        <div className="flex-1 space-y-1">
                          {[5, 4, 3, 2, 1].map((star) => (
                            <div key={star} className="flex items-center gap-2 text-tiny">
                              <span className="w-6">{star}★</span>
                              <div className="h-1.5 flex-1 rounded bg-muted overflow-hidden">
                                <div className="h-full bg-warning" style={{ width: `${((Number(dist[String(star)]) || 0) / distMax) * 100}%` }} />
                              </div>
                              <span className="w-8 text-right text-muted-foreground">{dist[String(star) ?? "0"] ?? 0}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {badReviews.length > 0 && (
                        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
                          检测到 <b>{badReviews.length}</b> 条差评（≤3★），这些是产品改进的真实切入点：
                        </div>
                      )}
                      <div className="space-y-2 max-h-[420px] overflow-auto">
                        {reviews.map((r) => (
                          <div key={r.reviewId} className={cn("rounded-lg border p-2.5 text-xs", (r.rating ?? 5) <= 3 ? "border-destructive/30 bg-destructive/5" : "bg-muted/30")}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{r.reviewer || "匿名"}</span>
                              <span className="text-warning">{"★".repeat(r.rating ?? 0)}</span>
                              {r.verified && <Badge variant="outline" className="text-tiny h-4">已验证购买</Badge>}
                              {r.incentivized && <Badge variant="outline" className="text-tiny h-4">激励评价</Badge>}
                              <span className="ml-auto text-muted-foreground">{r.time}</span>
                            </div>
                            <p className="text-muted-foreground leading-relaxed">{r.text || "（无文字评价）"}</p>
                            {r.images.length > 0 && (
                              <div className="flex gap-1 mt-1.5">
                                {r.images.slice(0, 4).map((img, i) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img key={i} src={img} alt="晒图" className="h-12 w-12 rounded object-cover" loading="lazy" />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        {reviews.length === 0 && <p className="py-6 text-center text-muted-foreground">该商品暂无评论</p>}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 4 AI 差异化（保留真实历史） */}
          {currentStep === "ai-suggest" && (
            <div className="space-y-4">
              {(() => {
                const latest = recentResults[0];
                const r = (latest?.resultJson ?? {}) as Record<string, unknown>;
                const patentRisks = r.patentRisks as Array<{ label: string; status: string; detail: string }> | undefined;
                const differentiations = r.differentiations as string[] | undefined;
                if (!latest) {
                  return (
                    <Card><CardContent className="p-8 text-center">
                      <ShieldAlert className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground mb-2">暂无 AI 分析记录</p>
                      <p className="text-xs text-muted-foreground/60">选品 AI 分析由后端工作流执行并落库，执行后此处展示专利风险与差异化方向</p>
                    </CardContent></Card>
                  );
                }
                return (
                  <>
                    <Card className="border-l-2 border-l-red-500">
                      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-destructive" /> 专利风险检测</CardTitle></CardHeader>
                      <CardContent>
                        {patentRisks?.length ? (
                          <div className="grid gap-3 sm:grid-cols-3">
                            {patentRisks.map((p) => (
                              <div key={p.label} className={cn("p-3 rounded-lg border", p.status === "warning" ? "border-warning/30 bg-warning/5" : "border-success/30 bg-success/5")}>
                                <div className="flex items-center gap-2 mb-1 text-sm font-medium">
                                  {p.status === "warning" ? <AlertTriangle className="h-4 w-4 text-warning" /> : <CheckCircle2 className="h-4 w-4 text-success" />}{p.label}
                                </div>
                                <p className="text-xs text-muted-foreground">{p.detail}</p>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-xs text-muted-foreground">暂无专利检测数据</p>}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">产品差异化方向</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        {differentiations?.length ? differentiations.map((s, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm"><span className="text-primary font-bold">{i + 1}.</span><span className="text-muted-foreground">{s}</span></div>
                        )) : <p className="text-xs text-muted-foreground">暂无差异化建议</p>}
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </div>
          )}

          {/* Step 5 方案生成（保留真实历史） */}
          {currentStep === "proposal" && (
            <Card>
              {(() => {
                const latest = recentResults[0];
                const r = (latest?.resultJson ?? {}) as Record<string, unknown>;
                const proposal = r.proposal as Record<string, unknown> | undefined;
                const productName = (proposal?.productName as string) || (r.productName as string) || "";
                const sellingPoints = (proposal?.sellingPoints as string[]) || [];
                if (!latest || (!productName && sellingPoints.length === 0)) {
                  return <CardContent className="p-8 text-center"><Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">暂无产品方案，完成 AI 分析后自动生成</p></CardContent>;
                }
                return (
                  <CardContent className="space-y-4 pt-6">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">产品定义</p>
                      <p className="text-sm font-medium">{productName}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">核心卖点</p>
                      <div className="flex flex-wrap gap-1">{sellingPoints.map((s) => <Badge key={s} variant="outline" className="text-tiny border-primary/30 text-primary">{s}</Badge>)}</div>
                    </div>
                    <div className="flex gap-3">
                      <Button className="gap-2" onClick={() => {
                        const blob = new Blob([`选品方案\n\n${productName}\n卖点: ${sellingPoints.join(", ")}`], { type: "text/plain;charset=utf-8" });
                        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "选品方案.txt"; a.click();
                      }}><FileText className="h-4 w-4" /> 导出方案</Button>
                      <Button variant="outline" className="gap-2" onClick={() => router.push("/workflows/ai-imaging")}><ArrowRight className="h-4 w-4" /> 发送到 AI 作图</Button>
                    </div>
                  </CardContent>
                );
              })()}
            </Card>
          )}
        </div>

        {/* 侧栏 */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">采集概览</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">在售商品</span><AnimatedNumber value={products.length} className="font-medium" /></div>
              <div className="flex justify-between"><span className="text-muted-foreground">联想词</span><span className="font-medium">{suggestions.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">当前商品评论</span><span className="font-medium">{reviews.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">其中差评</span><span className="font-medium text-destructive">{badReviews.length}</span></div>
            </CardContent>
          </Card>

          {selected && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">当前选品</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-xs">
                <p className="line-clamp-3 leading-snug">{selected.title}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-price">{selected.currency}{selected.price}</span>
                  <span className="text-muted-foreground">已售 {selected.soldCount ?? 0}</span>
                </div>
                {selected.url && (
                  <a href={selected.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    打开 TikTok Shop 商品页 <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <Progress value={Math.min(100, (selected.rating ?? 0) * 20)} className="h-1.5" />
                <span className="text-muted-foreground">评分 {selected.rating ?? "—"} / 5</span>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

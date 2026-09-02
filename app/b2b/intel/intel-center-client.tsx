"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { PageTransition } from "@/components/ui/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  AdMaterial, ShopProduct, VideoItem, MusicItem, CreatorInsight, IgPost, CreatorProfile,
} from "@/lib/types";
import {
  Satellite, Flame, Megaphone, ShoppingBag, PlayCircle, Music, Users, AtSign,
  Loader2, Search, Star, AlertTriangle,
} from "lucide-react";

const Sparkline = dynamic(() => import("@/components/ui/sparkline").then((m) => ({ default: m.Sparkline })), { ssr: false });

type Tab = "trending" | "ads" | "shop" | "videos" | "music" | "creators" | "ig";

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: "trending", label: "热词", icon: <Flame className="h-4 w-4" /> },
  { id: "ads", label: "广告库", icon: <Megaphone className="h-4 w-4" /> },
  { id: "shop", label: "选品", icon: <ShoppingBag className="h-4 w-4" /> },
  { id: "videos", label: "爆款视频", icon: <PlayCircle className="h-4 w-4" /> },
  { id: "music", label: "音乐榜", icon: <Music className="h-4 w-4" /> },
  { id: "creators", label: "达人", icon: <Users className="h-4 w-4" /> },
  { id: "ig", label: "AtSign", icon: <AtSign className="h-4 w-4" /> },
];

function compact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}
function dur(s: number | null | undefined) {
  if (!s) return "—";
  const m = Math.floor(s / 60), x = Math.round(s % 60);
  return m ? `${m}:${String(x).padStart(2, "0")}` : `${x}s`;
}

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json();
  if (!j.data) throw new Error(j.error || "查询失败");
  return j.data;
}

function StateBox({ loading, warn, empty, children }: { loading: boolean; warn: string | null; empty: boolean; children: React.ReactNode }) {
  if (loading) return <div className="flex items-center justify-center py-20 gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> 拉取真实数据…</div>;
  if (warn) return <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /><span>{warn}</span></div>;
  if (empty) return <p className="py-16 text-center text-sm text-muted-foreground">暂无数据</p>;
  return <>{children}</>;
}

export function IntelCenterClient() {
  const [tab, setTab] = useState<Tab>("trending");

  // 通用查询状态
  const [loading, setLoading] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);
  const [kw, setKw] = useState("skincare");
  const [region, setRegion] = useState("US");
  const [feedType, setFeedType] = useState<"top" | "recent">("top");

  const [trending, setTrending] = useState<Array<{ word: string; type: string }>>([]);
  const [ads, setAds] = useState<AdMaterial[]>([]);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [music, setMusic] = useState<MusicItem[]>([]);
  const [insights, setInsights] = useState<CreatorInsight[]>([]);
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [igPosts, setIgPosts] = useState<IgPost[]>([]);

  const run = useCallback(async (t: Tab) => {
    setLoading(true); setWarn(null);
    try {
      if (t === "trending") {
        const d = await post("/api/b2b/content-intel", { action: "trending_words", limit: 50 });
        setTrending(d.trendingWords ?? []);
      } else if (t === "ads") {
        const d = await post("/api/b2b/ad-intel", { action: "search_ads", keyword: kw, limit: 20, orderBy: "likes", period: 180 });
        if (d.degraded) { setAds([]); setWarn(d.warning || "广告库不可用"); } else setAds(d.materials ?? []);
      } else if (t === "shop") {
        const d = await post("/api/b2b/shop-intel", { action: "search", keyword: kw, region, limit: 30 });
        if (d.degraded) { setProducts([]); setWarn(d.warning || "选品接口不可用"); } else setProducts(d.products ?? []);
      } else if (t === "videos") {
        const d = await post("/api/b2b/content-intel", { action: "video_search", keyword: kw, region, limit: 30 });
        if (d.degraded) { setVideos([]); setWarn(d.warning || "视频检索不可用"); } else setVideos(d.videos ?? []);
      } else if (t === "music") {
        const d = await post("/api/b2b/content-intel", { action: "music_chart", limit: 30 });
        setMusic(d.music ?? []);
      } else if (t === "creators") {
        const d = await post("/api/b2b/content-intel", { action: "creator_insights", limit: 30 });
        setInsights(d.insights ?? []);
      } else if (t === "ig") {
        const d = await post("/api/b2b/content-intel", { action: "ig_hashtag_posts", keyword: kw, feedType, limit: 24 });
        if (d.degraded) { setIgPosts([]); setWarn(d.warning || "IG 接口不可用"); } else setIgPosts(d.igPosts ?? []);
      }
    } catch (e) {
      setWarn(e instanceof Error ? e.message : "查询失败");
    } finally { setLoading(false); }
  }, [kw, region, feedType]);

  // 无参 tab 首次进入自动加载（延迟到定时器回调，避免 effect 体内同步 setState）
  useEffect(() => {
    if ((tab === "trending" && trending.length === 0) || (tab === "music" && music.length === 0) || (tab === "creators" && insights.length === 0)) {
      const t = setTimeout(() => void run(tab), 0);
      return () => clearTimeout(t);
    }
  }, [tab, run, trending.length, music.length, insights.length]);

  const lookupProfile = async () => {
    const handle = kw.trim().replace(/^@/, "");
    if (!handle) return;
    setLoading(true); setWarn(null);
    try {
      const d = await post("/api/b2b/content-intel", { action: "creator_profile", uniqueId: handle, withCountry: true });
      setProfile(d.profile ?? null);
      if (d.degraded || !d.profile) setWarn(d.warning || `未找到达人 @${handle}`);
    } catch (e) { setWarn(e instanceof Error ? e.message : "查询失败"); }
    finally { setLoading(false); }
  };

  const needKeyword = tab === "ads" || tab === "shop" || tab === "videos" || tab === "ig";

  return (
    <PageTransition className="space-y-4">
      <PageHeader
        title="跨境情报中心"
        description="TikHub 实时数据 — 热词 / 广告 / 选品 / 爆款视频 / 音乐 / 达人 / AtSign 一站检索"
        icon={<Satellite className="h-6 w-6 text-primary" />}
      />

      <div className="flex gap-1.5 flex-wrap">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all",
              tab === t.id ? "glass-surface text-primary font-medium ring-1 ring-primary/25" : "text-muted-foreground hover:bg-muted")}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {(needKeyword || tab === "creators") && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[220px]">
                <label className="text-caption text-muted-foreground">
                  {tab === "creators" ? "达人 handle（查档案，如 newsnews.69）" : "关键词"}
                </label>
                <Input className="mt-1 h-9" value={kw} onChange={(e) => setKw(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (tab === "creators" ? lookupProfile() : run(tab))}
                  placeholder={tab === "creators" ? "输入 @handle 查询达人档案" : "输入关键词"} />
              </div>
              {(tab === "shop" || tab === "videos") && (
                <div className="w-32">
                  <label className="text-caption text-muted-foreground">地区</label>
                  <select value={region} onChange={(e) => setRegion(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-input bg-background/60 px-2 text-sm">
                    {["US", "GB", "ID", "TH", "VN", "MY", "PH"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              )}
              {tab === "ig" && (
                <div className="w-32">
                  <label className="text-caption text-muted-foreground">排序</label>
                  <select value={feedType} onChange={(e) => setFeedType(e.target.value as "top" | "recent")}
                    className="mt-1 h-9 w-full rounded-lg border border-input bg-background/60 px-2 text-sm">
                    <option value="top">热门</option>
                    <option value="recent">最新</option>
                  </select>
                </div>
              )}
              <Button className="h-9 gap-2" onClick={() => (tab === "creators" ? lookupProfile() : run(tab))} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} 查询
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 热词 */}
      {tab === "trending" && (
        <StateBox loading={loading} warn={warn} empty={!trending.length}>
          <div className="flex flex-wrap gap-2">
            {trending.map((w, i) => (
              <Badge key={w.word + i} variant="outline" className="text-xs py-1.5 px-3 gap-1.5 cursor-pointer hover:bg-primary/10"
                onClick={() => { setKw(w.word); setTab("videos"); }}>
                <Flame className="h-3 w-3 text-price" />{w.word}
                {w.type && <span className="text-muted-foreground">{w.type}</span>}
              </Badge>
            ))}
          </div>
        </StateBox>
      )}

      {/* 广告库 */}
      {tab === "ads" && (
        <StateBox loading={loading} warn={warn} empty={!ads.length}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ads.map((a) => (
              <Card key={a.id} className="overflow-hidden">
                <div className="relative aspect-[9/12] bg-muted">
                  {a.coverUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={a.coverUrl} alt={a.title} loading="lazy" className="h-full w-full object-cover" />
                    : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">无封面</div>}
                  {a.videoUrl && (
                    <a href={a.videoUrl} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30">
                      <PlayCircle className="h-8 w-8 text-white/80" />
                    </a>
                  )}
                  <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-tiny text-white">{dur(a.durationS)}</span>
                </div>
                <CardContent className="p-2.5 space-y-1">
                  <p className="text-caption line-clamp-2 min-h-[2rem]">{a.title || "（无文案）"}</p>
                  <div className="flex justify-between text-tiny text-muted-foreground">
                    <span className="truncate">{a.brand}</span>
                    <span>CTR {typeof a.ctr === "number" ? `${a.ctr.toFixed(1)}%` : "—"} · 赞 {compact(a.likes)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </StateBox>
      )}

      {/* 选品 */}
      {tab === "shop" && (
        <StateBox loading={loading} warn={warn} empty={!products.length}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => (
              <Card key={p.productId} className="overflow-hidden">
                <div className="aspect-square bg-muted">
                  {p.imageUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.imageUrl} alt={p.title} loading="lazy" className="h-full w-full object-cover" />
                    : <div className="flex h-full items-center justify-center"><ShoppingBag className="h-7 w-7 text-muted-foreground" /></div>}
                </div>
                <CardContent className="p-2.5 space-y-1">
                  <p className="text-caption line-clamp-2 min-h-[2rem]">{p.title}</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-semibold text-price">{p.currency}{p.price}</span>
                    {p.originalPrice && p.originalPrice !== p.price && <span className="text-tiny line-through text-muted-foreground">{p.originalPrice}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-tiny text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Star className="h-3 w-3 text-warning" />{p.rating ?? "—"}</span>
                    <span>售 {compact(p.soldCount)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </StateBox>
      )}

      {/* 爆款视频 */}
      {tab === "videos" && (
        <StateBox loading={loading} warn={warn} empty={!videos.length}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <Card key={v.awemeId} className="overflow-hidden">
                <div className="relative aspect-[9/14] bg-muted">
                  {v.coverUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={v.coverUrl} alt={v.desc} loading="lazy" className="h-full w-full object-cover" />
                    : <div className="flex h-full items-center justify-center"><PlayCircle className="h-7 w-7 text-muted-foreground" /></div>}
                  {v.videoUrl && (
                    <a href={v.videoUrl} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30">
                      <PlayCircle className="h-8 w-8 text-white/80" />
                    </a>
                  )}
                  <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-tiny text-white">{dur(v.durationS)}</span>
                </div>
                <CardContent className="p-2.5 space-y-1">
                  <p className="text-caption line-clamp-2 min-h-[2rem]">{v.desc || "（无描述）"}</p>
                  <div className="flex justify-between text-tiny text-muted-foreground">
                    <span className="truncate">@{v.authorHandle || v.author}</span>
                    <span>播 {compact(v.play)} · 赞 {compact(v.likes)}</span>
                  </div>
                  <div className="text-tiny text-muted-foreground">作者粉丝 {compact(v.authorFollowers)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </StateBox>
      )}

      {/* 音乐榜 */}
      {tab === "music" && (
        <StateBox loading={loading} warn={warn} empty={!music.length}>
          <div className="space-y-2">
            {music.map((m) => (
              <Card key={m.musicId}>
                <CardContent className="p-3 flex items-center gap-3">
                  <span className="w-6 text-center text-sm font-bold text-primary">#{m.rank}</span>
                  {m.coverUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={m.coverUrl} alt={m.title} className="h-11 w-11 rounded object-cover" loading="lazy" />
                    : <div className="h-11 w-11 rounded bg-muted flex items-center justify-center"><Music className="h-4 w-4 text-muted-foreground" /></div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.title}</p>
                    <p className="text-caption text-muted-foreground truncate">{m.author} · {dur(m.durationS)} · {m.artists.join("/") || "—"}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs">使用 <b className="metric-value">{compact(m.userCount)}</b></div>
                    {m.trend != null && <div className="text-tiny text-success">趋势 {m.trend}</div>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </StateBox>
      )}

      {/* 达人 */}
      {tab === "creators" && (
        <div className="space-y-4">
          {profile && (
            <Card>
              <CardContent className="p-4 flex items-start gap-4">
                {profile.avatarUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={profile.avatarUrl} alt={profile.nickname ?? ""} className="h-16 w-16 rounded-full object-cover" />
                  : <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center"><Users className="h-6 w-6 text-muted-foreground" /></div>}
                <div className="flex-1 space-y-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{profile.nickname}</span>
                    <span className="text-xs text-muted-foreground">@{profile.uniqueId}</span>
                    {profile.isStar && <Badge className="text-tiny">星图</Badge>}
                    {profile.customVerify && <Badge variant="outline" className="text-tiny">{profile.customVerify}</Badge>}
                  </div>
                  <div className="flex gap-5 text-xs">
                    <span>粉丝 <b className="metric-value">{compact(profile.followers)}</b></span>
                    <span>关注 {compact(profile.following)}</span>
                    <span>作品 <b className="metric-value">{compact(profile.awemeCount)}</b></span>
                    {profile.country && <span>地区 {profile.country}</span>}
                  </div>
                  {profile.signature && <p className="text-xs text-muted-foreground line-clamp-2">{profile.signature}</p>}
                </div>
              </CardContent>
            </Card>
          )}
          <StateBox loading={loading && !insights.length} warn={profile ? null : warn} empty={!insights.length}>
            <p className="text-xs text-muted-foreground mb-2">TikTok 搜索灵感热词（含热度、视频数、7 日趋势，点击可直接去搜爆款视频）</p>
            <div className="grid gap-2 md:grid-cols-2">
              {insights.map((it) => (
                <Card key={it.queryId} className="cursor-pointer hover:ring-1 hover:ring-primary/30"
                  onClick={() => { setKw(it.query); setTab("videos"); }}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{it.query}</p>
                      <div className="flex gap-3 text-tiny text-muted-foreground mt-0.5">
                        <span>热度 {compact(it.popularity)}</span>
                        <span>视频 {compact(it.videoNum)}</span>
                        {it.categoryL1 && <span>{it.categoryL1}</span>}
                      </div>
                    </div>
                    {it.trendSeq.length > 1 && (
                      <Sparkline quiet data={it.trendSeq} width={64} height={22}
                        color={it.trendSeq[it.trendSeq.length - 1] >= it.trendSeq[0] ? "var(--success)" : "var(--destructive)"} />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </StateBox>
        </div>
      )}

      {/* AtSign */}
      {tab === "ig" && (
        <StateBox loading={loading} warn={warn} empty={!igPosts.length}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {igPosts.map((p) => (
              <Card key={p.mediaId} className="overflow-hidden">
                <div className="relative aspect-square bg-muted">
                  {p.thumbnail
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.thumbnail} alt={p.caption} loading="lazy" className="h-full w-full object-cover" />
                    : <div className="flex h-full items-center justify-center"><AtSign className="h-7 w-7 text-muted-foreground" /></div>}
                  {p.isVideo && p.videoUrl && (
                    <a href={p.videoUrl} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30">
                      <PlayCircle className="h-7 w-7 text-white/80" />
                    </a>
                  )}
                </div>
                <CardContent className="p-2.5 space-y-1">
                  <p className="text-caption line-clamp-2 min-h-[2rem]">{p.caption || "（无文案）"}</p>
                  <div className="flex justify-between text-tiny text-muted-foreground">
                    <span className="truncate">@{p.username}{p.verified && " ✓"}</span>
                    <span>❤ {compact(p.likes)} · 💬 {compact(p.comments)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </StateBox>
      )}
    </PageTransition>
  );
}


"use client";

import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  PenLine, Sparkles, Flame, ShieldCheck, Image as ImageIcon,
  CheckCircle2, AlertTriangle, XCircle, Library, Copy, Check, RefreshCw,
  Loader2, ExternalLink, Clock,
} from "lucide-react";
import {
  generateCopy, generateIdeas, generateImages, refreshHotTopics,
  auditDraft, useHotTopics, useWorks,
} from "@/hooks/use-content-studio";
import type {
  AuditResult, ContentIdea, ContentImageResult, ContentPlatform,
  ContentPlatformMeta, ContentWorks, CopyDraft, HotTopicsResult,
} from "@/lib/types";

const CATEGORY_LABELS: Record<string, string> = {
  absolute: "绝对化用语",
  medical: "医疗功效",
  advert: "夸大宣传",
  platform: "平台规范",
  finance: "金融夸大",
  data: "数据无来源",
};

const PLATFORM_LABEL: Record<string, string> = {
  xhs: "小红书",
  wechat: "公众号",
  douyin: "抖音",
};

type Tab = "copy" | "library";

interface ContentStudioClientProps {
  platforms: ContentPlatformMeta[];
  works: ContentWorks;
}

export function ContentStudioClient({ platforms, works: initialWorks }: ContentStudioClientProps) {
  const [tab, setTab] = useState<Tab>("copy");
  const [platform, setPlatform] = useState<ContentPlatform>("xhs");
  const [subject, setSubject] = useState("");
  const [angle, setAngle] = useState("");

  const [ideas, setIdeas] = useState<ContentIdea[] | null>(null);
  const [currentDraft, setCurrentDraft] = useState<CopyDraft | null>(null);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [images, setImages] = useState<ContentImageResult | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hotOverride, setHotOverride] = useState<HotTopicsResult | null>(null);

  const { data: hot } = useHotTopics(platform);
  const { data: liveWorks, refetch: refetchWorks } = useWorks();

  const works = liveWorks ?? initialWorks;
  const activePlatform = platforms.find((p) => p.id === platform) ?? platforms[0];
  const hotData = hotOverride ?? hot;

  // 平台切换：重置与平台强绑定的状态
  const switchPlatform = (p: ContentPlatform) => {
    setPlatform(p);
    setIdeas(null);
    setCurrentDraft(null);
    setAudit(null);
    setImages(null);
    setHotOverride(null);
    setError(null);
  };

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

  const handleGenerate = () => {
    if (!subject.trim()) {
      setError("请先输入产品 / 主题");
      return;
    }
    void run("all", async () => {
      const [ideaRes, draft] = await Promise.all([
        generateIdeas({ platform, subject: subject.trim() }),
        generateCopy({ platform, subject: subject.trim(), angle: angle.trim() || undefined }),
      ]);
      setIdeas(ideaRes);
      setCurrentDraft(draft);
      setAudit(null);
      setImages(null);
      void refetchWorks();
    });
  };

  const handleAudit = () => {
    if (!currentDraft) {
      setError("请先生成文案再审计");
      return;
    }
    void run("audit", async () => {
      setAudit(await auditDraft(currentDraft.id));
    });
  };

  const handleImages = () => {
    if (!currentDraft) {
      setError("请先生成文案再配图");
      return;
    }
    if (!imagePrompt.trim()) {
      setError("请输入画面描述");
      return;
    }
    void run("images", async () => {
      setImages(await generateImages({
        draftId: currentDraft.id, platform, prompt: imagePrompt.trim(), count: 3,
      }));
      void refetchWorks();
    });
  };

  const handleRefreshHot = () => {
    void run("hot", async () => {
      const result = await refreshHotTopics({ platform });
      setHotOverride(result);
    });
  };

  const copyAll = async () => {
    if (!currentDraft) return;
    const text = `${currentDraft.title}\n\n${currentDraft.body}\n\n${currentDraft.tags.map((t) => `#${t}`).join(" ")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-7">
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">内容创作中心</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            多平台文案创作：思路设计 · 抓取热点 · 生成文案 · 规则审计 · AI 配图
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setTab("library")} className={cn(tab === "library" && "text-primary")}>
            <Library className="h-4 w-4" /> 成果库
          </Button>
          <Button size="sm" onClick={() => setTab("copy")}>
            <PenLine className="h-4 w-4" /> 新建文案
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {tab === "copy" ? (
        <>
          {/* 头部：平台选择 + 主题输入 + 一键生成 */}
          <Card className="mb-4">
            <CardContent className="pt-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted-foreground">平台</span>
                {platforms.map((p) => (
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
                    <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                    {p.label}
                  </button>
                ))}
                <span className="ml-auto text-xs text-muted-foreground">{activePlatform?.hint}</span>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  placeholder="输入产品 / 主题，例如：车载保温杯，316 不锈钢，一键开盖防漏…"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                />
                <Input
                  className="sm:w-56"
                  placeholder="选题角度（可选）"
                  value={angle}
                  onChange={(e) => setAngle(e.target.value)}
                />
                <Button size="sm" onClick={handleGenerate} disabled={busy !== null} className="shrink-0">
                  {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  一键生成
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 思路设计 */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> 思路设计
              </CardTitle>
              <CardDescription>
                AI 选题灵感{subject ? ` · 「${subject}」` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ideas && ideas.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {ideas.map((idea) => (
                    <div key={idea.id} className="rounded-xl border p-4 transition-colors hover:border-primary/40">
                      <div className="text-[11px] font-semibold text-primary">{idea.angle}</div>
                      <div className="mt-1.5 text-sm font-medium leading-snug">{idea.title}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {busy === "all" ? "生成中…" : "在上方输入产品 / 主题后点击「一键生成」，这里会给出选题思路。"}
                </p>
              )}
            </CardContent>
          </Card>

          {/* 热点雷达 */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Flame className="h-4 w-4 text-primary" /> 热点雷达
                  </CardTitle>
                  <CardDescription className="hidden sm:block">
                    {hotData?.source && hotData.source !== "cache" ? `平台趋势热词 · 源 /${hotData.source}` : "平台趋势热词"}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleRefreshHot} disabled={busy !== null}>
                  {busy === "hot" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  刷新
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {hotData?.degraded && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {hotData.warning ?? "热榜 API 不可达，展示种子数据"}
                </div>
              )}
              {hotData && hotData.topics.length > 0 ? (
                <div className="flex flex-wrap gap-2.5">
                  {hotData.topics.map((h) => (
                    <a
                      key={h.word}
                      href={h.url || undefined}
                      target={h.url ? "_blank" : undefined}
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:border-primary/40 transition-colors"
                    >
                      {h.word}
                      <span className="font-mono text-xs font-semibold text-primary">{h.heat}</span>
                      {h.delta !== null && h.delta !== undefined && (
                        <span className={cn("font-mono text-[11px]", h.delta >= 0 ? "text-emerald-500" : "text-muted-foreground")}>
                          {h.delta >= 0 ? "▲" : "▽"}{Math.abs(h.delta)}
                        </span>
                      )}
                      {h.url && <ExternalLink className="h-3 w-3 text-muted-foreground/40" />}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无热点数据，点击「刷新」抓取。</p>
              )}
            </CardContent>
          </Card>

          {/* 生成文案 */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <PenLine className="h-4 w-4 text-primary" /> 生成文案
                </CardTitle>
                <Button variant="outline" size="sm" onClick={copyAll} disabled={!currentDraft}>
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "已复制" : "复制全部"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {currentDraft ? (
                <>
                  <h2 className="font-heading text-lg font-bold leading-snug">{currentDraft.title}</h2>
                  <p className="mt-3 text-sm leading-7 whitespace-pre-wrap">{currentDraft.body}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {currentDraft.tags.map((t) => (
                      <span key={t} className="text-sm text-info">#{t}</span>
                    ))}
                  </div>
                  {currentDraft.auditResult && currentDraft.auditResult.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      已审计 · {currentDraft.auditResult.filter((f) => f.severity === "error").length} 处风险
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">点击「一键生成」后，这里展示平台化文案（标题 + 正文 + 标签）。</p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {/* 平台规则审计 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" /> 平台规则审计
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={handleAudit} disabled={busy !== null || !currentDraft}>
                    {busy === "audit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    开始审计
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!audit ? (
                  <p className="text-xs text-muted-foreground">
                    规则库扫描（广告法 + {activePlatform?.label} 平台规范）+ AI 复核。先「一键生成」文案。
                  </p>
                ) : audit.findings.length === 0 ? (
                  <div className="flex items-start gap-2.5 text-sm text-emerald-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <div className="font-medium">未检出违规项，可通过</div>
                      <div className="text-xs text-muted-foreground">
                        {audit.llmReviewed ? "规则扫描 + AI 复核均通过" : "规则扫描通过（AI 复核未完成）"}
                      </div>
                    </div>
                  </div>
                ) : (
                  audit.findings.map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm">
                      {f.severity === "error"
                        ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                      <div>
                        <div className="font-medium">
                          {CATEGORY_LABELS[f.category] ?? f.category}
                          {f.matchedText && <span className="text-muted-foreground"> · 「{f.matchedText}」</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{f.message}</div>
                        <div className="text-xs text-muted-foreground/80">{f.suggestion}</div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* AI 配图 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" /> AI 配图
                </CardTitle>
                <CardDescription>调用云生图 · {activePlatform?.hint}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="画面描述，如：通勤场景 · 暖色调"
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleImages()}
                  />
                  <Button size="sm" onClick={handleImages} disabled={busy !== null}>
                    {busy === "images" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    生成
                  </Button>
                </div>
                {images ? (
                  <div className={cn("mt-3 grid gap-3", images.images.length > 1 ? "grid-cols-3" : "grid-cols-1")}>
                    {images.images.map((img) => (
                      <a
                        key={img.index}
                        href={img.url}
                        target="_blank"
                        rel="noreferrer"
                        className="relative block aspect-[3/4] overflow-hidden rounded-xl border bg-muted"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={`配图 ${img.index}`} className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    生成后图片会挂接当前文案草稿，按平台比例输出。
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <LibraryView works={works} onSelect={(d) => { setCurrentDraft(d); setPlatform(d.platform); setTab("copy"); }} />
      )}
    </div>
  );
}

function LibraryView({ works, onSelect }: { works: ContentWorks; onSelect: (d: CopyDraft) => void }) {
  const { drafts, videos } = works;
  const [filter, setFilter] = useState<string>("all");

  const items = useMemo(() => {
    if (filter === "all") return drafts;
    return drafts.filter((d) => d.platform === filter);
  }, [drafts, filter]);

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Library className="h-4 w-4 text-primary" /> 最近成果
        </CardTitle>
        <CardDescription>文案草稿与本地化视频 · 跨模块复用</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-wrap gap-2 border-b px-4 py-3">
          {(["all", "xhs", "wechat", "douyin"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                filter === f ? "border-border bg-card shadow-sm" : "border-transparent text-muted-foreground",
              )}
            >
              {f === "all" ? "全部" : PLATFORM_LABEL[f]}
            </button>
          ))}
        </div>
        <div className="divide-y">
          {items.length === 0 && videos.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">暂无成果，去「新建文案」生成第一条吧。</p>
          )}
          {items.map((d) => (
            <button
              key={d.id}
              onClick={() => onSelect(d)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
            >
              <div
                className="h-10 w-10 shrink-0 rounded-lg"
                style={{ background: d.auditPassed ? "linear-gradient(160deg,#cfe8d8,#7fbfa5)" : "linear-gradient(160deg,#f4e3c4,#e0a06a)" }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{d.title}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{PLATFORM_LABEL[d.platform]}</span> · {d.body.length} 字
                  {d.imageCount > 0 && <span>· {d.imageCount} 图</span>}
                </div>
              </div>
              <Badge variant={d.auditPassed ? "success" : "secondary"}>
                {d.auditPassed ? "已过审" : d.auditResult ? "待整改" : "未审计"}
              </Badge>
            </button>
          ))}
          {videos.map((v) => (
            <div key={v.id} className="flex items-center gap-3 px-4 py-3">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-gradient-to-br from-info/20 to-info/5" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{v.videoPath.split("/").pop()}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> 本地化视频 · {v.targetLang}
                </div>
              </div>
              <Badge variant="success">已导出</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

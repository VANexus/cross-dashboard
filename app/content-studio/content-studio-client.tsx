"use client";

/**
 * 内容创作中心 — 4 步工作流 stepper（J1 内容发布旅程的宿主页）
 *
 * ① 洞察（热点雷达第一屏 + 平台/主题输入）→ ② 创作（思路 + 文案）
 * → ③ 审计 + 配图 → ④ 发布（公众号发布工作台入口）
 *
 * 旅程接入：URL 带 ?journey=content-publish&step=n 时顶部出现 JourneyBar，
 * Agent 可经 data-agent-action="journey-next" 推进步骤。
 */
import { PageHeader } from "@/components/ui/page-header";
import { useCallback, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAgentPage } from "@/lib/agent/page-context";
import { JourneyBar } from "@/components/journey/journey-bar";
import { WorkflowStepper, type StepItem } from "@/components/ui/workflow-stepper";
import {
  PenLine, Sparkles, Flame, ShieldCheck, Image as ImageIcon,
  CheckCircle2, AlertTriangle, XCircle, Library, Copy, Check, RefreshCw,
  Loader2, ExternalLink, Clock, Send, ArrowRight, Download,
} from "lucide-react";
import {
  generateCopy, generateIdeas, generateImages,
  auditDraft, useWorks, useHotBoards,
} from "@/hooks/use-content-studio";
import type {
  AuditResult, ContentIdea, ContentImageResult, ContentPlatform,
  ContentPlatformMeta, ContentWorks, CopyDraft,
} from "@/lib/types";
import {
  HOT_BOARD_LABELS, HOT_BOARD_ORDER,
  type HotBoardType, type HotEngineResult, type TopicCard,
} from "@/lib/content/hot-engine";

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
type PageStep = "insight" | "create" | "audit" | "publish";

const STEP_ORDER: PageStep[] = ["insight", "create", "audit", "publish"];
const STEP_META: Record<PageStep, { label: string; description: string }> = {
  insight: { label: "洞察趋势", description: "热点雷达锁定选题方向" },
  create: { label: "选题创作", description: "AI 生成思路与平台化文案" },
  audit: { label: "审计配图", description: "平台规则审计 + AI 配图" },
  publish: { label: "发布", description: "公众号端到端发布" },
};

function readInitialStep(params: URLSearchParams | null): PageStep {
  const n = Number(params?.get("step") ?? "1");
  return STEP_ORDER[Math.min(Math.max(n, 1), STEP_ORDER.length) - 1];
}

function ContentStudioInner({ platforms, works: initialWorks }: ContentStudioClientProps) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("copy");
  // 步骤 = URL ?step=n 派生 + 本地覆盖。
  // 同路由下 ?step=2→3 的客户端导航不会重挂载组件，故不能只在初始化时读 URL：
  // 覆盖值绑定当时的 stepParam，URL 一变即失效回落到 URL 派生值。
  const stepParam = searchParams.get("step") ?? "1";
  const urlStep = readInitialStep(searchParams);
  const [stepOverride, setStepOverride] = useState<{ param: string; step: PageStep } | null>(null);
  const step = stepOverride && stepOverride.param === stepParam ? stepOverride.step : urlStep;
  const setStep = (s: PageStep) => setStepOverride({ param: stepParam, step: s });
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

  // 热榜引擎（多榜）
  const [categories, setCategories] = useState("");
  const [boardTab, setBoardTab] = useState<HotBoardType>("general");
  const [tagPreset, setTagPreset] = useState<string[]>([]);
  const cats = useMemo(
    () => categories.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
    [categories],
  );
  const { data: hotEngine, refetch: refetchHotBoards } = useHotBoards(platform, cats);

  const { data: liveWorks, refetch: refetchWorks } = useWorks();

  const works = liveWorks ?? initialWorks;
  const activePlatform = platforms.find((p) => p.id === platform) ?? platforms[0];

  // 平台切换：重置与平台强绑定的状态
  const switchPlatform = (p: ContentPlatform) => {
    setPlatform(p);
    setIdeas(null);
    setCurrentDraft(null);
    setAudit(null);
    setImages(null);
    setBoardTab("general");
    setCategories("");
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
        generateCopy({
          platform, subject: subject.trim(), angle: angle.trim() || undefined,
          keywords: tagPreset.length ? tagPreset : undefined,
        }),
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

  const handleRefreshHotBoards = () => {
    void run("hotBoards", async () => {
      await refetchHotBoards();
    });
  };

  const selectTopic = (card: TopicCard) => {
    // 从选题卡自动预填主题 + 标签 + 角度，并进入创作步
    setSubject(card.topic);
    if (card.tags.length > 0) setTagPreset(card.tags);
    if (card.angleSuggestion) setAngle(card.angleSuggestion);
    setStep("create");
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

  const copyTitle = async () => {
    if (!currentDraft) return;
    try {
      await navigator.clipboard.writeText(currentDraft.title);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  };

  const copyBody = async () => {
    if (!currentDraft) return;
    const text = `${currentDraft.body}\n\n${currentDraft.tags.map((t) => `#${t}`).join(" ")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  };

  /** 打包下载配图：逐张真实下载（不依赖 zip 库，标注为打包下载） */
  const downloadImages = () => {
    if (!images || images.images.length === 0) return;
    void run("download", async () => {
      for (const img of images.images) {
        try {
          const resp = await fetch(img.url);
          if (!resp.ok) continue;
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `xhs-${(currentDraft?.title ?? "note").slice(0, 12).replace(/[\\/:*?"<>|]/g, "")}-${img.index + 1}.jpg`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        } catch { /* 单张下载失败跳过 */ }
      }
    });
  };

  // 「前端即 Agent」一行接入：注册本页上下文快照 + 可被 agent 调用的页面动作
  useAgentPage({
    title: "内容创作中心",
    snapshot: () =>
      `平台=${PLATFORM_LABEL[platform]} · 当前第 ${STEP_ORDER.indexOf(step) + 1}/4 步（${STEP_META[step].label}） · ` +
      `主题「${subject || "未输入"}」 · ` +
      (currentDraft
        ? `文案已生成《${currentDraft.title}》（${currentDraft.body.length} 字 · ${currentDraft.tags.length} 个标签）`
        : "文案未生成") +
      ` · 审计${audit ? `已出（${audit.findings.length} 项发现）` : "未跑"}` +
      ` · 配图${images ? `已出 ${images.images.length} 张` : "未生成"}`,
    state: () => ({ platform, tab, step, subject, hasDraft: Boolean(currentDraft) }),
    actions: [
      {
        id: "oneKeyGenerate",
        description: "填入产品 / 主题并一键生成选题思路 + 平台文案（如 subject=车载保温杯 316 不锈钢），完成后停在创作步",
        schema: z.object({ subject: z.string().min(1).describe("产品 / 主题") }),
        execute: async (p) => {
          const s = String(p.subject ?? "").trim();
          if (!s) return "主题不能为空";
          setTab("copy");
          setStep("create");
          setSubject(s);
          try {
            const [ideaRes, draft] = await Promise.all([
              generateIdeas({ platform, subject: s }),
              generateCopy({ platform, subject: s, angle: angle.trim() || undefined }),
            ]);
            setIdeas(ideaRes);
            setCurrentDraft(draft);
            setAudit(null);
            setImages(null);
            void refetchWorks();
            return `已为「${s}」生成 ${ideaRes.length} 条思路与文案《${draft.title}》（${draft.body.length} 字），已展示在创作步`;
          } catch (err) {
            const msg = err instanceof Error ? err.message : "生成失败";
            setError(msg);
            throw err;
          }
        },
      },
    ],
  });

  const stepIdx = STEP_ORDER.indexOf(step);
  const stepperItems: StepItem[] = STEP_ORDER.map((s, i) => ({
    id: s,
    label: STEP_META[s].label,
    description: STEP_META[s].description,
    status: i < stepIdx ? "completed" : i === stepIdx ? "active" : "pending",
  }));

  // 洞察步「去创作」：有主题且未生成时顺带触发生成
  const goCreate = () => {
    setStep("create");
    if (subject.trim() && !currentDraft && busy === null) handleGenerate();
  };

  const wechatPublishHref = useMemo(() => {
    const q = new URLSearchParams();
    if (currentDraft) q.set("draft", currentDraft.id);
    const j = searchParams.get("journey");
    if (j) q.set("journey", j);
    if (j) q.set("step", "4");
    const qs = q.toString();
    return `/content-studio/wechat${qs ? `?${qs}` : ""}`;
  }, [currentDraft, searchParams]);

  return (
    <div>
      <JourneyBar />

      <PageHeader
        className="mb-5"
        breadcrumb={<><span>内容工坊</span> / <b>内容创作中心</b></>}
        title="内容创作中心"
        description="洞察 → 创作 → 审计配图 → 发布，一条流水线走完内容生产"
        actions={<div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setTab("library")} className={cn(tab === "library" && "text-primary")}>
            <Library className="h-4 w-4" /> 成果库
          </Button>
          <Button size="sm" onClick={() => setTab("copy")}>
            <PenLine className="h-4 w-4" /> 新建文案
          </Button>
        </div>}
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {tab === "library" ? (
        <LibraryView works={works} onSelect={(d) => { setCurrentDraft(d); setPlatform(d.platform); setTab("copy"); setStep("audit"); }} />
      ) : (
        <>
          {/* 4 步 stepper（横向，Linear 式紧凑） */}
          <Card className="mb-4 py-0">
            <CardContent className="px-4 py-3">
              <WorkflowStepper
                steps={stepperItems}
                currentStep={step}
                orientation="horizontal"
                onStepClick={(id) => {
                  setTab("copy");
                  setStep(id as PageStep);
                }}
              />
            </CardContent>
          </Card>

          {/* ── 第 1 步 · 洞察（热点雷达第一屏）── */}
          {step === "insight" && (
            <>
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
                      onKeyDown={(e) => e.key === "Enter" && goCreate()}
                    />
                    <Input
                      className="sm:w-56"
                      placeholder="选题角度（可选）"
                      value={angle}
                      onChange={(e) => setAngle(e.target.value)}
                    />
                    <Button size="sm" onClick={goCreate} className="shrink-0" data-agent-action="studio-goto-create">
                      {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      生成创作 <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 热榜引擎 · 选题雷达（多榜专门处理逻辑） */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Flame className="h-4 w-4 text-primary" /> 热榜引擎 · 选题雷达
                    </CardTitle>
                    <CardDescription className="hidden sm:block">
                      综合/垂类/话题/灵感多榜归一化 · 打分排序（PRD §3）
                    </CardDescription>
                    <div className="ml-auto flex items-center gap-2">
                      <Input
                        className="h-8 w-44 text-xs"
                        placeholder="品类偏好，如 美妆,穿搭"
                        value={categories}
                        onChange={(e) => setCategories(e.target.value)}
                      />
                      <Button variant="outline" size="sm" onClick={handleRefreshHotBoards} disabled={busy !== null} data-agent-action="hot-boards-refresh">
                        {busy === "hotBoards" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        刷新
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {hotEngine?.degraded && (
                    <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {hotEngine.warning ?? "全部热榜源不可达，暂无真实热点；可手工输入主题创作"}
                    </div>
                  )}

                  {/* 榜型 Tab */}
                  <div className="flex flex-wrap gap-1.5">
                    {HOT_BOARD_ORDER.map((b) => {
                      const board = hotEngine?.boards.find((x) => x.id === b);
                      const down = board?.degraded;
                      return (
                        <button
                          key={b}
                          onClick={() => setBoardTab(b)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            boardTab === b ? "border-border bg-card shadow-sm" : "border-transparent text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {HOT_BOARD_LABELS[b]}
                          {down && <span className="text-warning">·不可用</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* 当前榜内容 */}
                  {(() => {
                    const board = hotEngine?.boards.find((x) => x.id === boardTab);
                    if (!board || board.degraded) {
                      return (
                        <p className="text-sm text-muted-foreground">
                          {board?.warning ?? "该榜数据暂不可用，可切换其他榜型或刷新重试。"}
                        </p>
                      );
                    }
                    if (board.topics.length === 0) {
                      return <p className="text-sm text-muted-foreground">该榜暂无热点数据。</p>;
                    }
                    return (
                      <div className="flex flex-wrap gap-2">
                        {board.topics.slice(0, 20).map((h) => (
                          <a
                            key={`${h.board}-${h.rank}-${h.title}`}
                            href={h.url || undefined}
                            target={h.url ? "_blank" : undefined}
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:border-primary/40 transition-colors"
                          >
                            <span className="font-mono text-xs text-muted-foreground">#{h.rank}</span>
                            {h.title}
                            <span className="font-mono text-xs font-semibold text-primary">{h.heat}</span>
                            {h.url && <ExternalLink className="h-3 w-3 text-muted-foreground/40" />}
                          </a>
                        ))}
                      </div>
                    );
                  })()}

                  {/* 选题卡（聚合去重 + 打分排序） */}
                  {hotEngine && hotEngine.cards.length > 0 && (
                    <div className="border-t pt-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5" /> 选题卡（综合分排序 · 点击预填创作）
                        {cats.length > 0 && <span className="text-primary">品类命中已加权</span>}
                      </div>
                      <div className="grid gap-2.5 md:grid-cols-2">
                        {hotEngine.cards.slice(0, 10).map((c) => (
                          <button
                            key={c.topic}
                            onClick={() => selectTopic(c)}
                            className="rounded-xl border p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-medium leading-snug">{c.topic}</span>
                              <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-bold text-primary">
                                {c.score.total}
                              </span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {c.hitBoards.map((b) => (
                                <span key={b} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                  {HOT_BOARD_LABELS[b]}
                                </span>
                              ))}
                              <span className={cn(
                                "rounded px-1.5 py-0.5 text-[10px]",
                                c.competition === "high" ? "bg-warning/15 text-warning"
                                  : c.competition === "medium" ? "bg-muted text-muted-foreground" : "bg-success/15 text-success",
                              )}>
                                {c.competition === "high" ? "竞争高" : c.competition === "medium" ? "竞争中" : "竞争低"}
                              </span>
                              <span className={cn(
                                "rounded px-1.5 py-0.5 text-[10px]",
                                c.freshness === "fresh" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                              )}>
                                {c.freshness === "fresh" ? "新上榜" : c.freshness === "day" ? "24h内" : "较早"}
                              </span>
                            </div>
                            <div className="mt-1.5 text-xs text-muted-foreground">
                              <span className="font-mono text-[10px]">
                                名次 {c.bestRank} · 热度 {c.bestHeat} · 命中 {c.hitBoards.length} 榜
                              </span>
                              {c.angleSuggestion && (
                                <div className="mt-0.5 truncate text-[11px]">角度建议：{c.angleSuggestion}</div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {hotEngine && hotEngine.cards.length === 0 && !hotEngine.degraded && (
                    <p className="text-sm text-muted-foreground">暂无选题卡——刷新热榜或检查品类偏好。</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* ── 第 2 步 · 创作 ── */}
          {step === "create" && (
            <>
              <Card className="mb-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> 思路设计
                  </CardTitle>
                  <CardDescription>
                    AI 选题灵感{subject ? ` · 「${subject}」` : ""}
                  </CardDescription>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Input
                      className="h-8 text-sm"
                      placeholder="输入产品 / 主题"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                    />
                    <Button size="sm" onClick={handleGenerate} disabled={busy !== null} className="shrink-0" data-agent-action="studio-generate">
                      {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      一键生成
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {ideas && ideas.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-3">
                      {ideas.map((idea) => (
                        <div key={idea.id} className="rounded-xl border p-4 transition-colors hover:border-primary/40">
                          <div className="text-caption font-semibold text-primary">{idea.angle}</div>
                          <div className="mt-1.5 text-sm font-medium leading-snug">{idea.title}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {busy === "all" ? "生成中…" : "输入产品 / 主题后点击「一键生成」，这里会给出选题思路。"}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="mb-4">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <PenLine className="h-4 w-4 text-primary" /> 生成文案
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={copyAll} disabled={!currentDraft}>
                      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
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

              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setStep("audit")} disabled={!currentDraft} data-agent-action="studio-goto-audit">
                  下一步 · 审计与配图 <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </>
          )}

          {/* ── 第 3 步 · 审计 + 配图 ── */}
          {step === "audit" && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {/* 平台规则审计 */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-success" /> 平台规则审计
                      </CardTitle>
                      <Button variant="outline" size="sm" onClick={handleAudit} disabled={busy !== null || !currentDraft} data-agent-action="studio-audit">
                        {busy === "audit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        开始审计
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!audit ? (
                      <p className="text-xs text-muted-foreground">
                        规则库扫描（广告法 + {activePlatform?.label} 平台规范）+ AI 复核。先在创作步生成文案。
                      </p>
                    ) : audit.findings.length === 0 ? (
                      <div className="flex items-start gap-2.5 text-sm text-success">
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
                            : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />}
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
                      <Button size="sm" onClick={handleImages} disabled={busy !== null} data-agent-action="image-generate">
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
              <div className="mt-4 flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setStep("publish")} disabled={!currentDraft} data-agent-action="studio-goto-publish">
                  下一步 · 发布 <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </>
          )}

          {/* ── 第 4 步 · 发布 ── */}
          {step === "publish" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" /> 发布
                </CardTitle>
                <CardDescription>公众号端到端发布：AI 排版 → 人工确认 → 发布 / 群发</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentDraft ? (
                  <div className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{PLATFORM_LABEL[currentDraft.platform] ?? currentDraft.platform}</Badge>
                      <span className="text-sm font-medium">{currentDraft.title}</span>
                      <span className="text-xs text-muted-foreground">{currentDraft.body.length} 字</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{currentDraft.body}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">还没有草稿——回创作步生成文案后，可在这里直接进入发布工作台。</p>
                )}
                {platform === "wechat" || currentDraft?.platform === "wechat" ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button asChild size="sm" data-agent-action="studio-open-wechat">
                      <Link href={wechatPublishHref}>
                        打开公众号发布工作台 <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      选稿 → AI 排版 → 发布设置 → 人工确认 → 发布/群发，草稿会自动带上
                    </span>
                  </div>
                ) : platform === "xhs" || currentDraft?.platform === "xhs" ? (
                  /* xhs 发布就绪卡：一键复制 + 配图打包下载（真实能力边界内最完整的发布闭环） */
                  <div className="space-y-3 rounded-xl border border-success/20 bg-success/5 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span className="text-sm font-medium">发布就绪卡</span>
                      <span className="text-xs text-muted-foreground">
                        小红书暂无站内发布通道，一键复制后到小红书 App 粘贴发布
                      </span>
                    </div>
                    {currentDraft && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={copyAll} disabled={!currentDraft} data-agent-action="xhs-copy-all">
                            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                            {copied ? "已复制" : "复制完整笔记"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={copyTitle} disabled={!currentDraft}>复制标题</Button>
                          <Button size="sm" variant="outline" onClick={copyBody} disabled={!currentDraft}>复制正文+话题</Button>
                          {images && images.images.length > 0 && (
                            <Button size="sm" variant="outline" onClick={downloadImages} disabled={busy === "download"}>
                              {busy === "download" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                              打包下载配图（{images.images.length} 张）
                            </Button>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{currentDraft.title}</span>
                          <span> · {currentDraft.body.length} 字 · {currentDraft.tags.length} 个话题</span>
                          {currentDraft.tags.length > 0 && (
                            <span className="block">{currentDraft.tags.map((t) => `#${t}`).join(" ")}</span>
                          )}
                        </div>
                        {images && images.images.length > 0 && (
                          <div className="flex gap-2">
                            {images.images.map((img) => (
                              <div key={img.index} className="h-16 w-12 overflow-hidden rounded border bg-muted">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img.url} alt={`配图 ${img.index}`} className="h-full w-full object-cover" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm" variant="outline" onClick={copyAll} disabled={!currentDraft}>
                      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "已复制" : "复制文案"}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {PLATFORM_LABEL[platform]}暂无站内发布通道，复制文案后到平台 App 发布
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

interface ContentStudioClientProps {
  platforms: ContentPlatformMeta[];
  works: ContentWorks;
}

export function ContentStudioClient(props: ContentStudioClientProps) {
  // useSearchParams 需要 Suspense 边界（页面已在 page.tsx 里包裹）
  return (
    <Suspense fallback={null}>
      <ContentStudioInner {...props} />
    </Suspense>
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
                style={{ background: d.auditPassed ? "var(--gradient-success)" : "var(--gradient-warning)" }}
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

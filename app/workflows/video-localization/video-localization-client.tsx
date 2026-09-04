"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useState, useEffect, useCallback } from "react";
import { PageTransition } from "@/components/ui/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WorkflowStepper, type StepItem } from "@/components/ui/workflow-stepper";
import { cn } from "@/lib/utils";
import { apiGet } from "@/hooks/use-fetch";
import {
  useLocalizeHealth,
  useLocalizeTasks,
  submitLocalizeBatch,
  cancelLocalizeTask,
  retryLocalizeTask,
} from "@/hooks/use-video-localization";
import type { LocalizeTask, LocalizeHealth, LocalizeBatchReport } from "@/lib/shared/types";
import {
  Clapperboard,
  RefreshCw,
  Send,
  X,
  Download,
  RotateCcw,
  Ban,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Server,
  Clock,
  FileVideo,
  Languages,
  Volume2,
  Eraser,
} from "lucide-react";

const statusMeta: Record<string, { label: string; color: string; bg: string; border: string }> = {
  queued: { label: "排队中", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
  running: { label: "处理中", color: "text-info", bg: "bg-info/10", border: "border-info/20" },
  retrying: { label: "重试中", color: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
  completed: { label: "已完成", color: "text-success", bg: "bg-success/10", border: "border-success/20" },
  failed: { label: "失败", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
  cancelled: { label: "已取消", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
  not_found: { label: "未找到", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
  unknown: { label: "未知", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
};

const langLabels: Record<string, string> = {
  zh: "中文", en: "英语", th: "泰语", ja: "日语", ko: "韩语",
  es: "西班牙语", fr: "法语", de: "德语", ru: "俄语",
};

const TARGET_LANGS = ["en", "th", "ja", "ko", "es", "fr", "de", "ru"];

function buildSteps(task: LocalizeTask | null): StepItem[] {
  const base = [
    { id: "asr", label: "ASR 识别", description: "Paraformer 句级时间戳" },
    { id: "ocr", label: "OCR 定位", description: "定位原字幕区域" },
    { id: "translate", label: "翻译", description: "LongCat 目标语言" },
    { id: "erase", label: "擦除重绘", description: "擦除原字幕 + 烧录译文" },
    { id: "tts", label: "TTS 配音", description: "克隆音色逐句配音" },
  ];
  if (!task) return base.map((s) => ({ ...s, status: "pending" as const }));
  switch (task.status) {
    case "completed":
      return base.map((s) => ({ ...s, status: "completed" as const }));
    case "running":
      return base.map((s, i) => ({ ...s, status: (i < 1 ? "completed" : i === 1 ? "active" : "pending") as "completed" | "active" | "pending" }));
    case "retrying":
      return base.map((s, i) => ({ ...s, status: (i < 2 ? "completed" : i === 2 ? "active" : "pending") as "completed" | "active" | "pending" }));
    case "failed":
      return base.map((s, i) => ({ ...s, status: (i === 2 ? "error" : i < 2 ? "completed" : "pending") as "completed" | "active" | "pending" | "error" }));
    default:
      return base.map((s) => ({ ...s, status: "pending" as const }));
  }
}

function currentStepOf(task: LocalizeTask | null): string {
  if (!task) return "asr";
  switch (task.status) {
    case "completed": return "tts";
    case "running": return "ocr";
    case "retrying": return "translate";
    case "failed": return "translate";
    default: return "asr";
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m${s}s`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  // naive 时间戳（无时区后缀）按本地时间解析，避免被当作 UTC 偏移显示
  const d = new Date(iso.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export interface VideoLocalizationClientProps {
  initialTasks: LocalizeTask[];
  initialHealth: LocalizeHealth;
}

export function VideoLocalizationClient({ initialTasks, initialHealth }: VideoLocalizationClientProps) {
  const tasksHook = useLocalizeTasks();
  const healthHook = useLocalizeHealth();
  const tasks = tasksHook.data ?? initialTasks;
  const health = healthHook.data ?? initialHealth;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pathsText, setPathsText] = useState("");
  const [targetLang, setTargetLang] = useState("en");
  const [enableTts, setEnableTts] = useState(true);
  const [removeSubtitles, setRemoveSubtitles] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitResult, setSubmitResult] = useState<LocalizeBatchReport | null>(null);
  const [actionMsg, setActionMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  const refresh = useCallback(() => {
    tasksHook.refetch();
    healthHook.refetch();
  }, [tasksHook, healthHook]);

  // 5s 自动轮询
  useEffect(() => {
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const selectedTask = tasks.find((t) => t.id === selectedId) ?? null;

  const handleSubmit = async () => {
    const paths = pathsText.split("\n").map((p) => p.trim()).filter(Boolean);
    if (paths.length === 0) {
      setFormError("请至少输入一条视频路径或 URL");
      return;
    }
    setFormError("");
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const report = await submitLocalizeBatch({
        videoPaths: paths,
        targetLang,
        enableTts,
        removeSubtitles,
      });
      setSubmitResult(report);
      if (report.jobIds.length > 0) {
        setPathsText("");
        refresh();
      }
    } catch (err) {
      setSubmitResult({
        batchId: "", batchIds: [], jobIds: [], submittedCount: 0, rejectedCount: 0,
        rejectedPaths: [], costBand: "低", ttsRecommended: enableTts, batchSizeWarning: false,
        apiMessage: "提交失败", failureCategory: "unknown", retriable: false,
        warning: err instanceof Error ? err.message : "提交失败",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const res = await cancelLocalizeTask(id);
      setActionMsg({ id, text: res.message, ok: res.cancelled });
    } catch (err) {
      setActionMsg({ id, text: err instanceof Error ? err.message : "取消失败", ok: false });
    }
    refresh();
  };

  const handleRetry = async (id: string) => {
    try {
      const res = await retryLocalizeTask(id);
      setActionMsg({ id, text: res.newTaskId ? `已重提 → ${res.newTaskId}` : (res.message ?? "重提失败"), ok: !!res.newTaskId });
    } catch (err) {
      setActionMsg({ id, text: err instanceof Error ? err.message : "重提失败", ok: false });
    }
    refresh();
  };

  const handleDownload = async (id: string, filename: string) => {
    try {
      const res = await apiGet<{ url: string }>(
        `/api/workflows/video-localization/tasks/${encodeURIComponent(id)}/download?file=${encodeURIComponent(filename)}`
      );
      window.open(res.url, "_blank");
    } catch (err) {
      setActionMsg({ id, text: err instanceof Error ? err.message : "获取下载链接失败", ok: false });
    }
  };

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const runningCount = tasks.filter((t) => t.status === "running" || t.status === "retrying").length;
  const failedCount = tasks.filter((t) => t.status === "failed").length;

  return (
    <PageTransition className="space-y-4">
      <PageHeader
        title="视频本地化"
        description="ASR → OCR 定位 → 翻译 → 擦除重绘 → TTS 配音 — 全云端流水线"
        icon={<Clapperboard className="h-6 w-6 text-[var(--wf-localize)]" />}
      />

      {!health.ok && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            video-localizer 后端不可达（{health.error ?? "unknown"}，{health.apiBase}）。当前展示本地缓存任务，提交/取消/重试等实时操作不可用。
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {/* 批量提交 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">批量提交</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">视频路径或 URL（每行一条，支持 .mp4）</label>
                <textarea
                  value={pathsText}
                  onChange={(e) => setPathsText(e.target.value)}
                  placeholder={"https://cdn.example.com/videos/car-launch-zh.mp4\n/opt/videos/product-demo.mp4"}
                  className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
                {formError && <p className="mt-1 text-xs text-destructive">{formError}</p>}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Languages className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">目标语言</span>
                  <Select value={targetLang} onValueChange={setTargetLang}>
                    <SelectTrigger className="h-8 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TARGET_LANGS.map((l) => (
                        <SelectItem key={l} value={l}>{langLabels[l] ?? l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">TTS 配音</span>
                  <Switch checked={enableTts} onCheckedChange={setEnableTts} />
                </div>
                <div className="flex items-center gap-2">
                  <Eraser className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">擦除原字幕</span>
                  <Switch checked={removeSubtitles} onCheckedChange={setRemoveSubtitles} />
                </div>
                <Button
                  size="sm"
                  className="ml-auto gap-1.5 h-8 text-xs bg-[var(--wf-localize)] hover:bg-[var(--wf-localize)]/90"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {submitting ? "提交中..." : "提交批量任务"}
                </Button>
              </div>

              {submitResult && (
                <div className={cn(
                  "p-3 rounded-lg border text-xs space-y-1.5",
                  submitResult.failureCategory ? "border-destructive/30 bg-destructive/5" : "border-success/30 bg-success/5"
                )}>
                  {submitResult.failureCategory ? (
                    <>
                      <p className="flex items-center gap-1.5 text-destructive font-medium">
                        <AlertTriangle className="h-3.5 w-3.5" /> 提交失败（{submitResult.failureCategory}）
                      </p>
                      {submitResult.warning && <p className="text-muted-foreground">{submitResult.warning}</p>}
                    </>
                  ) : (
                    <>
                      <p className="flex items-center gap-1.5 text-success font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" /> 已提交 {submitResult.submittedCount} 个视频
                        {submitResult.rejectedCount > 0 && `（拒绝 ${submitResult.rejectedCount} 个）`}
                      </p>
                      <p className="text-muted-foreground">
                        批次 {submitResult.batchId} · 成本档位「{submitResult.costBand}」· {submitResult.jobIds.length} 个任务
                      </p>
                      {submitResult.rejectedPaths.length > 0 && (
                        <p className="text-muted-foreground">被拒路径：{submitResult.rejectedPaths.join("、")}</p>
                      )}
                      {submitResult.batchSizeWarning && (
                        <p className="text-warning">批量超过 100 条，已提交服务端批量处理。</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 任务列表 */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">任务列表</CardTitle>
                <Button variant="outline" size="sm" className="h-6 gap-1 text-tiny" onClick={refresh}>
                  <RefreshCw className={cn("h-3 w-3", tasksHook.loading && "animate-spin")} /> 刷新
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                      <th className="text-left px-4 py-2.5 font-medium">视频路径</th>
                      <th className="text-center px-4 py-2.5 font-medium">目标语言</th>
                      <th className="text-center px-4 py-2.5 font-medium">状态</th>
                      <th className="text-right px-4 py-2.5 font-medium">创建时间</th>
                      <th className="text-right px-4 py-2.5 font-medium">耗时</th>
                      <th className="text-center px-4 py-2.5 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                          暂无任务，请在上方提交批量任务
                        </td>
                      </tr>
                    ) : tasks.map((task) => {
                      const meta = statusMeta[task.status] ?? statusMeta.unknown;
                      return (
                        <tr
                          key={task.id}
                          className={cn(
                            "border-b hover:bg-muted/50 cursor-pointer transition-colors",
                            selectedId === task.id && "bg-muted/50"
                          )}
                          onClick={() => setSelectedId(selectedId === task.id ? null : task.id)}
                        >
                          <td className="px-4 py-2.5 max-w-[280px]">
                            <div className="flex items-center gap-2">
                              <FileVideo className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="truncate font-mono text-xs" title={task.videoPath}>{task.videoPath}</span>
                            </div>
                            <p className="text-tiny text-muted-foreground mt-0.5">#{task.id}</p>
                          </td>
                          <td className="px-4 py-2.5 text-center text-xs">{langLabels[task.targetLang] ?? task.targetLang}</td>
                          <td className="px-4 py-2.5 text-center">
                            <Badge variant="outline" className={cn("text-tiny", meta.color, meta.bg, meta.border)}>
                              {meta.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{formatTime(task.createdAt)}</td>
                          <td className="px-4 py-2.5 text-right text-xs text-muted-foreground metric-value">{formatDuration(task.durationSeconds)}</td>
                          <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              {task.status === "completed" && Object.keys(task.outputs).length > 0 && (
                                <Button variant="ghost" size="icon" className="h-6 w-6" title="下载产物"
                                  onClick={() => handleDownload(task.id, Object.keys(task.outputs)[0])}>
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {(task.status === "failed" || task.status === "cancelled" || task.status === "not_found") && (
                                <Button variant="ghost" size="icon" className="h-6 w-6" title="重提任务"
                                  onClick={() => handleRetry(task.id)}>
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {(task.status === "queued" || task.status === "running" || task.status === "retrying") && (
                                <Button variant="ghost" size="icon" className="h-6 w-6" title="取消任务"
                                  onClick={() => handleCancel(task.id)}>
                                  <Ban className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 任务详情 */}
          {selectedTask && (
            <Card className="border-l-2 border-l-[var(--wf-localize)]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">任务详情</h3>
                    <Badge variant="outline" className={cn("text-tiny", statusMeta[selectedTask.status]?.color, statusMeta[selectedTask.status]?.bg, statusMeta[selectedTask.status]?.border)}>
                      {statusMeta[selectedTask.status]?.label ?? selectedTask.status}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <WorkflowStepper
                  steps={buildSteps(selectedTask)}
                  currentStep={currentStepOf(selectedTask)}
                  orientation="horizontal"
                  compact
                  className="mb-4 overflow-x-auto"
                />

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-1.5 mb-1">
                      <FileVideo className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-tiny text-muted-foreground">源视频</span>
                    </div>
                    <p className="text-xs font-mono break-all">{selectedTask.videoPath}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Languages className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-tiny text-muted-foreground">参数</span>
                    </div>
                    <p className="text-xs">
                      {langLabels[selectedTask.targetLang] ?? selectedTask.targetLang}
                      <span className="text-muted-foreground"> · TTS {selectedTask.enableTts ? "开" : "关"} · 擦除 {selectedTask.removeSubtitles ? "开" : "关"}</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">创建时间</span>
                    <span className="font-medium">{formatTime(selectedTask.createdAt)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">开始时间</span>
                    <span className="font-medium">{formatTime(selectedTask.startedAt)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">完成时间</span>
                    <span className="font-medium">{formatTime(selectedTask.finishedAt)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">耗时</span>
                    <span className="font-medium metric-value">{formatDuration(selectedTask.durationSeconds)}</span>
                  </div>
                </div>

                {selectedTask.error && (
                  <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 mb-4">
                    <p className="flex items-center gap-1.5 text-xs text-destructive font-medium mb-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> 错误信息
                    </p>
                    <p className="text-xs text-muted-foreground break-all">{selectedTask.error}</p>
                  </div>
                )}

                {Object.keys(selectedTask.outputs).length > 0 && (
                  <div className="p-3 rounded-lg border bg-muted/20">
                    <p className="text-xs font-medium mb-2">产物文件</p>
                    <div className="space-y-1.5">
                      {Object.entries(selectedTask.outputs).map(([name, path]) => (
                        <div key={name} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-mono truncate">{name}</p>
                            <p className="text-tiny text-muted-foreground truncate">{path}</p>
                          </div>
                          <Button variant="outline" size="sm" className="h-6 gap-1 text-tiny shrink-0"
                            onClick={() => handleDownload(selectedTask.id, name)}>
                            <Download className="h-3 w-3" /> 下载
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {actionMsg && actionMsg.id === selectedTask.id && (
                  <p className={cn("mt-2 text-xs", actionMsg.ok ? "text-success" : "text-destructive")}>
                    {actionMsg.text}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右侧栏 */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">后端健康</CardTitle>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={refresh} title="刷新">
                  <RefreshCw className={cn("h-3 w-3", healthHook.loading && "animate-spin")} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "h-2 w-2 rounded-full",
                  health.ok ? "bg-success status-glow-success" : "bg-destructive status-glow-danger"
                )} />
                <span className={cn("text-sm font-medium", health.ok ? "text-success" : "text-destructive")}>
                  {health.ok ? "运行正常" : "不可达"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1"><Server className="h-3 w-3" /> 服务地址</span>
                <span className="font-mono">{health.apiBase}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1"><Activity className="h-3 w-3" /> 响应延迟</span>
                <span className="font-medium metric-value">{health.latencyMs}ms</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">任务概览</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">总任务</span>
                <span className="font-medium metric-value">{tasks.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">已完成</span>
                <span className="font-medium text-success metric-value">{completedCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">处理中</span>
                <span className="font-medium text-info metric-value">{runningCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">失败</span>
                <span className="font-medium text-destructive metric-value">{failedCount}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">流水线说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p className="flex items-start gap-1.5"><Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" /> 全云端处理：ASR / OCR / 翻译 / TTS 均走云 API，无本地模型。</p>
              <p className="flex items-start gap-1.5"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> 译文为 LLM 生成，正式投放前建议人工抽查。</p>
              <p className="flex items-start gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" /> 字幕策略：OCR 定位 → 擦除原字幕 → 目标语言重绘。</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
"use client";

/**
 * FlowMind — 微信公众号端到端发布工作台
 *
 * 三个页签：发布工作台（选稿 → AI排版 → 发布设置 → 人工确认 → 发布/群发）
 *          账号管理（AppID/Secret 加密保险库 + 测试连接）
 *          发布历史（状态轮询 / 文章链接 / 删除）
 */
import { useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { WechatTypesetEditor } from "@/components/content/wechat-typeset-editor";
import {
  useWechatAccounts, useWechatJobs,
  createWechatAccount, removeWechatAccount, testWechatAccount,
  typesetMarkdown, createWechatJob, updateWechatJob, submitWechatJob,
  refreshWechatJob, removeWechatJob,
} from "@/hooks/use-wechat-publish";
import type {
  CopyDraft, WechatAccount, WechatAccountTestResult, WechatChannel,
  WechatPublishJob, WechatPublishSubmitResult, WechatTypesetTheme,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAgentPage } from "@/lib/agent/page-context";
import { JourneyBar } from "@/components/journey/journey-bar";
import {
  CheckCircle2, XCircle, Loader2, RefreshCw, Trash2, ExternalLink,
  PenLine, Type, Settings2, Send, Plus, CircleDot, ShieldCheck, FileText, RotateCcw,
} from "lucide-react";

const CHANNEL_LABEL: Record<WechatChannel, string> = { publish: "发布", mass: "群发" };
const STATUS_LABEL: Record<string, string> = {
  drafting: "排版中", drafted: "已排版", publishing: "发布中", published: "已发布",
  mass_sent: "已群发", failed: "失败", cancelled: "已取消",
};
const STATUS_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  drafting: "secondary", drafted: "secondary", publishing: "outline",
  published: "default", mass_sent: "default", failed: "destructive", cancelled: "outline",
};

// ── 手机预览 ─────────────────────────────────────────────────────────
function PhonePreview({ html, title }: { html: string; title: string }) {
  const srcdoc = useMemo(
    () =>
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Helvetica Neue',sans-serif;background:#fff;}h1{font-size:20px;margin:16px 0 12px;}p,li{font-size:15px;line-height:1.75;}</style></head><body>${html}</body></html>`,
    [html],
  );
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-[300px] overflow-hidden rounded-2xl border bg-white shadow-lg">
        <div className="border-b bg-[#07C160] px-3 py-1.5 text-center text-xs font-medium text-white">
          公众号预览
        </div>
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <div className="h-7 w-7 rounded-full bg-[#07C160]/10" />
          <div className="flex-1 truncate text-xs font-medium text-gray-800">{title || "未命名"}</div>
          <span className="text-[10px] text-gray-400">···</span>
        </div>
        <iframe
          title="公众号正文预览"
          className="h-[520px] w-full"
          sandbox="allow-same-origin"
          srcDoc={srcdoc}
        />
      </div>
      <p className="text-xs text-muted-foreground">预览渲染 AI 排版后的正文（含内联样式）</p>
    </div>
  );
}

// ── 账号面板 ─────────────────────────────────────────────────────────
function AccountPanel({
  accounts, onChanged,
}: { accounts: WechatAccount[]; onChanged: () => void }) {
  const [form, setForm] = useState({ label: "", appId: "", appSecret: "" });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<WechatAccountTestResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [envTesting, setEnvTesting] = useState(false);

  const test = async (input: { id?: string; appId?: string; appSecret?: string } = {}) => {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      setTestResult(await testWechatAccount(input));
    } catch (err) {
      setError(err instanceof Error ? err.message : "测试失败");
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await createWechatAccount({
        label: form.label, appId: form.appId.trim(), appSecret: form.appSecret.trim(),
      });
      setForm({ label: "", appId: "", appSecret: "" });
      setTestResult(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#07C160]" /> 公众号账号保险库
          </CardTitle>
          <CardDescription>
            支持无限多个公众号。AppID / AppSecret 用 AES-256-GCM 加密存储，任何接口都只返回掩码，
            明文只在「测试连接 / 发布」时于服务端内存出现。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.length === 0 && (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              还没有账号。可先在下方添加（推荐），或使用 flowmind 环境变量
              <code className="mx-1 rounded bg-muted px-1">WECHAT_APP_ID</code>/
              <code className="mx-1 rounded bg-muted px-1">WECHAT_APP_SECRET</code> 走「开发模式」。
            </div>
          )}
          <div className="space-y-2">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.label}</span>
                    {a.isDefault && <Badge variant="secondary">默认</Badge>}
                    <Badge variant={a.status === "active" ? "default" : "destructive"}>
                      {a.status === "active" ? "正常" : "失效"}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    AppID {a.appIdMasked}
                    {a.lastCheckedAt ? ` · 最近测试 ${new Date(a.lastCheckedAt).toLocaleString()}` : " · 未测试"}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => test({ id: a.id })} disabled={testing}>
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} 测试
                </Button>
                <Button
                  size="sm" variant="ghost"
                  onClick={async () => {
                    if (!confirm(`删除公众号「${a.label}」？`)) return;
                    await removeWechatAccount(a.id);
                    onChanged();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="text-sm font-medium">添加公众号</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>名称（仅本平台显示）</Label>
                <Input
                  placeholder="例如：主号 / 矩阵号 B"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>AppID</Label>
                <Input
                  placeholder="wx + 16 位"
                  value={form.appId}
                  onChange={(e) => setForm({ ...form, appId: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>AppSecret</Label>
                <Input
                  type="password"
                  placeholder="32 位密钥"
                  value={form.appSecret}
                  onChange={(e) => setForm({ ...form, appSecret: e.target.value })}
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {testResult && (
              <div className={cn("flex items-start gap-2 rounded-md border p-3 text-sm",
                testResult.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800")}>
                {testResult.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                <div>
                  <div className="font-medium">
                    {testResult.ok ? `连接成功 · ${testResult.nickname ?? "已获取 token"}` : "连接失败"}
                  </div>
                  {testResult.warning && <div className="mt-0.5 text-xs opacity-80">{testResult.warning}</div>}
                  {!testResult.ok && testResult.failureCategory && (
                    <div className="mt-0.5 text-xs opacity-80">原因类型：{testResult.failureCategory}</div>
                  )}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => test({ appId: form.appId.trim(), appSecret: form.appSecret.trim() })}
                disabled={testing || !form.appId || !form.appSecret}
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDot className="h-4 w-4" />} 测试连接
              </Button>
              <Button onClick={save} disabled={saving || !form.appId || !form.appSecret}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} 加密保存
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-dashed p-3">
            <div className="text-sm">
              <div className="font-medium">开发模式（环境变量账号）</div>
              <div className="text-xs text-muted-foreground">
                未添加账号时，发布默认走 flowmind 的 WECHAT_APP_ID / WECHAT_APP_SECRET。
              </div>
            </div>
            <Button
              variant="ghost" size="sm"
              onClick={() => { setEnvTesting(true); test({}).finally(() => setEnvTesting(false)); }}
              disabled={envTesting}
            >
              {envTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} 测试环境变量账号
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── 历史面板 ─────────────────────────────────────────────────────────
function HistoryPanel({
  jobs, onChanged,
}: { jobs: WechatPublishJob[]; onChanged: () => void }) {
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#07C160]" /> 发布历史
        </CardTitle>
        <CardDescription>已排版 / 已发布 / 已群发的任务，可轮询状态或打开文章链接。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {jobs.length === 0 && <p className="text-sm text-muted-foreground">还没有发布任务。</p>}
        {jobs.map((j) => (
          <div key={j.id} className="flex items-center gap-3 rounded-lg border p-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{j.title}</span>
                <Badge variant={STATUS_TONE[j.status] ?? "secondary"}>{STATUS_LABEL[j.status] ?? j.status}</Badge>
                <Badge variant="outline">{CHANNEL_LABEL[j.channel]}</Badge>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {new Date(j.createdAt).toLocaleString()}
                {j.publishTime ? ` · 定时 ${new Date(j.publishTime * 1000).toLocaleString()}` : ""}
                {j.articleUrl ? " · 已生成文章链接" : ""}
              </div>
              {j.warning && <div className="mt-1 text-xs text-amber-600">{j.warning}</div>}
            </div>
            {(j.status === "publishing" || (j.publishId && !j.articleUrl)) && (
              <Button
                size="sm" variant="ghost"
                disabled={refreshingId === j.id}
                onClick={async () => {
                  setRefreshingId(j.id);
                  try { await refreshWechatJob(j.id); onChanged(); }
                  finally { setRefreshingId(null); }
                }}
              >
                {refreshingId === j.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} 刷新
              </Button>
            )}
            {j.articleUrl && (
              <Button size="sm" variant="ghost" asChild>
                <a href={j.articleUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> 文章</a>
              </Button>
            )}
            <Button
              size="sm" variant="ghost"
              onClick={async () => {
                if (!confirm("删除该发布任务记录？")) return;
                await removeWechatJob(j.id);
                onChanged();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── 主工作台 ─────────────────────────────────────────────────────────
type Step = "select" | "typeset" | "settings" | "confirm" | "done";
const STEP_ORDER: Step[] = ["select", "typeset", "settings", "confirm", "done"];

interface Props {
  accounts: WechatAccount[];
  jobs: WechatPublishJob[];
  themes: WechatTypesetTheme[];
  drafts: CopyDraft[];
}

export function WechatPublishClient({ accounts: initAccounts, jobs: initJobs, themes, drafts }: Props) {
  const accountsState = useWechatAccounts();
  const jobsState = useWechatJobs();
  const accounts = accountsState.data ?? initAccounts;
  const jobs = jobsState.data ?? initJobs;

  const [tab, setTab] = useState<"studio" | "accounts" | "history">("studio");

  // 向导状态（深链 ?draft=<id>：初渲直接选中对应公众号草稿——内容工坊第 4 步入口会带上）
  const searchParams = useSearchParams();
  const deepDraftId = searchParams.get("draft");
  const deepDraft = deepDraftId ? drafts.find((x) => x.id === deepDraftId) : undefined;

  const [step, setStep] = useState<Step>("select");
  const [draftId, setDraftId] = useState<string>(deepDraft?.id ?? "");
  const [markdown, setMarkdown] = useState(deepDraft?.body ?? "");
  const [title, setTitle] = useState(deepDraft?.title ?? "");
  const [themeId, setThemeId] = useState("default");
  const [html, setHtml] = useState("");
  const [job, setJob] = useState<WechatPublishJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);

  // 设置
  const [accountId, setAccountId] = useState<string>("__env__");
  const [channel, setChannel] = useState<WechatChannel>("publish");
  const [publishTime, setPublishTime] = useState("");
  const [summary, setSummary] = useState("");
  const [author, setAuthor] = useState("");
  const [thumbUrl, setThumbUrl] = useState("");

  // 确认
  const [confirmTypeset, setConfirmTypeset] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(false);
  const [result, setResult] = useState<WechatPublishSubmitResult | null>(null);
  const [draftOnly, setDraftOnly] = useState(false);

  const selectDraft = (d: CopyDraft) => {
    setDraftId(d.id);
    setTitle(d.title || "");
    setMarkdown(d.body || "");
  };

  /** 选稿 → AI 排版：调 flowmind content_typeset，建任务 */
  const startTypeset = async () => {
    if (!markdown.trim() || !title.trim()) {
      setError("需要标题和正文（Markdown）");
      return;
    }
    setBusy(true);
    setBusyLabel("AI 排版中…");
    setError(null);
    try {
      const ts = await typesetMarkdown({ markdown, theme: themeId });
      setHtml(ts.html);
      const j = await createWechatJob({
        title: title.trim(), bodyHtml: ts.html, theme: themeId,
        accountId: accountId === "__env__" ? null : accountId,
      });
      setJob(j);
      setStep("typeset");
      setEditorVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "排版失败");
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  };

  /** 排版页：切换主题 → 重新 AI 排版 */
  const applyTheme = async (t: string) => {
    setThemeId(t);
    if (!markdown.trim()) return;
    setBusy(true);
    setBusyLabel("重新排版…");
    setError(null);
    try {
      const ts = await typesetMarkdown({ markdown, theme: t });
      setHtml(ts.html);
      if (job) await updateWechatJob(job.id, { bodyHtml: ts.html, theme: t });
      setEditorVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "重新排版失败");
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  };

  /** 排版 → 设置 */
  const saveTypeset = async () => {
    if (!job) return;
    setBusy(true);
    setBusyLabel("保存…");
    try {
      await updateWechatJob(job.id, { bodyHtml: html, step: "settings", status: "drafted" });
      setStep("settings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  };

  /** 设置 → 确认 */
  const saveSettings = async () => {
    if (!job) return;
    if (!thumbUrl.trim()) {
      setError("请填写封面图 URL（公众号文章必须有封面，建议 900×500）");
      return;
    }
    setBusy(true);
    setBusyLabel("保存设置…");
    try {
      await updateWechatJob(job.id, {
        accountId: accountId === "__env__" ? null : accountId,
        channel,
        publishTime: publishTime ? Math.floor(new Date(publishTime).getTime() / 1000) : null,
        summary,
        author,
        thumbUrl,
        step: "confirm",
      });
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存设置失败");
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  };

  /** 最终确认 → 发布/群发 */
  const doPublish = async () => {
    if (!job) return;
    if (!confirmTypeset || !confirmTarget) {
      setError("请先勾选两条确认项");
      return;
    }
    setBusy(true);
    setBusyLabel(draftOnly ? "提交草稿…" : channel === "mass" ? "提交群发…" : "提交发布…");
    setError(null);
    try {
      const res = await submitWechatJob(job.id, {
        accountId: accountId === "__env__" ? null : accountId,
        title: title.trim(),
        summary,
        author,
        bodyHtml: html,
        thumbUrl,
        channel,
        theme: themeId,
        publishTime: publishTime ? Math.floor(new Date(publishTime).getTime() / 1000) : null,
        publish: !draftOnly,
      });
      setResult(res);
      setStep("done");
      jobsState.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "发布失败");
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  };

  const resetAll = useCallback(() => {
    setStep("select");
    setDraftId(""); setMarkdown(""); setTitle("");
    setHtml(""); setJob(null); setError(null); setResult(null);
    setConfirmTypeset(false); setConfirmTarget(false);
    setThemeId("default"); setChannel("publish"); setPublishTime("");
    setSummary(""); setAuthor(""); setThumbUrl(""); setDraftOnly(false);
  }, []);

  const stepIndex = STEP_ORDER.indexOf(step);
  const accountLabel = accountId === "__env__"
    ? "开发模式（环境变量账号）"
    : (accounts.find((a) => a.id === accountId)?.label ?? "开发模式（环境变量账号）");

  // 「前端即 Agent」页面上下文：Agent 可感知向导进度并经 data-agent-action 把手驱动
  useAgentPage({
    title: "公众号发布",
    snapshot: () =>
      `向导第 ${stepIndex + 1}/5 步（${step}） · 标题「${title || "未填"}」 · ` +
      `正文 ${markdown.length} 字 · ${job ? `任务已建（${job.status}）` : "任务未建"} · 账号 ${accountLabel}`,
    state: () => ({ tab, step, draftId, hasJob: Boolean(job) }),
  });

  const stepBar = step !== "done" && (
    <div className="flex items-center gap-1 overflow-x-auto text-xs">
      {(["select", "typeset", "settings", "confirm"] as Step[]).map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium",
              i < stepIndex ? "bg-[#07C160]/15 text-[#07C160]"
                : i === stepIndex ? "bg-[#07C160] text-white" : "bg-muted text-muted-foreground",
            )}
          >
            {i < stepIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span className={cn("whitespace-nowrap", i === stepIndex ? "font-medium text-foreground" : "text-muted-foreground")}>
            {s === "select" ? "选稿" : s === "typeset" ? "AI 排版" : s === "settings" ? "发布设置" : "人工确认"}
          </span>
          {i < 3 && <div className="mx-1 h-px w-6 bg-border" />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* J1 内容发布旅程第 4 步：URL 带 ?journey=&step=4 时显示旅程步进条 */}
      <JourneyBar />

      {/* 顶部操作区 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#07C160]/10 text-[#07C160]">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-semibold">公众号端到端发布</div>
            <div className="text-xs text-muted-foreground">文案 → AI 排版 → 人工确认 → 发布 / 群发</div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={resetAll}><RotateCcw className="h-4 w-4" /> 重置向导</Button>
      </div>

      {/* 页签 */}
      <div className="flex items-center gap-1 border-b">
        {([
          ["studio", "发布工作台"],
          ["accounts", "账号管理"],
          ["history", "发布历史"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm transition-colors",
              tab === k ? "border-[#07C160] font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {tab === "accounts" && (
        <>
          {accountsState.error && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <div className="font-medium">公众号账号表未就绪</div>
              <div className="mt-0.5 text-xs opacity-90">
                请在 Supabase SQL Editor 执行 <code className="rounded bg-amber-100 px-1">supabase/migrations/00011_wechat_e2e.sql</code>
                （创建 wf_wechat_accounts / wf_wechat_publish_jobs 表）后刷新。错误：{accountsState.error}
              </div>
            </div>
          )}
          <AccountPanel accounts={accounts} onChanged={() => accountsState.refetch()} />
        </>
      )}

      {tab === "history" && (
        <HistoryPanel jobs={jobs} onChanged={() => jobsState.refetch()} />
      )}

      {tab === "studio" && (
        <>
          {stepBar}

          {/* ── 选稿 ── */}
          {step === "select" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">① 选稿</CardTitle>
                  <CardDescription>从内容创作中心的公众号草稿里选，或直接粘贴 Markdown。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="max-h-52 space-y-2 overflow-auto pr-1">
                    {drafts.length === 0 && (
                      <p className="text-sm text-muted-foreground">暂无公众号草稿，请直接在右侧粘贴 Markdown。</p>
                    )}
                    {drafts.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => selectDraft(d)}
                        className={cn(
                          "block w-full rounded-lg border p-2.5 text-left transition-colors",
                          draftId === d.id ? "border-[#07C160] bg-[#07C160]/5" : "hover:border-border",
                        )}
                      >
                        <div className="truncate text-sm font-medium">{d.title}</div>
                        <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{d.body.slice(0, 80)}…</div>
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <Label>标题</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="文章标题" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>正文（Markdown）</Label>
                    <Textarea
                      rows={8}
                      value={markdown}
                      onChange={(e) => setMarkdown(e.target.value)}
                      placeholder={"## 二级标题\n\n正文内容，支持 **加粗**、- 列表、> 引用、```代码块 等"}
                    />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">② 准备排版</CardTitle>
                  <CardDescription>选择内置主题，点击开始调用 AI 排版（flowmind content_typeset）。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>排版主题</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {themes.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setThemeId(t.id)}
                          className={cn(
                            "rounded-lg border p-3 text-left transition-colors",
                            themeId === t.id ? "border-[#07C160] bg-[#07C160]/5" : "hover:border-border",
                          )}
                        >
                          <div className="h-3 w-3 rounded-full" style={{ background: t.primary }} />
                          <div className="mt-1.5 text-sm font-medium">{t.label}</div>
                          <div className="text-[11px] text-muted-foreground">{t.primary}</div>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">主题基于 doocs/md 官方 CSS（已内置到后端），AI 排版后仍可在下一步可视化微调。</p>
                  </div>
                  <Button className="w-full" disabled={busy || !markdown.trim() || !title.trim()} onClick={startTypeset} data-agent-action="wechat-typeset">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Type className="h-4 w-4" />}
                    {busy ? busyLabel : "开始 AI 排版"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── 排版 ── */}
          {step === "typeset" && job && (
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="space-y-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <PenLine className="h-4 w-4 text-[#07C160]" /> 可视化微调（TipTap 富文本）
                    </CardTitle>
                    <CardDescription>直接编辑已排版的正文；切换主题会基于原文重新排版（丢弃手改）。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Label className="text-xs">主题</Label>
                      {themes.map((t) => (
                        <Button
                          key={t.id} size="sm" variant={themeId === t.id ? "default" : "outline"}
                          onClick={() => applyTheme(t.id)} disabled={busy}
                        >
                          {t.label}
                        </Button>
                      ))}
                    </div>
                    <WechatTypesetEditor key={`${themeId}-${editorVersion}`} initialHtml={html} onChange={setHtml} />
                  </CardContent>
                </Card>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setStep("select")}>上一步</Button>
                  <Button onClick={saveTypeset} disabled={busy} data-agent-action="wechat-typeset-next">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 下一步：发布设置
                  </Button>
                </div>
              </div>
              <PhonePreview html={html} title={title} />
            </div>
          )}

          {/* ── 设置 ── */}
          {step === "settings" && job && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2"><Settings2 className="h-4 w-4 text-[#07C160]" /> 发布设置</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>发布账号</Label>
                    <Select value={accountId} onValueChange={setAccountId}>
                      <SelectTrigger><SelectValue placeholder="选择公众号账号" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__env__">开发模式（环境变量账号）</SelectItem>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.label} · {a.appIdMasked}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">选「开发模式」则使用 flowmind 环境变量中的凭证。</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>渠道</Label>
                    <Select value={channel} onValueChange={(v) => setChannel(v as WechatChannel)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="publish">发布（进草稿箱/已发布，可后续操作）</SelectItem>
                        <SelectItem value="mass">群发（直接推送给全部粉丝）</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {channel === "mass"
                        ? "群发提交即异步执行，受微信次数限制（服务号每月 4 次），可能需要管理员扫码确认；无官方定时参数，定时走服务端调度。"
                        : "发布走 freepublish（草稿→发布），发布后生成文章链接；支持定时发布（需认证服务号）。"}
                    </p>
                  </div>
                  <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                    <input type="checkbox" checked={draftOnly} onChange={(e) => setDraftOnly(e.target.checked)} className="mt-0.5" />
                    <span>
                      <span className="font-medium">仅存草稿</span>
                      <span className="block text-xs text-muted-foreground">
                        只提交到公众号草稿箱，不立即发布/群发；稍后在公众号后台手动发布（发布与群发都可后续操作）。
                      </span>
                    </span>
                  </label>
                  <div className="space-y-1.5">
                    <Label>定时发布（可选，仅发布渠道）</Label>
                    <Input
                      type="datetime-local"
                      value={publishTime}
                      onChange={(e) => setPublishTime(e.target.value)}
                      disabled={channel === "mass" || draftOnly}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>摘要（选填）</Label>
                      <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="公众号文章摘要" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>作者（选填）</Label>
                      <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="公众号后台显示的作者" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>封面图 URL（必填，公众号文章必须有封面）</Label>
                    <Input value={thumbUrl} onChange={(e) => setThumbUrl(e.target.value)} placeholder="https://…/cover.jpg（建议 900×500）" />
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">当前内容</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div><span className="text-muted-foreground">标题：</span>{title}</div>
                    <div><span className="text-muted-foreground">正文长度：</span>{html.replace(/<[^>]+>/g, "").length} 字（HTML {html.length}）</div>
                    <div><span className="text-muted-foreground">主题：</span>{themes.find((t) => t.id === themeId)?.label ?? themeId}</div>
                    <div><span className="text-muted-foreground">渠道：</span>{CHANNEL_LABEL[channel]}</div>
                    {publishTime && <div><span className="text-muted-foreground">定时：</span>{new Date(publishTime).toLocaleString()}</div>}
                  </CardContent>
                </Card>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setStep("typeset")}>上一步</Button>
                  <Button onClick={saveSettings} disabled={busy} data-agent-action="wechat-settings-next">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 下一步：确认发布
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── 确认 ── */}
          {step === "confirm" && job && (
            <div className="mx-auto max-w-2xl space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#07C160]" /> 最终确认</CardTitle>
                  <CardDescription>发布是不可逆操作，请逐项核对后勾选确认。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 rounded-lg border p-4 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">标题</span><span className="text-right font-medium">{title}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">账号</span><span className="text-right font-medium">{accountLabel}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">渠道</span><span className="text-right font-medium">{CHANNEL_LABEL[channel]}{draftOnly ? "（仅存草稿）" : ""}</span></div>
                    {publishTime && (
                      <div className="flex justify-between"><span className="text-muted-foreground">定时</span><span className="text-right font-medium">{new Date(publishTime).toLocaleString()}</span></div>
                    )}
                    <div className="flex justify-between"><span className="text-muted-foreground">主题</span><span className="text-right font-medium">{themes.find((t) => t.id === themeId)?.label ?? themeId}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">正文字数</span><span className="text-right font-medium">{html.replace(/<[^>]+>/g, "").length}</span></div>
                  </div>
                  <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                    <input type="checkbox" checked={confirmTypeset} onChange={(e) => setConfirmTypeset(e.target.checked)} className="mt-0.5" />
                    <span>我已检查排版与正文内容，确认无误（发送前可在上方「上一步」返回微调）。</span>
                  </label>
                  <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                    <input type="checkbox" checked={confirmTarget} onChange={(e) => setConfirmTarget(e.target.checked)} className="mt-0.5" />
                    <span>我已核对目标账号「{accountLabel}」与渠道「{CHANNEL_LABEL[channel]}」。
                      {draftOnly
                        ? "本次仅保存草稿，不会对粉丝推送。"
                        : channel === "mass" && "群发将直接推送给全部粉丝，且受次数限制。"}</span>
                  </label>
                </CardContent>
              </Card>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep("settings")}>上一步</Button>
                <Button onClick={doPublish} disabled={busy} className="bg-[#07C160] hover:bg-[#06ad56]" data-agent-action="wechat-publish-submit">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {busy ? busyLabel
                    : draftOnly ? "确认保存草稿"
                    : `确认${channel === "mass" ? "群发" : "发布"}`}
                </Button>
              </div>
            </div>
          )}

          {/* ── 完成 ── */}
          {step === "done" && result && (
            <Card className="mx-auto max-w-2xl">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> {draftOnly ? "已保存草稿" : "已提交"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">渠道</span><span>{CHANNEL_LABEL[channel]}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">状态</span>
                  <Badge variant={result.status === "failed" ? "destructive" : "default"}>{result.status}</Badge>
                </div>
                {result.mediaId && <div className="flex justify-between"><span className="text-muted-foreground">media_id</span><span className="font-mono text-xs">{result.mediaId}</span></div>}
                {result.publishId && <div className="flex justify-between"><span className="text-muted-foreground">发布 ID</span><span className="font-mono text-xs">{result.publishId}</span></div>}
                {result.msgId && <div className="flex justify-between"><span className="text-muted-foreground">群发 msg_id</span><span className="font-mono text-xs">{result.msgId}</span></div>}
                {result.warning && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">{result.warning}</div>}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { jobsState.refetch(); resetAll(); }}>
                    <RotateCcw className="h-4 w-4" /> 再发一篇
                  </Button>
                  <Button onClick={() => setTab("history")}>查看发布历史</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

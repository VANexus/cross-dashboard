"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Globe, KeyRound, Loader2, RefreshCw, ShieldCheck, Trash2, AlertTriangle, CheckCircle2, XCircle, MonitorSmartphone,
} from "lucide-react";
import type { ChannelAccount, ChannelPlatform } from "@/lib/types";

interface AccountView {
  id: string;
  platform: ChannelPlatform;
  label: string;
  status: "active" | "expired" | "risk_control";
  lastCheckedAt: string | null;
  createdAt: string;
}

interface BrowserStatus {
  connected: boolean;
  browser: string;
  cdp: string;
  tabs?: number;
  platforms?: { tiktok: boolean; instagram: boolean; alibaba: boolean };
  hint: string;
}

const STATUS_BADGE: Record<AccountView["status"], { label: string; variant: "success" | "danger" | "warning" }> = {
  active: { label: "有效", variant: "success" },
  expired: { label: "已过期", variant: "danger" },
  risk_control: { label: "疑似风控", variant: "warning" },
};

function fmtTime(iso: string | null): string {
  if (!iso) return "从未校验";
  return new Date(iso).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const EDGE_CMD = 'msedge.exe --remote-debugging-port=9222';
const CHROME_CMD = 'chrome.exe --remote-debugging-port=9222';

export function ChannelsClient() {
  const [accounts, setAccounts] = useState<AccountView[]>([]);
  const [browser, setBrowser] = useState<BrowserStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<Record<string, string>>({});
  const [importOpen, setImportOpen] = useState<ChannelPlatform | null>(null);
  const [importLabel, setImportLabel] = useState("");
  const [importSession, setImportSession] = useState("");

  const refresh = useCallback(async () => {
    const [accRes, brRes] = await Promise.allSettled([
      fetch("/api/b2b/channels").then((r) => r.json()),
      fetch("/api/b2b/browser-status").then((r) => r.json()),
    ]);
    if (accRes.status === "fulfilled" && accRes.value.success) setAccounts(accRes.value.data as AccountView[]);
    if (brRes.status === "fulfilled" && brRes.value.success) setBrowser(brRes.value.data as BrowserStatus);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const copyCmd = useCallback(async (cmd: string) => {
    try { await navigator.clipboard.writeText(cmd); setMessage((s) => ({ ...s, cmd: "已复制，粘贴到 Win+R 或终端执行" })); }
    catch { setMessage((s) => ({ ...s, cmd: "复制失败，请手动选择文本复制" })); }
  }, []);

  /** 兜底：粘贴导入会话（F12 → Application → Cookies 复制） */
  const handleImport = useCallback(async () => {
    if (!importOpen || importSession.trim().length < 10) {
      setMsg("import", "会话内容过短");
      return;
    }
    setBuz("import", true);
    setMsg("import", "");
    try {
      const res = await fetch("/api/b2b/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: importOpen, label: importLabel, session: importSession.trim() }),
      });
      const d = await res.json();
      if (d.success) {
        setImportOpen(null);
        setImportLabel("");
        setImportSession("");
        refresh();
      } else {
        setMsg("import", d.error ?? "导入失败");
      }
    } finally {
      setBuz("import", false);
    }
  }, [importOpen, importLabel, importSession, refresh]);

  const handleVerify = useCallback(async (id: string) => {
    setBuz(`verify-${id}`, true);
    setMsg(`verify-${id}`, "");
    try {
      const res = await fetch(`/api/b2b/channels/${id}/verify`, { method: "POST" });
      const d = await res.json();
      const payload = d.data as { status?: string; message?: string } | undefined;
      setMsg(`verify-${id}`, payload?.message ?? (d.success ? "已校验" : (d.error ?? "校验失败")));
      refresh();
    } finally {
      setBuz(`verify-${id}`, false);
    }
  }, [refresh]);

  const handleDelete = useCallback(async (id: string) => {
    setBuz(`del-${id}`, true);
    try {
      await fetch(`/api/b2b/channels/${id}`, { method: "DELETE" });
      refresh();
    } finally {
      setBuz(`del-${id}`, false);
    }
  }, [refresh]);

  const setMsg = (key: string, text: string) => setMessage((s) => ({ ...s, [key]: text }));
  const setBuz = (key: string, on: boolean) => setBusy((s) => ({ ...s, [key]: on }));

  return (
    <div className="space-y-6">
      {/* 浏览器直连状态卡（主路径） */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                你的浏览器（CDP 直连）
                {browser && (
                  <Badge variant={browser.connected ? "success" : "danger"} className="ml-1">
                    {browser.connected ? "已连接" : "未连接"}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                抓取直接在你的浏览器里进行——真实指纹 + 你已登录的账号，会话永不离开浏览器，零风控。
                登录平台 = 在你自己的浏览器里正常登录。
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={refresh}>
              <RefreshCw className="mr-1 h-4 w-4" /> 刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-2 text-sm text-muted-foreground">检测中…</p>
          ) : browser?.connected ? (
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {browser.browser || "浏览器"} · {browser.tabs ?? 0} 个标签页 · {browser.cdp}
              </p>
              <div className="flex flex-wrap gap-2">
                {(["tiktok", "instagram"] as const).map((p) => (
                  <Badge key={p} variant={browser.platforms?.[p] ? "success" : "outline"}>
                    {p === "tiktok" ? "TikTok" : "Instagram"}：{browser.platforms?.[p] ? "浏览器里有页面" : "未打开过页面"}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{browser.hint}</p>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="flex items-start gap-1.5 text-warning">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {browser?.hint ?? "无法连接浏览器调试端口。"}
              </p>
              <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-xs">
                <p className="font-medium">启用步骤（一次性）：</p>
                <p>1. 完全退出浏览器（含后台进程，任务栏右键图标退出）</p>
                <p>2. 用以下命令重启（粘贴到 Win+R 运行框或终端）：</p>
                <div className="flex items-center gap-2 font-mono">
                  <code className="rounded bg-background px-2 py-1">{EDGE_CMD}</code>
                  <Button size="sm" variant="outline" onClick={() => copyCmd(EDGE_CMD)}>复制</Button>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <code className="rounded bg-background px-2 py-1">{CHROME_CMD}</code>
                  <Button size="sm" variant="outline" onClick={() => copyCmd(CHROME_CMD)}>复制</Button>
                </div>
                <p>3. 在这个浏览器里正常登录 tiktok.com / instagram.com，然后点上方「刷新」</p>
              </div>
              {message["cmd"] && <p className="text-xs text-muted-foreground">{message["cmd"]}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* 兜底：账号保险库（粘贴导入会话） */}
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MonitorSmartphone className="h-5 w-5 text-muted-foreground" />
                兜底：粘贴导入会话（AES-256-GCM 加密保管）
              </CardTitle>
              <CardDescription>
                浏览器直连不可用时（如服务器部署）的兜底路径。会话加密入库、永不明文返回前端。
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => { setImportOpen("instagram"); setMsg("import", ""); }}>
              <KeyRound className="mr-1 h-4 w-4" /> 粘贴导入
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">加载中…</p>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无兜底会话。</p>
          ) : (
            <div className="space-y-3">
              {accounts.map((a) => {
                const badge = STATUS_BADGE[a.status];
                return (
                  <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{a.label || "未命名账号"}</span>
                        <Badge variant="outline">{a.platform}</Badge>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">最近校验：{fmtTime(a.lastCheckedAt)}</p>
                      {message[`verify-${a.id}`] && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{message[`verify-${a.id}`]}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleVerify(a.id)} disabled={busy[`verify-${a.id}`]}>
                        {busy[`verify-${a.id}`]
                          ? <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          : <RefreshCw className="mr-1 h-4 w-4" />}
                        校验
                      </Button>
                      <Button size="sm" variant="outline" className="text-danger" onClick={() => handleDelete(a.id)} disabled={busy[`del-${a.id}`]}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            CDP 直连可用时优先走浏览器，此处会话不参与抓取。
          </p>
        </CardContent>
      </Card>

      {importOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">粘贴导入会话 — {importOpen === "tiktok" ? "TikTok" : "Instagram"}</CardTitle>
            <CardDescription>
              在已登录平台页按 F12 → Application → Cookies，复制完整 cookie 串（须含 sessionid=...），导入后立即加密入库。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ch-import-label">账号备注（可选）</Label>
              <Input id="ch-import-label" value={importLabel} onChange={(e) => setImportLabel(e.target.value)}
                placeholder="如：主账号 / 备用号" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ch-import-session">会话 cookie</Label>
              <Input id="ch-import-session" type="password" value={importSession} onChange={(e) => setImportSession(e.target.value)}
                placeholder="sessionid=...; csrftoken=...; ..." />
            </div>
            {message["import"] && (
              <p className="flex items-center gap-1.5 text-xs text-warning">
                <AlertTriangle className="h-3.5 w-3.5" /> {message["import"]}
              </p>
            )}
            <Separator />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setImportOpen(null)}>取消</Button>
              <Button size="sm" onClick={handleImport} disabled={busy["import"]}>
                {busy["import"] && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                加密导入
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        需要配置单账号兜底或 CDP 地址？前往
        <Link href="/settings/b2b" className="mx-1 text-primary underline-offset-4 hover:underline">设置 → B 端运营</Link>。
      </p>
    </div>
  );
}

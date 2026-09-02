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
  KeyRound, Loader2, RefreshCw, ShieldCheck, Trash2, AlertTriangle,
} from "lucide-react";
import { JourneyBar } from "@/components/journey/journey-bar";
import type { ChannelPlatform } from "@/lib/types";

interface AccountView {
  id: string;
  platform: ChannelPlatform;
  label: string;
  status: "active" | "expired" | "risk_control";
  lastCheckedAt: string | null;
  createdAt: string;
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

export function ChannelsClient() {
  const [accounts, setAccounts] = useState<AccountView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<Record<string, string>>({});
  const [importOpen, setImportOpen] = useState<ChannelPlatform | null>(null);
  const [importLabel, setImportLabel] = useState("");
  const [importSession, setImportSession] = useState("");

  const setMsg = (key: string, text: string) => setMessage((s) => ({ ...s, [key]: text }));
  const setBuz = (key: string, on: boolean) => setBusy((s) => ({ ...s, [key]: on }));

  const refresh = useCallback(async () => {
    const accRes = await fetch("/api/b2b/channels").then((r) => r.json()).catch(() => null);
    if (accRes?.success) setAccounts(accRes.data as AccountView[]);
    setLoading(false);
  }, []);

  // 延迟到定时器回调再拉取，避免在 effect 体内同步 setState（react-hooks/set-state-in-effect）
  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  /** 粘贴导入会话（F12 → Application → Cookies 复制），加密入库 */
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

  return (
    <div className="space-y-6">
      <JourneyBar />
      {/* 数据源说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            数据源：TikHub API（免登录）
          </CardTitle>
          <CardDescription>
            趋势数据现由 TikHub 服务端代抓（TikTok Creative Center 榜单 / Instagram 话题搜索），
            无需平台登录、无需浏览器、无需安装任何东西。
            本页仅作为备用凭证保险库：手动粘贴的平台会话（AES-256-GCM 加密保管）可供旧自建回退路径使用。
          </CardDescription>
        </CardHeader>
      </Card>

      <Separator />

      {/* 账号保险库 */}
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-muted-foreground" />
                账号保险库（AES-256-GCM 加密保管）
              </CardTitle>
              <CardDescription>手动粘贴导入（F12 → Application → Cookies 复制）。会话加密保存、永不明文返回前端。</CardDescription>
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
            <p className="text-sm text-muted-foreground">暂无保存的账号会话。</p>
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
          {message["import"] && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5" /> {message["import"]}
            </p>
          )}
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
        需要配置单账号兜底或托管浏览器参数？前往
        <Link href="/settings/b2b" className="mx-1 text-primary underline-offset-4 hover:underline">设置 → B 端运营</Link>。
      </p>
    </div>
  );
}

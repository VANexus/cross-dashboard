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
  Globe, KeyRound, Loader2, Plus, RefreshCw, ShieldCheck, Trash2, AlertTriangle,
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

const PLATFORMS: Array<{ key: "tiktok" | "instagram"; title: string; desc: string }> = [
  { key: "tiktok", title: "TikTok", desc: "登录后解锁 Creative Center 全量榜单" },
  { key: "instagram", title: "Instagram", desc: "话题搜索必需登录会话" },
];

const STATUS_BADGE: Record<AccountView["status"], { label: string; variant: "success" | "danger" | "warning" }> = {
  active: { label: "有效", variant: "success" },
  expired: { label: "已过期", variant: "danger" },
  risk_control: { label: "疑似风控", variant: "warning" },
};

function fmtTime(iso: string | null): string {
  if (!iso) return "从未校验";
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function ChannelsClient() {
  const [accounts, setAccounts] = useState<AccountView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<Record<string, string>>({});
  const [importOpen, setImportOpen] = useState<ChannelPlatform | null>(null);
  const [importLabel, setImportLabel] = useState("");
  const [importSession, setImportSession] = useState("");

  const fetchAccounts = useCallback(async () => {
    try {
      const r = await fetch("/api/b2b/channels");
      const d = await r.json();
      if (d.success) setAccounts(d.data as AccountView[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const setMsg = (key: string, text: string) => setMessage((s) => ({ ...s, [key]: text }));
  const setBuz = (key: string, on: boolean) => setBusy((s) => ({ ...s, [key]: on }));

  /** 站内登录新增账号：弹本机浏览器，捕获会话 → 加密入库 */
  const handleLogin = useCallback(async (platform: "tiktok" | "instagram") => {
    setBuz(`login-${platform}`, true);
    setMsg(`login-${platform}`, "本机即将弹出浏览器，请在窗口内完成登录（最长等 5 分钟）…");
    try {
      const res = await fetch("/api/b2b/channels/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const d = await res.json();
      const payload = d.data as { ok?: boolean; message?: string } | undefined;
      setMsg(`login-${platform}`, payload?.message ?? (d.success ? "完成" : (d.error ?? "登录未完成")));
      if (d.success && payload?.ok) fetchAccounts();
    } catch (e) {
      setMsg(`login-${platform}`, e instanceof Error ? e.message : "登录请求失败");
    } finally {
      setBuz(`login-${platform}`, false);
    }
  }, [fetchAccounts]);

  /** 手动粘贴导入（浏览器扩展/脚本导出 cookie） */
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
        fetchAccounts();
      } else {
        setMsg("import", d.error ?? "导入失败");
      }
    } finally {
      setBuz("import", false);
    }
  }, [importOpen, importLabel, importSession, fetchAccounts]);

  /** 校验会话：真实只读探活 */
  const handleVerify = useCallback(async (id: string) => {
    setBuz(`verify-${id}`, true);
    setMsg(`verify-${id}`, "");
    try {
      const res = await fetch(`/api/b2b/channels/${id}/verify`, { method: "POST" });
      const d = await res.json();
      const payload = d.data as { status?: string; message?: string } | undefined;
      setMsg(`verify-${id}`, payload?.message ?? (d.success ? "已校验" : (d.error ?? "校验失败")));
      fetchAccounts();
    } finally {
      setBuz(`verify-${id}`, false);
    }
  }, [fetchAccounts]);

  const handleDelete = useCallback(async (id: string) => {
    setBuz(`del-${id}`, true);
    try {
      await fetch(`/api/b2b/channels/${id}`, { method: "DELETE" });
      fetchAccounts();
    } finally {
      setBuz(`del-${id}`, false);
    }
  }, [fetchAccounts]);

  const forPlatform = (p: ChannelPlatform) => accounts.filter((a) => a.platform === p);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border/60 bg-card/50 px-4 py-3 text-sm text-muted-foreground">
        会话经 <span className="text-foreground">AES-256-GCM 加密</span>保管在账号保险库（channel_accounts），
        主密钥只存于服务端环境变量。趋势页自动取用「有效」账号会话解锁全量功能；会话失效请重新登录。
        也可在 <Link href="/settings/b2b" className="text-primary underline-offset-4 hover:underline">设置 → B 端运营</Link> 配置单账号兜底会话。
      </div>

      {PLATFORMS.map((p) => {
        const list = forPlatform(p.key);
        const activeCount = list.filter((a) => a.status === "active").length;
        return (
          <Card key={p.key}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" />
                    {p.title}
                    {list.length > 0 && (
                      <Badge variant={activeCount > 0 ? "success" : "danger"} className="ml-1">
                        {activeCount}/{list.length} 有效
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{p.desc}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleLogin(p.key)} disabled={busy[`login-${p.key}`]}>
                    {busy[`login-${p.key}`]
                      ? <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      : <Plus className="mr-1 h-4 w-4" />}
                    站内登录
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setImportOpen(p.key); setMsg("import", ""); }}>
                    <KeyRound className="mr-1 h-4 w-4" />
                    粘贴导入
                  </Button>
                </div>
              </div>
              {message[`login-${p.key}`] && (
                <p className="mt-2 text-xs text-muted-foreground">{message[`login-${p.key}`]}</p>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="py-4 text-center text-sm text-muted-foreground">加载中…</p>
              ) : list.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  暂无账号——点上方「站内登录」弹出浏览器登录，或「粘贴导入」已有会话
                </p>
              ) : (
                <div className="space-y-3">
                  {list.map((a) => {
                    const badge = STATUS_BADGE[a.status];
                    return (
                      <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{a.label || "未命名账号"}</span>
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
                            校验会话
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
            </CardContent>
          </Card>
        );
      })}

      {importOpen && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">粘贴导入会话 — {importOpen === "tiktok" ? "TikTok" : "Instagram"}</CardTitle>
            <CardDescription>从已登录浏览器导出 cookie 串（格式 &quot;k=v; k2=v2&quot;，须含 sessionid）。导入后立即加密入库。</CardDescription>
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
    </div>
  );
}

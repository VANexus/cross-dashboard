"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Server, Save, Check, AlertTriangle, Database,
  Globe, ShoppingCart, Eye, EyeOff, Loader2, RefreshCw, Boxes, Wifi,
} from "lucide-react";
import type { B2BHealthStatus, B2BSettings, B2BSettingsGroup, B2BTestResult } from "@/lib/shared/types";

type GroupKey = B2BSettingsGroup;

interface GroupSpec {
  key: GroupKey;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  fields: Array<{
    settingKey: keyof B2BSettings;
    label: string;
    placeholder: string;
    type?: "text" | "password" | "url";
    hint?: string;
  }>;
}

/**
 * 服务化改造（2026-09-03）：本页只保留「业务凭证/登录态」。
 * 原「FlowMind MCP 地址」「LongCat Key」「AllIn Key」「浏览器 CDP 地址」输入框已退役——
 * 基础设施端点由集群服务目录自动解析（docs/architecture/2026-09-03-cluster-native-service-architecture.md §3），
 * 模型/生图凭据归 LiteLLM 网关与 flowmind-mcp Secret，不再进入浏览器与数据库。
 */
const GROUPS: GroupSpec[] = [
  {
    key: "channel",
    title: "渠道登录态（TikHub 主路径免配置）",
    desc: "会话 Cookie 仅用于解锁更多数据与旧自建回退路径。多账号保险库见「设置 → 渠道账号」",
    icon: Globe,
    fields: [
      {
        settingKey: "tiktokSessionCookie",
        label: "TikTok 会话（可选）",
        placeholder: "可选：sessionid=...; ...",
        type: "password",
        hint: "TikHub 主路径无需登录；填写后透传以解锁更多数据，也用于旧自建回退路径",
      },
      {
        settingKey: "instagramSessionCookie",
        label: "Instagram 会话（兜底）",
        placeholder: "可选：sessionid=...; ...",
        type: "password",
        hint: "仅旧自建回退路径（self_host）使用",
      },
    ],
  },
  {
    key: "alibaba",
    title: "阿里国际站 TOP（商品/上架）",
    desc: "TOP open platform：商品池同步 + 一键上架",
    icon: ShoppingCart,
    fields: [
      { settingKey: "alibabaAppKey", label: "App Key", placeholder: "xxxxxxxx", type: "password" },
      { settingKey: "alibabaAppSecret", label: "App Secret", placeholder: "xxxxxxxx", type: "password" },
      {
        settingKey: "alibabaSession",
        label: "Session（OAuth Access Token）",
        placeholder: "5000xxxxxxxxxx",
        type: "password",
        hint: "授权国际站账号后拿到，具备 product.list + icbu.open.product.post 权限",
      },
    ],
  },
];

interface CatalogService {
  id: string;
  name: string;
  layer: string;
  mode: "cluster" | "dev";
  url: string | null;
  browserUrl: string | null;
  note?: string;
}

const LAYER_LABEL: Record<string, string> = {
  app: "应用服务", data: "数据层", ai: "模型网关", search: "搜索", obs: "可观测",
};

export default function B2BSettingsPage() {
  const [settings, setSettings] = useState<B2BSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState<Partial<Record<keyof B2BSettings, boolean>>>({
    tiktokSessionCookie: false, instagramSessionCookie: false,
    alibabaAppKey: false,
    alibabaAppSecret: false, alibabaSession: false,
  });
  const [testing, setTesting] = useState<Partial<Record<GroupKey, boolean>>>({});
  const [testResults, setTestResults] = useState<Partial<Record<GroupKey, B2BTestResult>>>({});
  const [health, setHealth] = useState<B2BHealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [catalog, setCatalog] = useState<{ mode: string; services: CatalogService[] } | null>(null);

  const refreshHealth = useCallback(() => {
    setHealthLoading(true);
    fetch("/api/settings/b2b/health").then((r) => r.json()).then((d) => {
      if (d.success) setHealth(d.data);
    }).finally(() => setHealthLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/cluster/services").then((r) => r.json()).then((d) => {
      if (d.success) setCatalog(d.data);
    }).catch(() => {});
    fetch("/api/settings/b2b").then((r) => r.json()).then((d) => {
      if (d.success) setSettings(d.data);
    }).catch(() => {}).finally(() => refreshHealth());
  }, [refreshHealth]);

  const handleSave = useCallback(async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/b2b", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.data);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const handleTest = useCallback(async (group: GroupKey) => {
    setTesting((t) => ({ ...t, [group]: true }));
    try {
      const res = await fetch(`/api/settings/test/${group}`);
      const data = await res.json();
      if (data.success) {
        setTestResults((r) => ({ ...r, [group]: data.data }));
      }
    } finally {
      setTesting((t) => ({ ...t, [group]: false }));
    }
  }, []);

  const updateSetting = useCallback(<K extends keyof B2BSettings>(k: K, v: B2BSettings[K]) => {
    setSettings((s) => s ? { ...s, [k]: v } : s);
  }, []);

  const toggleKey = useCallback((k: keyof B2BSettings) => {
    setShowKey((s) => ({ ...s, [k]: !s[k] }));
  }, []);

  const healthGroupBadge = (g: GroupKey) => {
    const h = health?.groups[g];
    const t = testResults[g];
    const best = t ?? h;
    if (!best) return <Badge variant="outline">未检测</Badge>;
    if (best.ok) return <Badge className="bg-success hover:bg-success text-white">已连通 {best.latencyMs ? `· ${best.latencyMs}ms` : ""}</Badge>;
    return <Badge variant="destructive" title={best.error}>不可达 · 点击「测试连通」查看</Badge>;
  };

  const databaseHealth = useMemo(() => health?.database ?? null, [health]);
  const mcpHealth = testResults.mcp ?? health?.groups.mcp ?? null;
  const catalogMode = catalog?.mode === "cluster" ? "集群内" : catalog?.mode === "dev" ? "开发机" : "检测中";

  return (
    <div className="space-y-6">
      <PageHeader
        title="B 端运营配置"
        description="仅业务凭证与登录态——基础设施端点与密钥已服务化（集群服务自动发现 · 零配置）。"
        actions={<Button
          variant="outline"
          size="sm"
          onClick={refreshHealth}
          disabled={healthLoading}
        >
          {healthLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          刷新健康检查
        </Button>}
      />

      {/* 集群服务：自动连接（零配置） */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-sm">集群服务 · 自动连接（{catalogMode}模式）</CardTitle>
                <CardDescription>
                  端点由服务目录解析（lib/cluster），无需也无法在此填写地址或密钥；凭据由集群 Secret 注入。
                </CardDescription>
              </div>
            </div>
            {mcpHealth && (mcpHealth.ok
              ? <Badge className="bg-success hover:bg-success text-white">FlowMind MCP 已连通 {mcpHealth.latencyMs ? `· ${mcpHealth.latencyMs}ms` : ""}</Badge>
              : <Badge variant="destructive" title={mcpHealth.error}>FlowMind MCP 不可达</Badge>)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {(catalog?.services ?? []).map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    <Wifi className={`h-3 w-3 ${s.layer === "app" ? "text-success" : "text-muted-foreground"}`} />
                    {s.name}
                    <Badge variant="outline" className="text-tiny px-1 py-0">{LAYER_LABEL[s.layer] ?? s.layer}</Badge>
                  </div>
                  <div className="text-muted-foreground mt-0.5 font-mono">
                    {s.url ?? s.browserUrl ?? (s.layer === "app" ? "同源反代 · 内网直达" : "内网专属")}
                  </div>
                </div>
                {s.id === "flowmind.mcp" && (
                  mcpHealth?.ok
                    ? <Badge className="bg-success/90 text-tiny">自动</Badge>
                    : <Badge variant="secondary" className="text-tiny">启动后自动</Badge>
                )}
              </div>
            ))}
            {!catalog && (
              <div className="text-xs text-muted-foreground">正在读取集群服务目录…（/api/cluster/services）</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 数据面健康 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">数据面连接</CardTitle>
          </div>
          <CardDescription>
            当前：Supabase 云（P1 迁移完成后切换为集群 PG「pg-main」直连，见架构文档 §4）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">连接状态</div>
              <p className="text-xs text-muted-foreground">
                {databaseHealth
                  ? (databaseHealth.ok
                    ? `连接正常 · ${databaseHealth.latencyMs}ms · image-skills 表 ${databaseHealth.rowsInImageSkills} 行`
                    : `异常：${databaseHealth.error ?? "尚未检测"}`)
                  : "尚未检测，点击右上角「刷新健康检查」"}
              </p>
            </div>
            {databaseHealth?.ok
              ? <Badge className="bg-success hover:bg-success text-white">连接正常</Badge>
              : <Badge variant="destructive">连接异常</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* 业务凭证分组卡片 */}
      {settings && GROUPS.map((group) => {
        const Icon = group.icon;
        return (
          <Card key={group.key}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-sm">{group.title}</CardTitle>
                  </div>
                  <CardDescription>{group.desc}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {healthGroupBadge(group.key)}
                  <Button size="sm" variant="outline" onClick={() => handleTest(group.key)} disabled={!!testing[group.key]}>
                    {testing[group.key] ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Server className="h-4 w-4 mr-1" />}
                    测试连通
                  </Button>
                </div>
              </div>
              {testResults[group.key] && !testResults[group.key]!.ok && (
                <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">连通失败：{testResults[group.key]!.error}</div>
                    <div className="mt-1 opacity-80">请检查下方输入或参考文档获取正确的凭据。</div>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {group.fields.map((f) => (
                <div key={String(f.settingKey)} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`in-${String(f.settingKey)}`}>{f.label}</Label>
                    {f.type === "password" ? (
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => toggleKey(f.settingKey)}>
                        {showKey[f.settingKey] ? <><EyeOff className="h-3.5 w-3.5 mr-1" /> 隐藏</> : <><Eye className="h-3.5 w-3.5 mr-1" /> 显示</>}
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id={`in-${String(f.settingKey)}`}
                      type={f.type === "password" ? (showKey[f.settingKey] ? "text" : "password") : "text"}
                      value={settings[f.settingKey]}
                      onChange={(e) => updateSetting(f.settingKey, e.target.value)}
                      placeholder={f.placeholder}
                      autoComplete="off"
                    />
                  </div>
                  {f.hint ? <p className="text-xs text-muted-foreground">{f.hint}</p> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {/* 保存条 */}
      <div className="sticky bottom-4 z-10 rounded-xl border bg-background/90 backdrop-blur p-3 flex items-center justify-between">
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          保存后：关键词/商品/生图三页 degraded 缓存将自动清理，下次进入即可重试真实数据源。
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setSaved(false); refreshHealth(); }}>重置状态</Button>
          <Button onClick={handleSave} disabled={saving || !settings}>
            {saving
              ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> 保存中...</>
              : saved
                ? <><Check className="h-4 w-4 mr-1" /> 已保存</>
                : <><Save className="h-4 w-4 mr-1" /> 保存配置</>}
          </Button>
        </div>
      </div>

      <Separator />
    </div>
  );
}

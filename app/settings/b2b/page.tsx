"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Server, Save, Check, AlertTriangle, Key, Database,
  Globe, ShoppingCart, Palette, Zap, Send, Eye, EyeOff, Loader2, RefreshCw,
} from "lucide-react";
import type { B2BHealthStatus, B2BSettings, B2BSettingsGroup, B2BTestResult } from "@/lib/types";

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
  /** 渠道授权组：无内嵌字段时仅展示测试/状态 */
}

const GROUPS: GroupSpec[] = [
  {
    key: "mcp",
    title: "FlowMind MCP（Python 后端）",
    desc: "关键词趋势 / AI Listing / 生图 Skill 全部经由该 MCP 调度",
    icon: Server,
    fields: [{
      settingKey: "flowmindMcpUrl",
      label: "MCP HTTP 地址",
      placeholder: "http://127.0.0.1:8001/mcp",
      type: "url",
      hint: "默认 127.0.0.1:8001，flowmind-mcp-http 启动后点击「测试连通」即可",
    }],
  },
  {
    key: "channel",
    title: "渠道授权（浏览器直连）",
    desc: "主路径：直连你自己的浏览器（真实指纹 + 登录态，零风控）；粘贴会话仅作兜底。多账号管理见「B端运营 → 渠道授权」",
    icon: Globe,
    fields: [
      {
        settingKey: "browserDebugUrl",
        label: "浏览器 CDP 地址",
        placeholder: "http://127.0.0.1:9222",
        type: "url",
        hint: "浏览器需带调试端口启动：完全退出后执行 chrome.exe --remote-debugging-port=9222（Edge 用 msedge.exe）",
      },
      {
        settingKey: "tiktokSessionCookie",
        label: "TikTok 会话（兜底）",
        placeholder: "可选：sessionid=...; ...",
        type: "password",
        hint: "CDP 未连通时的兜底路径",
      },
      {
        settingKey: "instagramSessionCookie",
        label: "Instagram 会话（兜底）",
        placeholder: "可选：sessionid=...; ...",
        type: "password",
        hint: "CDP 未连通时的兜底路径",
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
  {
    key: "longcat",
    title: "LongCat LLM（长尾词 / Listing / 反推）",
    desc: "长尾词生成、TOP5 推荐打分、Listing 标题详情编写、Prompt 反推",
    icon: Zap,
    fields: [{
      settingKey: "longcatApiKey",
      label: "LongCat API Key",
      placeholder: "sk-xxxxxxxxxx",
      type: "password",
    }],
  },
  {
    key: "allin",
    title: "AllIn-API 生图（gpt-image-2）",
    desc: "主图 / 详情 / 社媒图出图，含 Skill 固化时的反推与生成",
    icon: Palette,
    fields: [{
      settingKey: "allinApiKey",
      label: "AllIn API Key",
      placeholder: "xxxxxxxxxx",
      type: "password",
    }],
  },
  {
    key: "webhook",
    title: "推送 Webhook（飞书 / 企微）",
    desc: "每日 08:00 关键词趋势榜单推送；填一个即可启用",
    icon: Send,
    fields: [
      { settingKey: "feishuWebhookUrl", label: "飞书机器人 Webhook", placeholder: "https://open.feishu.cn/open-apis/bot/v2/hook/xxxx", type: "url" },
      { settingKey: "wecomWebhookUrl", label: "企业微信群机器人 Webhook", placeholder: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxx", type: "url" },
    ],
  },
];

export default function B2BSettingsPage() {
  const [settings, setSettings] = useState<B2BSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState<Partial<Record<keyof B2BSettings, boolean>>>({
    flowmindMcpUrl: true, tiktokSessionCookie: false, instagramSessionCookie: false,
    alibabaAppKey: false,
    alibabaAppSecret: false, alibabaSession: false, longcatApiKey: false,
    allinApiKey: false, feishuWebhookUrl: true, wecomWebhookUrl: true,
  });
  const [testing, setTesting] = useState<Partial<Record<GroupKey, boolean>>>({});
  const [testResults, setTestResults] = useState<Partial<Record<GroupKey, B2BTestResult>>>({});
  const [health, setHealth] = useState<B2BHealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const refreshHealth = useCallback(() => {
    setHealthLoading(true);
    fetch("/api/settings/b2b/health").then((r) => r.json()).then((d) => {
      if (d.success) setHealth(d.data);
    }).finally(() => setHealthLoading(false));
  }, []);

  useEffect(() => {
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
    if (best.ok) return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">已连通 {best.latencyMs ? `· ${best.latencyMs}ms` : ""}</Badge>;
    return <Badge variant="destructive" title={best.error}>不可达 · 点击「测试连通」查看</Badge>;
  };

  const supabaseHealth = useMemo(() => {
    if (!health) return { ok: false, rowsInImageSkills: undefined, error: undefined, latencyMs: 0 };
    return health.supabase;
  }, [health]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">B 端运营配置</h1>
          <p className="text-sm text-muted-foreground">
            渠道授权登录 + 阿里 TOP / LongCat / AllIn / Webhook 密钥，保存后三功能页面将清除缓存并重试。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshHealth}
          disabled={healthLoading}
        >
          {healthLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          刷新健康检查
        </Button>
      </div>

      {/* Supabase 健康卡片 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">Supabase 数据库连接</CardTitle>
          </div>
          <CardDescription>
            云数据库（PostgreSQL）承载配置 / 关键词缓存 / 商品缓存 / Listing 草稿 / 生图 Skill
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">连接状态</div>
              <p className="text-xs text-muted-foreground">
                {supabaseHealth.ok
                  ? `连接正常 · ${supabaseHealth.latencyMs}ms · image-skills 表 ${supabaseHealth.rowsInImageSkills} 行`
                  : supabaseHealth.error ? `异常：${supabaseHealth.error}` : "尚未检测，点击右上角「刷新健康检查」"}
              </p>
            </div>
            {supabaseHealth.ok
              ? <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">连接正常</Badge>
              : <Badge variant="destructive">连接异常</Badge>}
          </div>
          <div className="grid gap-3 sm:grid-cols-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><Key className="h-3.5 w-3.5" /> <span>AI KV: ai_config</span></div>
            <div className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> <span>关键词: b2b_keyword_trends</span></div>
            <div className="flex items-center gap-2"><Palette className="h-3.5 w-3.5" /> <span>Skill: wf_image_skills</span></div>
          </div>
        </CardContent>
      </Card>

      {/* 密钥分组卡片 */}
      {settings && GROUPS.map((group) => {
        const Icon = group.icon;
        const spec = GROUPS.find((g) => g.key === group.key)!;
        return (
          <Card key={group.key}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-sm">{spec.title}</CardTitle>
                  </div>
                  <CardDescription>{spec.desc}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {healthGroupBadge(group.key)}
                  <Button size="sm" variant="outline" onClick={() => handleTest(group.key)} disabled={!!testing[group.key]}>
                    {testing[group.key] ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
                    测试连通
                  </Button>
                </div>
              </div>
              {testResults[group.key] && !testResults[group.key]!.ok && (
                <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">连通失败：{testResults[group.key]!.error}</div>
                    <div className="mt-1 opacity-80">请检查下方输入或参考文档获取正确的 Key。</div>
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

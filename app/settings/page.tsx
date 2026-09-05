"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Server, Bell, Shield, Brain, Save, Check, Layout } from "lucide-react";

interface AIConfig {
  provider: string;
  model: string;
  baseUrl: string;
  maxTokens: number;
  temperature: number;
}

const PROVIDERS = [
  { value: "openai", label: "OpenAI 兼容" },
  { value: "claude", label: "Claude 兼容" },
];

export default function SettingsPage() {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  /** 动态页面编辑器开关（默认关 = /p/ 页纯只读；AI 上下文增量不受影响） */
  const [pageEditor, setPageEditor] = useState(false);
  const [pageEditorLoaded, setPageEditorLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/ai/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setConfig(d.data);
        }
      })
      .catch(() => {});
    fetch("/api/settings/ui")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setPageEditor(Boolean(d.data.pageEditorEnabled));
        }
      })
      .catch(() => {})
      .finally(() => setPageEditorLoaded(true));
  }, []);

  const toggleEditor = useCallback(async (value: boolean) => {
    const prev = pageEditor;
    setPageEditor(value);
    try {
      const res = await fetch("/api/settings/ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageEditorEnabled: value }),
      });
      const d = await res.json();
      if (!d.success) setPageEditor(prev);
    } catch {
      setPageEditor(prev);
    }
  }, [pageEditor]);

  const handleSave = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    setSaved(false);
    try {
      const body: Record<string, string> = {
        provider: config.provider,
        model: config.model,
        base_url: config.baseUrl,
        max_tokens: String(config.maxTokens),
        temperature: String(config.temperature),
      };
      if (apiKey) body.api_key = apiKey;
      const res = await fetch("/api/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
        setApiKey("");
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }, [config, apiKey]);

  const update = <K extends keyof AIConfig>(key: K, value: AIConfig[K]) => {
    setConfig((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="系统设置"
        description="配置 FlowMind 系统参数"
      />

      {/* AI 配置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">AI 模型配置</CardTitle>
          </div>
          <CardDescription>配置 AI 服务商和模型参数</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>服务商</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={config.provider}
                    onChange={(e) => update("provider", e.target.value)}
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>模型</Label>
                  <Input
                    value={config.model}
                    onChange={(e) => update("model", e.target.value)}
                    placeholder="mimo-v2.5-pro"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>API Base URL</Label>
                <Input
                  value={config.baseUrl}
                  onChange={(e) => update("baseUrl", e.target.value)}
                  placeholder="https://api.openai.com"
                />
              </div>

              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex gap-2">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="留空则不更新"
                  />
                  <Button variant="outline" size="sm" onClick={() => setShowKey(!showKey)} className="shrink-0">
                    {showKey ? "隐藏" : "显示"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    value={config.maxTokens}
                    onChange={(e) => update("maxTokens", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Temperature</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={config.temperature}
                    onChange={(e) => update("temperature", Number(e.target.value))}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => { setApiKey(""); window.location.reload(); }}>重置</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "保存中..." : saved ? <><Check className="h-4 w-4 mr-1" />已保存</> : <><Save className="h-4 w-4 mr-1" />保存配置</>}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">加载中...</div>
          )}
        </CardContent>
      </Card>

      {/* 动态页面设置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layout className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">动态页面</CardTitle>
          </div>
          <CardDescription>AI 动态页面（/p/…）的展示与编排行为</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-medium">页面编辑器</span>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                默认关闭 = 纯只读展示（推荐）。开启后组件上会显示工具条 / 序号角标 / 就地 JSON 编辑，供高阶团队微调。
                AI 的「页面即上下文」增量与全页统一编排不依赖此开关，始终可对话驱动。
              </p>
            </div>
            <Switch checked={pageEditor} disabled={!pageEditorLoaded} onCheckedChange={(v) => void toggleEditor(v)} />
          </div>
        </CardContent>
      </Card>

      {/* 服务器配置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">服务器配置</CardTitle>
          </div>
          <CardDescription>服务器连接和部署配置</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="host">服务器地址</Label>
              <Input id="host" defaultValue="192.168.1.100" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">端口</Label>
              <Input id="port" defaultValue="3000" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>部署方式</Label>
            <div className="flex items-center gap-2">
              <Badge>Docker</Badge>
              <Badge variant="outline">单机部署</Badge>
              <span className="text-xs text-muted-foreground">8核 · 16GB RAM · 200GB SSD</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 通知设置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">通知设置</CardTitle>
          </div>
          <CardDescription>配置告警通知方式和频率</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Ⅰ级告警通知", description: "立即推送告警", defaultChecked: true },
            { label: "Ⅱ级告警通知", description: "告警消息推送", defaultChecked: true },
            { label: "Ⅲ级预警通知", description: "每日汇总推送", defaultChecked: true },
            { label: "任务完成通知", description: "任务完成消息推送", defaultChecked: false },
            { label: "Agent异常通知", description: "立即推送异常告警", defaultChecked: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">{item.label}</span>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Switch defaultChecked={item.defaultChecked} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 安全设置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">安全设置</CardTitle>
          </div>
          <CardDescription>安全策略和访问控制</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Dev区沙箱隔离", description: "开发区代码在独立沙箱中运行", defaultChecked: true },
            { label: "自动熔断", description: "风险达到Ⅱ级时自动触发熔断", defaultChecked: true },
            { label: "操作审计日志", description: "记录所有Agent操作日志", defaultChecked: true },
            { label: "双因素认证", description: "登录时需要二次验证", defaultChecked: false },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">{item.label}</span>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Switch defaultChecked={item.defaultChecked} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

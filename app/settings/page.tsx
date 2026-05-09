"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, Server, Bell, Key, Database, Shield } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">系统设置</h1>
        <p className="text-sm text-muted-foreground">配置 FlowMind 系统参数</p>
      </div>

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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">API 密钥</CardTitle>
          </div>
          <CardDescription>管理外部服务 API 密钥</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { name: "Claude API Key", value: "sk-ant-***...***", status: "active" },
            { name: "GPT-4o API Key", value: "sk-***...***", status: "active" },
            { name: "Feishu App ID", value: "cli_***...***", status: "active" },
            { name: "n8n Webhook URL", value: "https://n8n.example.com/...", status: "active" },
          ].map((key) => (
            <div key={key.name} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <span className="text-sm font-medium">{key.name}</span>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">{key.value}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="success" className="text-[10px]">已配置</Badge>
                <Button variant="ghost" size="sm" className="h-7 text-xs">编辑</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

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
            { label: "Ⅰ级告警通知", description: "立即推送飞书 + 短信", defaultChecked: true },
            { label: "Ⅱ级告警通知", description: "飞书消息推送", defaultChecked: true },
            { label: "Ⅲ级预警通知", description: "每日汇总推送", defaultChecked: true },
            { label: "任务完成通知", description: "飞书消息推送", defaultChecked: false },
            { label: "Agent异常通知", description: "立即推送飞书", defaultChecked: true },
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

      <div className="flex justify-end gap-3">
        <Button variant="outline">重置</Button>
        <Button>保存设置</Button>
      </div>
    </div>
  );
}

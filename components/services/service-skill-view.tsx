/**
 * FlowMind — 技能视图（schema 驱动的动态渲染器）
 *
 * 根据 discovered skill 的 inputSchema 动态生成输入表单，
 * 调用技能，并展示结果。无需为每个技能硬编码 UI。
 *
 * 如果 skill 未在注册表中找到（后端未连接或技能不存在），
 * 显示引导信息帮助用户配置后端。
 */
"use client";

import { useState, useMemo } from "react";
import { useDiscovery } from "@/components/providers/discovery-provider";
import type {
  DiscoveredSkill,
  SkillExecutionResult,
  SkillJsonSchema,
} from "@/lib/mcp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { Loader2, Play, AlertCircle, CheckCircle2, Braces } from "lucide-react";

interface ServiceSkillViewProps {
  serviceId: string;
  skillId: string;
}

export function ServiceSkillView({
  serviceId,
  skillId,
}: ServiceSkillViewProps) {
  const { manifests, executeSkill, initialized } = useDiscovery();

  // 从注册表查找技能
  const skill = useMemo<DiscoveredSkill | null>(() => {
    const manifest = manifests[serviceId];
    if (!manifest) return null;
    return manifest.skills.find((s) => s.id === skillId) ?? null;
  }, [manifests, serviceId, skillId]);

  const manifest = manifests[serviceId];

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<SkillExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 表单输入处理
  const updateField = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // 执行技能
  const handleExecute = async () => {
    setExecuting(true);
    setError(null);
    setResult(null);
    try {
      const res = await executeSkill(serviceId, skillId, formData);
      setResult(res);
      if (!res.ok) {
        setError(res.error?.message ?? "技能执行失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExecuting(false);
    }
  };

  // ── 状态 1：后端未连接 ──
  if (!initialized || (!manifest && !skill)) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <h1 className="text-2xl font-bold">{skillId}</h1>
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertCircle className="h-5 w-5" />
              服务未连接
            </CardTitle>
            <CardDescription>
              无法找到服务 &quot;{serviceId}&quot; 的技能清单。请确认：
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. 后端服务已启动并可达</p>
            <p>2. 环境变量配置正确（如 NEXT_PUBLIC_FLOWMIND_URL）</p>
            <p>3. 在设置页配置了后端连接</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── 状态 2：技能不存在 ──
  if (!skill) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <h1 className="text-2xl font-bold">{skillId}</h1>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              技能不存在
            </CardTitle>
            <CardDescription>
              服务 &quot;{manifest?.serviceName ?? serviceId}&quot; 未暴露技能 &quot;{skillId}&quot;
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // ── 状态 3：正常渲染 ──
  const inputSchema = skill.inputSchema;
  const properties = inputSchema?.properties ?? {};
  const required = inputSchema?.required ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 头部 */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{skill.name}</h1>
            <StatusDot
              status={manifest.health === "connected" ? "success" : "warning"}
              size="sm"
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {skill.description || "暂无描述"}
          </p>
          <div className="mt-2 flex gap-2">
            <span className="rounded bg-muted px-2 py-0.5 text-xs">
              {skill.protocol.toUpperCase()}
            </span>
            <span className="rounded bg-muted px-2 py-0.5 text-xs">
              {skill.category}
            </span>
            <span className="rounded bg-muted px-2 py-0.5 text-xs">
              v{skill.version}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 输入表单 */}
        <Card>
          <CardHeader>
            <CardTitle>输入参数</CardTitle>
            <CardDescription>
              {Object.keys(properties).length > 0
                ? "填写技能输入参数"
                : "该技能无定义输入参数（将使用空参数调用）"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(properties).map(([key, schema]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key}>
                  {key}
                  {required.includes(key) && (
                    <span className="ml-1 text-destructive">*</span>
                  )}
                  {schema.description && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {schema.description}
                    </span>
                  )}
                </Label>
                {renderInput(key, schema, formData[key], updateField)}
              </div>
            ))}

            <Button
              onClick={handleExecute}
              disabled={executing}
              className="w-full gap-2"
            >
              {executing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {executing ? "执行中..." : "执行技能"}
            </Button>
          </CardContent>
        </Card>

        {/* 结果展示 */}
        <Card>
          <CardHeader>
            <CardTitle>执行结果</CardTitle>
            <CardDescription>
              {result
                ? result.ok
                  ? `执行成功（${result.durationMs}ms）`
                  : "执行失败"
                : "点击「执行技能」查看结果"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {result?.ok && (
              <div className="mb-4 flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                执行成功
                {result.metrics?.degraded && (
                  <span className="text-warning">
                   （降级：{result.metrics.degradationReason}）
                  </span>
                )}
              </div>
            )}

            {result && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Braces className="h-3 w-3" />
                  返回数据
                </div>
                <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}

            {!result && !error && (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                等待执行...
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Schema 驱动的输入渲染 ──

function renderInput(
  key: string,
  schema: SkillJsonSchema,
  value: unknown,
  onChange: (key: string, value: unknown) => void,
): React.ReactNode {
  const val = value ?? schema.default ?? "";

  // enum → select
  if (schema.enum && schema.enum.length > 0) {
    return (
      <select
        id={key}
        value={String(val)}
        onChange={(e) => onChange(key, e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
      >
        <option value="">请选择...</option>
        {schema.enum.map((opt) => (
          <option key={String(opt)} value={String(opt)}>
            {String(opt)}
          </option>
        ))}
      </select>
    );
  }

  // boolean
  if (schema.type === "boolean") {
    return (
      <input
        id={key}
        type="checkbox"
        checked={Boolean(val)}
        onChange={(e) => onChange(key, e.target.checked)}
        className="h-4 w-4 rounded border-input"
      />
    );
  }

  // number / integer
  if (schema.type === "number" || schema.type === "integer") {
    return (
      <Input
        id={key}
        type="number"
        value={val as number | string}
        onChange={(e) => onChange(key, e.target.value)}
        placeholder={schema.description}
      />
    );
  }

  // array (simple — comma separated)
  if (schema.type === "array") {
    return (
      <Input
        id={key}
        value={Array.isArray(val) ? val.join(", ") : String(val)}
        onChange={(e) =>
          onChange(
            key,
            e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
          )
        }
        placeholder="逗号分隔的列表"
      />
    );
  }

  // object → JSON textarea
  if (schema.type === "object") {
    return (
      <Textarea
        id={key}
        value={typeof val === "object" ? JSON.stringify(val, null, 2) : String(val)}
        onChange={(e) => {
          try {
            onChange(key, JSON.parse(e.target.value));
          } catch {
            onChange(key, e.target.value);
          }
        }}
        placeholder='{"key": "value"}'
        rows={4}
      />
    );
  }

  // string (long → textarea)
  if (schema.type === "string") {
    if (schema.description && schema.description.length > 40) {
      return (
        <Textarea
          id={key}
          value={String(val)}
          onChange={(e) => onChange(key, e.target.value)}
          placeholder={schema.description}
          rows={3}
        />
      );
    }
    return (
      <Input
        id={key}
        value={String(val)}
        onChange={(e) => onChange(key, e.target.value)}
        placeholder={schema.description}
      />
    );
  }

  // fallback → text input
  return (
    <Input
      id={key}
      value={String(val)}
      onChange={(e) => onChange(key, e.target.value)}
      placeholder={schema.description ?? schema.type}
    />
  );
}

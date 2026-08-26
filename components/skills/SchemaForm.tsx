/**
 * FlowMind — 技能入参表单（Schema 驱动）
 *
 * 根据技能的 input_schema 动态生成表单字段，无需为每个技能手写表单。
 * 支持的字段类型（体现「通用但多样」）：
 *   text / textarea / number / boolean(switch) / select(enum) / array(标签输入)
 */
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JSONSchema } from "@/lib/skills";

/** 表单渲染所需的字段描述（比 JSONSchema 更具体） */
interface FieldSchema {
  type?: string;
  title?: string;
  description?: string;
  format?: string;
  enum?: string[];
  default?: unknown;
}

export interface SchemaFormProps {
  schema: JSONSchema | null;
  /** 受控值对象，由父组件持有 */
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
}

/** 判断字段是否为长文本（描述性文本） */
function isTextarea(prop: FieldSchema): boolean {
  return (
    prop.format === "textarea" ||
    (prop.type === "string" && !prop.enum && (prop.description?.length ?? 0) > 12)
  );
}

/** 判断字段是否为枚举下拉 */
function isSelect(prop: FieldSchema): boolean {
  return Array.isArray(prop.enum) && prop.enum.length > 0;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function SchemaForm({ schema, value, onChange, disabled }: SchemaFormProps) {
  const [arrayDraft, setArrayDraft] = useState<Record<string, string>>({});

  if (!schema?.properties) {
    return (
      <p className="text-sm text-muted-foreground">该技能无需结构化入参，可直接运行。</p>
    );
  }

  const props = schema.properties as unknown as Record<string, FieldSchema>;
  const required = new Set(
    Array.isArray(schema.required) ? (schema.required as unknown as string[]) : [],
  );

  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v });

  const pushArray = (key: string) => {
    const draft = (arrayDraft[key] ?? "").trim();
    if (!draft) return;
    const cur = Array.isArray(value[key]) ? (value[key] as string[]) : [];
    set(key, [...cur, draft]);
    setArrayDraft((d) => ({ ...d, [key]: "" }));
  };

  const removeArray = (key: string, idx: number) => {
    const cur = (value[key] as string[]) ?? [];
    set(key, cur.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(props).map(([key, prop]) => {
        const label = asString(prop.title) || key;
        const isReq = required.has(key);
        const current = value[key];

        return (
          <div key={key} className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              {label}
              {isReq && <span className="ml-1 text-destructive">*</span>}
            </Label>

            {prop.type === "boolean" ? (
              <div className="flex items-center gap-2">
                <Switch
                  checked={Boolean(current)}
                  onCheckedChange={(v) => set(key, v)}
                  disabled={disabled}
                />
                <span className="text-sm text-muted-foreground">{current ? "开" : "关"}</span>
              </div>
            ) : prop.type === "number" || prop.type === "integer" ? (
              <Input
                type="number"
                value={current === undefined || current === null ? "" : String(current)}
                placeholder={prop.description}
                disabled={disabled}
                onChange={(e) => set(key, e.target.value === "" ? undefined : Number(e.target.value))}
                className="font-mono"
              />
            ) : isSelect(prop) ? (
              <select
                className={cn(
                  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                )}
                value={String(current ?? prop.default ?? "")}
                disabled={disabled}
                onChange={(e) => set(key, e.target.value)}
              >
                {(prop.enum ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : prop.type === "array" ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {(Array.isArray(current) ? (current as string[]) : []).map((item, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-accent/50 px-2.5 py-0.5 text-xs"
                    >
                      {item}
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => removeArray(key, i)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`删除 ${item}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={arrayDraft[key] ?? ""}
                    placeholder="输入后回车添加"
                    disabled={disabled}
                    onChange={(e) => setArrayDraft((d) => ({ ...d, [key]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        pushArray(key);
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => pushArray(key)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input hover:bg-accent"
                    aria-label="添加"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : isTextarea(prop) ? (
              <Textarea
                value={asString(current)}
                placeholder={prop.description}
                disabled={disabled}
                onChange={(e) => set(key, e.target.value)}
                className="min-h-[72px]"
              />
            ) : (
              <Input
                value={asString(current)}
                placeholder={prop.description}
                disabled={disabled}
                onChange={(e) => set(key, e.target.value)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

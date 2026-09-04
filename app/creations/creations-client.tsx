"use client";

/**
 * 统一成果库 — 豆包式「我的生成」管理页
 *
 * 集中浏览所有 AI 生成产物（文案/创意/生图/Agent动态页），
 * 按类型分组 + 搜索过滤 + 回看跳转。数据来自 /api/creations。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FileText, Lightbulb, Image as ImageIcon, Layout, Search, Loader2, ExternalLink, RefreshCw,
} from "lucide-react";
import type { CreationType } from "@/lib/server/services/creations.service";

interface CreationItem {
  id: string;
  type: CreationType;
  title: string;
  summary: string;
  url?: string;
  platform?: string;
  createdAt: string;
  updatedAt: string;
  href?: string;
}

const TYPE_META: Record<CreationType, { label: string; icon: typeof FileText; tone: string }> = {
  draft: { label: "文案", icon: FileText, tone: "from-primary/20 to-primary/5" },
  idea: { label: "创意", icon: Lightbulb, tone: "from-amber/20 to-amber/5" },
  image: { label: "图片", icon: ImageIcon, tone: "from-info/20 to-info/5" },
  page: { label: "动态页", icon: Layout, tone: "from-success/20 to-success/5" },
};

const PLATFORM_LABEL: Record<string, string> = {
  xhs: "小红书",
  wechat: "公众号",
  douyin: "抖音",
};

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function CreationsClient() {
  const [items, setItems] = useState<CreationItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<CreationType | "all">("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/creations?limit=300");
      const json = (await res.json()) as { success?: boolean; data?: { items: CreationItem[]; counts: Record<string, number> } };
      if (json.success && json.data) {
        setItems(json.data.items);
        setCounts(json.data.counts);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = filter === "all" ? items : items.filter((i) => i.type === filter);
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(query) ||
          i.summary.toLowerCase().includes(query) ||
          (i.platform ?? "").toLowerCase().includes(query),
      );
    }
    return list;
  }, [items, filter, q]);

  const totalCount = useMemo(
    () => Object.values(counts).reduce((a, b) => a + (b || 0), 0),
    [counts],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="统一成果库"
        description="豆包式管理所有 AI 生成产物 · 文案 / 创意 / 图片 / 动态页"
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            刷新
          </Button>
        }
      />

      {/* 搜索 + 类型过滤 */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索标题 / 摘要 / 平台…"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["all", "draft", "idea", "image", "page"] as const).map((f) => {
                const meta = f === "all" ? { label: "全部", icon: Layout } : TYPE_META[f];
                const Icon = meta.icon;
                const count = f === "all" ? totalCount : counts[f] ?? 0;
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      filter === f
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {meta.label}
                    <span className="font-mono text-tiny opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 成果列表 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Layout className="h-4 w-4 text-primary" /> {filter === "all" ? "全部成果" : `${TYPE_META[filter].label}成果`}
          </CardTitle>
          <CardDescription>{filtered.length} 条生成产物</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading && items.length === 0 ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              暂无成果。去「内容创作」生成文案/创意/图片，或让 Agent 动态生成页面后回来看。
            </p>
          ) : (
            <div className="grid gap-px bg-border/60 sm:grid-cols-2">
              {filtered.map((item) => {
                const meta = TYPE_META[item.type];
                const Icon = meta.icon;
                return (
                  <a
                    key={`${item.type}-${item.id}`}
                    href={item.href}
                    target={item.type === "page" ? "_blank" : undefined}
                    className={cn(
                      "group flex gap-3 bg-card p-3 hover:bg-muted/40",
                      "transition-colors",
                    )}
                  >
                    {/* 缩略图：图片类显示图，其余类型角标 */}
                    {item.type === "image" && item.url ? (
                      <img
                        src={item.url}
                        alt={item.title}
                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className={cn(
                          "flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-muted-foreground",
                          meta.tone,
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="shrink-0">{meta.label}</Badge>
                        {item.platform && PLATFORM_LABEL[item.platform] && (
                          <span className="text-tiny text-muted-foreground">{PLATFORM_LABEL[item.platform]}</span>
                        )}
                        <span className="ml-auto text-tiny text-muted-foreground/70">{fmtTime(item.updatedAt)}</span>
                      </div>
                      <div className="mt-1 truncate text-sm font-medium group-hover:text-primary">{item.title}</div>
                      <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.summary}</div>
                    </div>
                    {item.href && (
                      <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 group-hover:text-primary" />
                    )}
                  </a>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
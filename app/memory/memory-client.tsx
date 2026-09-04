"use client";

import { PageHeader } from "@/components/ui/page-header";
import dynamic from "next/dynamic";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Brain,
  Search,
  Database,
  Lightbulb,
  FileText,
  Clock,
  Link as LinkIcon,
  BarChart3,
  TrendingUp,
  Zap,
  Plus,
  Trash2,
  History,
  CheckCircle2,
  Sparkles,
  RotateCw,
} from "lucide-react";
import type { MemoryEntry } from "@/lib/shared/types";

const AnimatedNumber = dynamic(
  () => import("@/components/ui/animated-number").then((m) => ({ default: m.AnimatedNumber })),
  { ssr: false },
);

const typeConfig: Record<MemoryEntry["type"], { label: string; icon: typeof Database; color: string; bg: string }> = {
  script: { label: "脚本", icon: Database, color: "text-viz-1", bg: "bg-viz-1/10" },
  code: { label: "代码", icon: FileText, color: "text-viz-4", bg: "bg-viz-4/10" },
  prompt: { label: "提示词", icon: Lightbulb, color: "text-viz-3", bg: "bg-viz-3/10" },
  skill: { label: "技能", icon: BarChart3, color: "text-viz-2", bg: "bg-viz-2/10" },
  insight: { label: "洞察", icon: Brain, color: "text-viz-5", bg: "bg-viz-5/10" },
};

const zoneConfig: Record<MemoryEntry["zone"], { label: string; color: string; bg: string }> = {
  preset: { label: "预设区", color: "text-viz-1", bg: "bg-viz-1/10" },
  dev: { label: "开发区", color: "text-viz-3", bg: "bg-viz-3/10" },
  prompt: { label: "提示区", color: "text-viz-4", bg: "bg-viz-4/10" },
  agent: { label: "Agent区", color: "text-viz-2", bg: "bg-viz-2/10" },
};

interface MemoryClientProps {
  initialData: MemoryEntry[];
  agents: Array<{ id: string; name: string }>;
  indexStats: { count: number; exists: boolean };
}

interface HistoryItem {
  memoryId: string;
  action: "create" | "update" | "delete";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  version: number;
  at: string;
}

const emptyForm = { zone: "preset", title: "", content: "", type: "insight", tags: "", agentId: "" };

export function MemoryClient({ initialData, agents, indexStats }: MemoryClientProps) {
  const router = useRouter();
  const [items, setItems] = useState<MemoryEntry[]>(initialData);
  const [search, setSearch] = useState("");
  const [semanticOn, setSemanticOn] = useState(false);
  const [semanticResults, setSemanticResults] = useState<Array<MemoryEntry & { score: number }> | null>(null);
  const [searching, setSearching] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<MemoryEntry | null>(null);
  const [editForm, setEditForm] = useState({ title: "", content: "", tags: "" });

  const [historyFor, setHistoryFor] = useState<MemoryEntry | null>(null);
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [rebuilding, setRebuilding] = useState(false);

  useEffect(() => {
    if (!semanticOn || !search.trim()) return;
    const t = setTimeout(() => void runSemanticSearch(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, semanticOn]);

  async function runSemanticSearch() {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/memory/search?q=${encodeURIComponent(search.trim())}&limit=15`);
      const json = await res.json();
      setSemanticResults(json.data ?? []);
    } catch {
      toast.error("语义检索失败");
    } finally {
      setSearching(false);
    }
  }

  const localFiltered = useMemo(() => {
    return items.filter((m) => {
      const matchSearch =
        m.content.toLowerCase().includes(search.toLowerCase()) ||
        m.title.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || m.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [items, search, typeFilter]);

  const displayed = semanticOn && semanticResults ? semanticResults : localFiltered;

  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of items) c[m.type] = (c[m.type] ?? 0) + 1;
    return c;
  }, [items]);

  async function handleCreate() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        zone: form.zone,
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        tags: form.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      };
      if (form.agentId) body.agentId = form.agentId;
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "创建失败");
      toast.success("记忆已创建并写入语义索引（Milvus）");
      setCreateOpen(false);
      setForm(emptyForm);
      router.refresh();
      // 本地同步
      setItems((prev) => [json.data, ...prev]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/memory/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title.trim(),
          content: editForm.content.trim(),
          tags: editForm.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存失败");
      toast.success("记忆已更新（向量已重算）");
      setEditing(null);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleVerified(m: MemoryEntry) {
    const res = await fetch(`/api/memory/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: !m.verified }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, verified: !m.verified } : x)));
      router.refresh();
    }
  }

  async function handleDelete(m: MemoryEntry) {
    if (!confirm(`确认删除记忆「${m.title}」？将同时移除 Milvus 向量索引。`)) return;
    const res = await fetch(`/api/memory/${m.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("记忆已删除（PG + Milvus + 历史已记录）");
      setItems((prev) => prev.filter((x) => x.id !== m.id));
      router.refresh();
    } else {
      toast.error("删除失败");
    }
  }

  async function openHistory(m: MemoryEntry) {
    setHistoryFor(m);
    const res = await fetch(`/api/memory/${m.id}/history`);
    const json = await res.json();
    setHistoryData(json.data?.history ?? []);
    setHistoryOpen(true);
  }

  async function handleRebuild() {
    if (!confirm("将清空 Milvus 索引并从 PG 全量重建，确认？")) return;
    setRebuilding(true);
    try {
      const res = await fetch("/api/memory/rebuild", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "重建失败");
      toast.success(`语义索引重建完成：${json.data?.total ?? 0} 条`);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRebuilding(false);
    }
  }

  const zoneOptions: MemoryEntry["zone"][] = ["preset", "dev", "prompt", "agent"];

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="记忆系统"
        description="PG 事实源 · Milvus 语义索引（dense + BM25 混合检索）· Mongo 版本历史"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleRebuild} disabled={rebuilding}>
              <RotateCw className={cn("h-4 w-4 mr-1", rebuilding && "animate-spin")} />
              {rebuilding ? "重建中..." : "重建索引"}
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              新建记忆
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 grid-cols-5">
        {Object.entries(typeConfig).map(([key, cfg]) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <cfg.icon className="h-3 w-3" /> {cfg.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AnimatedNumber value={typeCounts[key] ?? 0} className="text-2xl font-bold" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={semanticOn ? "输入语义检索词（Milvus 混合检索）..." : "搜索记忆（本地过滤）..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-24"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs">
            {searching && <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />}
            <Switch checked={semanticOn} onCheckedChange={setSemanticOn} className="scale-75" />
            <span className="text-muted-foreground">语义</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant={typeFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("all")}>
            全部
          </Button>
          {Object.entries(typeConfig).map(([key, cfg]) => (
            <Button
              key={key}
              variant={typeFilter === key ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter(key)}
            >
              {cfg.label}
            </Button>
          ))}
        </div>
        {semanticOn && (
          <Badge variant="secondary" className="text-xs">
            Milvus 索引 {indexStats.exists ? `${indexStats.count} 条` : "未初始化"}
          </Badge>
        )}
      </div>

      <div className="grid gap-6 grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {displayed.map((memory) => {
                const cfg = typeConfig[memory.type];
                const zone = zoneConfig[memory.zone];
                const Icon = cfg.icon;
                const isSemanticHit = semanticOn && "score" in memory;
                return (
                  <div key={memory.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", cfg.bg, cfg.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">{memory.content}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-tiny text-muted-foreground flex items-center gap-1">
                          <LinkIcon className="h-2.5 w-2.5" /> {memory.title}
                        </span>
                        <span className="text-tiny text-muted-foreground flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" /> {memory.createdAt}
                        </span>
                        <Badge variant="outline" className={cn(zone.color, zone.bg, "border-0 text-tiny h-4")}>
                          {zone.label}
                        </Badge>
                        {isSemanticHit && (
                          <Badge variant="secondary" className="border-0 text-tiny h-4">
                            相关度 {(memory as MemoryEntry & { score: number }).score}
                          </Badge>
                        )}
                        {memory.verified && (
                          <Badge variant="outline" className="border-0 text-tiny h-4 text-emerald-500 bg-emerald-500/10">
                            <CheckCircle2 className="h-3 w-3 mr-0.5" /> 已验证
                          </Badge>
                        )}
                        {memory.agentId && (
                          <Badge variant="outline" className="border-0 text-tiny h-4">
                            {memory.agentId}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="版本历史"
                        onClick={() => void openHistory(memory)}>
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="编辑"
                        onClick={() => {
                          setEditing(memory);
                          setEditForm({ title: memory.title, content: memory.content, tags: (memory.tags ?? []).join(",") });
                        }}>
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="验证/取消验证"
                        onClick={() => void handleToggleVerified(memory)}>
                        <CheckCircle2 className={cn("h-3.5 w-3.5", memory.verified ? "text-emerald-500" : "text-muted-foreground")} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" title="删除"
                        onClick={() => void handleDelete(memory)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {displayed.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Brain className="h-8 w-8 mb-2" />
                  <p className="text-sm">{semanticOn ? "未检索到相关记忆" : "未找到匹配的记忆"}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              类型分布
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(typeConfig).map(([key, cfg]) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs">{cfg.label}</span>
                  <span className="text-xs font-medium">{typeCounts[key] ?? 0}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", cfg.bg)}
                    style={{
                      width: `${items.length > 0 ? Math.round(((typeCounts[key] ?? 0) / items.length) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">语义索引（Milvus）</p>
              <p className="text-sm font-medium">{indexStats.exists ? `${indexStats.count} 条向量` : "未初始化（写入时自动创建）"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 新建记忆 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新建记忆</DialogTitle>
            <DialogDescription>写入 PG 并同步 Milvus 语义索引 + Mongo 版本历史</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>分区</Label>
                <Select value={form.zone} onValueChange={(v) => setForm({ ...form, zone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {zoneOptions.map((z) => (
                      <SelectItem key={z} value={z}>{zoneConfig[z].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>类型</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeConfig).map(([k, c]) => (
                      <SelectItem key={k} value={k}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>标题</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="记忆标题" />
            </div>
            <div className="space-y-2">
              <Label>内容</Label>
              <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="记忆正文（将参与向量化）" rows={5} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>标签（逗号分隔）</Label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="fba,补货" />
              </div>
              <div className="space-y-2">
                <Label>归属 Agent（可选）</Label>
                <Select value={form.agentId} onValueChange={(v) => setForm({ ...form, agentId: v })}>
                  <SelectTrigger><SelectValue placeholder="不归属" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">不归属</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={() => void handleCreate()} disabled={saving || !form.title.trim() || !form.content.trim()}>
              {saving ? "写入中..." : "创建并索引"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑 */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑记忆</DialogTitle>
            <DialogDescription>保存后内容变化将重算 Milvus 向量</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>标题</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>内容</Label>
              <Textarea value={editForm.content} onChange={(e) => setEditForm({ ...editForm, content: e.target.value })} rows={5} />
            </div>
            <div className="space-y-2">
              <Label>标签</Label>
              <Input value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
            <Button onClick={() => void handleSaveEdit()} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 版本历史 */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>版本历史 · {historyFor?.title}</DialogTitle>
            <DialogDescription>Mongo 中的不可变变更审计（create/update/delete）</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {historyData.length === 0 && <p className="text-sm text-muted-foreground">暂无历史记录</p>}
            {historyData.map((h, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-0",
                      h.action === "create" && "text-emerald-500 bg-emerald-500/10",
                      h.action === "update" && "text-viz-3 bg-viz-3/10",
                      h.action === "delete" && "text-destructive bg-destructive/10",
                    )}
                  >
                    {h.action === "create" ? "创建" : h.action === "update" ? "更新" : "删除"}
                  </Badge>
                  <span className="text-muted-foreground">v{h.version}</span>
                  <span className="text-muted-foreground ml-auto">{h.at}</span>
                </div>
                {h.after && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {String((h.after as { content?: string }).content ?? (h.before as { content?: string } | null)?.content ?? "")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}

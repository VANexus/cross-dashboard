"use client";

/**
 * AI 作图 · 项目式版本画布（ComfyUI 式，T4 v1）
 *
 * 核心心智：一张主图要反复迭代 → 每跑一次 = 一个「版本节点」，天然成树；
 * - 项目（root）：一次创作目标（如"保温杯主视觉"）；
 * - 版本（node）：每次生成的结果（prompt + 图 + 参数），主线/分支共享同一画布；
 * - 分支（branch_tag B1/B2…）：在某个旧版本上开新线继续演变，互不干扰；
 * - 内置提示词速选：常用风格/构图一句话追加，加速"快速生成"。
 *
 * 数据流：canvas API（root/branch/patch/list 落库）+ 现有 /generate 出图。
 * 诚实边界：v1 分支出图为「继承父版本 prompt 的变体重生成」，图生图/局部重绘后续接入。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { PageTransition } from "@/components/ui/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Image as ImageIcon, Plus, RefreshCw, Sparkles, GitBranch, Trash2, Save, Loader2, FolderKanban, GitFork,
} from "lucide-react";

export interface AiImagingClientProps {
  mainImages: unknown[];
  sceneImages: unknown[];
  storyboardFrames: unknown[];
}

export interface CanvasNode {
  id: string;
  title: string;
  rootId: string;
  parentId: string | null;
  branchTag: string;
  depth: number;
  status: string;
  prompt: string;
  negative: string;
  params: Record<string, unknown>;
  imageUrl: string;
  thumbnail: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectSummary { id: string; title: string; count: number }

/** 内置提示词速选：常用风格/构图一句话（点击追加到 prompt）。 */
const QUICK_PROMPTS = [
  "纯白背景 · 亚马逊主图规范 · 产品居中",
  "暖光室内实拍 · 桌面摆放 · 自然阴影",
  "轻奢高级感 · 深色背景 · 材质特写",
  "户外自然光 · 模特手持 · 场景实拍",
  "扁平 2D 插画 · 产品拟物化",
  "3D 渲染 · 玻璃质感 · 极简构图",
  "赛博霓虹 · 酸性视觉 · 高饱和",
  "日系简约 · 米白低饱和 · 留白",
];

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const j = (await res.json().catch(() => null)) as { success?: boolean; data?: T };
  if (!j?.success) throw new Error("读取失败");
  return j.data as T;
}
async function apiSend<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = (await res.json().catch(() => null)) as { success?: boolean; data?: T; error?: string };
  if (!j?.success) throw new Error(j?.error ?? "操作失败");
  return j.data as T;
}

/** 出图并回填版本节点。 */
async function generateAndPatch(node: { id: string }, prompt: string): Promise<string | null> {
  const gen = await apiSend<{ result?: Array<{ url?: string }> }>(
    "/api/workflows/ai-imaging/generate",
    "POST",
    { type: "main", prompt, count: 1 },
  );
  const url = gen?.result?.[0]?.url;
  if (url) {
    await apiSend("/api/workflows/ai-imaging/canvas", "PATCH", {
      id: node.id, status: "done", imageUrl: url, thumbnail: url, prompt,
    });
  }
  return url ?? null;
}

export function AiImagingClient(_props: AiImagingClientProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [rootId, setRootId] = useState<string | null>(null);
  const [tree, setTree] = useState<CanvasNode[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const [draftPrompt, setDraftPrompt] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = useMemo(() => tree.find((n) => n.id === currentId) ?? null, [tree, currentId]);

  const refreshProjects = useCallback(async (): Promise<ProjectSummary[]> => {
    try {
      const list = await apiGet<ProjectSummary[]>("/api/workflows/ai-imaging/canvas");
      setProjects(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  const loadTree = useCallback(async (rid: string) => {
    const nodes = await apiGet<CanvasNode[]>(`/api/workflows/ai-imaging/canvas?root=${rid}`);
    setTree(nodes);
    setCurrentId(nodes[0]?.id ?? null);
    const cur = nodes[0];
    if (cur) setDraftPrompt(cur.prompt);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await refreshProjects();
      if (!cancelled) setRootId((prev) => prev ?? list[0]?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, [refreshProjects]);
  useEffect(() => {
    if (!rootId) return;
    let cancelled = false;
    void (async () => {
      try {
        const nodes = await apiGet<CanvasNode[]>(`/api/workflows/ai-imaging/canvas?root=${rootId}`);
        if (cancelled) return;
        setTree(nodes);
        setCurrentId(nodes[0]?.id ?? null);
        if (nodes[0]) setDraftPrompt(nodes[0].prompt);
      } catch { /* 静默 */ }
    })();
    return () => { cancelled = true; };
  }, [rootId]);

  const pickProject = (rid: string) => { setRootId(rid); setError(null); };

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, CanvasNode[]>();
    for (const n of tree) {
      const k = n.parentId;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(n);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.branchTag.localeCompare(b.branchTag, undefined, { numeric: true }));
    return map;
  }, [tree]);

  const selectNode = (n: CanvasNode) => {
    setCurrentId(n.id);
    setDraftPrompt(n.prompt);
    setError(null);
  };

  /** 新建项目：创建 root 版本 → 出图 → 回填 → 进入画布 */
  const handleCreateProject = async () => {
    const prompt = newPrompt.trim();
    if (!prompt) { setError("请先输入产品/主题提示词"); return; }
    setCreating(true); setError(null);
    try {
      const node = await apiSend<CanvasNode>("/api/workflows/ai-imaging/canvas", "POST", {
        action: "root", title: prompt.slice(0, 24), prompt,
      });
      const url = await generateAndPatch(node, prompt);
      if (!url) setError("出图成功但未拿到图片地址，版本已登记（可后续重试）");
      setNewPrompt("");
      await refreshProjects();
      await loadTree(node.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally { setCreating(false); }
  };

  /** 基于当前版本再生成（= 开一条新分支变体，继承 prompt 可改） */
  const handleRegenerate = async () => {
    if (!current) return;
    const prompt = draftPrompt.trim() || current.prompt;
    if (!prompt) { setError("提示词不能为空"); return; }
    setBusy("regen"); setError(null);
    try {
      const child = await apiSend<CanvasNode>("/api/workflows/ai-imaging/canvas", "POST", {
        action: "branch", parentId: current.id, prompt,
      });
      const url = await generateAndPatch(child, prompt);
      if (!url) setError("出图成功但未拿到图片地址，版本已登记");
      await loadTree(child.rootId);
      await refreshProjects();
      setCurrentId(child.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally { setBusy(null); }
  };

  /** 仅保存当前版本 prompt（不动图，便于分支继承）。 */
  const handleSavePrompt = async () => {
    if (!current) return;
    setBusy("save"); setError(null);
    try {
      const node = await apiSend<CanvasNode>("/api/workflows/ai-imaging/canvas", "PATCH", {
        id: current.id, prompt: draftPrompt.trim() || current.prompt,
      });
      if (node) setDraftPrompt(node.prompt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally { setBusy(null); }
  };

  const handleDelete = async () => {
    if (!current) return;
    setBusy("delete"); setError(null);
    try {
      await apiSend(`/api/workflows/ai-imaging/canvas?id=${current.id}`, "DELETE");
      const nextRoot = current.rootId;
      if (tree.filter((n) => n.id === current.id).length === 1 && tree.length === 1) {
        // 只剩根节点被删 → 回项目列表
        setRootId(null);
        setTree([]);
        setCurrentId(null);
        await refreshProjects();
      } else {
        await loadTree(nextRoot);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败（存在子版本时不可删除）");
    } finally { setBusy(null); }
  };

  /** 递归渲染版本树（根 → 分支缩进）。 */
  const renderNode = (node: CanvasNode, depth: number): React.ReactNode => (
    <div key={node.id}>
      <button
        type="button"
        onClick={() => selectNode(node)}
        className={cn(
          "group flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors",
          currentId === node.id
            ? "border-primary/40 bg-primary/8"
            : "border-transparent hover:bg-muted/60",
        )}
        style={{ marginLeft: depth * 14 }}
      >
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border bg-muted/60">
          {node.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={node.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
            </div>
          )}
          {node.status === "draft" && (
            <span className="absolute bottom-0 left-0 right-0 bg-black/50 py-px text-center text-[8px] text-white">未出图</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-medium text-foreground">
              {node.branchTag === "root" ? "主线" : node.branchTag}
            </span>
            {node.parentId && (
              <GitFork className="h-3 w-3 shrink-0 text-primary/60" />
            )}
          </div>
          <p className="truncate text-[10px] text-muted-foreground">{node.prompt.slice(0, 32) || node.title}</p>
        </div>
        {node.status === "done" && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" title="已出图" />
        )}
      </button>
      {(childrenOf.get(node.id) ?? []).map((c) => renderNode(c, depth + 1))}
    </div>
  );

  return (
    <PageTransition className="space-y-4">
      <PageHeader
        title="AI 作图"
        description="项目式版本画布 — 反复迭代不丢线，分支并行出图，内置提示词快速起步"
        icon={<ImageIcon className="h-6 w-6 text-wf-imaging" />}
      />

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        {/* ── 左：项目列表 ── */}
        <div className="space-y-3">
          <Card>
            <CardContent className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium flex items-center gap-1.5">
                  <FolderKanban className="h-3.5 w-3.5 text-primary" /> 创作项目
                </span>
                <Badge variant="secondary" className="text-caption">{projects.length}</Badge>
              </div>
              <div className="space-y-1">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickProject(p.id)}
                    className={cn(
                      "block w-full truncate rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                      rootId === p.id ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted/60",
                    )}
                  >
                    {p.title || "未命名项目"}
                    <span className="ml-1 text-[10px] text-muted-foreground/60">· {p.count}版</span>
                  </button>
                ))}
                {projects.length === 0 && (
                  <p className="px-1 text-[11px] text-muted-foreground">还没有项目，右侧新建一个</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── 右：画布 ── */}
        <div className="space-y-4">
          {/* 新建项目 */}
          <Card className="border-dashed">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  className="h-9"
                  placeholder="产品 / 主题，如：316 车载保温杯主视觉"
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !creating && handleCreateProject()}
                />
                <Button className="h-9 gap-1.5" onClick={handleCreateProject} disabled={creating || !newPrompt.trim()}>
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  新建项目并出图
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setNewPrompt((v) => (v ? `${v}，${q}` : q))}
                    className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {q}
                  </button>
                ))}
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </CardContent>
          </Card>

          {rootId && tree.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-[280px_1fr]">
              {/* 版本树 */}
              <Card>
                <CardContent className="p-3">
                  <div className="mb-2 text-xs font-medium">版本树（{tree.length} 个）</div>
                  <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1 scrollbar-thin">
                    {(childrenOf.get(null) ?? []).map((root) => renderNode(root, 0))}
                  </div>
                </CardContent>
              </Card>

              {/* 当前版本 */}
              {current && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="relative aspect-square overflow-hidden rounded-xl border bg-muted/40">
                        {current.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={current.imageUrl} alt={current.prompt} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/40">
                            <Sparkles className="h-8 w-8" />
                            <p className="text-xs">该版本待出图</p>
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 flex gap-1.5">
                          <Badge variant="secondary" className="text-caption">
                            {current.branchTag === "root" ? "主线" : `分支 ${current.branchTag}`} · v{current.depth + 1}
                          </Badge>
                          {current.status === "done" ? (
                            <Badge className="text-caption bg-success/90">已出图</Badge>
                          ) : (
                            <Badge variant="warning" className="text-caption">未出图</Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-caption">更新于 {new Date(current.updatedAt).toLocaleString("zh-CN")}</Badge>
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-caption text-destructive hover:bg-destructive/10" onClick={handleDelete} disabled={busy === "delete"}>
                            {busy === "delete" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            删除
                          </Button>
                        </div>
                        <div>
                          <label className="text-caption text-muted-foreground">提示词</label>
                          <textarea
                            value={draftPrompt}
                            onChange={(e) => setDraftPrompt(e.target.value)}
                            rows={5}
                            className="mt-1 w-full resize-y rounded-lg border bg-background/60 p-2 font-mono text-[11px] leading-5 outline-none focus:border-primary/40"
                          />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {QUICK_PROMPTS.slice(0, 6).map((q) => (
                            <button
                              key={q}
                              type="button"
                              onClick={() => setDraftPrompt((v) => (v ? `${v}，${q}` : q))}
                              className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-primary"
                            >
                              +{q.slice(0, 10)}…
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                      <Button size="sm" className="gap-1.5" onClick={handleRegenerate} disabled={busy !== null}>
                        {busy === "regen" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        基于此版本再生成（新分支）
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={handleSavePrompt} disabled={busy !== null}>
                        {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        保存提示词
                      </Button>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {current.parentId ? `源自 ${current.branchTag === "B1" ? "主线" : "上一分支"}` : "根版本"} · 分支继承父版本提示词
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : rootId && tree.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">该项目暂无版本，请在右侧新建</CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                选择一个创作项目，或在上方 {`「新建项目并出图」`} 开始 —— 每次生成都会成为树上的一个版本，随时可在旧版本上开新分支。
                <GitBranch className="mx-auto mt-3 h-8 w-8 text-muted-foreground/30" />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
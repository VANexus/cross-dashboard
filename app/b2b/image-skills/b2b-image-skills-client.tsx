"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Palette, Loader2, XCircle, ScanSearch, Save, Wand2, Images, Sparkles, AlertTriangle, ArrowUpRight, ImageUp,
} from "lucide-react";
import { B2BNav } from "../b2b-nav";
import { JourneyBar } from "@/components/journey/journey-bar";
import { useAgentPage } from "@/lib/agent/page-context";
import type { UIActionDef } from "@/lib/agent/ui-actions";
import {
  reversePrompt, createImageSkill, generateWithSkill, useImageSkills,
} from "@/hooks/use-b2b";
import type { ImageSkill, ReversePromptResult } from "@/lib/shared/types";

export function B2BImageSkillsClient({ initialSkills }: { initialSkills: ImageSkill[] }) {
  const [coverUrl, setCoverUrl] = useState("");
  const [hint, setHint] = useState("");
  const [reversed, setReversed] = useState<ReversePromptResult | null>(null);
  const [skillName, setSkillName] = useState("");

  const [genSkillId, setGenSkillId] = useState<string | null>(null);
  const [genPrompt, setGenPrompt] = useState("");
  const [genImages, setGenImages] = useState<Record<string, { index: number; url: string }[]>>({});

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: liveSkills, refetch: refetchSkills } = useImageSkills();
  const skills = liveSkills ?? initialSkills;

  const run = useCallback(async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(null);
    }
  }, []);

  const fileRef = useRef<HTMLInputElement>(null);

  /** 上传本地图片到集群 MinIO，得到 7 天预签名 URL（URL 仅作为素材源，用户直接给图片） */
  const uploadCover = async (file: File) => {
    if (!/^image\/(jpeg|png|webp|avif|gif)$/.test(file.type)) {
      setError("仅支持 JPG/PNG/WEBP/AVIF/GIF 图片");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("图片需小于 20MB");
      return;
    }
    setBusy("upload");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/b2b/image-skills/upload", { method: "POST", body: fd });
      const j = (await res.json().catch(() => null)) as { success?: boolean; data?: { url: string }; error?: string };
      if (!res.ok || !j?.success || !j.data?.url) throw new Error(j?.error ?? "上传失败");
      setCoverUrl(j.data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setBusy(null);
    }
  };

  const handleReverse = () => {
    if (!coverUrl.trim()) {
      setError("请先上传封面图片，或粘贴图片链接");
      return;
    }
    void run("reverse", async () => {
      setReversed(await reversePrompt({ imageUrl: coverUrl.trim(), hint: hint.trim() || undefined }));
    });
  };

  const handleCreate = () => {
    if (!reversed) {
      setError("请先反推提示词");
      return;
    }
    if (!skillName.trim()) {
      setError("请给 Skill 起个名字");
      return;
    }
    void run("create", async () => {
      await createImageSkill({
        name: skillName.trim(),
        coverUrl: coverUrl.trim(),
        reversedPrompt: reversed.prompt,
        styleTags: reversed.styleTags,
        aspectRatio: "1:1",
      });
      setReversed(null);
      setSkillName("");
      setCoverUrl("");
      setHint("");
      void refetchSkills();
    });
  };

  const handleGenerate = (skill: ImageSkill) => {
    void run(`gen-${skill.id}`, async () => {
      const images = await generateWithSkill(skill.id, genPrompt.trim() || undefined);
      setGenImages((prev) => ({ ...prev, [skill.id]: images }));
    });
  };

  // 「UI 即工具」：反推提示词/固化 Skill/按 Skill 出图均为本页可逆 L1 动作
  const agentActions: UIActionDef[] = [
    {
      id: "reverseCoverPrompt",
      description: "对一张 ROI 好的封面图 URL 反推生图提示词与风格标签（结果展示在页面上）",
      riskLevel: "L1",
      schema: z.object({
        imageUrl: z.string().url().describe("封面图 URL"),
        hint: z.string().optional().describe("补充说明"),
      }),
      execute: async (p) => {
        const url = String(p.imageUrl);
        const hint = typeof p.hint === "string" ? p.hint : "";
        setCoverUrl(url);
        setHint(hint);
        const r: ReversePromptResult = await reversePrompt({ imageUrl: url, hint: hint || undefined });
        setReversed(r);
        return `已反推提示词（风格标签：${r.styleTags.join("、") || "无"}），可继续用 createSkillFromCover 固化成 Skill`;
      },
    },
    {
      id: "createSkillFromCover",
      description: "把当前已反推的提示词固化为一个团队生图 Skill（需先 reverseCoverPrompt）",
      riskLevel: "L1",
      schema: z.object({ name: z.string().min(1).describe("Skill 名称，如 欧美ins暖调场景风") }),
      execute: async (p) => {
        if (!reversed) throw new Error("尚未反推提示词，请先调用 reverseCoverPrompt");
        const name = String(p.name).trim();
        await createImageSkill({
          name,
          coverUrl: coverUrl.trim(),
          reversedPrompt: reversed.prompt,
          styleTags: reversed.styleTags,
          aspectRatio: "1:1",
        });
        setReversed(null);
        setSkillName("");
        void refetchSkills();
        return `已固化生图 Skill「${name}」并入库`;
      },
    },
    {
      id: "generateWithSkillAction",
      description: "用指定生图 Skill（按 id 或名称匹配）+ 附加描述批量出图，结果展示在该 Skill 卡片内",
      riskLevel: "L1",
      schema: z.object({
        skillId: z.string().min(1).describe("Skill id；也可传 Skill 名称做模糊匹配"),
        prompt: z.string().optional().describe("附加画面描述"),
      }),
      execute: async (p) => {
        const key = String(p.skillId);
        const skill = skills.find((s) => s.id === key) ?? skills.find((s) => s.name.includes(key));
        if (!skill) throw new Error(`未找到 Skill：${key}（当前 ${skills.length} 个）`);
        const prompt = typeof p.prompt === "string" ? p.prompt : "";
        setGenSkillId(skill.id);
        setGenPrompt(prompt);
        const images = await generateWithSkill(skill.id, prompt || undefined);
        setGenImages((prev) => ({ ...prev, [skill.id]: images }));
        return `已用 Skill「${skill.name}」生成 ${images.length} 张图`;
      },
    },
  ];

  useAgentPage({
    title: "生图 Skill 库（铺货素材）",
    snapshot: () => {
      const segs = [`生图 Skill ${skills.length} 个`, reversed ? "已反推提示词待固化" : "未反推"];
      const genCount = Object.values(genImages).reduce((n, arr) => n + arr.length, 0);
      if (genCount) segs.push(`本页已出图 ${genCount} 张`);
      return segs.join(" · ") + " · 真实出图走 AllIn-API，未配置 Key 会明确报错";
    },
    state: () => ({
      skillCount: skills.length,
      skillNames: skills.map((s) => s.name),
      hasReversed: Boolean(reversed),
      busy,
    }),
    actions: agentActions,
  });

  return (
    <div>
      <JourneyBar />
      <B2BNav />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1 flex flex-wrap items-center gap-2">
            <span>{error}</span>
            {/ALLIN|key|api|mock|密钥/i.test(error) && (
              <Link
                href="/settings/b2b"
                className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-background/70 px-2 py-0.5 text-caption font-medium text-destructive hover:bg-background transition-colors"
              >
                <AlertTriangle className="h-3 w-3" /> 检查生图 API 配置
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 提示词反推 → 固化 Skill */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ScanSearch className="h-4 w-4 text-primary" /> 上传 ROI 好的封面 · 反推提示词 · 固化成 Skill
          </CardTitle>
          <CardDescription>上传本地爆款风格封面图（或粘贴链接），AI 反推提示词后入库，形成团队生图 Skill 库</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-2"
                onClick={() => fileRef.current?.click()}
                disabled={busy !== null}
              >
                {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
                {coverUrl ? "更换图片" : "上传封面图片"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadCover(f);
                  e.target.value = "";
                }}
              />
              <Input
                className="flex-1"
                placeholder="或粘贴图片链接（https://…）"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
              />
              <Input
                className="sm:w-48"
                placeholder="补充说明（可选）"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
              />
              <Button size="sm" variant="outline" onClick={handleReverse} disabled={busy !== null} className="shrink-0">
                {busy === "reverse" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
                反推提示词
              </Button>
            </div>

            {/* 即时预览：上传/粘贴后立即可见 */}
            {coverUrl.trim() && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl.trim()}
                alt="封面"
                className="h-28 max-w-40 rounded-lg border border-border object-cover"
              />
            )}
          </div>

          {reversed && (
            <div className="mt-4 rounded-xl border p-4 space-y-3">
              <div className="flex gap-3">
                {coverUrl.trim() && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverUrl.trim()}
                    alt="封面"
                    className="h-20 w-20 shrink-0 rounded-lg border object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">反推提示词</p>
                  <p className="mt-1 text-xs leading-5 whitespace-pre-wrap">{reversed.prompt}</p>
                  {reversed.negativePrompt && (
                    <p className="mt-1.5 text-caption leading-4 text-muted-foreground">
                      负向：{reversed.negativePrompt}
                    </p>
                  )}
                  {reversed.styleTags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {reversed.styleTags.map((t) => (
                        <Badge key={t} variant="secondary">{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Skill 名称，如：欧美ins暖调场景风"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <Button size="sm" onClick={handleCreate} disabled={busy !== null} className="shrink-0">
                  {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  固化成 Skill
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skill 库 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" /> 生图 Skill 库
              </CardTitle>
              <CardDescription className="hidden sm:block">固化常用风格模板 · 按风格一键出图</CardDescription>
            </div>
            <Badge variant="secondary">{skills.length} 个</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {skills.length === 0 ? (
            <div className="py-6 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <p className="text-sm text-muted-foreground">
                暂无 Skill。上传一张 ROI 好的封面图（真实出图走 AllIn-API gpt-image-2），反推提示词后固化，即可沉淀团队第一个生图风格：
              </p>
              <Link
                href="/settings/b2b"
                className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                <Sparkles className="h-3 w-3" />
                先配置生图 API Key
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {skills.map((s) => (
                <div key={s.id} className="rounded-xl border overflow-hidden transition-colors hover:border-primary/40">
                  {s.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.coverUrl} alt={s.name} className="aspect-[4/3] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted">
                      <Palette className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{s.name}</span>
                      <span className="shrink-0 font-mono text-caption text-muted-foreground">
                        {s.aspectRatio} · {s.usageCount} 次
                      </span>
                    </div>
                    {s.styleTags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.styleTags.map((t) => (
                          <Badge key={t} variant="secondary" className="text-tiny">{t}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1.5">
                      <Input
                        className="h-8 text-xs"
                        placeholder="附加画面描述（可选）"
                        value={genSkillId === s.id ? genPrompt : ""}
                        onFocus={() => setGenSkillId(s.id)}
                        onChange={(e) => {
                          setGenSkillId(s.id);
                          setGenPrompt(e.target.value);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && handleGenerate(s)}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0 px-2.5"
                        onClick={() => handleGenerate(s)}
                        disabled={busy !== null}
                      >
                        {busy === `gen-${s.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                        出图
                      </Button>
                    </div>
                    {genImages[s.id] && (
                      <div className="grid grid-cols-2 gap-2">
                        {genImages[s.id].map((img) => (
                          <a
                            key={img.index}
                            href={img.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block aspect-square overflow-hidden rounded-lg border bg-muted"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.url} alt={`生成图 ${img.index}`} className="h-full w-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {skills.length > 0 && (
            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Images className="h-3.5 w-3.5" /> 生成结果保留在页面内，可点击查看原图；Skill 使用次数自动累计。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

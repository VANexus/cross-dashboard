"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Palette, Loader2, XCircle, ScanSearch, Save, Wand2, Images, Sparkles, AlertTriangle, ArrowUpRight,
} from "lucide-react";
import { B2BNav } from "../b2b-nav";
import {
  reversePrompt, createImageSkill, generateWithSkill, useImageSkills,
} from "@/hooks/use-b2b";
import type { ImageSkill, ReversePromptResult } from "@/lib/types";

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

  const handleReverse = () => {
    if (!coverUrl.trim()) {
      setError("请先粘贴效果好的封面图 URL");
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

  return (
    <div className="mx-auto max-w-5xl px-6 py-7">
      <B2BNav />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1 flex flex-wrap items-center gap-2">
            <span>{error}</span>
            {/ALLIN|key|api|mock|密钥/i.test(error) && (
              <Link
                href="/settings/b2b"
                className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-white/70 px-2 py-0.5 text-[11px] font-medium text-destructive hover:bg-white transition-colors"
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
          <CardDescription>粘贴过往效果好的风格封面图 URL，AI 反推提示词后入库，形成团队生图 Skill 库</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="封面图 URL，如 https://…（爆款风格封面）"
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
                    <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
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
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        {s.aspectRatio} · {s.usageCount} 次
                      </span>
                    </div>
                    {s.styleTags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.styleTags.map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
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

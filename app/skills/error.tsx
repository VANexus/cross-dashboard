"use client";

export default function SkillsError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 py-16">
      <h2 className="font-heading text-lg font-semibold">能力中心加载失败</h2>
      <p className="text-sm text-muted-foreground">技能发现服务暂不可用，请稍后重试。</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        重试
      </button>
    </div>
  );
}
